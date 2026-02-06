export type UiLabels = {
  entry: string
  entryPlural: string
  entryNumber: string
  entryDescription: string
}

// Keep this file CLIENT-SAFE (no DB / server-only imports).
export type EventTypeRules = {
  entryTerminology?: {
    entry?: string
    entryPlural?: string
    entryNumber?: string
    entryDescription?: string
  }
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

  const entry = titleCase(rules.entryTerminology.entry)
  const entryPlural = rules.entryTerminology.entryPlural
    ? titleCase(rules.entryTerminology.entryPlural)
    : (entry.endsWith("s") ? entry : `${entry}s`)

  const entryNumber = rules.entryTerminology.entryNumber
    ? humanizeIfToken(rules.entryTerminology.entryNumber)
    : `${entry} #`

  const entryDescription = rules.entryTerminology.entryDescription
    ? humanizeIfToken(rules.entryTerminology.entryDescription)
    : `${entry} Description`

  return {
    entry,
    entryPlural,
    entryNumber,
    entryDescription,
  }
}

function titleCase(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function humanizeIfToken(s: string): string {
  // If it looks like a snake_case mapping token, humanize it.
  if (/_|-/.test(s)) {
    const cleaned = s.replace(/[_-]+/g, " ").trim()
    return titleCase(cleaned)
  }
  return s
}

