import { labelsFromRules, getDefaultLabels, type UiLabels } from "@/lib/labels"
import { loadEventTypeForEventId } from "@/lib/event-rules"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables")
  }
  
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function loadLabelsForEventId(
  eventId: number | null | undefined
): Promise<UiLabels> {
  if (!eventId) return getDefaultLabels()
  
  // Check if this is a Lemonade Day event
  try {
    const supabase = getSupabase()
    const { data: event } = await supabase
      .from("events")
      .select("type")
      .eq("id", eventId)
      .single()
    
    if (event && event.type === "lemonade_day") {
      return {
        entry: "Stand",
        entryPlural: "Stands",
        entryNumber: "Stand #",
        entryDescription: "Stand Description",
      }
    }
  } catch (error) {
    console.error("[loadLabelsForEventId] Error checking event type:", error)
  }
  
  // Otherwise, try to load from event_types
  const eventType = await loadEventTypeForEventId(eventId)
  return labelsFromRules(eventType?.rules as any)
}

