-- Migration: Add organization column to events table
-- Purpose: Store host organization for events (required for Lemonade Day child-safe forms)
-- Date: 2026-01-31

-- Add organization column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS organization TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN events.organization IS 'Host organization for the event (e.g., "Greater Boerne Chamber of Commerce")';

-- Update existing Lemonade Day events with default organization
UPDATE events 
SET organization = 'Greater Boerne Chamber of Commerce'
WHERE type = 'lemonade_day' 
  AND organization IS NULL;
