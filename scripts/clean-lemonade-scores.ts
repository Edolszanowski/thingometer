/**
 * Clean Lemonade Day Scores
 * Deletes all scores for Lemonade Day event so we can recreate them
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing environment variables")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function main() {
  console.log("🧹 Cleaning Lemonade Day scores...\n")

  // Get event ID
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("name", "Lemonade Day 2026")
    .single()

  if (!event) {
    console.error("❌ Event not found")
    process.exit(1)
  }

  const eventId = event.id

  // Delete score items first (foreign key constraint)
  const { data: scores } = await supabase
    .from("scores")
    .select("id")
    .eq("event_id", eventId)

  if (scores && scores.length > 0) {
    const scoreIds = scores.map((s: any) => s.id)
    
    const { error: itemsError } = await supabase
      .from("score_items")
      .delete()
      .in("score_id", scoreIds)

    if (itemsError) {
      console.error("❌ Failed to delete score items:", itemsError)
    } else {
      console.log(`✅ Deleted score items for ${scores.length} scores`)
    }
  }

  // Delete scores
  const { error: scoresError } = await supabase
    .from("scores")
    .delete()
    .eq("event_id", eventId)

  if (scoresError) {
    console.error("❌ Failed to delete scores:", scoresError)
  } else {
    console.log(`✅ Deleted all scores for event ${eventId}`)
  }

  console.log("\n✅ Cleanup complete! Run test script again to create scores.")
}

main().catch(console.error)
