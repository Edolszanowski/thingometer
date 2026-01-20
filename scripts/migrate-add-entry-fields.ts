import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

import { neon } from "@neondatabase/serverless"

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  const sql = neon(databaseUrl)

  try {
    console.log("Starting migration: Adding new fields to floats table...")

    // Add new columns to floats table
    // Using ALTER TABLE with IF NOT EXISTS equivalent logic
    const alterTableQueries = [
      // Make float_number nullable
      `ALTER TABLE floats ALTER COLUMN float_number DROP NOT NULL`,
      // Add new columns
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS first_name TEXT`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS last_name TEXT`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS title TEXT`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS phone TEXT`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS email TEXT`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS comments TEXT`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS entry_length TEXT`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS float_description TEXT`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS type_of_entry TEXT`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS has_music BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE floats ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP`,
    ]

    for (const query of alterTableQueries) {
      try {
        await sql(query)
        console.log(`✓ Executed: ${query.substring(0, 60)}...`)
      } catch (error: any) {
        // If column already exists or constraint already dropped, that's okay
        if (error?.message?.includes("already exists") || 
            error?.message?.includes("does not exist") ||
            error?.code === "42701") {
          console.log(`⚠ Skipped (already exists): ${query.substring(0, 60)}...`)
        } else {
          throw error
        }
      }
    }

    // Set all existing floats to approved = true
    await sql`UPDATE floats SET approved = true WHERE approved IS NULL OR approved = false`
    console.log("✓ Set all existing floats to approved = true")

    // Drop unique constraint on float_number if it exists (since it's now nullable)
    // We'll need to handle this carefully - check if constraint exists first
    try {
      await sql`ALTER TABLE floats DROP CONSTRAINT IF EXISTS floats_float_number_unique`
      console.log("✓ Dropped unique constraint on float_number (if it existed)")
    } catch (error: any) {
      console.log("⚠ Could not drop unique constraint (may not exist):", error.message)
    }

    console.log("\n✅ Migration completed successfully!")
    console.log("\nNote: You may need to manually handle the float_number unique constraint")
    console.log("if you want to allow multiple floats without assigned numbers.")
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

migrate()

