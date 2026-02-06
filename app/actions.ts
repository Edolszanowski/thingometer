"use server"

import { setJudgeId, clearJudgeId } from "@/lib/cookies"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { loadLabelsForEventId } from "@/lib/labels-server"
import type { UiLabels } from "@/lib/labels"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import type { BrandingConfig } from "@/lib/theme-context"
import { createClient } from "@supabase/supabase-js"

export async function selectJudge(judgeId: number) {
  await setJudgeId(judgeId)
  redirect("/floats")
}

export async function logoutJudge() {
  await clearJudgeId()
  // Also clear the judge-auth cookie
  const cookieStore = cookies()
  cookieStore.delete("judge-auth")
  redirect("/")
}

// UI labels helper (server action) - lets client components fetch event-specific labels
export async function getLabelsForEvent(eventId: number | null): Promise<UiLabels> {
  return loadLabelsForEventId(eventId)
}

export type EntryAttributesConfig = {
  extraFields?: Array<{
    key: string
    label: string
    type: "text" | "textarea" | "number" | "select" | "boolean"
    required?: boolean
    placeholder?: string
    options?: string[]
    helpText?: string
  }>
}

export async function getEntryAttributesForEvent(
  eventId: number | null
): Promise<EntryAttributesConfig> {
  // Default = no extra fields; parade works unchanged.
  const fallback: EntryAttributesConfig = { extraFields: [] }
  if (!eventId) return fallback

  try {
    const rows = await db
      .select({ entryAttributes: schema.events.entryAttributes })
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1)

    const cfg = rows[0]?.entryAttributes
    if (!cfg || typeof cfg !== "object") return fallback
    return cfg as EntryAttributesConfig
  } catch (err: any) {
    // Backward compatibility if migration isn't applied yet.
    const msg = String(err?.message || "")
    if (err?.code === "42703" || msg.includes("entry_attributes") || msg.includes("does not exist")) {
      return fallback
    }
    throw err
  }
}

// ============================================================================
// THEME LOADING - Load branding configuration for events
// ============================================================================

const defaultColors = {
  primary: "#DC2626",
  secondary: "#16A34A",
  accent: "#F59E0B",
  background: "#FFFFFF",
  foreground: "#14532D",
}

export async function loadThemeForEvent(eventId: number): Promise<BrandingConfig | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase credentials not configured for theme loading")
    return null
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Get event with city info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, city_id")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      console.warn("Event not found for theme loading:", eventId)
      return null
    }

    // Get event branding
    const { data: eventBranding } = await supabase
      .from("event_branding")
      .select("*")
      .eq("event_id", eventId)
      .single()

    // Get city branding if city_id exists
    let cityBranding = null
    if (event.city_id) {
      const { data } = await supabase
        .from("city_branding")
        .select("*")
        .eq("city_id", event.city_id)
        .single()
      cityBranding = data
    }

    // Priority: Event branding > Theme preset > City branding > Default
    let colors = { ...defaultColors }

    // Load theme preset if specified
    if (eventBranding?.theme_preset) {
      const { data: preset } = await supabase
        .from("theme_presets")
        .select("colors")
        .eq("slug", eventBranding.theme_preset)
        .single()

      if (preset?.colors) {
        colors = preset.colors as typeof colors
      }
    }

    // Override with custom event colors if provided
    if (eventBranding?.primary_color) {
      colors.primary = eventBranding.primary_color
    }
    if (eventBranding?.secondary_color) {
      colors.secondary = eventBranding.secondary_color
    }
    if (eventBranding?.accent_color) {
      colors.accent = eventBranding.accent_color
    }

    return {
      cityLogo: cityBranding?.logo_url,
      eventLogo: eventBranding?.logo_url,
      favicon: cityBranding?.favicon_url || eventBranding?.favicon_url,
      colors,
      contrastMode: (eventBranding?.text_contrast_mode as "auto" | "high" | "maximum") || "auto",
      customCss: eventBranding?.custom_css || cityBranding?.custom_css,
    }
  } catch (error) {
    console.error("Error loading theme:", error)
    return null
  }
}

export async function getThemePresets() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return []
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from("theme_presets")
    .select("*")
    .order("name")

  if (error) {
    console.error("Error loading theme presets:", error)
    return []
  }

  return data || []
}

