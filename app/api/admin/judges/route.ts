import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic'

function verifyAdminPassword(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    console.error("[admin/judges] ADMIN_PASSWORD environment variable is not set")
    return false
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const providedPassword = authHeader.substring(7)
    const isValid = providedPassword === password
    if (!isValid) {
      console.log("[admin/judges] Bearer auth failed - password mismatch")
    }
    return isValid
  }

  const searchParams = request.nextUrl.searchParams
  const queryPassword = searchParams.get("password")
  const isValid = queryPassword === password
  
  if (!isValid) {
    console.log("[admin/judges] Query password failed - password mismatch")
    console.log("[admin/judges] Expected length:", password.length, "Received length:", queryPassword?.length || 0)
  }
  
  return isValid
}

async function verifyCityAccess(cityId: number | null, userEmail?: string): Promise<boolean> {
  // If no cityId provided (backward compatibility), allow access
  if (!cityId || cityId === 0) {
    return true
  }

  // Check if user has access to this city
  // For now, we'll use password-based auth, but check city_users table if userEmail is provided
  if (userEmail) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !serviceRoleKey) {
        return false
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey)
      const { data, error } = await supabase
        .from("city_users")
        .select("id")
        .eq("city_id", cityId)
        .eq("user_email", userEmail)
        .limit(1)

      if (error) {
        // Backward compatibility: if city_users doesn't exist, allow access
        return true
      }

      return (data?.length || 0) > 0
    } catch (error) {
      // If city_users table doesn't exist, allow access (backward compatibility)
      return true
    }
  }

  // For password-based auth, allow access (will be filtered by city_id in queries)
  return true
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    // Create a fresh client with no caching
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      },
    })

    // Get cityId and eventId from query params
    const searchParams = request.nextUrl.searchParams
    const cityIdParam = searchParams.get("cityId")
    const cityId = cityIdParam ? parseInt(cityIdParam, 10) : null
    const eventIdParam = searchParams.get("eventId")
    const eventId = eventIdParam ? parseInt(eventIdParam, 10) : null

    // Verify city access
    const hasCityAccess = await verifyCityAccess(cityId)
    if (!hasCityAccess) {
      return NextResponse.json({ error: "Access denied for this city" }, { status: 403 })
    }

    // Phase 1 (header-based): when cityId is present, resolve EXACTLY ONE active event for that city.
    // If 0 or >1 active events exist, return 409 with a clear error (no response body changes otherwise).
    let resolvedCityEventId: number | null = null
    if (cityId && cityId !== 0) {
      const { data: activeEvents, error: activeEventsError } = await supabase
        .from("events")
        .select("id")
        .eq("city_id", cityId)
        .eq("active", true)

      if (activeEventsError) {
        console.error("[api/admin/judges] Error resolving active event for city:", activeEventsError)
        return NextResponse.json(
          { error: "Failed to resolve active event for city" },
          { status: 500 }
        )
      }

      const count = activeEvents?.length ?? 0
      if (count !== 1) {
        return NextResponse.json(
          {
            error:
              count === 0
                ? "No active event found for this city. Exactly one active event is required."
                : "Multiple active events found for this city. Exactly one active event is required.",
            activeEventCount: count,
          },
          { status: 409 }
        )
      }

      resolvedCityEventId = activeEvents![0].id
    }

    // Get judges - filter by cityId and eventId
    let judges: Array<{
      id: number
      name: string
      submitted: boolean
      eventId: number | null
      createdAt: string | null
    }> = []
    
    // Filter by city through events
    if (cityId && cityId !== 0) {
      try {
        // Get events for this city
        const { data: cityEvents, error: cityEventsError } = await supabase
          .from("events")
          .select("id")
          .eq("city_id", cityId)

        if (cityEventsError) {
          // If city_id column doesn't exist, fall back to eventId only
          const msg = String(cityEventsError.message || "")
          if (msg.includes("does not exist")) {
            console.log("city_id column does not exist, using eventId filter only")
            if (eventId && !isNaN(eventId)) {
              const { data, error } = await supabase
                .from("judges")
                .select("id,name,submitted,event_id,created_at")
                .eq("event_id", eventId)

              if (error) throw error
              judges = (data || []).map((j: any) => ({
                id: j.id,
                name: j.name,
                submitted: j.submitted,
                eventId: j.event_id ?? null,
                createdAt: j.created_at ?? null,
              }))
            }
          } else {
            throw cityEventsError
          }
        } else {
          const eventIds = (cityEvents || []).map((e: any) => e.id)
        
          if (eventIds.length > 0) {
            if (eventId && !isNaN(eventId)) {
              if (!eventIds.includes(eventId)) {
                // Event doesn't belong to this city
                return NextResponse.json([])
              }

              const { data, error } = await supabase
                .from("judges")
                .select("id,name,submitted,event_id,created_at")
                .eq("event_id", eventId)

              if (error) throw error
              judges = (data || []).map((j: any) => ({
                id: j.id,
                name: j.name,
                submitted: j.submitted,
                eventId: j.event_id ?? null,
                createdAt: j.created_at ?? null,
              }))
            } else {
              const { data, error } = await supabase
                .from("judges")
                .select("id,name,submitted,event_id,created_at")
                .in("event_id", eventIds)

              if (error) throw error
              judges = (data || []).map((j: any) => ({
                id: j.id,
                name: j.name,
                submitted: j.submitted,
                eventId: j.event_id ?? null,
                createdAt: j.created_at ?? null,
              }))
            }
          } else {
            return NextResponse.json([])
          }
        }
      } catch (error) {
        throw error
      }
    } else if (eventId && !isNaN(eventId)) {
      const { data, error } = await supabase
        .from("judges")
        .select("id,name,submitted,event_id,created_at")
        .eq("event_id", eventId)

      if (error) throw error
      judges = (data || []).map((j: any) => ({
        id: j.id,
        name: j.name,
        submitted: j.submitted,
        eventId: j.event_id ?? null,
        createdAt: j.created_at ?? null,
      }))
    } else {
      // Get all judges (backward compatibility)
      // Force fresh data by using a direct query with cache busting
      const { data, error } = await supabase
        .from("judges")
        .select("id,name,submitted,event_id,created_at")
        .order('id', { ascending: true })

      // #region agent log
      const drBootheRaw = (data||[]).find((j:any)=>j.name?.toLowerCase().includes('boothe'));
      fetch('http://127.0.0.1:7244/ingest/b9cff614-5356-493b-8a2f-a25c3a6bf3a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/judges:GET:rawData',message:'Raw Supabase response',data:{drBootheRaw:drBootheRaw||null,totalRows:data?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SUPABASE-CACHE',runId:'post-fix'})}).catch(()=>{});
      // #endregion

      if (error) throw error
      judges = (data || []).map((j: any) => ({
        id: j.id,
        name: j.name,
        submitted: j.submitted,
        eventId: j.event_id ?? null,
        createdAt: j.created_at ?? null,
      }))
    }

    const judgesWithCounts = await Promise.all(
      judges.map(async (judge) => {
        let floatIds: number[] | null = null

        // If eventId is provided, filter scores by floats that belong to that event
        if (eventId && !isNaN(eventId)) {
          try {
            const { data: eventFloats, error: floatsError } = await supabase
              .from("floats")
              .select("id")
              .eq("event_id", eventId)

            if (floatsError) {
              const msg = String(floatsError.message || "")
              if (msg.includes("does not exist")) {
                console.log("eventId column does not exist yet, ignoring event filter")
              } else {
                throw floatsError
              }
            } else {
              floatIds = (eventFloats || []).map((f: any) => f.id)
              if (floatIds.length === 0) {
                return { ...judge, scoreCount: 0 }
              }
            }
          } catch (error) {
            throw error
          }
        }

        // Count scores (preserve shape: { scoreCount })
        let scoreQuery = supabase
          .from("scores")
          .select("id", { count: "exact", head: true })
          .eq("judge_id", judge.id)

        if (floatIds && floatIds.length > 0) {
          scoreQuery = scoreQuery.in("float_id", floatIds)
        }

        const { count, error: countError } = await scoreQuery
        if (countError) throw countError

        return {
          ...judge,
          scoreCount: count || 0,
        }
      })
    )

    // #region agent log
    const drBoothe = judgesWithCounts.find((j: any) => j.name?.toLowerCase().includes('boothe'));
    fetch('http://127.0.0.1:7244/ingest/b9cff614-5356-493b-8a2f-a25c3a6bf3a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/judges:GET',message:'Returning judges',data:{totalJudges:judgesWithCounts.length,drBoothe:drBoothe||null,allSubmitted:judgesWithCounts.map((j:any)=>({id:j.id,name:j.name,submitted:j.submitted}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    // Add cache-control headers to prevent caching
    const response = NextResponse.json(judgesWithCounts)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    if (resolvedCityEventId) {
      response.headers.set("X-Thingometer-Event-Id", String(resolvedCityEventId))
    }
    
    return response
  } catch (error) {
    console.error("Error fetching judges:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

