-- ============================================================================
-- Enable Row Level Security (RLS) on all public tables
-- Migration: 04-enable-rls.sql
-- ============================================================================
-- This migration enables RLS on all tables to satisfy Supabase security requirements.
-- Since the application uses direct PostgreSQL connections (not Supabase client),
-- these policies allow all operations. If the application switches to using
-- Supabase client with anon key, these policies can be refined for proper access control.

-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations on events
CREATE POLICY "Allow all operations on events"
  ON public.events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on event_categories table
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations on event_categories
CREATE POLICY "Allow all operations on event_categories"
  ON public.event_categories
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on judges table
ALTER TABLE public.judges ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations on judges
CREATE POLICY "Allow all operations on judges"
  ON public.judges
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on participants table
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations on participants
CREATE POLICY "Allow all operations on participants"
  ON public.participants
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on floats table
ALTER TABLE public.floats ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations on floats
CREATE POLICY "Allow all operations on floats"
  ON public.floats
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on judge_submissions table
ALTER TABLE public.judge_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations on judge_submissions
CREATE POLICY "Allow all operations on judge_submissions"
  ON public.judge_submissions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on settings table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations on settings
CREATE POLICY "Allow all operations on settings"
  ON public.settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on scores table
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations on scores
CREATE POLICY "Allow all operations on scores"
  ON public.scores
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable RLS on score_items table
ALTER TABLE public.score_items ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations on score_items
CREATE POLICY "Allow all operations on score_items"
  ON public.score_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

