import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

import { db, schema } from "../lib/db"

async function testDatabase() {
  try {
    console.log("Testing database connection...")
    console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set ✓" : "Not set ✗")
    
    if (!process.env.DATABASE_URL) {
      console.error("ERROR: DATABASE_URL is not set!")
      process.exit(1)
    }

    // Test 1: Check if we can query judges
    console.log("\n1. Testing judges table...")
    const judges = await db.select().from(schema.judges).limit(5)
    console.log(`   ✓ Found ${judges.length} judges`)
    if (judges.length > 0) {
      console.log(`   Sample: ${judges[0].name}`)
    }

    // Test 2: Check if we can query floats
    console.log("\n2. Testing floats table...")
    const floats = await db.select().from(schema.floats).limit(5)
    console.log(`   ✓ Found ${floats.length} floats`)
    if (floats.length > 0) {
      console.log(`   Sample: Float #${floats[0].floatNumber} - ${floats[0].organization}`)
    }

    // Test 3: Check scores table structure
    console.log("\n3. Testing scores table structure...")
    const scores = await db.select().from(schema.scores).limit(1)
    console.log(`   ✓ Scores table accessible`)
    if (scores.length > 0) {
      console.log(`   Sample score structure:`, {
        id: scores[0].id,
        judgeId: scores[0].judgeId,
        floatId: scores[0].floatId,
        lighting: scores[0].lighting,
        total: scores[0].total,
        createdAt: scores[0].createdAt,
        updatedAt: scores[0].updatedAt,
      })
    }

    // Test 4: Try to insert a test score (then delete it)
    console.log("\n4. Testing score insert/update...")
    if (judges.length > 0 && floats.length > 0) {
      const testJudgeId = judges[0].id
      const testFloatId = floats[0].id
      
      // Check if test score exists
      const { eq, and } = await import("drizzle-orm")
      const existing = await db
        .select()
        .from(schema.scores)
        .where(
          and(
            eq(schema.scores.judgeId, testJudgeId),
            eq(schema.scores.floatId, testFloatId)
          )
        )
        .limit(1)

      if (existing.length === 0) {
        // Try to insert
        console.log("   Attempting test insert...")
        const testScore = await db
          .insert(schema.scores)
          .values({
            judgeId: testJudgeId,
            floatId: testFloatId,
            lighting: 10,
            theme: 10,
            traditions: 10,
            spirit: 10,
            music: 10,
            // total is a generated column, so we don't set it
          })
          .returning()
        
        console.log(`   ✓ Insert successful! Score ID: ${testScore[0].id}, Total: ${testScore[0].total} (auto-calculated)`)
        
        // Try to update
        console.log("   Attempting test update...")
        const { eq } = await import("drizzle-orm")
        const updated = await db
          .update(schema.scores)
          .set({
            lighting: 15,
            // total is a generated column, so we don't update it
          })
          .where(eq(schema.scores.id, testScore[0].id))
          .returning()
        
        console.log(`   ✓ Update successful! New total: ${updated[0].total} (auto-calculated)`)
        
        // Clean up - delete test score
        const { eq: eqDelete } = await import("drizzle-orm")
        await db
          .delete(schema.scores)
          .where(eqDelete(schema.scores.id, testScore[0].id))
        console.log("   ✓ Test score deleted (cleanup)")
      } else {
        console.log("   Test score already exists, trying update...")
        const { eq: eqUpdate } = await import("drizzle-orm")
        const updated = await db
          .update(schema.scores)
          .set({
            lighting: 15,
            // total is a generated column, so we don't update it
          })
          .where(eqUpdate(schema.scores.id, existing[0].id))
          .returning()
        console.log(`   ✓ Update successful! New total: ${updated[0].total} (auto-calculated)`)
      }
    } else {
      console.log("   ⚠ Skipping insert test (need at least 1 judge and 1 float)")
    }

    // Test 5: Check table columns
    console.log("\n5. Checking table schemas...")
    console.log("   Judges table exists ✓")
    console.log("   Floats table exists ✓")
    console.log("   Scores table exists ✓")

    console.log("\n✅ All database tests passed!")
    process.exit(0)
  } catch (error: any) {
    console.error("\n❌ Database test failed!")
    console.error("Error:", error.message)
    console.error("Code:", error.code)
    console.error("Constraint:", error.constraint)
    console.error("Detail:", error.detail)
    console.error("\nFull error:", error)
    process.exit(1)
  }
}

testDatabase()

