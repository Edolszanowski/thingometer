import { defineConfig } from "drizzle-kit"
import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local for migrations
config({ path: resolve(process.cwd(), ".env.local") })

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set")
}

export default defineConfig({
  schema: "./lib/drizzle/schema.ts",
  out: "./lib/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})

