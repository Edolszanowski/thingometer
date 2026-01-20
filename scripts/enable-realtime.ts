#!/usr/bin/env npx tsx
/**
 * Enable Supabase Realtime for Parade Judge tables
 */

import { config } from "dotenv"
import { resolve } from "path"
import postgres from "postgres"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

async function enableRealtime() {
  const databaseUrl = process.env.DATABASE_URL_SUPABASE || process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.error("❌ No database URL found")
    process.exit(1)
  }

  const sql = postgres(databaseUrl, { max: 1 })

  try {
    console.log("🔄 Enabling realtime on tables...")
    
    // Check if publication exists
    const pubExists = await sql`SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'`
    
    if (pubExists.length === 0) {
      await sql`CREATE PUBLICATION supabase_realtime`
      console.log("✅ Created supabase_realtime publication")
    } else {
      console.log("ℹ️  supabase_realtime publication already exists")
    }
    
    // Add tables (ignore errors if already added)
    const tables = ['scores', 'score_items', 'judges', 'floats', 'judge_submissions', 'events', 'event_categories']
    
    for (const table of tables) {
      try {
        await sql.unsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE ${table}`)
        console.log(`✅ Added ${table} to realtime`)
      } catch (e: any) {
        if (e.message?.includes('already member')) {
          console.log(`ℹ️  ${table} already in realtime`)
        } else {
          console.error(`⚠️  Error adding ${table}:`, e.message)
        }
      }
    }
    
    // Verify
    const result = await sql`SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`
    console.log("\n✅ Realtime enabled tables:", result.map((r: any) => r.tablename).join(", "))
    
  } catch (error: any) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

enableRealtime()

