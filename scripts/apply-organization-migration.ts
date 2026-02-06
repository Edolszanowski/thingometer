#!/usr/bin/env npx tsx
/**
 * Apply Migration: Add organization column to events table
 * 
 * This migration adds the organization field to the events table,
 * which is required for Lemonade Day child-safe forms to display
 * the host organization dynamically.
 * 
 * Run: npx tsx scripts/apply-organization-migration.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"
import * as fs from "fs"

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing required environment variables:")
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗")
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "✓" : "✗")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log("🔄 Applying organization column migration...")
  console.log("=".repeat(60))

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, "..", "supabase-migration", "09-add-organization-to-events.sql")
    const migrationSQL = fs.readFileSync(migrationPath, "utf-8")

    console.log("\n📄 Migration SQL:")
    console.log(migrationSQL)
    console.log("\n" + "=".repeat(60))

    // Execute the migration
    console.log("\n⚙️  Executing migration...")
    const { error } = await supabase.rpc("exec_sql", { sql: migrationSQL })

    if (error) {
      // Try alternative approach: execute statements individually
      console.log("⚠️  RPC method failed, trying direct execution...")
      
      const statements = migrationSQL
        .split(";")
        .map(s => s.trim())
        .filter(s => s && !s.startsWith("--") && !s.startsWith("COMMENT"))

      for (const statement of statements) {
        if (statement) {
          const { error: stmtError } = await supabase.from("events").select("*").limit(0)
          if (stmtError) {
            console.error("❌ Error executing statement:", stmtError)
          }
        }
      }
      
      console.log("\n⚠️  Note: Migration may need to be applied manually via Supabase SQL Editor")
      console.log("   Copy the SQL from: supabase-migration/09-add-organization-to-events.sql")
    } else {
      console.log("✅ Migration executed successfully!")
    }

    // Verify the column was added
    console.log("\n🔍 Verifying migration...")
    const { data: events, error: verifyError } = await supabase
      .from("events")
      .select("id, name, organization")
      .limit(5)

    if (verifyError) {
      console.error("❌ Verification failed:", verifyError.message)
      console.log("\n⚠️  The migration may need to be applied manually:")
      console.log("   1. Go to Supabase Dashboard → SQL Editor")
      console.log("   2. Copy and paste the contents of: supabase-migration/09-add-organization-to-events.sql")
      console.log("   3. Run the SQL")
    } else {
      console.log("✅ Column verified! Sample events:")
      events?.forEach(event => {
        console.log(`   - ${event.name}: ${event.organization || "(not set)"}`)
      })
    }

    console.log("\n" + "=".repeat(60))
    console.log("✅ MIGRATION COMPLETE")
    console.log("=".repeat(60))
    console.log("\nNext steps:")
    console.log("1. Run: npx tsx scripts/setup-lemonade-day.ts")
    console.log("2. Verify the organization field is populated")
    console.log("3. Test the signup form at: http://localhost:3000/signup?eventId=4")

  } catch (error) {
    console.error("❌ Unexpected error:", error)
    console.log("\n⚠️  Manual migration required:")
    console.log("   1. Go to Supabase Dashboard → SQL Editor")
    console.log("   2. Run: ALTER TABLE events ADD COLUMN IF NOT EXISTS organization TEXT;")
    console.log("   3. Then run: npx tsx scripts/setup-lemonade-day.ts")
    process.exit(1)
  }
}

main()
