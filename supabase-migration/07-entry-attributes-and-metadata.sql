-- ============================================================================
-- Event-configurable entry forms
-- Migration: 07-entry-attributes-and-metadata.sql
-- ============================================================================
-- Adds:
-- - events.entry_attributes (jsonb): per-event configuration for dynamic entry fields
-- - floats.metadata (jsonb): storage for dynamic/custom fields submitted with an entry
--
-- Notes:
-- - Parade continues to work unchanged because entry_attributes defaults to an empty config.
-- - No tables/routes/columns are renamed; these are additive columns only.

-- ----------------------------------------------------------------------------
-- EVENTS: entry_attributes
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS entry_attributes JSONB NOT NULL DEFAULT '{"extraFields":[]}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_events_entry_attributes_gin
  ON public.events
  USING GIN (entry_attributes);

-- ----------------------------------------------------------------------------
-- FLOATS: metadata
-- ----------------------------------------------------------------------------
ALTER TABLE public.floats
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_floats_metadata_gin
  ON public.floats
  USING GIN (metadata);

