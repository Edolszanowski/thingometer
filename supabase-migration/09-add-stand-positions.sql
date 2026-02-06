-- Migration: Add stand_positions table for position-based location management
-- This allows locations to be tied to stand numbers instead of participants

-- Create stand_positions table
CREATE TABLE IF NOT EXISTS stand_positions (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position_number INTEGER NOT NULL,
  location_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, position_number)
);

-- Create index for faster lookups by event
CREATE INDEX idx_stand_positions_event ON stand_positions(event_id);

-- Create index for faster lookups by position number
CREATE INDEX idx_stand_positions_position ON stand_positions(position_number);

-- Enable Row Level Security
ALTER TABLE stand_positions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations (coordinators use admin-auth cookie, not RLS)
-- This is consistent with other coordinator-managed tables
CREATE POLICY "Allow all operations on stand_positions" 
  ON stand_positions FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE stand_positions IS 'Stores location data for stand positions. Locations are tied to position numbers, not participants, so they persist when participants move between stands.';
COMMENT ON COLUMN stand_positions.position_number IS 'Stand number (e.g., 1-50 for Lemonade Day events)';
COMMENT ON COLUMN stand_positions.location_data IS 'JSONB containing: placeId, address, lat, lng, placeName, instructions, assignedBy, assignedAt';
