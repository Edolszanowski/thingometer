/**
 * Migration Script: Create settings table
 * 
 * This script creates the settings table for application-wide configuration.
 * 
 * Run with: npx tsx scripts/migrate-settings-table.ts
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

async function migrateSettingsTable() {
  const sql = neon(getDatabaseUrl())

  console.log("Starting migration: Creating settings table...")

  try {
    // Check if table already exists
    const checkTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'settings'
      )
    `
    
    if (checkTable[0].exists) {
      console.log("✓ Settings table already exists")
      return
    }

    // Create settings table
    console.log("\n1. Creating settings table...")
    
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `
    
    console.log("✓ Settings table created")

    console.log("\n✅ Migration completed successfully!")

  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message)
    console.error("Error details:", error)
    process.exit(1)
  }
}

migrateSettingsTable()

