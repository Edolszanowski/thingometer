import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { db, schema } from "@/lib/db"
import { eq, inArray } from "drizzle-orm"

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const searchParams = request.nextUrl.searchParams
    const judgeId = searchParams.get("judgeId")

    // Get judge's eventId if judgeId is provided - judges should see floats from their assigned event
    let judgeEventId: number | null = null
    if (judgeId) {
      try {
        const judgeIdNum = parseInt(judgeId, 10)
        if (!isNaN(judgeIdNum)) {
          const { data: judgeRow, error: judgeError } = await supabase
            .from("judges")
            .select("event_id")
            .eq("id", judgeIdNum)
            .single()

          if (!judgeError && judgeRow?.event_id) {
            judgeEventId = judgeRow.event_id
            // console.log(`[API/Floats] Judge ${judgeIdNum} is assigned to event ${judgeEventId}`)
          }
        }
      } catch (error: any) {
        console.error("Error fetching judge event:", error)
      }
    }

    // Get cityId from cookie (if available)
    let cityId: number | null = null
    try {
      // This is a server-side API route, so we can't use cookies() directly
      // City filtering will be done through event filtering
      const cityIdParam = searchParams.get("cityId")
      cityId = cityIdParam ? parseInt(cityIdParam, 10) : null
    } catch (error) {
      // Ignore
    }

    // If judge doesn't have eventId, fall back to active event (filtered by city if provided)
    if (!judgeEventId) {
      try {
        let query = supabase
          .from("events")
          .select("id,city_id")
          .eq("active", true)
          .limit(1)

        if (cityId && cityId !== 0) {
          query = query.eq("city_id", cityId)
        }

        let { data: activeEvents, error: activeEventsError } = await query

        // If city_id column doesn't exist, retry without city filter.
        if (activeEventsError && cityId && cityId !== 0) {
          const msg = String((activeEventsError as any)?.message || "")
          if (msg.includes("does not exist") || msg.includes("city_id")) {
            const retry = await supabase
              .from("events")
              .select("id")
              .eq("active", true)
              .limit(1)
            activeEvents = retry.data as any
            activeEventsError = retry.error as any
          }
        }

        if (activeEventsError) {
          throw activeEventsError
        }

        if (activeEvents && activeEvents.length > 0) {
          judgeEventId = activeEvents[0].id
          // console.log(`[API/Floats] No judge eventId, using active event ${judgeEventId}`)
        }
      } catch (error: any) {
        // If events table doesn't exist yet, that's okay - just continue without filtering
        if (error?.code !== "42P01" && !error?.message?.includes("does not exist")) {
          console.error("Error fetching active event:", error)
        }
      }
    } else if (cityId && cityId !== 0) {
      // Verify event belongs to city
      try {
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("city_id")
          .eq("id", judgeEventId)
          .single()

        if (eventError) {
          throw eventError
        }

        if (event && typeof event.city_id === "number" && event.city_id !== cityId) {
          return NextResponse.json([])
        }
      } catch (error: any) {
        // If city_id column doesn't exist, ignore filter
        const msg = String(error?.message || "")
        if (error?.code !== "42703" && !msg.includes("does not exist")) {
          throw error
        }
      }
    }

    // Get all approved floats - CRITICAL: Order by floatNumber to match coordinator's order exactly
    // Use raw SQL ordering to ensure nulls are handled correctly
    const floatsSelect =
      "id,event_id,float_number,organization,entry_name,first_name,last_name,title,phone,email,comments,entry_length,float_description,type_of_entry,has_music,approved,submitted_at,created_at,metadata"

    let floatsQuery = supabase.from("floats").select(floatsSelect).eq("approved", true)

    if (judgeEventId !== null) {
      floatsQuery = floatsQuery.eq("event_id", judgeEventId)
    }

    let { data: floatsData, error: floatsError } = await floatsQuery

    // If event_id column doesn't exist yet, retry without event filter (backward compatibility).
    if (floatsError && judgeEventId !== null) {
      const msg = String((floatsError as any)?.message || "")
      if (floatsError.code === "42703" || (msg.includes("column") && msg.includes("does not exist"))) {
        console.log("eventId column does not exist yet, filtering by approved only")
        const retry = await supabase.from("floats").select(floatsSelect).eq("approved", true)
        floatsData = retry.data as any
        floatsError = retry.error as any
      }
    }

    if (floatsError) {
      throw floatsError
    }

    const floats = (floatsData || []).map((f: any) => ({
      id: f.id,
      eventId: f.event_id ?? null,
      floatNumber: f.float_number ?? null,
      organization: f.organization,
      entryName: f.entry_name ?? null,
      firstName: f.first_name ?? null,
      lastName: f.last_name ?? null,
      title: f.title ?? null,
      phone: f.phone ?? null,
      email: f.email ?? null,
      comments: f.comments ?? null,
      entryLength: f.entry_length ?? null,
      floatDescription: f.float_description ?? null,
      typeOfEntry: f.type_of_entry ?? null,
      hasMusic: Boolean(f.has_music),
      approved: Boolean(f.approved),
      submittedAt: f.submitted_at ?? null,
      createdAt: f.created_at ?? null,
      metadata: (f.metadata ?? {}) as Record<string, unknown>,
    }))
    
    // Sort floats: non-null floatNumbers first (ascending), then nulls
    const sortedFloats = [...floats].sort((a, b) => {
      // If both have floatNumbers, sort by floatNumber
      if (a.floatNumber !== null && b.floatNumber !== null) {
        return a.floatNumber - b.floatNumber
      }
      // If only a has floatNumber, a comes first
      if (a.floatNumber !== null && b.floatNumber === null) {
        return -1
      }
      // If only b has floatNumber, b comes first
      if (a.floatNumber === null && b.floatNumber !== null) {
        return 1
      }
      // Both null - sort by id for consistency
      return a.id - b.id
    })
    
    // console.log(`[API/Floats] Found ${sortedFloats.length} floats matching criteria (approved=true${judgeEventId ? `, eventId=${judgeEventId}` : ''})`)
    // if (sortedFloats.length > 0) {
    //   console.log(`[API/Floats] Float order: ${sortedFloats.slice(0, 5).map((f) => `#${f.floatNumber ?? 'null'}`).join(', ')}`)
    // }

    // If judgeId is provided, include scores for that judge
    if (judgeId) {
      const judgeIdNum = parseInt(judgeId, 10)
      if (!isNaN(judgeIdNum)) {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:207',message:'Querying scores for judge using Drizzle',data:{judgeIdNum:judgeIdNum},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Use Drizzle ORM instead of Supabase client for consistency with individual float page
        const scoresData = await db
          .select()
          .from(schema.scores)
          .where(eq(schema.scores.judgeId, judgeIdNum))

        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:212',message:'Drizzle scores query result',data:{scoresFound:scoresData?.length??0,sampleScores:scoresData?.slice(0,3).map(s=>({id:s.id,floatId:s.floatId,judgeId:s.judgeId}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        const scores = (scoresData || []).map((s: typeof schema.scores.$inferSelect) => ({
          id: s.id,
          eventId: s.eventId ?? null,
          judgeId: s.judgeId,
          floatId: s.floatId,
          lighting: s.lighting ?? null,
          theme: s.theme ?? null,
          traditions: s.traditions ?? null,
          spirit: s.spirit ?? null,
          music: s.music ?? null,
          total: s.total ?? 0,
          createdAt: s.createdAt ?? null,
          updatedAt: s.updatedAt ?? null,
        }))

        console.log(`[API/Floats] Found ${scores.length} scores for judge ${judgeIdNum}`)
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:234',message:'Scores mapped and counted',data:{scoresCount:scores.length,sampleScores:scores.slice(0,3).map(s=>({id:s.id,floatId:s.floatId,judgeId:s.judgeId}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (scores.length > 0) {
          console.log(`[API/Floats] Sample scores:`, scores.slice(0, 3).map(s => ({ scoreId: s.id, floatId: s.floatId, total: s.total })))
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:238',message:'WARNING: No scores found',data:{judgeIdNum:judgeIdNum,rawDataLength:scoresData?.length??0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }

        type ScoreType = (typeof scores)[number]
        const scoresMap = new Map<number, ScoreType>(scores.map((score: ScoreType) => [score.floatId, score]))
        
        // Get all score items for these scores
        const scoreIds = scores.map((s: { id: number }) => s.id)
        console.log(`[API/Floats] Processing ${scoreIds.length} scores for judge ${judgeIdNum}`)
        let scoreItemsMap = new Map<number, Array<{ categoryName: string; value: number | null }>>()
        
        if (scoreIds.length > 0) {
          try {
            // Use Drizzle ORM like PMS for reliable joins
            console.log(`[API/Floats] Querying score_items for scoreIds:`, scoreIds.slice(0, 5))
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:243',message:'Querying score_items with Drizzle',data:{scoreIds:scoreIds.slice(0,5),totalScoreIds:scoreIds.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            const allItems = await db
              .select({
                scoreId: schema.scoreItems.scoreId,
                value: schema.scoreItems.value,
                categoryName: schema.eventCategories.categoryName,
              })
              .from(schema.scoreItems)
              .innerJoin(schema.eventCategories, eq(schema.scoreItems.eventCategoryId, schema.eventCategories.id))
              .where(inArray(schema.scoreItems.scoreId, scoreIds))
            
            // Group items by scoreId
            console.log(`[API/Floats] Loaded ${allItems.length} score items for ${scoreIds.length} scores`)
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:256',message:'Drizzle query result',data:{itemsFound:allItems.length,expectedScores:scoreIds.length,sampleItems:allItems.slice(0,3).map(i=>({scoreId:i.scoreId,category:i.categoryName,value:i.value}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            if (allItems.length === 0) {
              console.warn(`[API/Floats] WARNING: No score items found for ${scoreIds.length} scores!`)
              // #region agent log
              fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:260',message:'WARNING: No score items found',data:{scoreIds:scoreIds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
            } else {
              console.log(`[API/Floats] Sample score items:`, allItems.slice(0, 5).map(i => ({ scoreId: i.scoreId, category: i.categoryName, value: i.value })))
            }
            allItems.forEach((item: { scoreId: number; value: number | null; categoryName: string }) => {
              const existing = scoreItemsMap.get(item.scoreId) || []
              existing.push({ categoryName: item.categoryName, value: item.value })
              scoreItemsMap.set(item.scoreId, existing)
            })
            console.log(`[API/Floats] Score items map populated with ${scoreItemsMap.size} entries`)
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:270',message:'Score items map populated',data:{mapSize:scoreItemsMap.size,mapKeys:Array.from(scoreItemsMap.keys()).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
          } catch (error: any) {
            // If score_items table doesn't exist yet, that's okay - use legacy logic
            console.error(`[API/Floats] ERROR fetching score items:`, error)
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:275',message:'ERROR in Drizzle query',data:{error:error?.message,code:error?.code,stack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            if (error?.code !== "42P01" && !error?.message?.includes("does not exist")) {
              console.error("Error fetching score items:", error)
            }
          }
        } else {
          console.log(`[API/Floats] No scores found for judge ${judgeIdNum}, no score items to load`)
        }

        const response = NextResponse.json(
          await Promise.all(sortedFloats.map(async (float) => {
            // PRIORITY 1: Check if organization is missing or empty - should show grey
            // This check MUST happen FIRST, before any score status checks
            const hasOrganization = float.organization != null && 
                                   String(float.organization).trim() !== '' && 
                                   String(float.organization).trim().toLowerCase() !== 'null'
            
            // If no organization, return special status for grey color (PRIORITY OVER ALL OTHER STATUSES)
            if (!hasOrganization) {
              // console.log(`[API/Floats] Float ${float.floatNumber ?? 'N/A'} has no organization (value: "${float.organization}") - returning no_organization status`)
              return {
                ...float,
                score: null,
                scored: false,
                scoreStatus: 'no_organization' as const,
              }
            }
            
            const score = scoresMap.get(float.id)
            
            if (!score) {
              // No score record exists - total is effectively 0, so not_started (blue)
              return {
                ...float,
                score: null,
                scored: false,
                scoreStatus: 'not_started' as const,
              }
            }
            
            // Get event categories for this float's event
            const eventId = float.eventId
            if (!eventId) {
              return {
                ...float,
                score: score || null,
                scored: true,
                scoreStatus: 'incomplete' as const,
              }
            }
            
            let categories: Array<{ categoryName: string; required: boolean; hasNoneOption: boolean }> = []
            try {
              const { data: eventCategories, error: categoriesError } = await supabase
                .from("event_categories")
                .select("category_name,required,has_none_option")
                .eq("event_id", eventId)
                .order("display_order", { ascending: true })

              if (categoriesError) {
                throw categoriesError
              }

              categories = (eventCategories || []).map((cat: any) => ({
                categoryName: cat.category_name,
                required: Boolean(cat.required),
                hasNoneOption: Boolean(cat.has_none_option),
              }))
            } catch (error: any) {
              console.error(`[API/Floats] Error fetching categories for event ${eventId}:`, error)
              return {
                ...float,
                score: score || null,
                scored: true,
                scoreStatus: 'incomplete' as const,
              }
            }
            
            if (categories.length === 0) {
              return {
                ...float,
                score: score || null,
                scored: true,
                scoreStatus: 'incomplete' as const,
              }
            }
            
            // Get score items for this score
            const scoreItems = scoreItemsMap.get(score.id) || []
            console.log(`[API/Floats] Float ${float.floatNumber}: ScoreID=${score.id}, Items in map: ${scoreItems.length}`, scoreItems.length > 0 ? `Sample: ${scoreItems.slice(0, 2).map(i => `${i.categoryName}=${i.value}`).join(', ')}` : '')
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:352',message:'Getting score items for float',data:{floatNumber:float.floatNumber,scoreId:score.id,itemsInMap:scoreItems.length,scoreItems:scoreItems.slice(0,3).map(i=>({category:i.categoryName,value:i.value}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            const scoreItemsByCategory = new Map(scoreItems.map((item: { categoryName: string; value: number | null }) => [item.categoryName, item.value]))
            
            // CRITICAL: If no score items exist at all, check if we need to query them directly
            // Sometimes the scoreItemsMap might not have the items due to timing issues
            if (scoreItems.length === 0) {
              // console.log(`[API/Floats] Float ${float.floatNumber ?? 'N/A'}: No score items in map for score ${score.id}, querying directly...`)
              
              // Try to fetch score items directly from database using Drizzle
              try {
                const directItems = await db
                  .select({
                    categoryName: schema.eventCategories.categoryName,
                    value: schema.scoreItems.value,
                  })
                  .from(schema.scoreItems)
                  .innerJoin(schema.eventCategories, eq(schema.scoreItems.eventCategoryId, schema.eventCategories.id))
                  .where(eq(schema.scoreItems.scoreId, score.id))
                
                if (directItems.length > 0) {
                  console.log(`[API/Floats] Float ${float.floatNumber ?? 'N/A'}: Found ${directItems.length} score items via direct query:`, directItems.slice(0, 3).map(i => `${i.categoryName}=${i.value}`).join(', '))
                  directItems.forEach((item: { categoryName: string; value: number | null }) => {
                    scoreItemsByCategory.set(item.categoryName, item.value)
                  })
                } else {
                  console.log(`[API/Floats] Float ${float.floatNumber ?? 'N/A'}: Score record exists (ID: ${score.id}) but NO score items found in database - marking as not_started`)
                  return {
                    ...float,
                    score: score || null,
                    scored: false,
                    scoreStatus: 'not_started' as const,
                  }
                }
              } catch (error: any) {
                console.error(`[API/Floats] Error querying score items directly:`, error)
                // Continue with empty map - will be marked as not_started
              }
            }
            
            // Calculate total from score items
            let total = 0
            const categoryValues: Record<string, number | null> = {}
            
            for (const category of categories) {
              const value = scoreItemsByCategory.get(category.categoryName) ?? null
              categoryValues[category.categoryName] = value
              
              // Add to total (null treated as 0)
              total += value ?? 0
            }
            
            // Determine score status
            // - not_started: No score items exist OR all values are NULL
            // - incomplete: Some required categories are NULL or missing
            // - complete: All required categories have non-NULL values (0 or >0 both count as filled)
            
            // Check if all values are NULL (not started)
            const allValues = categories.map(cat => scoreItemsByCategory.get(cat.categoryName) ?? null)
            const allNull = allValues.every(v => v === null)
            
            // Check if all required categories are filled
            // A category is "filled" if it has a non-NULL value (0 or >0 both count)
            // CRITICAL: Match the review page logic exactly - check for null OR undefined
            let allRequiredFilled = true
            const requiredCategories = categories.filter(c => c.required)
            
            for (const category of requiredCategories) {
              const value = scoreItemsByCategory.get(category.categoryName)
              
              // Required categories must have a non-NULL, non-undefined value
              // This matches the review page logic: if (value === null || value === undefined)
              if (value === null || value === undefined) {
                // console.log(`[API/Floats] Float ${float.floatNumber ?? 'N/A'}: Required category '${category.categoryName}' is missing (null/undefined)`)
                allRequiredFilled = false
                break
              }
            }
            
            // Check if all required categories are scored as 0 (no-show indicator)
            const allRequiredZero = requiredCategories.every(category => {
              const value = scoreItemsByCategory.get(category.categoryName)
              return value === 0
            })
            
            let scoreStatus: 'not_started' | 'incomplete' | 'complete' | 'no_show' | 'no_organization'
            
            if (allNull) {
              // All values are NULL - not started (blue)
              scoreStatus = 'not_started'
            } else if (allRequiredFilled && allRequiredZero) {
              // All required categories are 0 - this float didn't show up (no-show - gray)
              scoreStatus = 'no_show'
            } else if (allRequiredFilled) {
              // All required categories have non-NULL values (0 or >0 both count) - complete (green)
              // FIXED: Removed total > 0 requirement - if all required categories are filled, it's complete
              scoreStatus = 'complete'
            } else {
              // Not all required categories filled - incomplete (red)
              scoreStatus = 'incomplete'
            }
            
            // Debug logging - ENABLED for testing - Log for ALL floats
            const valuesStr = categories.map(cat => {
              const val = scoreItemsByCategory.get(cat.categoryName) ?? null
              const isRequired = categories.find(c => c.categoryName === cat.categoryName)?.required ?? false
              const hasItem = scoreItemsByCategory.has(cat.categoryName)
              return `${cat.categoryName}${isRequired ? '*' : ''}=${val === null ? 'NULL' : val}${hasItem ? '' : '(no item)'}`
            }).join(', ')
            const requiredCategoryNames = categories.filter(c => c.required).map(c => c.categoryName)
            const filledRequired = requiredCategoryNames.filter(cat => {
              const val = scoreItemsByCategory.get(cat) ?? null
              return val !== null
            })
            console.log(`[API/Floats] Float ${float.floatNumber}: ScoreID=${score.id} | Items=${scoreItems.length} | ${valuesStr} | Total=${total} | Required: [${requiredCategoryNames.join(', ')}] | Filled: [${filledRequired.join(', ')}] | AllRequiredFilled=${allRequiredFilled} | AllNull=${allNull} | Status=${scoreStatus}`)
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/floats/route.ts:463',message:'Status calculation result',data:{floatNumber:float.floatNumber,scoreId:score.id,itemsFound:scoreItems.length,categoriesFound:categories.length,requiredCategories:requiredCategories.map(c=>c.categoryName),filledRequired:filledRequired,allRequiredFilled:allRequiredFilled,allNull:allNull,scoreStatus:scoreStatus,valuesByCategory:Object.fromEntries(scoreItemsByCategory)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            return {
              ...float,
              score: score || null,
              scored: scoresMap.has(float.id),
              scoreStatus,
            }
          }))
        )
        // Add no-cache headers to ensure fresh data
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        return response
      }
    }

    const response = NextResponse.json(sortedFloats)
    // Add no-cache headers to ensure fresh data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    console.error("Error fetching floats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

