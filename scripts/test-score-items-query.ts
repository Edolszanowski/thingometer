import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

import { db, schema } from "../lib/db"
import { eq, inArray } from "drizzle-orm"

async function testScoreItemsQuery() {
  const scoreIds = [31, 32, 127, 128, 129] // Scores for stands 101-105
  
  console.log("Testing Drizzle query for score_items...")
  console.log("Score IDs:", scoreIds)
  
  try {
    const allItems = await db
      .select({
        scoreId: schema.scoreItems.scoreId,
        value: schema.scoreItems.value,
        categoryName: schema.eventCategories.categoryName,
      })
      .from(schema.scoreItems)
      .innerJoin(schema.eventCategories, eq(schema.scoreItems.eventCategoryId, schema.eventCategories.id))
      .where(inArray(schema.scoreItems.scoreId, scoreIds))
    
    console.log(`\nFound ${allItems.length} score items`)
    
    // Group by scoreId
    const itemsByScore = new Map<number, typeof allItems>()
    allItems.forEach(item => {
      const existing = itemsByScore.get(item.scoreId) || []
      existing.push(item)
      itemsByScore.set(item.scoreId, existing)
    })
    
    console.log(`\nGrouped into ${itemsByScore.size} scores:`)
    itemsByScore.forEach((items, scoreId) => {
      console.log(`\nScore ID ${scoreId}:`)
      items.forEach(item => {
        console.log(`  - ${item.categoryName}: ${item.value}`)
      })
    })
    
    // Test status calculation for score 31 (stand 101)
    const score31Items = itemsByScore.get(31) || []
    console.log(`\n\nTesting status for Score 31 (Stand 101):`)
    console.log(`Items found: ${score31Items.length}`)
    
    // Get categories for event 4
    const categories = await db
      .select()
      .from(schema.eventCategories)
      .where(eq(schema.eventCategories.eventId, 4))
      .orderBy(schema.eventCategories.displayOrder)
    
    console.log(`\nCategories for event 4: ${categories.length}`)
    categories.forEach(cat => {
      console.log(`  - ${cat.categoryName} (required: ${cat.required})`)
    })
    
    // Check if all required categories are filled
    const scoreItemsByCategory = new Map(score31Items.map(item => [item.categoryName, item.value]))
    const requiredCategories = categories.filter(c => c.required)
    
    console.log(`\n\nStatus calculation for Score 31:`)
    console.log(`Required categories: ${requiredCategories.length}`)
    
    let allRequiredFilled = true
    for (const category of requiredCategories) {
      const value = scoreItemsByCategory.get(category.categoryName)
      const filled = value !== null && value !== undefined
      console.log(`  ${category.categoryName}: value=${value}, filled=${filled}`)
      if (!filled) {
        allRequiredFilled = false
      }
    }
    
    const allNull = score31Items.every(item => item.value === null)
    console.log(`\nAll required filled: ${allRequiredFilled}`)
    console.log(`All null: ${allNull}`)
    
    let status: string
    if (allNull) {
      status = 'not_started'
    } else if (allRequiredFilled) {
      status = 'complete'
    } else {
      status = 'incomplete'
    }
    
    console.log(`\nFinal status: ${status}`)
    
  } catch (error: any) {
    console.error("Error:", error)
    console.error("Stack:", error?.stack)
  }
  
  process.exit(0)
}

testScoreItemsQuery()
