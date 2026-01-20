-- ============================================================================
-- PARADE MANAGEMENT SYSTEM - SUPABASE SCHEMA
-- Generated migration from Neon PostgreSQL
-- ============================================================================

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$

;

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
      $function$

;

-- ============================================================================
-- TRIGGERS (will be added after tables are created)
-- ============================================================================

-- trg_scores_timestamp
CREATE TRIGGER trg_scores_timestamp BEFORE UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION update_timestamp()
;

-- trigger_update_score_total_delete
CREATE TRIGGER trigger_update_score_total_delete AFTER DELETE ON public.score_items FOR EACH ROW EXECUTE FUNCTION update_score_total()
;

-- trigger_update_score_total_update
CREATE TRIGGER trigger_update_score_total_update AFTER UPDATE ON public.score_items FOR EACH ROW EXECUTE FUNCTION update_score_total()
;

-- trigger_update_score_total_insert
CREATE TRIGGER trigger_update_score_total_insert AFTER INSERT ON public.score_items FOR EACH ROW EXECUTE FUNCTION update_score_total()
;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "event_categories" (
  "id" INTEGER NOT NULL,
  "event_id" INTEGER NOT NULL,
  "category_name" TEXT NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "has_none_option" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;


ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_event_id_category_name_key" UNIQUE (event_id, category_name);


CREATE INDEX idx_event_categories_event_id ON public.event_categories USING btree (event_id);




CREATE TABLE IF NOT EXISTS "events" (
  "id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "event_date" TIMESTAMP,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "scoring_categories" JSONB DEFAULT '[{"name": "Lighting", "hasNone": true, "required": true}, {"name": "Theme", "hasNone": true, "required": true}, {"name": "Traditions", "hasNone": true, "required": true}, {"name": "Spirit", "hasNone": true, "required": true}, {"name": "Music", "hasNone": true, "required": false}]'::jsonb,
  "entry_category_title" TEXT DEFAULT 'Best Entry'::text,
  PRIMARY KEY (id)
);



CREATE TABLE IF NOT EXISTS "floats" (
  "id" INTEGER NOT NULL,
  "float_number" INTEGER,
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
  "event_id" INTEGER NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE "floats" ADD CONSTRAINT "floats_event_id_events_id_fk" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;


ALTER TABLE "floats" ADD CONSTRAINT "floats_float_number_key" UNIQUE (float_number);


CREATE INDEX idx_floats_float_number ON public.floats USING btree (float_number);




CREATE TABLE IF NOT EXISTS "judge_submissions" (
  "id" INTEGER NOT NULL,
  "event_id" INTEGER NOT NULL,
  "judge_id" INTEGER NOT NULL,
  "submitted_at" TIMESTAMP NOT NULL DEFAULT now(),
  "ip_address" TEXT,
  PRIMARY KEY (id)
);

ALTER TABLE "judge_submissions" ADD CONSTRAINT "judge_submissions_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;


ALTER TABLE "judge_submissions" ADD CONSTRAINT "judge_submissions_judge_id_fkey" FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE;


ALTER TABLE "judge_submissions" ADD CONSTRAINT "judge_submissions_event_id_judge_id_key" UNIQUE (event_id, judge_id);


CREATE INDEX idx_judge_submissions_event_id ON public.judge_submissions USING btree (event_id);


CREATE INDEX idx_judge_submissions_judge_id ON public.judge_submissions USING btree (judge_id);




CREATE TABLE IF NOT EXISTS "judges" (
  "id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "submitted" BOOLEAN NOT NULL DEFAULT false,
  "event_id" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE "judges" ADD CONSTRAINT "judges_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;


ALTER TABLE "judges" ADD CONSTRAINT "judges_event_id_name_unique" UNIQUE (event_id, name);




CREATE TABLE IF NOT EXISTS "participants" (
  "id" INTEGER NOT NULL,
  "organization" TEXT NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "title" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "entry_name" TEXT,
  "type_of_entry" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);



CREATE TABLE IF NOT EXISTS "score_items" (
  "id" INTEGER NOT NULL,
  "score_id" INTEGER NOT NULL,
  "event_category_id" INTEGER NOT NULL,
  "value" INTEGER,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE "score_items" ADD CONSTRAINT "score_items_score_id_fkey" FOREIGN KEY (score_id) REFERENCES scores(id) ON DELETE CASCADE;


ALTER TABLE "score_items" ADD CONSTRAINT "score_items_event_category_id_fkey" FOREIGN KEY (event_category_id) REFERENCES event_categories(id) ON DELETE CASCADE;


ALTER TABLE "score_items" ADD CONSTRAINT "score_items_score_id_event_category_id_key" UNIQUE (score_id, event_category_id);


CREATE INDEX idx_score_items_score_id ON public.score_items USING btree (score_id);


CREATE INDEX idx_score_items_event_category_id ON public.score_items USING btree (event_category_id);




CREATE TABLE IF NOT EXISTS "scores" (
  "id" INTEGER NOT NULL,
  "judge_id" INTEGER NOT NULL,
  "float_id" INTEGER NOT NULL,
  "lighting" INTEGER,
  "theme" INTEGER,
  "traditions" INTEGER,
  "spirit" INTEGER,
  "music" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "event_id" INTEGER,
  "total" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id)
);

ALTER TABLE "scores" ADD CONSTRAINT "scores_judge_id_fkey" FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE;


ALTER TABLE "scores" ADD CONSTRAINT "scores_float_id_fkey" FOREIGN KEY (float_id) REFERENCES floats(id) ON DELETE CASCADE;


ALTER TABLE "scores" ADD CONSTRAINT "scores_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;


ALTER TABLE "scores" ADD CONSTRAINT "uniq_judge_float" UNIQUE (judge_id, float_id);


CREATE INDEX idx_scores_float ON public.scores USING btree (float_id);


CREATE INDEX idx_scores_judge ON public.scores USING btree (judge_id);




CREATE TABLE IF NOT EXISTS "settings" (
  "id" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE "settings" ADD CONSTRAINT "settings_key_key" UNIQUE (key);



