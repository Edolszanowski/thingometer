import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Server-only route (no caching assumptions)
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const eventIdParam = request.nextUrl.searchParams.get("eventId")
  if (!eventIdParam) {
    return NextResponse.json(
      { error: "Missing required query parameter: eventId" },
      { status: 400 }
    )
  }

  const eventId = Number(eventIdParam)
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json(
      { error: "Invalid eventId (must be a positive number)" },
      { status: 400 }
    )
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

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await supabase
    .from("event_categories")
    .select("id,event_id,category_name,display_order,required,has_none_option,created_at")
    .eq("event_id", eventId)
    .order("display_order", { ascending: true })

  if (error) {
    console.error("[api/event-categories] Error fetching event categories:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  // Return the DB column names exactly (snake_case)
  return NextResponse.json(data ?? [])
}

