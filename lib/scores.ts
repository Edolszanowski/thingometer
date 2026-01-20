import { db, schema } from "./db"
import { eq, sql, desc, inArray, and } from "drizzle-orm"

// Re-export client-safe utilities for backwards compatibility
export { calculateTotalFromItems, calculateTotal } from "./score-utils"

/**
 * Get scores for a specific judge
 */
export async function getJudgeScores(judgeId: number) {
  return await db
    .select()
    .from(schema.scores)
    .where(eq(schema.scores.judgeId, judgeId))
}

/**
 * Get score items for a specific score
 */
export async function getScoreItems(scoreId: number) {
  return await db
    .select({
      id: schema.scoreItems.id,
      scoreId: schema.scoreItems.scoreId,
      eventCategoryId: schema.scoreItems.eventCategoryId,
      value: schema.scoreItems.value,
      categoryName: schema.eventCategories.categoryName,
      createdAt: schema.scoreItems.createdAt,
      updatedAt: schema.scoreItems.updatedAt,
    })
    .from(schema.scoreItems)
    .innerJoin(schema.eventCategories, eq(schema.scoreItems.eventCategoryId, schema.eventCategories.id))
    .where(eq(schema.scoreItems.scoreId, scoreId))
}

/**
 * Get score with all items for a judge-float combination
 */
export async function getScoreWithItems(judgeId: number, floatId: number) {
  const score = await db
    .select()
    .from(schema.scores)
    .where(
      and(
        eq(schema.scores.judgeId, judgeId),
        eq(schema.scores.floatId, floatId)
      )
    )
    .limit(1)

  if (score.length === 0) {
    return null
  }

  const items = await getScoreItems(score[0].id)
  
  return {
    score: score[0],
    items: items.reduce((acc: Record<string, number | null>, item: { categoryName: string; value: number | null }) => {
      acc[item.categoryName] = item.value
      return acc
    }, {} as Record<string, number | null>),
  }
}

/**
 * Check if a judge has completed scoring all floats for an event
 */
export async function checkJudgeCompletion(
  judgeId: number,
  eventId: number
): Promise<boolean> {
  // Get all floats for the event
  const eventFloats = await db
    .select({ id: schema.floats.id })
    .from(schema.floats)
    .where(eq(schema.floats.eventId, eventId))

  const totalFloats = eventFloats.length
  if (totalFloats === 0) return true

  // Get all scores for this judge
  const scores = await getJudgeScores(judgeId)
  const eventScores = scores.filter((s: typeof schema.scores.$inferSelect) => s.eventId === eventId)
  
  // Get event categories to check required categories
  const categories = await db
    .select()
    .from(schema.eventCategories)
    .where(eq(schema.eventCategories.eventId, eventId))

  const requiredCategories = categories.filter((c: typeof schema.eventCategories.$inferSelect) => c.required).map((c: typeof schema.eventCategories.$inferSelect) => c.categoryName)

  // Check if all floats have scores with all required categories
  const scoredFloatIds = new Set(eventScores.map((s: typeof schema.scores.$inferSelect) => s.floatId))
  
  if (scoredFloatIds.size < totalFloats) {
    return false
  }

  // For each score, check if all required categories are present
  for (const score of eventScores) {
    const items = await getScoreItems(score.id)
    const itemCategories = new Set(items.map((i: { categoryName: string; value: number | null }) => i.categoryName))
    
    // Check if all required categories have values (not null)
    for (const requiredCategory of requiredCategories) {
      if (!itemCategories.has(requiredCategory)) {
        return false
      }
      const item = items.find((i: { categoryName: string; value: number | null }) => i.categoryName === requiredCategory)
      if (item && item.value === null) {
        return false
      }
    }
  }

  return true
}

/**
 * Get float scores aggregated across all judges
 */
export async function getFloatScores(floatId: number) {
  const scores = await db
    .select()
    .from(schema.scores)
    .where(eq(schema.scores.floatId, floatId))

  // Get all score items for these scores
  const scoreIds = scores.map((s: typeof schema.scores.$inferSelect) => s.id)
  if (scoreIds.length === 0) {
    return []
  }

  const allItems = await db
    .select({
      id: schema.scoreItems.id,
      scoreId: schema.scoreItems.scoreId,
      eventCategoryId: schema.scoreItems.eventCategoryId,
      value: schema.scoreItems.value,
      categoryName: schema.eventCategories.categoryName,
    })
    .from(schema.scoreItems)
    .innerJoin(schema.eventCategories, eq(schema.scoreItems.eventCategoryId, schema.eventCategories.id))
    .where(inArray(schema.scoreItems.scoreId, scoreIds))

  // Group items by score
  type ScoreItemType = typeof allItems[number]
  const itemsByScore = new Map<number, ScoreItemType[]>()
  allItems.forEach((item: ScoreItemType) => {
    const existing = itemsByScore.get(item.scoreId) || []
    existing.push(item)
    itemsByScore.set(item.scoreId, existing)
  })

  return scores.map((score: typeof schema.scores.$inferSelect) => ({
    ...score,
    items: itemsByScore.get(score.id) || [],
  }))
}

/**
 * Aggregate scores by category for an event
 * Returns winners for each category and overall
 */
