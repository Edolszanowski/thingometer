/**
 * Migration Script: Convert score columns from NOT NULL with default 0 to nullable
 * 
 * This script:
 * 1. Alters the database schema to make score columns nullable
 * 2. Converts existing 0 values to NULL for unscored records (all values are 0)
 * 3. Preserves records where at least one category has a value > 0
 * 
 * Run with: npx tsx scripts/migrate-scores-nullable.ts
 */

import { config } from "dotenv"
import { resolve } from "path"
import { neon } from "@neondatabase/serverless"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set")
  }
  return url
}

async function migrateScoresNullable() {
  const sql = neon(getDatabaseUrl())

  console.log("Starting migration: Making score columns nullable...")

  try {
    // Step 1: Alter columns to be nullable (remove NOT NULL constraint and default)
    console.log("\n1. Altering score columns to be nullable...")
    
    await sql`
      ALTER TABLE scores 
      ALTER COLUMN lighting DROP NOT NULL,
      ALTER COLUMN lighting DROP DEFAULT,
      ALTER COLUMN theme DROP NOT NULL,
      ALTER COLUMN theme DROP DEFAULT,
      ALTER COLUMN traditions DROP NOT NULL,
      ALTER COLUMN traditions DROP DEFAULT,
      ALTER COLUMN spirit DROP NOT NULL,
      ALTER COLUMN spirit DROP DEFAULT,
      ALTER COLUMN music DROP NOT NULL,
      ALTER COLUMN music DROP DEFAULT
    `
    
    console.log("✓ Columns altered to nullable")

    // Step 2: Convert existing 0 values to NULL for unscored records
    // Only update records where ALL values are 0 (unscored records)
    console.log("\n2. Converting unscored records (all 0s) to NULL...")
    
    const result = await sql`
      UPDATE scores
      SET 
        lighting = NULL,
        theme = NULL,
        traditions = NULL,
        spirit = NULL,
        music = NULL
      WHERE 
        lighting = 0 
        AND theme = 0 
        AND traditions = 0 
        AND spirit = 0 
        AND music = 0
    `
    
    console.log(`✓ Converted unscored records to NULL`)
    console.log(`  (Records with at least one value > 0 were preserved)`)

    // Step 3: Verify migration
    console.log("\n3. Verifying migration...")
    
    const nullCount = await sql`
      SELECT COUNT(*) as count
      FROM scores
      WHERE lighting IS NULL 
        AND theme IS NULL 
        AND traditions IS NULL 
        AND spirit IS NULL 
        AND music IS NULL
    `
    
    const scoredCount = await sql`
      SELECT COUNT(*) as count
      FROM scores
      WHERE lighting IS NOT NULL 
        OR theme IS NOT NULL 
        OR traditions IS NOT NULL 
        OR spirit IS NOT NULL 
        OR music IS NOT NULL
    `
    
    console.log(`✓ Migration complete:`)
    console.log(`  - Unscored records (NULL): ${nullCount[0].count}`)
    console.log(`  - Scored records (at least one value): ${scoredCount[0].count}`)

    console.log("\n✅ Migration completed successfully!")
    console.log("\nNote: Judges will need to re-enter scores for records that were converted to NULL.")

  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message)
    console.error("Error details:", error)
    process.exit(1)
  }
}

migrateScoresNullable()

