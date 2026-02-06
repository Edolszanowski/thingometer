import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const role = searchParams.get("role")
  const context = searchParams.get("context")

  if (!role) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    let query = supabase
      .from("help_content")
      .select("id, role, page_context, title, content, video_url, display_order")
      .eq("role", role)
      .eq("active", true)
      .order("display_order", { ascending: true })

    if (context) {
      query = query.eq("page_context", context)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching help content:", error)
      return NextResponse.json({ error: "Failed to fetch help content" }, { status: 500 })
    }

    // Transform snake_case to camelCase
    const transformed = (data || []).map((item) => ({
      id: item.id,
      role: item.role,
      pageContext: item.page_context,
      title: item.title,
      content: item.content,
      videoUrl: item.video_url,
      displayOrder: item.display_order,
    }))

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("Error in help API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
