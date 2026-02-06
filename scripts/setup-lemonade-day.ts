#!/usr/bin/env npx tsx
/**
 * Setup Script: Lemonade Day 2026 - Boerne, Texas
 * 
 * This script creates the Lemonade Day event with all required:
 * - Event details
 * - Scoring categories with proper weights
 * - Judges
 * 
 * Run: npx tsx scripts/setup-lemonade-day.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing required environment variables:")
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗")
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "✓" : "✗")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Scoring Categories with Weights (Gold Standard) - stored as JSONB
const SCORING_CATEGORIES_JSONB = [
  { name: "Taste", required: true, hasNone: false, maxScore: 25 },
  { name: "Stand Appearance", required: true, hasNone: false, maxScore: 15 },
  { name: "Customer Service", required: true, hasNone: false, maxScore: 15 },
  { name: "Business Knowledge", required: true, hasNone: false, maxScore: 20 },
  { name: "Marketing & Salesmanship", required: true, hasNone: false, maxScore: 10 },
  { name: "Spirit & Enthusiasm", required: true, hasNone: false, maxScore: 10 },
  { name: "Overall Experience", required: true, hasNone: false, maxScore: 5 },
]

// For event_categories table (normalized storage)
const EVENT_CATEGORIES = [
  { categoryName: "Taste", displayOrder: 1, required: true, hasNoneOption: false },
  { categoryName: "Stand Appearance", displayOrder: 2, required: true, hasNoneOption: false },
  { categoryName: "Customer Service", displayOrder: 3, required: true, hasNoneOption: false },
  { categoryName: "Business Knowledge", displayOrder: 4, required: true, hasNoneOption: false },
  { categoryName: "Marketing & Salesmanship", displayOrder: 5, required: true, hasNoneOption: false },
  { categoryName: "Spirit & Enthusiasm", displayOrder: 6, required: true, hasNoneOption: false },
  { categoryName: "Overall Experience", displayOrder: 7, required: true, hasNoneOption: false },
]

// Judges
const JUDGES = [
  "Kimberley Blohm",
  "Holly Rodriguez",
  "Melissa Hinton",
  "Steely Lott",
  "Kylee Schuette",
  "Cassie Diamond",
]

// Entry Attributes Configuration (dynamic form fields)
const LEMONADE_DAY_ENTRY_ATTRIBUTES = {
  extraFields: [
    // Stand Location
    { 
      key: "standAddress", 
      label: "Stand Address/Location", 
      type: "text" as const, 
      required: true,
      helpText: "Street address or description of where your stand will be located",
      placeholder: "123 Main St, Boerne, TX"
    },
    { 
      key: "locationLat", 
      label: "Latitude (Optional)", 
      type: "number" as const, 
      required: false,
      placeholder: "29.7949"
    },
    { 
      key: "locationLng", 
      label: "Longitude (Optional)", 
      type: "number" as const, 
      required: false,
      placeholder: "-98.7319"
    },
  ]
}

// Lemonade Day Event Configuration
// Note: Database uses snake_case column names
const EVENT_CONFIG = {
  name: "Lemonade Day 2026",
  city: "Boerne",
  organization: "Greater Boerne Chamber of Commerce", // Host organization - required for child-safe form
  // May 2, 2026 from 9:00 AM CST (event_date only, no separate end time in DB)
  event_date: new Date("2026-05-02T09:00:00-05:00"),
  active: true,
  type: "lemonade_day", // CANONICAL EVENT DETECTION: single source of truth
  entry_category_title: "Best Lemonade Stand",
  scoring_categories: SCORING_CATEGORIES_JSONB,
  entry_attributes: LEMONADE_DAY_ENTRY_ATTRIBUTES,
}

async function main() {
  console.log("🍋 Setting up Lemonade Day 2026 - Boerne, Texas")
  console.log("=".repeat(60))

  try {
    // Step 1: Check if event already exists
    console.log("\n📋 Checking for existing event...")
    const { data: existingEvents, error: checkError } = await supabase
      .from("events")
      .select("id, name")
      .eq("name", EVENT_CONFIG.name)
      .eq("city", EVENT_CONFIG.city)

    if (checkError) {
      console.error("❌ Error checking existing events:", checkError)
      process.exit(1)
    }

    let eventId: number

    if (existingEvents && existingEvents.length > 0) {
      eventId = existingEvents[0].id
      console.log(`✓ Event already exists (ID: ${eventId}), updating...`)
      
      // Update the event (using snake_case column names as in DB)
      const { error: updateError } = await supabase
        .from("events")
        .update({
          name: EVENT_CONFIG.name,
          city: EVENT_CONFIG.city,
          organization: EVENT_CONFIG.organization,
          event_date: EVENT_CONFIG.event_date.toISOString(),
          active: EVENT_CONFIG.active,
          type: EVENT_CONFIG.type,
          entry_category_title: EVENT_CONFIG.entry_category_title,
          scoring_categories: EVENT_CONFIG.scoring_categories,
          entry_attributes: EVENT_CONFIG.entry_attributes,
        })
        .eq("id", eventId)

      if (updateError) {
        console.error("❌ Error updating event:", updateError)
        process.exit(1)
      }
      
      // Delete existing categories and judges to recreate them
      console.log("  Clearing existing categories and judges...")
      await supabase.from("event_categories").delete().eq("event_id", eventId)
      await supabase.from("judges").delete().eq("event_id", eventId)
    } else {
      // Create new event
      console.log("\n📝 Creating new event...")
      const { data: newEvent, error: createError } = await supabase
        .from("events")
        .insert({
          name: EVENT_CONFIG.name,
          city: EVENT_CONFIG.city,
          organization: EVENT_CONFIG.organization,
          event_date: EVENT_CONFIG.event_date.toISOString(),
          active: EVENT_CONFIG.active,
          type: EVENT_CONFIG.type,
          entry_category_title: EVENT_CONFIG.entry_category_title,
          scoring_categories: EVENT_CONFIG.scoring_categories,
          entry_attributes: EVENT_CONFIG.entry_attributes,
        })
        .select("id")
        .single()

      if (createError || !newEvent) {
        console.error("❌ Error creating event:", createError)
        process.exit(1)
      }

      eventId = newEvent.id
      console.log(`✓ Event created (ID: ${eventId})`)
    }

    // Step 2: Create Event Categories (normalized table)
    console.log("\n📊 Creating scoring categories...")
    const totalPoints = SCORING_CATEGORIES_JSONB.reduce((sum, cat) => sum + (cat.maxScore || 20), 0)
    console.log(`   Total possible points: ${totalPoints}`)

    for (const category of EVENT_CATEGORIES) {
      const { error: catError } = await supabase.from("event_categories").insert({
        event_id: eventId,
        category_name: category.categoryName,
        display_order: category.displayOrder,
        required: category.required,
        has_none_option: category.hasNoneOption,
      })

      if (catError) {
        // Might be duplicate, try upsert
        console.warn(`   ⚠ Category "${category.categoryName}" may already exist:`, catError.message)
      } else {
        const maxScore = SCORING_CATEGORIES_JSONB.find(c => c.name === category.categoryName)?.maxScore || 20
        console.log(`   ✓ ${category.categoryName} (0-${maxScore} points)`)
      }
    }

    // Step 3: Create Judges
    console.log("\n👨‍⚖️ Creating judges...")
    for (const judgeName of JUDGES) {
      const { error: judgeError } = await supabase.from("judges").insert({
        event_id: eventId,
        name: judgeName,
      })

      if (judgeError) {
        // Might be duplicate
        console.warn(`   ⚠ Judge "${judgeName}" may already exist:`, judgeError.message)
      } else {
        console.log(`   ✓ ${judgeName}`)
      }
    }

    // Step 4: Verify setup
    console.log("\n✅ Verifying setup...")
    
    const { data: verifyEvent } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single()
    
    const { data: verifyCategories } = await supabase
      .from("event_categories")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order")

    const { data: verifyJudges } = await supabase
      .from("judges")
      .select("*")
      .eq("event_id", eventId)

    console.log("\n" + "=".repeat(60))
    console.log("🍋 LEMONADE DAY 2026 SETUP COMPLETE")
    console.log("=".repeat(60))
    
    const scoringCats = verifyEvent?.scoring_categories || []
    console.log(`
Event Details:
  ID: ${eventId}
  Name: ${verifyEvent?.name}
  City: ${verifyEvent?.city}
  Date: May 2, 2026 (9:00 AM - 4:00 PM)
  Status: ${verifyEvent?.active ? "Active" : "Inactive"}
  Entry Category Title: ${verifyEvent?.entry_category_title}

Scoring Categories (from JSONB): ${scoringCats.length}
${scoringCats.map((c: any) => `  - ${c.name}: 0-${c.maxScore || 20} points${c.required ? ' (required)' : ''}`).join("\n") || "  (none)"}

Event Categories (normalized): ${verifyCategories?.length || 0}
${verifyCategories?.map((c: any) => `  - ${c.category_name}`).join("\n") || "  (none)"}

Judges: ${verifyJudges?.length || 0}
${verifyJudges?.map((j: any) => `  - ${j.name} (ID: ${j.id})`).join("\n") || "  (none)"}

Total Possible Score: ${totalPoints} points
`)

    console.log("\n📱 Access URLs:")
    console.log(`   Signup: http://localhost:3000/signup?eventId=${eventId}`)
    console.log(`   Judge Login: http://localhost:3000/judge/login`)
    console.log(`   Admin: http://localhost:3000/admin`)
    console.log(`   Coordinator: http://localhost:3000/coordinator`)

    console.log("\n🔑 To test, use these default credentials:")
    console.log(`   Admin Password: Set in .env.local (ADMIN_PASSWORD)`)
    console.log(`\n   Update .env.local with: NEXT_PUBLIC_THINGOMETER_EVENT_ID=${eventId}`)

  } catch (error) {
    console.error("❌ Unexpected error:", error)
    process.exit(1)
  }
}

main()
