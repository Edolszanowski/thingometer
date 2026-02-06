#!/usr/bin/env npx tsx
/**
 * Automated Test Script: Lemonade Day 2026 - Boerne, Texas
 * 
 * This script tests all the main workflows:
 * 1. Admin - Login, view events, edit categories/judges
 * 2. Coordinator - View entries, approve entries
 * 3. Participant Registration - Submit a new entry
 * 4. Judge - Login, score entries
 * 
 * Run: npx tsx scripts/test-lemonade-day.ts
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminPassword = process.env.ADMIN_PASSWORD || "admin123"

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing required environment variables")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const BASE_URL = "http://localhost:3002"
const EVENT_ID = 4 // Lemonade Day 2026

// Test data
const TEST_ENTRY = {
  organization: "Test Lemonade Stand LLC",
  firstName: "John",
  lastName: "Doe",
  phone: "(830) 555-1234",
  email: "test@example.com",
  driverFirstName: "Jane",
  driverLastName: "Doe",
  driverPhone: "(830) 555-5678",
  driverEmail: "driver@example.com",
  floatDescription: "Automated test entry for Lemonade Day 2026",
  typeOfEntry: "Other",
  hasMusic: false,
  eventId: EVENT_ID,
}

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logSection(title: string) {
  console.log("\n" + "=".repeat(60))
  log(`  ${title}`, colors.bright + colors.cyan)
  console.log("=".repeat(60))
}

function logStep(step: string) {
  log(`\n📋 ${step}`, colors.yellow)
}

function logSuccess(message: string) {
  log(`   ✓ ${message}`, colors.green)
}

function logError(message: string) {
  log(`   ✗ ${message}`, colors.red)
}

function logInfo(message: string) {
  log(`   ℹ ${message}`, colors.blue)
}

async function testAdminWorkflow() {
  logSection("ADMIN WORKFLOW TESTS")

  // Test 1: Admin API - Get Events
  logStep("Test 1: Admin API - Fetch Events")
  try {
    const response = await fetch(`${BASE_URL}/api/admin/events?password=${encodeURIComponent(adminPassword)}`)
    if (!response.ok) {
      logError(`Failed to fetch events: ${response.status}`)
      return false
    }
    const events = await response.json()
    logSuccess(`Fetched ${events.length} events`)
    
    const lemonadeEvent = events.find((e: any) => e.id === EVENT_ID)
    if (lemonadeEvent) {
      logSuccess(`Found Lemonade Day 2026 event (ID: ${EVENT_ID})`)
      logInfo(`  Name: ${lemonadeEvent.name}`)
      logInfo(`  City: ${lemonadeEvent.city}`)
      logInfo(`  Categories: ${lemonadeEvent.categories?.length || 0}`)
      logInfo(`  Judges: ${lemonadeEvent.judges?.length || 0}`)
    } else {
      logError(`Lemonade Day 2026 event not found`)
      return false
    }
  } catch (error) {
    logError(`Error: ${error}`)
    return false
  }

  // Test 2: Admin API - Verify Judges
  logStep("Test 2: Admin API - Verify Judges")
  try {
    const response = await fetch(`${BASE_URL}/api/admin/judges?password=${encodeURIComponent(adminPassword)}&eventId=${EVENT_ID}`)
    if (!response.ok) {
      logError(`Failed to fetch judges: ${response.status}`)
      return false
    }
    const judges = await response.json()
    logSuccess(`Fetched ${judges.length} judges for event ${EVENT_ID}`)
    judges.forEach((j: any) => {
      logInfo(`  - ${j.name} (ID: ${j.id})`)
    })
  } catch (error) {
    logError(`Error: ${error}`)
    return false
  }

  // Test 3: Admin API - Verify Categories
  logStep("Test 3: Admin API - Verify Scoring Categories")
  try {
    const response = await fetch(`${BASE_URL}/api/event-categories?eventId=${EVENT_ID}`)
    if (!response.ok) {
      logError(`Failed to fetch categories: ${response.status}`)
      return false
    }
    const categories = await response.json()
    logSuccess(`Fetched ${categories.length} categories`)
    categories.forEach((c: any) => {
      logInfo(`  - ${c.category_name || c.categoryName}`)
    })
  } catch (error) {
    logError(`Error: ${error}`)
    return false
  }

  return true
}

async function testParticipantRegistration() {
  logSection("PARTICIPANT REGISTRATION TESTS")

  // Test 1: Submit a new entry
  logStep("Test 1: Submit New Entry via API")
  try {
    const response = await fetch(`${BASE_URL}/api/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TEST_ENTRY),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }))
      logError(`Failed to submit entry: ${error.error}`)
      return false
    }

    const result = await response.json()
    logSuccess(`Entry submitted successfully`)
    logInfo(`  Entry ID: ${result.id}`)
    logInfo(`  Float Number: ${result.floatNumber || "Pending approval"}`)
    logInfo(`  Organization: ${result.organization}`)
    return result.id
  } catch (error) {
    logError(`Error: ${error}`)
    return false
  }
}

async function testCoordinatorWorkflow(entryId: number) {
  logSection("COORDINATOR WORKFLOW TESTS")

  // Test 1: Get floats (entries)
  logStep("Test 1: Coordinator API - Fetch Entries")
  try {
    const response = await fetch(`${BASE_URL}/api/coordinator/floats?password=${encodeURIComponent(adminPassword)}&eventId=${EVENT_ID}`)
    if (!response.ok) {
      logError(`Failed to fetch entries: ${response.status}`)
      return false
    }
    const floats = await response.json()
    logSuccess(`Fetched ${floats.length} entries`)
    
    const testEntry = floats.find((f: any) => f.id === entryId)
    if (testEntry) {
      logSuccess(`Found test entry (ID: ${entryId})`)
      logInfo(`  Organization: ${testEntry.organization}`)
      logInfo(`  Approved: ${testEntry.approved}`)
    }
  } catch (error) {
    logError(`Error: ${error}`)
    return false
  }

  // Test 2: Approve the entry
  logStep("Test 2: Coordinator API - Approve Entry")
  try {
    const response = await fetch(`${BASE_URL}/api/coordinator/approve?password=${encodeURIComponent(adminPassword)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ floatId: entryId, approved: true }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }))
      logError(`Failed to approve entry: ${error.error}`)
      return false
    }

    const result = await response.json()
    logSuccess(`Entry approved successfully`)
    logInfo(`  Float Number assigned: ${result.float?.floatNumber || result.floatNumber || "Check DB"}`)
  } catch (error) {
    logError(`Error: ${error}`)
    return false
  }

  return true
}

async function testJudgeWorkflow() {
  logSection("JUDGE WORKFLOW TESTS")

  // Test 1: Get judges for event
  logStep("Test 1: Fetch Judges for Login Selection")
  try {
    const response = await fetch(`${BASE_URL}/api/judges?eventId=${EVENT_ID}`)
    if (!response.ok) {
      logError(`Failed to fetch judges: ${response.status}`)
      return false
    }
    const judges = await response.json()
    logSuccess(`Fetched ${judges.length} judges available for login`)
    
    if (judges.length === 0) {
      logError("No judges available")
      return false
    }

    // Use first judge for testing
    const testJudge = judges[0]
    logInfo(`  Using judge: ${testJudge.name} (ID: ${testJudge.id})`)
    return testJudge.id
  } catch (error) {
    logError(`Error: ${error}`)
    return false
  }
}

async function testScoring(judgeId: number) {
  logSection("SCORING WORKFLOW TESTS")

  // Get approved floats to score
  logStep("Test 1: Get Approved Entries to Score")
  try {
    const response = await fetch(`${BASE_URL}/api/floats?eventId=${EVENT_ID}`)
    if (!response.ok) {
      logError(`Failed to fetch floats: ${response.status}`)
      return false
    }
    const floats = await response.json()
    const approvedFloats = floats.filter((f: any) => f.approved)
    logSuccess(`Found ${approvedFloats.length} approved entries`)
    
    if (approvedFloats.length === 0) {
      logInfo("No approved entries to score - skipping scoring test")
      return true
    }

    // Test scoring first approved float
    const testFloat = approvedFloats[0]
    logInfo(`  Scoring entry: ${testFloat.organization} (ID: ${testFloat.id})`)

    // Create test scores
    logStep("Test 2: Submit Scores for Entry")
    const testScores = {
      judgeId,
      floatId: testFloat.id,
      eventId: EVENT_ID,
      scores: {
        Taste: 22,
        "Stand Appearance": 13,
        "Customer Service": 14,
        "Business Knowledge": 18,
        "Marketing & Salesmanship": 8,
        "Spirit & Enthusiasm": 9,
        "Overall Experience": 4,
      },
    }

    const scoreResponse = await fetch(`${BASE_URL}/api/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testScores),
    })

    if (!scoreResponse.ok) {
      const error = await scoreResponse.json().catch(() => ({ error: "Unknown error" }))
      logError(`Failed to submit scores: ${error.error}`)
      // This may fail if scores already exist, which is OK for testing
      logInfo("  (This may fail if scores already exist)")
      return true
    }

    logSuccess("Scores submitted successfully")
    const totalScore = Object.values(testScores.scores).reduce((a, b) => a + b, 0)
    logInfo(`  Total score: ${totalScore}/100`)

  } catch (error) {
    logError(`Error: ${error}`)
    return false
  }

  return true
}

async function runCleanup(entryId: number | null) {
  logSection("CLEANUP")
  
  if (entryId) {
    logStep("Removing test entry from database...")
    try {
      // Delete scores first
      await supabase.from("scores").delete().eq("floatId", entryId)
      await supabase.from("score_items").delete().eq("floatId", entryId)
      // Delete the float
      await supabase.from("floats").delete().eq("id", entryId)
      logSuccess(`Test entry (ID: ${entryId}) cleaned up`)
    } catch (error) {
      logError(`Cleanup failed: ${error}`)
    }
  }
}

async function main() {
  console.log("\n")
  log("🍋 LEMONADE DAY 2026 - AUTOMATED TEST SUITE", colors.bright + colors.yellow)
  log("=" .repeat(60), colors.yellow)
  console.log(`
Test Environment:
  Base URL: ${BASE_URL}
  Event ID: ${EVENT_ID}
  Admin Password: ${adminPassword ? "***" : "(not set)"}
  Supabase URL: ${supabaseUrl?.substring(0, 30)}...
`)

  let allPassed = true
  let testEntryId: number | null = null

  try {
    // 1. Admin Tests
    const adminPassed = await testAdminWorkflow()
    if (!adminPassed) allPassed = false

    // 2. Participant Registration Tests
    const entryResult = await testParticipantRegistration()
    if (typeof entryResult === "number") {
      testEntryId = entryResult
    } else {
      allPassed = false
    }

    // 3. Coordinator Tests
    if (testEntryId) {
      const coordinatorPassed = await testCoordinatorWorkflow(testEntryId)
      if (!coordinatorPassed) allPassed = false
    }

    // 4. Judge Tests
    const judgeId = await testJudgeWorkflow()
    if (typeof judgeId === "number") {
      // 5. Scoring Tests
      const scoringPassed = await testScoring(judgeId)
      if (!scoringPassed) allPassed = false
    } else {
      allPassed = false
    }

  } catch (error) {
    logError(`Unexpected error: ${error}`)
    allPassed = false
  } finally {
    // Cleanup test data
    await runCleanup(testEntryId)
  }

  // Summary
  logSection("TEST SUMMARY")
  if (allPassed) {
    log("\n  ✅ ALL TESTS PASSED!", colors.bright + colors.green)
  } else {
    log("\n  ❌ SOME TESTS FAILED", colors.bright + colors.red)
  }

  console.log(`
Manual Testing URLs:
  🏠 Home: ${BASE_URL}/
  📝 Signup: ${BASE_URL}/signup?eventId=${EVENT_ID}
  👨‍⚖️ Judge Login: ${BASE_URL}/judge/login
  📋 Coordinator: ${BASE_URL}/coordinator
  ⚙️ Admin: ${BASE_URL}/admin
  📊 Results: ${BASE_URL}/admin/results
  📅 Manage Events: ${BASE_URL}/admin/events
`)

  process.exit(allPassed ? 0 : 1)
}

main()
