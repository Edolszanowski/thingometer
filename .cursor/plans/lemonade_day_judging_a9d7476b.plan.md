---
name: Lemonade Day Judging
overview: Add Lemonade Day as an event type using existing judge auth/session and scoring engine, with event-specific categories and entry metadata, while keeping parade judging unchanged.
todos:
  - id: inc1-rubric-data
    content: Create Lemonade Day event and insert 5 rubric categories into public.event_categories (required=true, order 0..4).
    status: pending
  - id: inc2-gps-metadata
    content: Configure Lemonade Day entry_attributes to capture location lat/lng and persist into floats.metadata.location.{lat,lng}.
    status: pending
  - id: inc3-scale-0-10
    content: Add event-configurable scoring scale so Lemonade Day uses 0–10 while parade remains unchanged (likely via event_types.rules + ScoringSliders adjustment).
    status: pending
---

# Lemonade Day judging (incremental, parade-safe)

## Architecture understanding (reuse what exists)

### What we already have (and will reuse)

- **Event-scoped judging**: Judges are assigned to exactly one `public.events` row via `public.judges.event_id`. The judge session/cookies already resolve to a single event and are used to filter floats/entries.
- **Dynamic rubric support**: Scoring is already dynamic via `public.event_categories` + `public.score_items`. UI renders sliders per category and persists score items through existing score endpoints.
- **Entry extensibility**: Per-event entry form extensions exist via `public.events.entry_attributes` and are persisted into `public.floats.metadata` (jsonb).
- **Terminology / labels**: Event type rules (`public.event_types.rules`) drive UI labels via `lib/labels`/`labelsFromRules`.

### Key data flow (today)

```mermaid
flowchart LR
JudgeLogin[JudgeLogin] --> JudgeSession[Cookies: judge-auth, parade-judge-id]
JudgeSession --> JudgePage[/judge]
JudgePage --> FloatsPage[/floats]
FloatsPage --> ApiFloats[/api/floats]
ApiFloats --> FloatsTable[(public.floats)]
ApiFloats --> ScoresTable[(public.scores)]
ApiFloats --> ScoreItemsTable[(public.score_items)]
ApiFloats --> CategoriesTable[(public.event_categories)]
FloatPage[/float/[id]] --> ApiScores[/api/scores PATCH]
ApiScores --> ScoreItemsTable
```

### Lemonade Day-specific requirements mapping

- **Rubric categories** → `public.event_categories` (5 rows for the Lemonade Day event)
- **0–10 score scale** → **needs UI support** (current `components/ScoringSliders.tsx` uses `max={20}` and displays 0..20)
- **GPS location** → `public.floats.metadata.location` stored as `{ lat: number, lng: number }` (confirmed)
- **Equal weight / total** → total score is sum of category values (max 50)

## Increment 1 — Lemonade Day rubric + data (no UI changes)

### Goal

Create a Lemonade Day event that can be judged using the existing engine, with the right categories stored in the DB.

### Changes

- **Tables touched**:
  - `public.event_types` (ensure Lemonade Day type exists and has rules for labels)
  - `public.events` (create/activate Lemonade Day event)
  - `public.event_categories` (insert 5 Lemonade Day categories)
  - `public.settings` (optional: `judge_event_password:<eventId>`)

- **Files touched**:
  - None required for Increment 1.

### Rubric definition (as DB rows)

Insert into `public.event_categories` for the Lemonade Day event:

- `Business Planning`
- `Financial Understanding`
- `Stand Design & Creativity`
- `Customer Experience`
- `Narrative / Story`

All 5 categories:

- `required = true`
- `has_none_option = false` (national-standard aligned for a 0–10 rubric; avoids “None” semantics)
- `display_order = 0..4`

### Acceptance criteria

- `GET /api/event-categories?eventId=<lemonadeEventId>` returns the 5 categories in order.
- Judges can reach `/floats` and see entries for the Lemonade Day event (even if they can’t yet score 0–10).

