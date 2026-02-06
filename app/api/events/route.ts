import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET - List all active events (public endpoint)
// Optionally filter by cityId
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
    const cityIdParam = searchParams.get("cityId")
    const cityId = cityIdParam ? parseInt(cityIdParam, 10) : null

    try {
      const baseSelect = "id,name,city,event_date,active,entry_category_title,created_at,updated_at,city_id,type,organization"

      // Prefer filtering in the query for efficiency while keeping the same response shape.
      let query = supabase
        .from("events")
        .select(baseSelect)
        .eq("active", true)
        .order("event_date", { ascending: true })

      if (cityId && cityId !== 0 && !isNaN(cityId)) {
        query = query.eq("city_id", cityId)
      }

      let { data, error } = await query

      // Backward compatibility: if city_id doesn't exist, retry without the filter.
      if (error && cityId && cityId !== 0) {
        const msg = String((error as any)?.message || "")
        if (msg.includes("does not exist") || msg.includes("city_id")) {
          const retry = await supabase
            .from("events")
            .select("id,name,city,event_date,active,entry_category_title,created_at,updated_at")
            .eq("active", true)
            .order("event_date", { ascending: true })

          data = retry.data as any
          error = retry.error as any
        }
      }

      if (error) {
        throw error
      }

      const activeEvents = (data || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        city: e.city,
        eventDate: e.event_date ?? null,
        active: e.active,
        entryCategoryTitle: e.entry_category_title ?? null,
        createdAt: e.created_at ?? null,
        updatedAt: e.updated_at ?? null,
        type: e.type ?? null,
        organization: e.organization ?? null,
      }))

      console.log(
        `[api/events] Found ${activeEvents.length} active events`
      )

      return NextResponse.json(activeEvents)
    } catch (dbError: any) {
      // If events table doesn't exist yet, return empty array
      const msg = String(dbError?.message || "")
      if (dbError?.code === "42P01" || msg.includes("does not exist")) {
        console.log("[api/events] Events table does not exist yet, returning empty array")
        return NextResponse.json([])
      }
      console.error("[api/events] Database error fetching events:", {
        code: dbError?.code,
        message: dbError?.message,
        stack: dbError?.stack,
      })
      throw dbError
    }
  } catch (error: any) {
    console.error("[api/events] Error fetching active events:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    })
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

