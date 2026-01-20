"use server"

import { setJudgeId, clearJudgeId } from "@/lib/cookies"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { loadLabelsForEventId } from "@/lib/labels"
import type { UiLabels } from "@/lib/labels"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

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

