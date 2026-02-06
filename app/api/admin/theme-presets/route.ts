import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data, error } = await supabase
      .from("theme_presets")
      .select("*")
      .order("name")

    if (error) {
      console.error("Error fetching theme presets:", error)
      return NextResponse.json({ error: "Failed to fetch theme presets" }, { status: 500 })
    }

    // Transform to camelCase
    const transformed = (data || []).map((preset) => ({
      id: preset.id,
      name: preset.name,
      slug: preset.slug,
      description: preset.description,
      colors: preset.colors,
      cssVariables: preset.css_variables,
      accessibilityMode: preset.accessibility_mode,
      createdAt: preset.created_at,
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("Error in theme presets API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
