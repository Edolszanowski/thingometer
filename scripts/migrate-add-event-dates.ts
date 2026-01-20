/**
 * Migration script to add startDate and endDate columns to events table
 * Run with: npx tsx scripts/migrate-add-event-dates.ts
 */

import "dotenv/config"
import { resolve } from "path"
import { config } from "dotenv"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment variables")
  process.exit(1)
}

async function migrate() {
  const { Client } = await import("pg")
  const client = new Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log("✅ Connected to database")

    // Check if columns already exist
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name IN ('start_date', 'end_date')
    `)

    const existingColumns = checkColumns.rows.map((r: any) => r.column_name)

    // Add start_date column if it doesn't exist
    if (!existingColumns.includes("start_date")) {
      console.log("📝 Adding start_date column to events table...")
      await client.query(`
        ALTER TABLE events 
        ADD COLUMN start_date TIMESTAMP
      `)
      console.log("  ✓ Added start_date column")
    } else {
      console.log("  ✓ start_date column already exists")
    }

    // Add end_date column if it doesn't exist
    if (!existingColumns.includes("end_date")) {
      console.log("📝 Adding end_date column to events table...")
      await client.query(`
        ALTER TABLE events 
        ADD COLUMN end_date TIMESTAMP
      `)
      console.log("  ✓ Added end_date column")
    } else {
      console.log("  ✓ end_date column already exists")
    }

    console.log("\n✅ Migration completed successfully!")
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message)
    if (error.code === "42P01") {
      console.error("   Events table does not exist. Please run migrate-to-dynamic-schema.ts first.")
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

migrate()

