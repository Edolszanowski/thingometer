-- ============================================================================
-- PARADE MANAGEMENT SYSTEM - SUPABASE SCHEMA (CORRECTED ORDER)
-- Generated migration from Neon PostgreSQL
-- ============================================================================

-- ============================================================================
-- STEP 1: FUNCTIONS (must be created before triggers)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_score_total()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      BEGIN
        UPDATE scores
        SET total = COALESCE((
          SELECT SUM(COALESCE(value, 0))
          FROM score_items
          WHERE score_id = COALESCE(NEW.score_id, OLD.score_id)
        ), 0),
        updated_at = NOW()
        WHERE id = COALESCE(NEW.score_id, OLD.score_id);
        RETURN COALESCE(NEW, OLD);
      END;
      $function$;

-- ============================================================================
-- STEP 2: TABLES (in dependency order)
-- ============================================================================

-- Events table (no dependencies)
CREATE TABLE IF NOT EXISTS "events" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "event_date" TIMESTAMP,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "scoring_categories" JSONB DEFAULT '[{"name": "Lighting", "hasNone": true, "required": true}, {"name": "Theme", "hasNone": true, "required": true}, {"name": "Traditions", "hasNone": true, "required": true}, {"name": "Spirit", "hasNone": true, "required": true}, {"name": "Music", "hasNone": true, "required": false}]'::jsonb,
  "entry_category_title" TEXT DEFAULT 'Best Entry'::text
);

-- Event categories (depends on events)
CREATE TABLE IF NOT EXISTS "event_categories" (
  "id" SERIAL PRIMARY KEY,
  "event_id" INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "category_name" TEXT NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "has_none_option" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (event_id, category_name)
);

-- Judges (depends on events)
CREATE TABLE IF NOT EXISTS "judges" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "submitted" BOOLEAN NOT NULL DEFAULT false,
  "event_id" INTEGER REFERENCES events(id) ON DELETE CASCADE,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);

-- Participants (no dependencies)
CREATE TABLE IF NOT EXISTS "participants" (
  "id" SERIAL PRIMARY KEY,
  "organization" TEXT NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "title" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "entry_name" TEXT,
  "type_of_entry" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Floats (depends on events)
CREATE TABLE IF NOT EXISTS "floats" (
  "id" SERIAL PRIMARY KEY,
  "float_number" INTEGER UNIQUE,
  "organization" TEXT NOT NULL,
  "entry_name" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "first_name" TEXT,
  "last_name" TEXT,
  "title" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "comments" TEXT,
  "entry_length" TEXT,
  "float_description" TEXT,
  "type_of_entry" TEXT,
  "has_music" BOOLEAN NOT NULL DEFAULT false,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "submitted_at" TIMESTAMP,
  "event_id" INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE
);

-- Scores (depends on judges, floats, events)
CREATE TABLE IF NOT EXISTS "scores" (
  "id" SERIAL PRIMARY KEY,
  "judge_id" INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  "float_id" INTEGER NOT NULL REFERENCES floats(id) ON DELETE CASCADE,
  "lighting" INTEGER,
  "theme" INTEGER,
  "traditions" INTEGER,
  "spirit" INTEGER,
  "music" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "event_id" INTEGER REFERENCES events(id) ON DELETE CASCADE,
  "total" INTEGER NOT NULL DEFAULT 0,
  UNIQUE (judge_id, float_id)
);

-- Score items (depends on scores, event_categories)
CREATE TABLE IF NOT EXISTS "score_items" (
  "id" SERIAL PRIMARY KEY,
  "score_id" INTEGER NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  "event_category_id" INTEGER NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
  "value" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (score_id, event_category_id)
);

-- Judge submissions (depends on events, judges)
CREATE TABLE IF NOT EXISTS "judge_submissions" (
  "id" SERIAL PRIMARY KEY,
  "event_id" INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  "judge_id" INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  "submitted_at" TIMESTAMP NOT NULL DEFAULT now(),
  "ip_address" TEXT,
  UNIQUE (event_id, judge_id)
);

-- Settings (no dependencies)
CREATE TABLE IF NOT EXISTS "settings" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 3: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_event_categories_event_id ON event_categories (event_id);
CREATE INDEX IF NOT EXISTS idx_floats_float_number ON floats (float_number);
CREATE INDEX IF NOT EXISTS idx_scores_float ON scores (float_id);
CREATE INDEX IF NOT EXISTS idx_scores_judge ON scores (judge_id);
CREATE INDEX IF NOT EXISTS idx_score_items_score_id ON score_items (score_id);
CREATE INDEX IF NOT EXISTS idx_score_items_event_category_id ON score_items (event_category_id);
CREATE INDEX IF NOT EXISTS idx_judge_submissions_event_id ON judge_submissions (event_id);
CREATE INDEX IF NOT EXISTS idx_judge_submissions_judge_id ON judge_submissions (judge_id);

-- ============================================================================
-- STEP 4: TRIGGERS (must be created after tables)
-- ============================================================================

CREATE TRIGGER trg_scores_timestamp 
  BEFORE UPDATE ON scores 
  FOR EACH ROW 
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_score_total_insert 
  AFTER INSERT ON score_items 
  FOR EACH ROW 
  EXECUTE FUNCTION update_score_total();

CREATE TRIGGER trigger_update_score_total_update 
  AFTER UPDATE ON score_items 
  FOR EACH ROW 
  EXECUTE FUNCTION update_score_total();

CREATE TRIGGER trigger_update_score_total_delete 
  AFTER DELETE ON score_items 
  FOR EACH ROW 
  EXECUTE FUNCTION update_score_total();

