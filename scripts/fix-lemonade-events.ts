#!/usr/bin/env npx tsx
/**
 * Fix Lemonade Day Events - Set type and organization correctly
 * Run: npx tsx scripts/fix-lemonade-events.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.join(__dirname, "..", ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing environment variables")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log("🔍 Checking all events...")
  
  // Get all events
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, city, type, organization")
    .order("id")

  if (error) {
    console.error("❌ Error fetching events:", error)
    process.exit(1)
  }

  console.log("\n📋 Current Events:")
  console.log("=".repeat(80))
  events?.forEach(e => {
    console.log(`ID: ${e.id} | Name: ${e.name}`)
    console.log(`   City: ${e.city} | Type: ${e.type || "(not set)"} | Org: ${e.organization || "(not set)"}`)
  })
  console.log("=".repeat(80))

  // Find events that look like Lemonade Day but don't have type set
  const lemonadeEvents = events?.filter(e => 
    e.name.toLowerCase().includes("lemonade") && 
    e.type !== "lemonade_day"
  )

  if (lemonadeEvents && lemonadeEvents.length > 0) {
    console.log(`\n⚠️  Found ${lemonadeEvents.length} Lemonade Day event(s) without correct type:`)
    
    for (const event of lemonadeEvents) {
      console.log(`\n🔧 Fixing event ID ${event.id}: ${event.name}`)
      
      const { error: updateError } = await supabase
        .from("events")
        .update({ 
          type: "lemonade_day",
          organization: event.organization || "Greater Boerne Chamber of Commerce"
        })
        .eq("id", event.id)

      if (updateError) {
        console.error(`   ❌ Error updating event ${event.id}:`, updateError)
      } else {
        console.log(`   ✅ Updated type to "lemonade_day"`)
        console.log(`   ✅ Organization: ${event.organization || "Greater Boerne Chamber of Commerce"}`)
      }
    }
  } else {
    console.log("\n✅ All Lemonade Day events have correct type set")
  }

  // Verify the fix
  console.log("\n🔍 Verifying fix...")
  const { data: verifyEvents } = await supabase
    .from("events")
    .select("id, name, city, type, organization")
    .ilike("name", "%lemonade%")

  console.log("\n📋 Lemonade Day Events After Fix:")
  console.log("=".repeat(80))
  verifyEvents?.forEach(e => {
    console.log(`ID: ${e.id} | ${e.name}`)
    console.log(`   City: ${e.city}`)
    console.log(`   Type: ${e.type} ${e.type === "lemonade_day" ? "✅" : "❌"}`)
    console.log(`   Organization: ${e.organization || "(not set)"}`)
  })
  console.log("=".repeat(80))

  console.log("\n✅ Done! Test the form at:")
  verifyEvents?.forEach(e => {
    console.log(`   http://localhost:3000/signup?eventId=${e.id}`)
  })
}

main()
