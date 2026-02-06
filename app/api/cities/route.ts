import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET - List all active cities
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

    const { data, error } = await supabase
      .from("cities")
      .select("id,name,slug,display_name,region,active")
      .eq("active", true)

    if (error) {
      // Backward compatibility: if the table doesn't exist yet, return empty array
      // (Supabase PostgREST usually returns PGRST* errors; keep the behavior forgiving.)
      const message = String(error.message || "")
      if (message.includes("does not exist") || message.includes("PGRST")) {
        return NextResponse.json([])
      }
      throw error
    }

    // Preserve existing response shape: { displayName } camelCase key.
    const cities =
      (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        displayName: c.display_name,
        region: c.region,
        active: c.active,
      })) ?? []

    return NextResponse.json(cities)
  } catch (error: any) {
    console.error("[api/cities] Error fetching cities:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


