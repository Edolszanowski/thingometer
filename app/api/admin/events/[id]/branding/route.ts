import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const eventId = parseInt(params.id, 10)

  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Get event info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get branding
    const { data: branding } = await supabase
      .from("event_branding")
      .select("*")
      .eq("event_id", eventId)
      .single()

    return NextResponse.json({
      eventId: event.id,
      eventName: event.name,
      branding: branding
        ? {
            id: branding.id,
            eventId: branding.event_id,
            themePreset: branding.theme_preset,
            textContrastMode: branding.text_contrast_mode,
            logoUrl: branding.logo_url,
            logoDarkUrl: branding.logo_dark_url,
            faviconUrl: branding.favicon_url,
            primaryColor: branding.primary_color,
            secondaryColor: branding.secondary_color,
            accentColor: branding.accent_color,
            backgroundImageUrl: branding.background_image_url,
            fontFamily: branding.font_family,
            customCss: branding.custom_css,
          }
        : null,
    })
  } catch (error) {
    console.error("Error fetching event branding:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const eventId = parseInt(params.id, 10)

  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await request.json()
    const {
      themePreset,
      textContrastMode,
      logoUrl,
      logoDarkUrl,
      faviconUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundImageUrl,
      fontFamily,
      customCss,
    } = body

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Check if branding exists
    const { data: existingBranding } = await supabase
      .from("event_branding")
      .select("id")
      .eq("event_id", eventId)
      .single()

    const brandingData = {
      event_id: eventId,
      theme_preset: themePreset || null,
      text_contrast_mode: textContrastMode || "auto",
      logo_url: logoUrl || null,
      logo_dark_url: logoDarkUrl || null,
      favicon_url: faviconUrl || null,
      primary_color: primaryColor || null,
      secondary_color: secondaryColor || null,
      accent_color: accentColor || null,
      background_image_url: backgroundImageUrl || null,
      font_family: fontFamily || null,
      custom_css: customCss || null,
      updated_at: new Date().toISOString(),
    }

    let result
    if (existingBranding) {
      // Update existing
      result = await supabase
        .from("event_branding")
        .update(brandingData)
        .eq("id", existingBranding.id)
        .select()
        .single()
    } else {
      // Insert new
      result = await supabase
        .from("event_branding")
        .insert(brandingData)
        .select()
        .single()
    }

    if (result.error) {
      console.error("Error saving branding:", result.error)
      return NextResponse.json({ error: "Failed to save branding" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      branding: {
        id: result.data.id,
        eventId: result.data.event_id,
        themePreset: result.data.theme_preset,
        textContrastMode: result.data.text_contrast_mode,
        logoUrl: result.data.logo_url,
        primaryColor: result.data.primary_color,
        secondaryColor: result.data.secondary_color,
        accentColor: result.data.accent_color,
      },
    })
  } catch (error) {
    console.error("Error saving event branding:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
