/**
 * Supabase Database Connection
 * 
 * This file provides database access using Supabase PostgreSQL.
 * Supabase uses standard PostgreSQL, so we can use either:
 * 1. Direct PostgreSQL connection (recommended for Drizzle ORM)
 * 2. Supabase JS client (for client-side access)
 * 
 * For server-side Drizzle ORM, we use direct PostgreSQL connection.
 */

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./drizzle/schema"

function getDatabaseUrl(): string {
  // Only access DATABASE_URL on server side
  if (typeof window !== "undefined") {
    throw new Error("Database access is only available on the server side")
  }
  
  // Check for Supabase-specific URL first, then fall back to standard DATABASE_URL
  const url = process.env.DATABASE_URL_SUPABASE || process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL or DATABASE_URL_SUPABASE environment variable is not set")
  }
  return url
}

// Lazy initialization to avoid build-time errors
let _db: ReturnType<typeof drizzle> | null = null
let _sql: ReturnType<typeof postgres> | null = null

function getDb() {
  if (!_db) {
    const databaseUrl = getDatabaseUrl()
    
    // Create postgres connection
    // Supabase connection string format:
    // postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
    _sql = postgres(databaseUrl, {
      max: 10, // Connection pool size
      idle_timeout: 20,
      connect_timeout: 10,
    })
    
    _db = drizzle(_sql, { schema })
  }
  return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>]
  },
})

export { schema }

// Export the SQL client for raw queries if needed
export function getSqlClient() {
  if (!_sql) {
    getDb() // Initialize to create SQL client
  }
  return _sql!
}



