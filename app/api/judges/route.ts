import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const eventIdParam = req.nextUrl.searchParams.get("eventId")
    const eventId = Number(eventIdParam)

    if (!Number.isFinite(eventId) || eventId <= 0) {
      return NextResponse.json(
        { error: "Invalid or missing eventId" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("judges")
      .select("id,name,submitted")
      .eq("event_id", eventId)
      .order("name", { ascending: true })

    if (error) {
      console.error("[api/judges] Supabase error:", error)
      return NextResponse.json(
        { error: "Failed to load judges" },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? [])
  } catch (err: any) {
    console.error("[api/judges] Unhandled error:", err)
    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development"
            ? String(err?.message ?? err)
            : undefined,
      },
      { status: 500 }
    )
  }
}

