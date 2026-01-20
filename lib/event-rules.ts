/**
 * Event rules helpers
 *
 * - Pure helpers for labels/flags derived from `event_types.rules` (jsonb)
 * - Optional loaders that fetch `event_types` + `rules` from Postgres
 *
 * This module is intentionally not wired into any UI/API code.
 */

export type PositionMode = "preplanned" | "jit"

export type DefaultScoringCategoryRule = {
  name: string
  required?: boolean
  hasNone?: boolean
}

export type EntryTerminologyRule = {
  /**
   * Human label (preferred) OR a legacy/mapping-like token.
   * Examples: "float", "stand", "entry", "racer"
   */
  entry?: string
  /** Optional plural label override. */
  entryPlural?: string
  /**
   * Human label (preferred) OR a snake_case mapping token.
   * Examples: "Entry #", "float_number"
   */
  entryNumber?: string
  /**
   * Human label (preferred) OR a snake_case mapping token.
   * Examples: "Description", "float_description"
   */
  entryDescription?: string
}

export type EntryFieldsRule = Record<string, boolean | undefined>

export type EventTypeRules = {
  entryTerminology?: EntryTerminologyRule
  defaultScoringCategories?: DefaultScoringCategoryRule[]
  entryFields?: EntryFieldsRule
  positionMode?: PositionMode[]
  requiresApproval?: boolean
  // Allow project-specific extensions without breaking typing.
  [key: string]: unknown
}

export type EventTypeRow = {
  id: number
  name: string
  slug: string
  description: string | null
  rules: EventTypeRules | null
  active: boolean | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

type RawSqlClient = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>

const USE_SUPABASE = process.env.USE_SUPABASE === "true"

function getDatabaseUrl(): string {
  if (typeof window !== "undefined") {
    throw new Error("Database access is only available on the server side")
  }

  const url = USE_SUPABASE
    ? (process.env.DATABASE_URL_SUPABASE || process.env.DATABASE_URL)
    : process.env.DATABASE_URL

  if (!url) {
    throw new Error(
      USE_SUPABASE
        ? "DATABASE_URL_SUPABASE or DATABASE_URL environment variable is not set"
        : "DATABASE_URL environment variable is not set"
    )
  }

  return url
}

let _rawSql: RawSqlClient | null = null

function getRawSql(): RawSqlClient {
  if (_rawSql) return _rawSql

  if (USE_SUPABASE) {
    // postgres-js (works with Supabase and any Postgres connection string)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const postgres = require("postgres")
    const client = postgres(getDatabaseUrl(), {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    })
    _rawSql = client as RawSqlClient
    return _rawSql
  }

  // Neon HTTP (serverless)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { neon } = require("@neondatabase/serverless")
  _rawSql = neon(getDatabaseUrl()) as RawSqlClient
  return _rawSql
}

function titleCase(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function humanizeToken(s: string): string {
  // Turn "float_number" -> "Float number"
  const cleaned = s.replace(/[_-]+/g, " ").trim()
  return titleCase(cleaned)
}

export function parseEventTypeRules(input: unknown): EventTypeRules | null {
  if (input == null) return null

  // postgres-js returns JSONB as object; some drivers can return it as string.
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input)
      return isRecord(parsed) ? (parsed as EventTypeRules) : null
    } catch {
      return null
    }
  }

  if (isRecord(input)) return input as EventTypeRules
  return null
}

export function getEntryLabel(rules: EventTypeRules | null | undefined): string {
  const raw = rules?.entryTerminology?.entry
  if (!raw) return "Entry"
  return titleCase(raw)
}

export function getEntryPluralLabel(rules: EventTypeRules | null | undefined): string {
  const explicit = rules?.entryTerminology?.entryPlural
  if (explicit) return titleCase(explicit)
  const singular = getEntryLabel(rules)
  // Basic pluralization; callers can override via entryPlural.
  return singular.endsWith("s") ? singular : `${singular}s`
}

export function getEntryNumberLabel(rules: EventTypeRules | null | undefined): string {
  const raw = rules?.entryTerminology?.entryNumber
  if (!raw) return `${getEntryLabel(rules)} #`
  return /[_-]/.test(raw) ? humanizeToken(raw) : raw
}

export function getEntryDescriptionLabel(rules: EventTypeRules | null | undefined): string {
  const raw = rules?.entryTerminology?.entryDescription
  if (!raw) return "Description"
  return /[_-]/.test(raw) ? humanizeToken(raw) : raw
}

export function getSupportedPositionModes(
  rules: EventTypeRules | null | undefined
): PositionMode[] {
  const modes = rules?.positionMode
  if (!modes || modes.length === 0) return ["preplanned", "jit"]
  return modes
}

export function requiresApproval(rules: EventTypeRules | null | undefined): boolean {
  return rules?.requiresApproval ?? false
}

export function isEntryFieldEnabled(
  rules: EventTypeRules | null | undefined,
  field: string
): boolean {
  return Boolean(rules?.entryFields?.[field])
}

export function getDefaultScoringCategories(
  rules: EventTypeRules | null | undefined
): DefaultScoringCategoryRule[] {
  return Array.isArray(rules?.defaultScoringCategories) ? rules!.defaultScoringCategories! : []
}

/**
 * Loads an event type row by slug from `public.event_types`.
 *
 * Note: Requires the Thingometer DB migrations that introduce `event_types`.
 */
export async function loadEventTypeBySlug(slug: string): Promise<EventTypeRow | null>
export async function loadEventTypeBySlug(_db: unknown, slug: string): Promise<EventTypeRow | null>
export async function loadEventTypeBySlug(arg1: unknown, arg2?: string): Promise<EventTypeRow | null> {
  const slug = typeof arg1 === "string" ? arg1 : (arg2 as string)
  const sql = getRawSql()

  const rows = await sql`
    select
      id,
      name,
      slug,
      description,
      rules,
      active,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from public.event_types
    where slug = ${slug}
    limit 1
  `

  const row = rows[0] as any
  if (!row) return null

  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: row.description == null ? null : String(row.description),
    rules: parseEventTypeRules(row.rules),
    active: row.active == null ? null : Boolean(row.active),
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  }
}

/**
 * Loads the event type (and rules) for a given event id using:
 * `events.event_type_id -> event_types.id`
 *
 * Returns null if the event has no event_type_id (or the migration isn't applied).
 */
export async function loadEventTypeForEventId(eventId: number): Promise<EventTypeRow | null>
export async function loadEventTypeForEventId(_db: unknown, eventId: number): Promise<EventTypeRow | null>
export async function loadEventTypeForEventId(arg1: unknown, arg2?: number): Promise<EventTypeRow | null> {
  const eventId = typeof arg1 === "number" ? arg1 : (arg2 as number)

  try {
    const sql = getRawSql()
    const rows = await sql`
      select
        et.id,
        et.name,
        et.slug,
        et.description,
        et.rules,
        et.active,
        et.created_at as "createdAt",
        et.updated_at as "updatedAt"
      from public.events e
      join public.event_types et on et.id = e.event_type_id
      where e.id = ${eventId}
      limit 1
    `

    const row = rows[0] as any
    if (!row) return null

    return {
      id: Number(row.id),
      name: String(row.name),
      slug: String(row.slug),
      description: row.description == null ? null : String(row.description),
      rules: parseEventTypeRules(row.rules),
      active: row.active == null ? null : Boolean(row.active),
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    }
  } catch (err: any) {
    // If the migration isn't applied yet, avoid crashing callers that choose to
    // use this helper early.
    const msg = String(err?.message || "")
    if (msg.includes("event_type_id") || msg.includes("event_types")) return null
    throw err
  }
}

