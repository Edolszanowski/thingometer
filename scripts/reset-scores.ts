import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

import { db, schema } from "@/lib/db"
import { sql } from "drizzle-orm"

async function resetScores() {
  console.log("🔄 Resetting all scores to 0...\n")

  try {
    // Get count before reset
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.scores)
    
    const countBefore = countResult[0]?.count || 0
    console.log(`Found ${countBefore} scores in the database`)

    if (countBefore === 0) {
      console.log("✓ No scores to reset. Database is already empty.")
    } else {
      // Update all scores to 0
      console.log(`\n⚠️  WARNING: This will reset ALL ${countBefore} scores to 0!`)
      console.log("All lighting, theme, traditions, spirit, and music values will be set to 0.")
      console.log("The total will automatically be 0 (generated column).\n")

      const updated = await db
        .update(schema.scores)
        .set({
          lighting: 0,
          theme: 0,
          traditions: 0,
          spirit: 0,
          music: 0,
          // total is a generated column, so it will automatically be 0
        })
      
      console.log(`✓ Successfully reset ${countBefore} scores to 0`)
      
      // Verify reset
      const verifyResult = await db
        .select({
          count: sql<number>`COUNT(*)`,
          nonZeroCount: sql<number>`COUNT(*) FILTER (WHERE lighting > 0 OR theme > 0 OR traditions > 0 OR spirit > 0 OR music > 0)`
        })
        .from(schema.scores)
      
      const verify = verifyResult[0]
      const nonZeroCount = verify?.nonZeroCount || 0
      
      if (nonZeroCount === 0) {
        console.log("✓ Verification: All scores have been reset to 0\n")
      } else {
        console.log(`⚠️  Warning: ${nonZeroCount} scores still have non-zero values\n`)
      }
    }

    // Reset judge submission status
    console.log("Resetting judge submission status...")
    const judgesResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.judges)
    
    const judgeCount = judgesResult[0]?.count || 0
    
    if (judgeCount > 0) {
      await db
        .update(schema.judges)
        .set({ submitted: false })
      
      console.log(`✓ All ${judgeCount} judges have been reset (submitted = false)\n`)
    } else {
      console.log("✓ No judges to reset\n")
    }

    // Check floats with null/empty organization
    console.log("Checking floats with null/empty organization...")
    const floatsResult = await db
      .select({
        total: sql<number>`COUNT(*)`,
        nullOrg: sql<number>`COUNT(*) FILTER (WHERE organization IS NULL OR organization = '')`
      })
      .from(schema.floats)
    
    const floatsInfo = floatsResult[0]
    const nullOrgCount = floatsInfo?.nullOrg || 0
    const totalFloats = floatsInfo?.total || 0
    
    console.log(`Total floats: ${totalFloats}`)
    console.log(`Floats with null/empty organization: ${nullOrgCount}`)
    if (nullOrgCount > 0) {
      console.log("⚠️  These floats will show as GREY in the QuickJumpBar\n")
    } else {
      console.log("✓ All floats have organization assigned\n")
    }

    console.log("============================================================")
    console.log("SCORE RESET COMPLETE")
    console.log("============================================================\n")
    console.log("✓ All scores reset to 0 (not_started = blue)")
    console.log("✓ All judges reset to 'not submitted'")
    console.log(`✓ ${nullOrgCount} floats with null/empty organization (will show grey)`)
    console.log("\nThe database is now ready for a new judging session.\n")
    console.log("Status colors:")
    console.log("  - Blue: All floats with total = 0 (not_started)")
    console.log("  - Grey: Floats with null/empty organization")
    console.log("  - Red: Floats with partial scores (incomplete)")
    console.log("  - Green: Floats with all scores complete\n")

  } catch (error) {
    console.error("❌ Error resetting scores:", error)
    process.exit(1)
  }
}

resetScores().catch((err) => {
  console.error("An unexpected error occurred:", err)
  process.exit(1)
})

