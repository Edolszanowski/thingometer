import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, inArray } from "drizzle-orm"
import { getEventCategories, getScoreItems } from "@/lib/scores"

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const judgeId = searchParams.get("judgeId")

    // Get judge's eventId if judgeId is provided - judges should see floats from their assigned event
    let judgeEventId: number | null = null
    if (judgeId) {
      try {
        const judgeIdNum = parseInt(judgeId, 10)
        if (!isNaN(judgeIdNum)) {
          const judges = await db
            .select()
            .from(schema.judges)
            .where(eq(schema.judges.id, judgeIdNum))
            .limit(1)
          
          if (judges.length > 0 && judges[0].eventId) {
            judgeEventId = judges[0].eventId
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
        let activeEventsQuery = db
          .select()
          .from(schema.events)
          .where(eq(schema.events.active, true))
        
        // Filter by cityId if provided
        if (cityId && cityId !== 0) {
          try {
            activeEventsQuery = activeEventsQuery.where(
              and(
                eq(schema.events.active, true),
                eq(schema.events.cityId, cityId)
              )
            ) as any
          } catch (error: any) {
            // If city_id column doesn't exist, ignore filter
            if (error?.code !== "42703" && !error?.message?.includes("does not exist")) {
              throw error
            }
          }
        }
        
        const activeEvents = await activeEventsQuery.limit(1)
        
        if (activeEvents.length > 0) {
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
        const event = await db
          .select({ cityId: schema.events.cityId })
          .from(schema.events)
          .where(eq(schema.events.id, judgeEventId))
          .limit(1)
        
        if (event.length > 0 && event[0].cityId !== cityId) {
          // Event doesn't belong to city - return empty
          return NextResponse.json([])
        }
      } catch (error: any) {
        // If city_id column doesn't exist, ignore filter
        if (error?.code !== "42703" && !error?.message?.includes("does not exist")) {
          throw error
        }
      }
    }

    // Build where clause - filter by approved and optionally by event
    let whereClause = eq(schema.floats.approved, true)
    
    // If eventId exists, filter by it (gracefully handle if column doesn't exist yet)
    if (judgeEventId !== null) {
      try {
        whereClause = and(
          eq(schema.floats.approved, true),
          eq(schema.floats.eventId, judgeEventId)
        ) as any
        // console.log(`[API/Floats] Filtering floats by eventId: ${judgeEventId}`)
      } catch (error: any) {
        // If eventId column doesn't exist yet, just filter by approved
        if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
          console.log("eventId column does not exist yet, filtering by approved only")
        } else {
          throw error
        }
      }
    } else {
      // console.log(`[API/Floats] No eventId available, showing all approved floats`)
    }

    // Get all approved floats - CRITICAL: Order by floatNumber to match coordinator's order exactly
    // Use raw SQL ordering to ensure nulls are handled correctly
    const floats = await db
      .select()
      .from(schema.floats)
      .where(whereClause)
    
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
    //   console.log(`[API/Floats] Float order: ${sortedFloats.slice(0, 5).map((f: typeof schema.floats.$inferSelect) => `#${f.floatNumber ?? 'null'}`).join(', ')}`)
    // }

    // If judgeId is provided, include scores for that judge
    if (judgeId) {
      const judgeIdNum = parseInt(judgeId, 10)
      if (!isNaN(judgeIdNum)) {
        const scores = await db
          .select()
          .from(schema.scores)
          .where(eq(schema.scores.judgeId, judgeIdNum))

        type ScoreType = typeof schema.scores.$inferSelect
        const scoresMap = new Map<number, ScoreType>(scores.map((score: ScoreType) => [score.floatId, score]))
        
        // Get all score items for these scores
        const scoreIds = scores.map((s: { id: number }) => s.id)
        let scoreItemsMap = new Map<number, Array<{ categoryName: string; value: number | null }>>()
        
        if (scoreIds.length > 0) {
          try {
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
            allItems.forEach((item: { scoreId: number; value: number | null; categoryName: string }) => {
              const existing = scoreItemsMap.get(item.scoreId) || []
              existing.push({ categoryName: item.categoryName, value: item.value })
              scoreItemsMap.set(item.scoreId, existing)
            })
          } catch (error: any) {
            // If score_items table doesn't exist yet, that's okay - use legacy logic
            if (error?.code !== "42P01" && !error?.message?.includes("does not exist")) {
              console.error("Error fetching score items:", error)
            }
          }
        }

        const response = NextResponse.json(
          await Promise.all(sortedFloats.map(async (float: typeof schema.floats.$inferSelect) => {
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
              const eventCategories = await getEventCategories(eventId)
              categories = eventCategories.map((cat: typeof schema.eventCategories.$inferSelect) => ({
                categoryName: cat.categoryName,
                required: cat.required,
                hasNoneOption: cat.hasNoneOption,
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
            const scoreItemsByCategory = new Map(scoreItems.map((item: { categoryName: string; value: number | null }) => [item.categoryName, item.value]))
            
            // CRITICAL: If no score items exist at all, check if we need to query them directly
            // Sometimes the scoreItemsMap might not have the items due to timing issues
            if (scoreItems.length === 0) {
              // console.log(`[API/Floats] Float ${float.floatNumber ?? 'N/A'}: No score items in map for score ${score.id}, querying directly...`)
              
              // Try to fetch score items directly from database
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
                  // console.log(`[API/Floats] Float ${float.floatNumber ?? 'N/A'}: Found ${directItems.length} score items via direct query`)
                  directItems.forEach((item: { categoryName: string; value: number | null }) => {
                    scoreItemsByCategory.set(item.categoryName, item.value)
                  })
                } else {
                  // console.log(`[API/Floats] Float ${float.floatNumber ?? 'N/A'}: Score record exists (ID: ${score.id}) but NO score items found in database - marking as not_started`)
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
            
            // Debug logging - COMMENTED OUT to reduce console noise
            // Uncomment for troubleshooting score status issues
            // if (float.floatNumber !== null && (float.floatNumber === 4 || float.floatNumber <= 20)) {
            //   const valuesStr = categories.map(cat => {
            //     const val = scoreItemsByCategory.get(cat.categoryName) ?? null
            //     const isRequired = categories.find(c => c.categoryName === cat.categoryName)?.required ?? false
            //     const hasItem = scoreItemsByCategory.has(cat.categoryName)
            //     return `${cat.categoryName}${isRequired ? '*' : ''}=${val === null ? 'NULL' : val}${hasItem ? '' : '(no item)'}`
            //   }).join(', ')
            //   const requiredCategories = categories.filter(c => c.required).map(c => c.categoryName)
            //   const filledRequired = requiredCategories.filter(cat => {
            //     const val = scoreItemsByCategory.get(cat) ?? null
            //     return val !== null
            //   })
            //   console.log(`[API/Floats] Float ${float.floatNumber}: ScoreID=${score.id} | Items=${scoreItems.length} | ${valuesStr} | Total=${total} | Required: [${requiredCategories.join(', ')}] | Filled: [${filledRequired.join(', ')}] | AllRequiredFilled=${allRequiredFilled} | AllNull=${allNull} | Status=${scoreStatus}`)
            // }
            
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

