// Support both Neon and Supabase connections
// Set USE_SUPABASE=true in .env.local to use Supabase
// Otherwise, defaults to Neon for backward compatibility

import * as schema from "./drizzle/schema"

const USE_SUPABASE = process.env.USE_SUPABASE === 'true'

function getDatabaseUrl(): string {
  // Only access DATABASE_URL on server side
  if (typeof window !== "undefined") {
    throw new Error("Database access is only available on the server side")
  }
  
  // Check for Supabase-specific URL first, then fall back to standard DATABASE_URL
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

// Lazy initialization to avoid build-time errors
let _db: any = null

function getDb() {
  if (!_db) {
    if (USE_SUPABASE) {
      // Use Supabase (PostgreSQL via postgres-js)
      const postgres = require("postgres")
      const { drizzle } = require("drizzle-orm/postgres-js")
      
      const sql = postgres(getDatabaseUrl(), {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      })
      
      _db = drizzle(sql, { schema })
    } else {
      // Use Neon (original)
      const { neon } = require("@neondatabase/serverless")
      const { drizzle } = require("drizzle-orm/neon-http")
      
      const sql = neon(getDatabaseUrl())
      _db = drizzle(sql, { schema })
    }
  }
  return _db
}

export const db = new Proxy({} as any, {
  get(_target, prop) {
    return getDb()[prop as string]
  },
})

export { schema }