export async function aggregateScoresByCategory(eventId?: number | null) {
  // Get float IDs for the event if eventId is provided
  let floatIds: number[] = []
  if (eventId && !isNaN(eventId)) {
    try {
      const eventFloats = await db
        .select({ id: schema.floats.id })
        .from(schema.floats)
        .where(eq(schema.floats.eventId, eventId))
      floatIds = eventFloats.map((f: { id: number }) => f.id)
    } catch (error: any) {
      if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
        console.log("eventId column does not exist yet, ignoring event filter")
      } else {
        throw error
      }
    }
  }

  // Get event categories
  let categories: typeof schema.eventCategories.$inferSelect[] = []
  if (eventId && !isNaN(eventId)) {
    try {
      categories = await db
        .select()
        .from(schema.eventCategories)
        .where(eq(schema.eventCategories.eventId, eventId))
        .orderBy(schema.eventCategories.displayOrder)
    } catch (error: any) {
      if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
        console.log("event_categories table does not exist yet, using default categories")
        // Fallback to default categories
        categories = [
          { id: 1, eventId, categoryName: "Lighting", displayOrder: 0, required: true, hasNoneOption: true, createdAt: new Date() },
          { id: 2, eventId, categoryName: "Theme", displayOrder: 1, required: true, hasNoneOption: true, createdAt: new Date() },
          { id: 3, eventId, categoryName: "Traditions", displayOrder: 2, required: true, hasNoneOption: true, createdAt: new Date() },
          { id: 4, eventId, categoryName: "Spirit", displayOrder: 3, required: true, hasNoneOption: true, createdAt: new Date() },
          { id: 5, eventId, categoryName: "Music", displayOrder: 4, required: false, hasNoneOption: true, createdAt: new Date() },
        ]
      } else {
        throw error
      }
    }
  } else {
    // No event ID, use default categories
    categories = [
      { id: 1, eventId: 0, categoryName: "Lighting", displayOrder: 0, required: true, hasNoneOption: true, createdAt: new Date() },
      { id: 2, eventId: 0, categoryName: "Theme", displayOrder: 1, required: true, hasNoneOption: true, createdAt: new Date() },
      { id: 3, eventId: 0, categoryName: "Traditions", displayOrder: 2, required: true, hasNoneOption: true, createdAt: new Date() },
      { id: 4, eventId: 0, categoryName: "Spirit", displayOrder: 3, required: true, hasNoneOption: true, createdAt: new Date() },
      { id: 5, eventId: 0, categoryName: "Music", displayOrder: 4, required: false, hasNoneOption: true, createdAt: new Date() },
    ]
  }

  // Get scores - filter by floatIds if provided
  let scoreWhere = undefined
  if (floatIds.length > 0) {
    scoreWhere = inArray(schema.scores.floatId, floatIds)
  }

  const scores = scoreWhere
    ? await db.select().from(schema.scores).where(scoreWhere)
    : await db.select().from(schema.scores)

  const scoreIds = scores.map((s: typeof schema.scores.$inferSelect) => s.id)
  
  if (scoreIds.length === 0) {
    // Return empty results for all categories
    return {
      categories: categories.reduce((acc, cat) => {
        acc[cat.categoryName] = []
        return acc
      }, {} as Record<string, Array<{ floatId: number | null; total: number }>>),
      overall: [],
    }
  }

  // Get all score items with category names
  const allItems = await db
    .select({
      scoreId: schema.scoreItems.scoreId,
      value: schema.scoreItems.value,
      categoryName: schema.eventCategories.categoryName,
    })
    .from(schema.scoreItems)
    .innerJoin(schema.eventCategories, eq(schema.scoreItems.eventCategoryId, schema.eventCategories.id))
    .where(inArray(schema.scoreItems.scoreId, scoreIds))

  // Aggregate by category
  const categoryResults: Record<string, Array<{ floatId: number; total: number }>> = {}

  for (const category of categories) {
    // Get all items for this category
    const categoryItems = allItems.filter((item: { scoreId: number; value: number | null; categoryName: string }) => item.categoryName === category.categoryName)
    
    // Group by floatId and sum values
    const floatTotals = new Map<number, number>()
    
    for (const item of categoryItems) {
      const score = scores.find((s: typeof schema.scores.$inferSelect) => s.id === item.scoreId)
      if (!score) continue
      
      const currentTotal = floatTotals.get(score.floatId) || 0
      floatTotals.set(score.floatId, currentTotal + (item.value ?? 0))
    }

    // Convert to array and sort
    const totals = Array.from(floatTotals.entries())
      .map(([floatId, total]) => ({ floatId, total }))
      .sort((a, b) => b.total - a.total)

    categoryResults[category.categoryName] = totals
  }

  // Calculate overall totals (sum of all categories for each float)
  const overallTotals = new Map<number, number>()
  
  for (const score of scores) {
    // Get all items for this score
    const scoreItems = allItems.filter((item: { scoreId: number; value: number | null; categoryName: string }) => item.scoreId === score.id)
    const scoreTotal = scoreItems.reduce((sum: number, item: { scoreId: number; value: number | null; categoryName: string }) => sum + (item.value ?? 0), 0)
    
    const currentTotal = overallTotals.get(score.floatId) || 0
    overallTotals.set(score.floatId, currentTotal + scoreTotal)
  }

  const overall = Array.from(overallTotals.entries())
    .map(([floatId, total]) => ({ floatId, total }))
    .sort((a, b) => b.total - a.total)

  return {
    categories: categoryResults,
    overall,
  }
}

/**
 * Get event categories for an event
 */
export async function getEventCategories(eventId: number) {
  return await db
    .select()
    .from(schema.eventCategories)
    .where(eq(schema.eventCategories.eventId, eventId))
    .orderBy(schema.eventCategories.displayOrder)
}

/**
 * Get event judges for an event
 */
export async function getEventJudges(eventId: number) {
  return await db
    .select()
    .from(schema.judges)
    .where(eq(schema.judges.eventId, eventId))
    .orderBy(schema.judges.name)
}
