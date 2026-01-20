-- ============================================================================
-- Event Types and Branding Support
-- Migration: 06-add-event-types-and-branding.sql
-- ============================================================================
-- This migration adds:
-- - event_types: Categorize events by type (parade, competition, festival, etc.)
-- - event_branding: Per-event branding configuration (colors, logos, etc.)
-- - events.event_type_id: Link events to event types
-- - entries: View mapping floats table to generic entry terminology

-- ============================================================================
-- EVENT_TYPES - Event type categorization
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.event_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- e.g., "Parade", "Competition", "Festival"
  slug TEXT NOT NULL UNIQUE, -- URL-friendly version: "parade", "competition", "festival"
  description TEXT, -- Description of this event type
  rules JSONB, -- Event type specific rules and configuration
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_types_slug ON public.event_types(slug);
CREATE INDEX IF NOT EXISTS idx_event_types_active ON public.event_types(active);
CREATE INDEX IF NOT EXISTS idx_event_types_rules ON public.event_types USING GIN (rules);

-- ============================================================================
-- Insert example event types with rule objects
-- ============================================================================
INSERT INTO public.event_types (name, slug, description, rules) VALUES
(
  'Parade',
  'parade',
  'Parade event with floats, marching bands, and participants',
  '{
    "entryTerminology": {
      "entry": "float",
      "entryNumber": "float_number",
      "entryDescription": "float_description"
    },
    "defaultScoringCategories": [
      {"name": "Lighting", "required": true, "hasNone": true},
      {"name": "Theme", "required": true, "hasNone": true},
      {"name": "Traditions", "required": true, "hasNone": true},
      {"name": "Spirit", "required": true, "hasNone": true},
      {"name": "Music", "required": false, "hasNone": true}
    ],
    "entryFields": {
      "entryLength": true,
      "hasMusic": true,
      "typeOfEntry": true
    },
    "positionMode": ["preplanned", "jit"],
    "requiresApproval": true
  }'::jsonb
),
(
  'Lemonade Day',
  'lemonade_day',
  'Lemonade Day competition for young entrepreneurs',
  '{
    "entryTerminology": {
      "entry": "stand",
      "entryNumber": "stand_number",
      "entryDescription": "stand_description"
    },
    "defaultScoringCategories": [
      {"name": "Presentation", "required": true, "hasNone": false},
      {"name": "Business Plan", "required": true, "hasNone": false},
      {"name": "Creativity", "required": true, "hasNone": false},
      {"name": "Customer Service", "required": true, "hasNone": false}
    ],
    "entryFields": {
      "entryLength": false,
      "hasMusic": false,
      "typeOfEntry": false,
      "ageGroup": true,
      "location": true
    },
    "positionMode": ["preplanned"],
    "requiresApproval": false,
    "ageRestrictions": {
      "minAge": 5,
      "maxAge": 18
    }
  }'::jsonb
),
(
  'Chili Cookoff',
  'chili_cookoff',
  'Chili cookoff competition with multiple categories',
  '{
    "entryTerminology": {
      "entry": "entry",
      "entryNumber": "entry_number",
      "entryDescription": "recipe_description"
    },
    "defaultScoringCategories": [
      {"name": "Taste", "required": true, "hasNone": false},
      {"name": "Texture", "required": true, "hasNone": false},
      {"name": "Appearance", "required": true, "hasNone": false},
      {"name": "Aroma", "required": true, "hasNone": false},
      {"name": "Heat Level", "required": false, "hasNone": false}
    ],
    "entryFields": {
      "entryLength": false,
      "hasMusic": false,
      "typeOfEntry": true,
      "category": true,
      "spiceLevel": true
    },
    "positionMode": ["preplanned"],
    "requiresApproval": true,
    "categories": ["Traditional", "Vegetarian", "White Chicken", "People''s Choice"]
  }'::jsonb
),
(
  'Dachshund Race',
  'dachshund_race',
  'Dachshund racing competition with heats and finals',
  '{
    "entryTerminology": {
      "entry": "racer",
      "entryNumber": "racer_number",
      "entryDescription": "racer_description"
    },
    "defaultScoringCategories": [
      {"name": "Speed", "required": true, "hasNone": false},
      {"name": "Style", "required": false, "hasNone": false}
    ],
    "entryFields": {
      "entryLength": false,
      "hasMusic": false,
      "typeOfEntry": false,
      "dogName": true,
      "ownerName": true,
      "heatNumber": true
    },
    "positionMode": ["jit"],
    "requiresApproval": false,
    "raceFormat": {
      "heats": true,
      "finals": true,
      "timingRequired": true
    },
    "entryRequirements": {
      "breed": "dachshund",
      "ageVerification": true
    }
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- EVENT_BRANDING - Per-event branding configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.event_branding (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  primary_color TEXT, -- Primary brand color (hex code, e.g., "#FF5733")
  secondary_color TEXT, -- Secondary brand color (hex code)
  accent_color TEXT, -- Accent color (hex code)
  logo_url TEXT, -- URL to event logo
  favicon_url TEXT, -- URL to favicon
  background_image_url TEXT, -- URL to background image
  font_family TEXT, -- Custom font family name
  custom_css TEXT, -- Custom CSS overrides (optional)
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (event_id) -- One branding config per event
);

CREATE INDEX IF NOT EXISTS idx_event_branding_event_id ON public.event_branding(event_id);

-- ============================================================================
-- Add event_type_id to events table
-- ============================================================================
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS event_type_id INTEGER REFERENCES public.event_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_event_type_id ON public.events(event_type_id);

-- ============================================================================
-- ENTRIES - View mapping floats to generic entry terminology
-- ============================================================================
CREATE OR REPLACE VIEW public.entries AS
SELECT 
  id,
  event_id,
  float_number AS entry_number,
  organization,
  entry_name,
  first_name,
  last_name,
  title,
  phone,
  email,
  comments,
  entry_length,
  float_description AS description,
  type_of_entry,
  has_music,
  approved,
  submitted_at
FROM public.floats;

-- Note: Views are read-only by default. To enable write operations,
-- INSTEAD OF triggers would need to be created separately.
-- For now, the view provides read access to floats data with generic terminology.

-- ============================================================================
-- Enable RLS on new tables
-- ============================================================================
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on event_types" 
  ON public.event_types 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

ALTER TABLE public.event_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on event_branding" 
  ON public.event_branding 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
