-- ============================================================================
-- Multi-Tenant Branding & Help System
-- Migration: 09-branding-help-system.sql
-- ============================================================================
-- This migration adds:
-- - city_branding: City-level branding configuration
-- - theme_presets: Pre-designed theme templates
-- - help_content: Context-aware help content
-- - user_onboarding: Track user onboarding progress
-- - Extends event_branding with theme_preset and contrast_mode columns

-- ============================================================================
-- CITY_BRANDING - City-level branding configuration
-- ============================================================================
-- Brand Hierarchy: Organization/city identity establishes trust, event identity 
-- provides context, sponsor recognition in designated non-disruptive areas.
-- Operational workflows intentionally minimize branding to preserve focus.

CREATE TABLE IF NOT EXISTS public.city_branding (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  logo_url TEXT,
  logo_dark_url TEXT, -- For dark mode
  favicon_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  custom_css TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (city_id)
);

CREATE INDEX IF NOT EXISTS idx_city_branding_city_id ON public.city_branding(city_id);

-- ============================================================================
-- THEME_PRESETS - Professionally designed, accessibility-tested themes
-- ============================================================================
-- Theme presets function as professionally designed, accessibility-tested 
-- experience foundations that reduce setup time while ensuring visual 
-- consistency and outdoor readability.

CREATE TABLE IF NOT EXISTS public.theme_presets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  colors JSONB NOT NULL, -- {primary, secondary, accent, background, foreground}
  css_variables JSONB, -- Custom CSS variable overrides
  accessibility_mode TEXT DEFAULT 'standard', -- 'standard', 'high-contrast', 'outdoor'
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_theme_presets_slug ON public.theme_presets(slug);
CREATE INDEX IF NOT EXISTS idx_theme_presets_accessibility ON public.theme_presets(accessibility_mode);

-- Insert preset themes
INSERT INTO public.theme_presets (name, slug, description, colors, accessibility_mode) VALUES
('Christmas Parade', 'christmas', 'Red, green, and gold Christmas colors', 
 '{"primary": "#DC2626", "secondary": "#16A34A", "accent": "#F59E0B", "background": "#FFFFFF", "foreground": "#14532D"}'::jsonb, 
 'standard'),
('Lemonade Day', 'lemonade', 'Bright lemon yellow with high contrast for outdoor viewing', 
 '{"primary": "#FCD34D", "secondary": "#F59E0B", "accent": "#FBBF24", "background": "#FFFBEB", "foreground": "#78350F"}'::jsonb, 
 'outdoor'),
('Chili Cookoff', 'chili', 'Warm southwestern colors with rustic feel', 
 '{"primary": "#DC2626", "secondary": "#C2410C", "accent": "#EA580C", "background": "#FFF7ED", "foreground": "#7C2D12"}'::jsonb, 
 'standard'),
('German Festival', 'german', 'Blue and white Bavarian colors', 
 '{"primary": "#1E40AF", "secondary": "#3B82F6", "accent": "#FBBF24", "background": "#EFF6FF", "foreground": "#1E3A8A"}'::jsonb, 
 'standard')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Extend EVENT_BRANDING with theme preset and contrast mode
-- ============================================================================
ALTER TABLE public.event_branding 
ADD COLUMN IF NOT EXISTS theme_preset TEXT, -- 'christmas', 'lemonade', 'chili', 'german', 'custom'
ADD COLUMN IF NOT EXISTS text_contrast_mode TEXT DEFAULT 'auto', -- 'auto', 'high', 'maximum'
ADD COLUMN IF NOT EXISTS logo_dark_url TEXT;

-- ============================================================================
-- HELP_CONTENT - Context-aware help content
-- ============================================================================
-- Help and onboarding features provide just-in-time confidence rather than 
-- formal training, enabling judges, volunteers, and coordinators to perform 
-- effectively with minimal instruction.

CREATE TABLE IF NOT EXISTS public.help_content (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL, -- 'judge', 'admin', 'coordinator', 'public'
  page_context TEXT NOT NULL, -- 'login', 'scoring', 'results', 'approval', etc.
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  video_url TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_help_content_role_context ON public.help_content(role, page_context);
CREATE INDEX IF NOT EXISTS idx_help_content_active ON public.help_content(active);

-- ============================================================================
-- USER_ONBOARDING - Track user onboarding progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id SERIAL PRIMARY KEY,
  user_identifier TEXT NOT NULL, -- Email or judge ID
  role TEXT NOT NULL,
  onboarding_completed BOOLEAN DEFAULT false,
  completed_steps JSONB DEFAULT '[]'::jsonb,
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_identifier ON public.user_onboarding(user_identifier);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_role ON public.user_onboarding(role);

-- ============================================================================
-- Insert default help content for each role and context
-- ============================================================================
INSERT INTO public.help_content (role, page_context, title, content, display_order) VALUES
-- Judge help content
('judge', 'login', 'Logging In', 
 '<p>Select your name from the dropdown list to begin scoring. If you don''t see your name, contact the event coordinator.</p>', 1),
('judge', 'scoring', 'How to Score', 
 '<p>Use the sliders to rate each entry from 0-10 in each category. Your scores are saved automatically as you move between entries.</p>
  <ul>
    <li><strong>0</strong> = Entry does not meet criteria or N/A</li>
    <li><strong>1-3</strong> = Below average</li>
    <li><strong>4-6</strong> = Average</li>
    <li><strong>7-9</strong> = Above average</li>
    <li><strong>10</strong> = Exceptional</li>
  </ul>', 1),
('judge', 'scoring', 'Navigating Entries', 
 '<p>Use the <strong>Previous</strong> and <strong>Next</strong> buttons to move between entries. You can also use the entry list to jump to any specific entry.</p>', 2),
('judge', 'review', 'Reviewing Your Scores', 
 '<p>Review all your scores before submitting. You can go back and adjust any score by clicking on the entry.</p>', 1),
('judge', 'review', 'Submitting Final Scores', 
 '<p>Once you''re satisfied with all scores, click <strong>Submit Scores</strong>. After submission, scores are locked and cannot be changed.</p>', 2),

-- Coordinator help content
('coordinator', 'dashboard', 'Coordinator Dashboard', 
 '<p>The dashboard shows an overview of all entries and their approval status. Use this to manage the event entries.</p>', 1),
('coordinator', 'entries', 'Managing Entries', 
 '<p>Review submitted entries and approve or reject them. Approved entries will appear in the judge''s scoring list.</p>', 1),
('coordinator', 'positions', 'Managing Positions', 
 '<p>Assign position numbers to approved entries. This determines the order entries appear to judges.</p>', 1),

-- Admin help content
('admin', 'results', 'Viewing Results', 
 '<p>The results dashboard shows real-time scoring data from all judges. Results update automatically as judges submit scores.</p>', 1),
('admin', 'judges', 'Managing Judges', 
 '<p>View judge status, unlock submitted scores if needed, and monitor scoring progress.</p>', 1),
('admin', 'export', 'Exporting Data', 
 '<p>Export results to CSV or PDF for record keeping and award ceremonies.</p>', 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Enable RLS on new tables
-- ============================================================================
ALTER TABLE public.city_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on city_branding" 
  ON public.city_branding 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

ALTER TABLE public.theme_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on theme_presets" 
  ON public.theme_presets 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

ALTER TABLE public.help_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on help_content" 
  ON public.help_content 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on user_onboarding" 
  ON public.user_onboarding 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
