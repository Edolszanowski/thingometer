import { config } from "dotenv"
import { resolve } from "path"
import { neon } from "@neondatabase/serverless"

config({ path: resolve(process.cwd(), ".env.local") })

const sql = neon(process.env.DATABASE_URL!)

async function fixTotalColumn() {
  try {
    console.log("Fixing total column to be a regular column (not generated)...")
    
    // Drop triggers first
    await sql`DROP TRIGGER IF EXISTS trigger_update_score_total_insert ON score_items`
    await sql`DROP TRIGGER IF EXISTS trigger_update_score_total_update ON score_items`
    await sql`DROP TRIGGER IF EXISTS trigger_update_score_total_delete ON score_items`
    console.log("✓ Dropped triggers")
    
    // Drop the trigger function
    await sql`DROP FUNCTION IF EXISTS update_score_total()`
    console.log("✓ Dropped trigger function")
    
    // Drop the generated column (CASCADE to drop dependencies)
    await sql`ALTER TABLE scores DROP COLUMN IF EXISTS total CASCADE`
    console.log("✓ Dropped generated total column")
    
    // Create regular total column
    await sql`ALTER TABLE scores ADD COLUMN total INTEGER NOT NULL DEFAULT 0`
    console.log("✓ Created regular total column")
    
    // Recreate the trigger function (it should work now)
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
    console.log("✓ Recreated trigger function")
    
    // Recreate triggers
    await sql`
      CREATE TRIGGER trigger_update_score_total_insert
      AFTER INSERT ON score_items
      FOR EACH ROW
      EXECUTE FUNCTION update_score_total()
    `
    await sql`
      CREATE TRIGGER trigger_update_score_total_update
      AFTER UPDATE ON score_items
      FOR EACH ROW
      EXECUTE FUNCTION update_score_total()
    `
    await sql`
      CREATE TRIGGER trigger_update_score_total_delete
      AFTER DELETE ON score_items
      FOR EACH ROW
      EXECUTE FUNCTION update_score_total()
    `
    console.log("✓ Recreated triggers")
    
    console.log("\n✅ Total column fixed! The trigger should now work correctly.")
  } catch (error: any) {
    console.error("Error:", error.message)
    process.exit(1)
  }
}

fixTotalColumn()