### Do-not-change list

- No cookie/auth changes.
- No new routes.
- No changes to parade data or existing parade events.

### Rollback

- Delete the inserted Lemonade Day `event_categories` rows (by `event_id`).
- Deactivate the Lemonade Day `events` row.

## Increment 2 — Add GPS metadata capture for Lemonade Day entries

### Goal

Allow each Lemonade Day entry to carry a GPS location stored in `floats.metadata`.

### Changes

- **Tables touched**:
  - `public.events.entry_attributes` (configure extra fields)
  - `public.floats.metadata` (already exists; store values)

- **Files likely touched** (depending on how entry creation happens for Lemonade Day):
  - [`app/signup/page.tsx`](app/signup/page.tsx) (dynamic fields already supported)
  - [`app/coordinator/upload/page.tsx`](app/coordinator/upload/page.tsx) (CSV ingest already supports metadata)

### Configuration

Set `events.entry_attributes` for the Lemonade Day event to include:

- `location_lat` (number, required)
- `location_lng` (number, required)

Persist to `floats.metadata` in a normalized structure:

- `metadata.location.lat`
- `metadata.location.lng`

For judge usability (demo-safe), display this on the existing float detail page when present:

- Render a small “Location” block that shows `lat,lng` and a Google Maps link generated from those numbers.
- Keep parade unchanged by only rendering when `metadata.location` exists.

### Acceptance criteria

- Creating an entry via signup stores GPS into `floats.metadata`.
- CSV upload can map GPS columns into `metadata.location.lat/lng`.
- Existing parade signup/upload still works unchanged.

### Do-not-change list

- No changes to judge auth.
- No changes to scoring endpoints.

### Rollback

- Remove the Lemonade Day `entry_attributes` configuration (set to empty fields).
- Existing entries keep metadata but the UI won’t render those fields.

## Increment 3 — Support 0–10 scoring scale safely (Lemonade Day only)

### Goal

Enable Lemonade Day scoring to use 0–10 while keeping parade scoring behavior unchanged.

### Important discovery / constraint

`components/ScoringSliders.tsx` currently uses `max={20}` and displays `0..20`. Lemonade Day requires `0..10`.

### Options (needs a decision)

This is confirmed:

- **Option A (event-configurable)**: Make slider max depend on event type rules (e.g., `event_types.rules.scoringScale.max = 10` for Lemonade Day; default remains 20 for parade).

Option B is not used.

### Proposed implementation (Option A)

- **Tables touched**:
  - `public.event_types.rules` (add a `scoringScale` rule for Lemonade Day, e.g. `{ min: 0, max: 10 }`)
- **Files touched**:
  - [`components/ScoringSliders.tsx`](components/ScoringSliders.tsx) to read `max` from provided config (default 20)
  - [`app/float/[id]/page.tsx`](app/float/[id]/page.tsx) to load the event’s scoringScale (from event type rules) and pass it to `ScoringSliders`
  - (Optional, for consistency) [`app/floats/page.tsx`](app/floats/page.tsx) or the component that shows totals/progress if it assumes 0..20 visually

### Acceptance criteria

- Parade events still show 0–20 sliders.
- Lemonade Day event shows 0–10 sliders.
- All scoring persistence remains in `score_items` values.
- Total for Lemonade Day is 0–50 (5 categories * max 10), and leaderboard/aggregation continues to use summed values.

### Do-not-change list

- No new scoring engines.
- No changes to `/api/scores` request/response shape.

### Rollback

- Remove `scoringScale` rule from Lemonade Day event type.
- Revert slider max logic to constant 20.

## Confirmed decisions (locked for the plan)

- Lemonade Day rubric: **5 categories**, all required, equal weight, **0–10** each, total = sum (max 50).
- GPS location: **lat/lng numeric**, stored at `floats.metadata.location.{lat,lng}`.
- Scoring scale: **Option A** (event-configurable slider max via `event_types.rules`; parade remains 0–20).