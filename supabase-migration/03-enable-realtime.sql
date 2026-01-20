-- ============================================================================
-- ENABLE SUPABASE REALTIME FOR PARADE JUDGE TABLES
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Enable realtime for the tables that need live updates
-- This allows clients to subscribe to changes via WebSocket

-- First, check if the publication exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add tables to the realtime publication
-- scores - updates when judges submit scores
ALTER PUBLICATION supabase_realtime ADD TABLE scores;

-- score_items - individual score category values
ALTER PUBLICATION supabase_realtime ADD TABLE score_items;

-- judges - when judge status changes (submitted)
ALTER PUBLICATION supabase_realtime ADD TABLE judges;

-- floats - when entries are approved/modified
ALTER PUBLICATION supabase_realtime ADD TABLE floats;

-- judge_submissions - submission tracking
ALTER PUBLICATION supabase_realtime ADD TABLE judge_submissions;

-- events - event changes
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- event_categories - category changes
ALTER PUBLICATION supabase_realtime ADD TABLE event_categories;

-- Verify the publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

