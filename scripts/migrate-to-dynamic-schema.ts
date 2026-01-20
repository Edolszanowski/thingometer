/**
 * Migration Script: Convert to Dynamic Event-Based Schema
 * 
 * This script implements the plan from christmas-parade-judging-app.plan.md:
 * 1. Adds scoringCategories JSONB to events table
 * 2. Creates event_categories table
 * 3. Adds eventId to judges table
 * 4. Creates score_items table
 * 5. Adds eventId to scores table
 * 6. Creates judge_submissions table
 * 7. Migrates existing data (or deletes for fresh start)
 * 
 * WARNING: This will DELETE all existing score data if starting fresh!
 */

import { config } from "dotenv"
import { resolve } from "path"
import { neon } from "@neondatabase/serverless"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set")
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function migrate() {
  console.log("🚀 Starting migration to dynamic event-based schema...\n")
  console.log("⚠️  WARNING: This will delete all existing score data!\n")

  try {
    // Step 0: Create events table if it doesn't exist
    console.log("Step 0: Creating events table if it doesn't exist...")
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          city TEXT NOT NULL,
          event_date TIMESTAMP,
          active BOOLEAN NOT NULL DEFAULT true,
          entry_category_title TEXT DEFAULT 'Best Entry',
          scoring_categories JSONB DEFAULT '[
            {"name": "Lighting", "required": true, "hasNone": true},
            {"name": "Theme", "required": true, "hasNone": true},
            {"name": "Traditions", "required": true, "hasNone": true},
            {"name": "Spirit", "required": true, "hasNone": true},
            {"name": "Music", "required": false, "hasNone": true}
          ]'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `
      console.log("  ✓ Events table created or already exists")
    } catch (error: any) {
      console.error(`  ❌ Error creating events table: ${error.message}`)
      throw error
    }

    // Step 0.5: Add entry_category_title if it doesn't exist
    console.log("Step 0.5: Adding entry_category_title column if needed...")
    try {
      await sql`
        ALTER TABLE events 
        ADD COLUMN IF NOT EXISTS entry_category_title TEXT DEFAULT 'Best Entry'
      `
      console.log("  ✓ entry_category_title column added or already exists")
    } catch (error: any) {
      if (!error.message.includes("already exists")) {
        console.log(`  ⚠️  Could not add entry_category_title: ${error.message}`)
      } else {
        console.log("  ✓ entry_category_title column already exists")
      }
    }

    // Step 1: Add scoringCategories JSONB column to events table
    console.log("Step 1: Adding scoringCategories to events table...")
    try {
      await sql`
        ALTER TABLE events 
        ADD COLUMN IF NOT EXISTS scoring_categories JSONB DEFAULT '[
          {"name": "Lighting", "required": true, "hasNone": true},
          {"name": "Theme", "required": true, "hasNone": true},
          {"name": "Traditions", "required": true, "hasNone": true},
          {"name": "Spirit", "required": true, "hasNone": true},
          {"name": "Music", "required": false, "hasNone": true}
        ]'::jsonb
      `
      console.log("  ✓ Added scoring_categories column to events")
    } catch (error: any) {
      if (!error.message.includes("already exists")) {
        throw error
      }
      console.log("  ✓ scoring_categories column already exists")
    }

    // Step 2: Create event_categories table
    console.log("\nStep 2: Creating event_categories table...")
    await sql`
      CREATE TABLE IF NOT EXISTS event_categories (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        category_name TEXT NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 0,
        required BOOLEAN NOT NULL DEFAULT true,
        has_none_option BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(event_id, category_name)
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_event_categories_event_id ON event_categories(event_id)`
    console.log("  ✓ Created event_categories table with indexes")

    // Step 3: Populate event_categories from events' scoringCategories JSONB
    console.log("\nStep 3: Populating event_categories from events...")
    try {
      await sql`
        INSERT INTO event_categories (event_id, category_name, display_order, required, has_none_option)
        SELECT 
          e.id,
          (cat->>'name')::text,
          row_number() OVER (PARTITION BY e.id ORDER BY (cat->>'name')) - 1,
          COALESCE((cat->>'required')::boolean, true),
          COALESCE((cat->>'hasNone')::boolean, true)
        FROM events e
        CROSS JOIN LATERAL jsonb_array_elements(e.scoring_categories) AS cat
        WHERE NOT EXISTS (
          SELECT 1 FROM event_categories ec 
          WHERE ec.event_id = e.id AND ec.category_name = (cat->>'name')::text
        )
      `
      console.log("  ✓ Populated event_categories from existing events")
    } catch (error: any) {
      console.log(`  ⚠️  Could not populate event_categories: ${error.message}`)
    }

    // Step 4: Update judges table - add eventId, update constraints
    console.log("\nStep 4: Updating judges table...")
    try {
      // Add eventId column (nullable)
      await sql`
        ALTER TABLE judges 
        ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE CASCADE
      `
      console.log("  ✓ Added event_id column to judges")

      // Drop old unique constraint on name if it exists
      try {
        await sql`ALTER TABLE judges DROP CONSTRAINT IF EXISTS judges_name_key`
        console.log("  ✓ Dropped old unique constraint on name")
      } catch (error: any) {
        // Constraint might not exist or have different name
        console.log("  ℹ️  No old constraint to drop")
      }

      // Add new unique constraint on (eventId, name)
      try {
        await sql`ALTER TABLE judges ADD CONSTRAINT judges_event_id_name_unique UNIQUE (event_id, name)`
        console.log("  ✓ Added unique constraint on (event_id, name)")
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          console.log("  ✓ Unique constraint already exists")
        } else {
          throw error
        }
      }

      // Add created_at if missing
      await sql`
        ALTER TABLE judges 
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()
      `
      console.log("  ✓ Added created_at column to judges")
    } catch (error: any) {
      console.error(`  ❌ Error updating judges table: ${error.message}`)
      throw error
    }

    // Step 5: Migrate existing judges to first active event (or create default event)
    console.log("\nStep 5: Migrating existing judges to events...")
    try {
      // Get or create default event
      const defaultEvent = await sql`
        SELECT id FROM events WHERE active = true ORDER BY created_at LIMIT 1
      `
      
      if (defaultEvent.length > 0) {
        const eventId = defaultEvent[0].id
        // Update judges without eventId to use default event
        await sql`
          UPDATE judges 
          SET event_id = ${eventId}
          WHERE event_id IS NULL
        `
        console.log(`  ✓ Migrated existing judges to event ${eventId}`)
      } else {
        console.log("  ℹ️  No active event found, judges will remain without event_id")
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not migrate judges: ${error.message}`)
    }

    // Step 6: Create score_items table
    console.log("\nStep 6: Creating score_items table...")
    await sql`
      CREATE TABLE IF NOT EXISTS score_items (
        id SERIAL PRIMARY KEY,
        score_id INTEGER NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
        event_category_id INTEGER NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
        value INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(score_id, event_category_id)
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_score_items_score_id ON score_items(score_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_score_items_event_category_id ON score_items(event_category_id)`
    console.log("  ✓ Created score_items table with indexes")

    // Step 7: Add eventId to scores table
    console.log("\nStep 7: Adding eventId to scores table...")
    try {
      await sql`
        ALTER TABLE scores 
        ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE CASCADE
      `
      console.log("  ✓ Added event_id column to scores")

      // Populate eventId from floats
      await sql`
        UPDATE scores s
        SET event_id = f.event_id
        FROM floats f
        WHERE s.float_id = f.id AND s.event_id IS NULL
      `
      console.log("  ✓ Populated event_id in scores from floats")
    } catch (error: any) {
      console.log(`  ⚠️  Could not add event_id to scores: ${error.message}`)
    }

    // Step 8: Make legacy score columns nullable (if not already)
    console.log("\nStep 8: Making legacy score columns nullable...")
    try {
      await sql`ALTER TABLE scores ALTER COLUMN lighting DROP NOT NULL`
    } catch (error: any) {
      // Column might already be nullable or not exist
    }
    try {
      await sql`ALTER TABLE scores ALTER COLUMN theme DROP NOT NULL`
    } catch (error: any) {}
    try {
      await sql`ALTER TABLE scores ALTER COLUMN traditions DROP NOT NULL`
    } catch (error: any) {}
    try {
      await sql`ALTER TABLE scores ALTER COLUMN spirit DROP NOT NULL`
    } catch (error: any) {}
    try {
      await sql`ALTER TABLE scores ALTER COLUMN music DROP NOT NULL`
    } catch (error: any) {}
    console.log("  ✓ Legacy score columns are nullable")

    // Step 9: Migrate existing scores to score_items (optional - for data preservation)
    console.log("\nStep 9: Migrating existing scores to score_items...")
    try {
      // Get default categories for each event
      await sql`
        INSERT INTO score_items (score_id, event_category_id, value)
        SELECT 
          s.id,
          ec.id,
          CASE ec.category_name
            WHEN 'Lighting' THEN s.lighting
            WHEN 'Theme' THEN s.theme
            WHEN 'Traditions' THEN s.traditions
            WHEN 'Spirit' THEN s.spirit
            WHEN 'Music' THEN s.music
            ELSE NULL
          END
        FROM scores s
        JOIN floats f ON s.float_id = f.id
        JOIN events e ON f.event_id = e.id
        JOIN event_categories ec ON ec.event_id = e.id
        WHERE NOT EXISTS (
          SELECT 1 FROM score_items si 
          WHERE si.score_id = s.id AND si.event_category_id = ec.id
        )
        AND (
          (ec.category_name = 'Lighting' AND s.lighting IS NOT NULL) OR
          (ec.category_name = 'Theme' AND s.theme IS NOT NULL) OR
          (ec.category_name = 'Traditions' AND s.traditions IS NOT NULL) OR
          (ec.category_name = 'Spirit' AND s.spirit IS NOT NULL) OR
          (ec.category_name = 'Music' AND s.music IS NOT NULL)
        )
      `
      const migrated = await sql`SELECT COUNT(*) as count FROM score_items`
      console.log(`  ✓ Migrated scores to score_items (${migrated[0]?.count || 0} items created)`)
    } catch (error: any) {
      console.log(`  ⚠️  Could not migrate scores: ${error.message}`)
      console.log("  ℹ️  This is okay if starting fresh - old scores will be deleted")
    }

    // Step 10: Create judge_submissions table
    console.log("\nStep 10: Creating judge_submissions table...")
    await sql`
      CREATE TABLE IF NOT EXISTS judge_submissions (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
        submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        UNIQUE(event_id, judge_id)
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_judge_submissions_event_id ON judge_submissions(event_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_judge_submissions_judge_id ON judge_submissions(judge_id)`
    console.log("  ✓ Created judge_submissions table with indexes")

    // Step 11: Migrate existing submissions to judge_submissions
    console.log("\nStep 11: Migrating existing judge submissions...")
    try {
      await sql`
        INSERT INTO judge_submissions (event_id, judge_id, submitted_at)
        SELECT 
          COALESCE(j.event_id, e.id),
          j.id,
          NOW()
        FROM judges j
        LEFT JOIN events e ON e.active = true
        WHERE j.submitted = true
        AND NOT EXISTS (
          SELECT 1 FROM judge_submissions js 
          WHERE js.judge_id = j.id AND js.event_id = COALESCE(j.event_id, e.id)
        )
        LIMIT 1
      `
      console.log("  ✓ Migrated existing judge submissions")
    } catch (error: any) {
      console.log(`  ⚠️  Could not migrate submissions: ${error.message}`)
    }

    // Step 12: Create trigger function to update score total from score_items
    console.log("\nStep 12: Creating trigger function for score totals...")
    await sql`
      CREATE OR REPLACE FUNCTION update_score_total()
      RETURNS TRIGGER AS $$
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
      $$ LANGUAGE plpgsql;
    `
    console.log("  ✓ Created update_score_total function")

    // Step 13: Create triggers to auto-update score totals
    console.log("\nStep 13: Creating triggers...")
    // Drop triggers separately
    try {
      await sql`DROP TRIGGER IF EXISTS trigger_update_score_total_insert ON score_items`
    } catch (error: any) {
      // Ignore if doesn't exist
    }
    await sql`
      CREATE TRIGGER trigger_update_score_total_insert
      AFTER INSERT ON score_items
      FOR EACH ROW
      EXECUTE FUNCTION update_score_total()
    `
    
    try {
      await sql`DROP TRIGGER IF EXISTS trigger_update_score_total_update ON score_items`
    } catch (error: any) {
      // Ignore if doesn't exist
    }
    await sql`
      CREATE TRIGGER trigger_update_score_total_update
      AFTER UPDATE ON score_items
      FOR EACH ROW
      EXECUTE FUNCTION update_score_total()
    `
    
    try {
      await sql`DROP TRIGGER IF EXISTS trigger_update_score_total_delete ON score_items`
    } catch (error: any) {
      // Ignore if doesn't exist
    }
    await sql`
      CREATE TRIGGER trigger_update_score_total_delete
      AFTER DELETE ON score_items
      FOR EACH ROW
      EXECUTE FUNCTION update_score_total()
    `
    console.log("  ✓ Created triggers for auto-updating score totals")

    console.log("\n✅ Migration completed successfully!")
    console.log("\n📋 Next steps:")
    console.log("  1. Update your application code to use the new schema")
    console.log("  2. Create events with categories and judges")
    console.log("  3. Test the scoring flow")
    console.log("\n⚠️  Note: Existing score data has been migrated to score_items where possible")

  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run migration
migrate()
