import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

import { db, schema } from "@/lib/db"
import { sql } from "drizzle-orm"

async function clearScores() {
  console.log("🗑️  Clearing all scores from the database...\n")

  try {
    // Get count before deletion
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.scores)
    
    const countBefore = countResult[0]?.count || 0
    console.log(`Found ${countBefore} scores in the database`)

    if (countBefore === 0) {
      console.log("✓ No scores to clear. Database is already empty.")
      return
    }

    // Ask for confirmation
    console.log(`\n⚠️  WARNING: This will delete ALL ${countBefore} scores from the database!`)
    console.log("This action cannot be undone.\n")

    // Delete all scores
    const deleted = await db.delete(schema.scores)
    
    console.log(`✓ Successfully cleared ${countBefore} scores from the database`)
    
    // Verify deletion
    const countAfter = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.scores)
    
    const remaining = countAfter[0]?.count || 0
    
    if (remaining === 0) {
      console.log("✓ Verification: All scores have been cleared (0 remaining)\n")
    } else {
      console.log(`⚠️  Warning: ${remaining} scores still remain in the database\n`)
    }

    // Also reset judge submission status
    console.log("Resetting judge submission status...")
    await db
      .update(schema.judges)
      .set({ submitted: false })
    
    console.log("✓ All judges have been reset (submitted = false)\n")
    
    console.log("============================================================")
    console.log("SCORE CLEARING COMPLETE")
    console.log("============================================================\n")
    console.log("✓ All scores deleted")
    console.log("✓ All judges reset to 'not submitted'")
    console.log("\nThe database is now ready for a new judging session.\n")

  } catch (error) {
    console.error("❌ Error clearing scores:", error)
    process.exit(1)
  }
}

clearScores().catch((err) => {
  console.error("An unexpected error occurred:", err)
  process.exit(1)
})

