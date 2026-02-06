import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./drizzle/schema"

const connectionString = process.env.DATABASE_URL || ''

const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Required for Supabase transaction pooler (port 6543)
})

export const db = drizzle(sql, { schema })

// Backward-compatible export used throughout the codebase
export { schema }
