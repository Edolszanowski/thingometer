/**
 * Environment variable validation
 * Validates required environment variables at startup
 * Only runs on the server side
 */

function getEnvVar(key: string, defaultValue?: string): string {
  // Only access env vars on the server side
  if (typeof window !== "undefined") {
    // Client side - return default or empty string
    return defaultValue || ""
  }
  
  const value = process.env[key] || defaultValue
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

// Only validate on server side
const isServer = typeof window === "undefined"

export const env = {
  DATABASE_URL: isServer ? getEnvVar("DATABASE_URL") : "",
  ADMIN_PASSWORD: isServer ? getEnvVar("ADMIN_PASSWORD") : "",
  NODE_ENV: process.env.NODE_ENV || "development",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://judging.ithriveai.com",
} as const

// Validate on module load (only in production, only on server)
if (isServer && env.NODE_ENV === "production") {
  console.log("Environment variables validated successfully")
}

