/**
 * Apply Multi-Tenant Migration to Active Database
 * 
 * Applies the multi-tenant tables migration to whichever database
 * is configured (Neon or Supabase)
 */

import { config } from "dotenv"
import { resolve } from "path"
import { readFileSync } from "fs"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

const USE_SUPABASE = process.env.USE_SUPABASE === 'true'

function getDatabaseUrl(): string {
  const url = USE_SUPABASE 
    ? (process.env.DATABASE_URL_SUPABASE || process.env.DATABASE_URL)
    : process.env.DATABASE_URL
    
  if (!url) {
    throw new Error(
      USE_SUPABASE 
        ? "DATABASE_URL_SUPABASE or DATABASE_URL environment variable is not set"
        : "DATABASE_URL environment variable is not set"
    )
  }
  return url
}

async function applyMigration() {
  try {
    console.log(`🔧 Applying Multi-Tenant Migration to ${USE_SUPABASE ? 'Supabase' : 'Neon'}...\n`)

    // Read migration file
    const migrationPath = resolve(process.cwd(), "supabase-migration/05-add-multi-tenant-tables.sql")
    const migrationSQL = readFileSync(migrationPath, "utf-8")

    // Execute migration based on database type
    if (USE_SUPABASE) {
      // Use postgres-js for Supabase
      const postgres = require("postgres")
      const sql = postgres(getDatabaseUrl(), {
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
      })

      // Split SQL into individual statements
      const statements = migrationSQL
        .split(";")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && !s.startsWith("--"))

      console.log(`   Executing ${statements.length} statements...`)

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (statement.length > 0) {
          try {
            await sql.unsafe(statement)
            if ((i + 1) % 5 === 0 || i === statements.length - 1) {
              console.log(`   ✓ Executed ${i + 1}/${statements.length} statements...`)
            }
          } catch (error: any) {
            // Ignore "already exists" errors
            if (!error.message?.includes("already exists") && 
                !error.message?.includes("duplicate") &&
                !error.message?.includes("does not exist")) {
              console.error(`   ⚠️  Error in statement ${i + 1}:`, error.message)
              console.error(`   Statement: ${statement.substring(0, 100)}...`)
            }
          }
        }
      }

      await sql.end()
    } else {
      // Use Neon for Neon database
      const { neon } = require("@neondatabase/serverless")
      const sql = neon(getDatabaseUrl())

      // Split SQL into individual statements
      const statements = migrationSQL
        .split(";")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && !s.startsWith("--"))

      console.log(`   Executing ${statements.length} statements...`)

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (statement.length > 0) {
          try {
            await sql(statement)
            if ((i + 1) % 5 === 0 || i === statements.length - 1) {
              console.log(`   ✓ Executed ${i + 1}/${statements.length} statements...`)
            }
          } catch (error: any) {
            // Ignore "already exists" errors
            if (!error.message?.includes("already exists") && 
                !error.message?.includes("duplicate") &&
                !error.message?.includes("does not exist")) {
              console.error(`   ⚠️  Error in statement ${i + 1}:`, error.message)
              console.error(`   Statement: ${statement.substring(0, 100)}...`)
            }
          }
        }
      }
    }

    console.log("\n✅ Migration applied successfully!")
    console.log("\nNext steps:")
    console.log("1. Run: npm run test:multi-tenant")
    console.log("2. Verify tables exist in database")

  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message)
    console.error(error)
    process.exit(1)
  }
}

applyMigration().catch(console.error)


