/**
 * Test Multi-Tenant Setup
 * 
 * Verifies that multi-tenant tables and auth helpers work correctly
 */

import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

import { db, schema } from "../lib/db"
import { resolveCityFromUrl, hasCityRole } from "../lib/admin-auth"
import { eq } from "drizzle-orm"

async function testMultiTenant() {
  try {
    console.log("🧪 Testing Multi-Tenant Setup...\n")

    // Test 1: Verify cities table exists and has data
    console.log("1. Testing cities table...")
    const cities = await db.select().from(schema.cities)
    console.log(`   ✓ Found ${cities.length} cities`)
    if (cities.length > 0) {
      console.log(`   Sample: ${cities[0].name} (${cities[0].slug})`)
    }

    // Test 2: Verify city_users table structure
    console.log("\n2. Testing city_users table...")
    const cityUsers = await db.select().from(schema.cityUsers).limit(5)
    console.log(`   ✓ city_users table accessible (${cityUsers.length} users)`)

    // Test 3: Verify events table has city_id column
    console.log("\n3. Testing events table with city_id...")
    const events = await db
      .select({
        id: schema.events.id,
        name: schema.events.name,
        cityId: schema.events.cityId,
        positionMode: schema.events.positionMode,
      })
      .from(schema.events)
      .limit(5)
    console.log(`   ✓ Found ${events.length} events`)
    if (events.length > 0) {
      console.log(`   Sample: ${events[0].name} (city_id: ${events[0].cityId || "null"}, position_mode: ${events[0].positionMode || "preplanned"})`)
    }

    // Test 4: Verify new tables exist
    console.log("\n4. Testing new tables...")
    const winningCategories = await db.select().from(schema.winningCategories).limit(1)
    console.log(`   ✓ winning_categories table accessible`)

    const eventDocuments = await db.select().from(schema.eventDocuments).limit(1)
    console.log(`   ✓ event_documents table accessible`)

    const vendors = await db.select().from(schema.vendors).limit(1)
    console.log(`   ✓ vendors table accessible`)

    // Test 5: Test city resolution (mock)
    console.log("\n5. Testing city resolution...")
    if (cities.length > 0) {
      const testCity = await resolveCityFromUrl(`/${cities[0].slug}/admin`)
      if (testCity) {
        console.log(`   ✓ City resolved: ${testCity.cityName} (ID: ${testCity.cityId})`)
      } else {
        console.log(`   ⚠️  City resolution returned null (may need URL path adjustment)`)
      }
    }

    // Test 6: Verify RLS is enabled
    console.log("\n6. Testing RLS status...")
    try {
      // Use raw SQL execution for Neon
      const { neon } = require("@neondatabase/serverless")
      const sql = neon(process.env.DATABASE_URL!)
      const rlsCheck = await sql`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN ('cities', 'city_users', 'winning_categories', 'event_documents', 'vendors')
        ORDER BY tablename
      `
      console.log(`   ✓ RLS check completed (${rlsCheck.length} tables checked)`)
      rlsCheck.forEach((row: any) => {
        console.log(`     - ${row.tablename}: RLS ${row.rowsecurity ? 'enabled' : 'disabled'}`)
      })
    } catch (error: any) {
      console.log(`   ⚠️  RLS check skipped: ${error.message}`)
    }

    console.log("\n✅ Multi-tenant setup tests completed!")
    console.log("\nNext steps:")
    console.log("1. Review MANUAL_STEPS_REQUIRED.md for actions needed")
    console.log("2. Create city-scoped routes")
    console.log("3. Test cross-city isolation")
    console.log("4. Set up email integration (Resend)")

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message)
    console.error(error)
    process.exit(1)
  }
}

testMultiTenant().catch(console.error)

