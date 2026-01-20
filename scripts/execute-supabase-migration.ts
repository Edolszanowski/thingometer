#!/usr/bin/env tsx
/**
 * Execute Supabase Migration
 * 
 * This script executes the schema and data SQL files against Supabase
 */

import { config } from "dotenv"
import { resolve } from "path"
import { readFileSync } from "fs"
import postgres from "postgres"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

async function executeMigration() {
  // Try multiple possible environment variable names
  let supabaseUrl = process.env.DATABASE_URL_SUPABASE || 
                    process.env.SUPABASE_DATABASE_URL ||
                    process.env.DATABASE_URL
  
  // If we have SUPABASE_URL, we might need to construct the connection string
  // But for direct PostgreSQL connection, we need the postgres connection string
  if (!supabaseUrl) {
    console.error("❌ Supabase connection string not found")
    console.error("   Please add one of these to .env.local:")
    console.error("   - DATABASE_URL_SUPABASE (preferred)")
    console.error("   - SUPABASE_DATABASE_URL")
    console.error("   - DATABASE_URL (if using Supabase)")
    console.error("   Format: postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres")
    console.error("   Or: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres")
    process.exit(1)
  }

  console.log("🚀 Starting Supabase migration execution...\n")

  // Create postgres client
  const sql = postgres(supabaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
  })

  try {
    // Test connection
    console.log("📡 Testing connection to Supabase...")
    await sql`SELECT 1`
    console.log("✅ Connected to Supabase\n")

    // Read and execute schema SQL (use fixed version with correct order)
    console.log("📋 Step 1: Executing schema SQL...")
    const schemaSQL = readFileSync(
      resolve(process.cwd(), "supabase-migration/01-schema-fixed.sql"),
      "utf-8"
    )
    
    // Split by semicolons and execute each statement
    const schemaStatements = schemaSQL
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"))
    
    console.log(`   Executing ${schemaStatements.length} schema statements...`)
    
    for (let i = 0; i < schemaStatements.length; i++) {
      const statement = schemaStatements[i]
      if (statement.length > 0) {
        try {
          await sql.unsafe(statement)
          if ((i + 1) % 10 === 0) {
            console.log(`   ✓ Executed ${i + 1}/${schemaStatements.length} statements...`)
          }
        } catch (error: any) {
          // Ignore "already exists" errors for CREATE IF NOT EXISTS
          if (!error.message?.includes("already exists") && !error.message?.includes("duplicate")) {
            console.error(`   ⚠️  Error in statement ${i + 1}:`, error.message)
            console.error(`   Statement: ${statement.substring(0, 100)}...`)
          }
        }
      }
    }
    
    console.log("✅ Schema executed successfully\n")

    // Read and execute data SQL
    console.log("📦 Step 2: Executing data SQL...")
    const dataSQL = readFileSync(
      resolve(process.cwd(), "supabase-migration/02-data.sql"),
      "utf-8"
    )
    
    // Split by semicolons and execute each statement
    const dataStatements = dataSQL
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"))
    
    console.log(`   Executing ${dataStatements.length} data statements...`)
    
    for (let i = 0; i < dataStatements.length; i++) {
      const statement = dataStatements[i]
      if (statement.length > 0) {
        try {
          await sql.unsafe(statement)
          if ((i + 1) % 5 === 0) {
            console.log(`   ✓ Executed ${i + 1}/${dataStatements.length} statements...`)
          }
        } catch (error: any) {
          // Ignore duplicate key errors (data might already exist)
          if (!error.message?.includes("duplicate key") && !error.message?.includes("already exists")) {
            console.error(`   ⚠️  Error in statement ${i + 1}:`, error.message)
            console.error(`   Statement: ${statement.substring(0, 100)}...`)
          }
        }
      }
    }
    
    console.log("✅ Data executed successfully\n")

    // Verify migration
    console.log("🔍 Step 3: Verifying migration...")
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
    
    console.log(`   ✓ Found ${tables.length} tables:`)
    for (const table of tables) {
      const count = await sql.unsafe(`SELECT COUNT(*) as count FROM "${table.table_name}"`)
      console.log(`     - ${table.table_name}: ${count[0]?.count || 0} rows`)
    }
    
    console.log("\n✅ Migration completed successfully!")
    console.log("\nNext steps:")
    console.log("1. Update .env.local to set USE_SUPABASE=true")
    console.log("2. Test the application with Supabase connection")
    console.log("3. Update Vercel environment variables if deploying")

  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

executeMigration().catch(console.error)

