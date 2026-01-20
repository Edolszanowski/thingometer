import type { EventTypeRules } from "@/lib/event-rules"
import {
  getEntryDescriptionLabel,
  getEntryLabel,
  getEntryNumberLabel,
  getEntryPluralLabel,
  loadEventTypeForEventId,
} from "@/lib/event-rules"

export type UiLabels = {
  entry: string
  entryPlural: string
  entryNumber: string
  entryDescription: string
}

export function getDefaultLabels(): UiLabels {
  // Backward-compatible defaults for the existing parade UI.
  return {
    entry: "Float",
    entryPlural: "Floats",
    entryNumber: "Float #",
    entryDescription: "Float Description",
  }
}

export function labelsFromRules(rules: EventTypeRules | null | undefined): UiLabels {
  // If rules are missing, keep the current UI wording (Float/Floats).
  if (!rules?.entryTerminology?.entry) return getDefaultLabels()

  const entry = getEntryLabel(rules)
  const entryPlural = getEntryPluralLabel(rules)
  const entryNumber = rules.entryTerminology?.entryNumber
    ? getEntryNumberLabel(rules)
    : `${entry} #`
  const entryDescription = rules.entryTerminology?.entryDescription
    ? getEntryDescriptionLabel(rules)
    : `${entry} Description`

  return {
    entry,
    entryPlural,
    entryNumber,
    entryDescription,
  }
}

export async function loadLabelsForEventId(eventId: number | null | undefined): Promise<UiLabels> {
  if (!eventId) return getDefaultLabels()

  const eventType = await loadEventTypeForEventId(eventId)
  return labelsFromRules(eventType?.rules)
}

