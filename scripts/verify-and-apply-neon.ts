/**
 * Verify and Apply Migration to Neon Database
 */

import { config } from "dotenv"
import { resolve } from "path"
import { readFileSync } from "fs"

config({ path: resolve(process.cwd(), ".env.local") })

async function verifyAndApply() {
  try {
    const { neon } = require("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL)

    console.log("🔍 Checking current database state...\n")

    // Check if cities table exists
    try {
      const result = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'cities'
        )
      `
      console.log(`Cities table exists: ${result[0]?.exists}`)
    } catch (error: any) {
      console.log("Error checking cities table:", error.message)
    }

    // Read and execute migration
    console.log("\n📝 Applying migration...\n")
    const migrationPath = resolve(process.cwd(), "supabase-migration/05-add-multi-tenant-tables.sql")
    const migrationSQL = readFileSync(migrationPath, "utf-8")

    // Execute the entire migration as one statement
    try {
      await sql(migrationSQL)
      console.log("✅ Migration executed")
    } catch (error: any) {
      console.error("Migration error:", error.message)
      // Try executing statement by statement
      const statements = migrationSQL
        .split(";")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && !s.startsWith("--") && !s.startsWith("--"))

      console.log(`\nTrying ${statements.length} statements individually...\n`)

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (statement.length > 0) {
          try {
            await sql(statement)
            console.log(`✓ Statement ${i + 1}/${statements.length}`)
          } catch (err: any) {
            if (!err.message?.includes("already exists") && 
                !err.message?.includes("duplicate")) {
              console.error(`✗ Statement ${i + 1} failed:`, err.message)
              console.error(`  SQL: ${statement.substring(0, 150)}...`)
            } else {
              console.log(`⊘ Statement ${i + 1} skipped (already exists)`)
            }
          }
        }
      }
    }

    // Verify cities table exists now
    console.log("\n🔍 Verifying migration...\n")
    const verify = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('cities', 'city_users', 'winning_categories', 'event_documents', 'vendors')
      ORDER BY table_name
    `
    
    console.log("Tables found:")
    verify.forEach((row: any) => {
      console.log(`  ✓ ${row.table_name}`)
    })

    if (verify.length === 5) {
      console.log("\n✅ All multi-tenant tables created successfully!")
    } else {
      console.log(`\n⚠️  Only ${verify.length}/5 tables found`)
    }

  } catch (error: any) {
    console.error("\n❌ Error:", error.message)
    console.error(error)
    process.exit(1)
  }
}

verifyAndApply().catch(console.error)


