import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getJudgeId } from "@/lib/cookies"
import { getEventCategories } from "@/lib/scores"
import { eq, and, inArray } from "drizzle-orm"
import { cookies } from "next/headers"

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

// Disable caching for score operations - always fetch fresh data
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    // Debug: log all cookies received
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    console.log("[API] POST /api/scores - All cookies:", allCookies.map(c => c.name))
    
    const judgeId = await getJudgeId()
    if (!judgeId) {
      console.error("[API] Judge not authenticated - no judgeId cookie found")
      console.error("[API] Available cookies:", allCookies.map(c => `${c.name}=${c.value.substring(0, 10)}...`))
      return NextResponse.json({ error: "Judge not authenticated" }, { status: 401 })
    }

    console.log(`[API] POST /api/scores - Judge ${judgeId} attempting to save score`)

    // Check if judge has already submitted
    const judge = await db
      .select()
      .from(schema.judges)
      .where(eq(schema.judges.id, judgeId))
      .limit(1)

    if (judge.length === 0) {
      return NextResponse.json({ error: "Judge not found" }, { status: 404 })
    }

    if (judge[0].submitted) {
      return NextResponse.json({ error: "Judge has already submitted scores" }, { status: 403 })
    }

    const body = await request.json()
    const { floatId, scores: dynamicScores } = body

    // Support both old format (lighting, theme, etc.) and new format (scores object)
    let scoreValues: Record<string, number | null> = {}
    
    if (dynamicScores && typeof dynamicScores === 'object') {
      // New format: { scores: { Lighting: 10, Theme: 8, ... } }
      scoreValues = dynamicScores
    } else {
      // Legacy format: { floatId, lighting, theme, traditions, spirit, music }
      const { lighting, theme, traditions, spirit, music } = body
      if (lighting !== undefined) scoreValues['Lighting'] = lighting === null ? null : Number(lighting)
      if (theme !== undefined) scoreValues['Theme'] = theme === null ? null : Number(theme)
      if (traditions !== undefined) scoreValues['Traditions'] = traditions === null ? null : Number(traditions)
      if (spirit !== undefined) scoreValues['Spirit'] = spirit === null ? null : Number(spirit)
      if (music !== undefined) scoreValues['Music'] = music === null ? null : Number(music)
    }

    if (!floatId) {
      return NextResponse.json({ error: "Missing required field: floatId" }, { status: 400 })
    }

    // Get float to determine event
    const float = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.id, floatId))
      .limit(1)

    if (float.length === 0) {
      return NextResponse.json({ error: "Float not found" }, { status: 404 })
    }

    const floatData = float[0]
    const eventId = floatData.eventId

    if (!eventId) {
      return NextResponse.json({ error: "Float is not associated with an event" }, { status: 400 })
    }

    // Get event categories
    const categories = await getEventCategories(eventId)
    if (categories.length === 0) {
      return NextResponse.json({ error: "Event has no scoring categories defined" }, { status: 400 })
    }

    // Validate scores against categories
    type CategoryType = typeof schema.eventCategories.$inferSelect
    const categoryMap = new Map<string, CategoryType>(categories.map((c: CategoryType) => [c.categoryName, c]))

    // Validate all provided scores
    for (const [categoryName, value] of Object.entries(scoreValues)) {
      if (value === undefined) continue
      
      if (!categoryMap.has(categoryName)) {
        return NextResponse.json({ error: `Invalid category: ${categoryName}` }, { status: 400 })
      }

      const category = categoryMap.get(categoryName)!
      
      // Validate score range (null, 0, or 1-20) - default max is 20
      const maxScore = 20 // Default max score
      if (value !== null && (value < 0 || value > maxScore || !Number.isInteger(value))) {
        return NextResponse.json({ 
          error: `Score for ${categoryName} must be null, 0, or an integer between 1 and ${maxScore}` 
        }, { status: 400 })
      }

      // If category doesn't have "none" option and value is 0, reject
      if (!category.hasNoneOption && value === 0) {
        return NextResponse.json({ 
          error: `Category ${categoryName} does not allow "None" option` 
        }, { status: 400 })
      }
    }

    // Check if score already exists
    const existingScore = await db
      .select()
      .from(schema.scores)
      .where(
        and(
          eq(schema.scores.judgeId, judgeId),
          eq(schema.scores.floatId, floatId)
        )
      )
      .limit(1)

    let scoreId: number

    if (existingScore.length > 0) {
      // Update existing score
      scoreId = existingScore[0].id
      
      // Update eventId if needed
      if (existingScore[0].eventId !== eventId) {
        await db
          .update(schema.scores)
          .set({ eventId, updatedAt: new Date() })
          .where(eq(schema.scores.id, scoreId))
      }
    } else {
      // Create new score
      const newScore = await db
        .insert(schema.scores)
        .values({
          eventId,
          judgeId,
          floatId,
          total: 0, // Will be updated by trigger
        })
        .returning()
      
      scoreId = newScore[0].id
    }

    // Update or create score items for ALL categories
    // CRITICAL: Create score items for all categories, not just ones in the request
    // This ensures status calculation can properly check if all required categories are filled
    for (const category of categories) {
      const value = scoreValues[category.categoryName]
      
      // If value is undefined (not provided), set it to null
      // This ensures we create score items for all categories
      const finalValue = value === undefined ? null : (value === null ? null : Number(value))

      // Check if score item exists
      const existingItem = await db
        .select()
        .from(schema.scoreItems)
        .where(
          and(
            eq(schema.scoreItems.scoreId, scoreId),
            eq(schema.scoreItems.eventCategoryId, category.id)
          )
        )
        .limit(1)

      if (existingItem.length > 0) {
        // Update existing item
        await db
          .update(schema.scoreItems)
          .set({
            value: finalValue,
            updatedAt: new Date(),
          })
          .where(eq(schema.scoreItems.id, existingItem[0].id))
      } else {
        // Create new item - always create for all categories
        await db
          .insert(schema.scoreItems)
          .values({
            scoreId,
            eventCategoryId: category.id,
            value: finalValue,
          })
      }
    }

    // Get updated score with items
    const updatedScore = await db
      .select()
      .from(schema.scores)
      .where(eq(schema.scores.id, scoreId))
      .limit(1)

    const scoreItems = await db
      .select({
        categoryName: schema.eventCategories.categoryName,
        value: schema.scoreItems.value,
      })
      .from(schema.scoreItems)
      .innerJoin(schema.eventCategories, eq(schema.scoreItems.eventCategoryId, schema.eventCategories.id))
      .where(eq(schema.scoreItems.scoreId, scoreId))

    const itemsObject = scoreItems.reduce((acc: Record<string, number | null>, item: { categoryName: string; value: number | null }) => {
      acc[item.categoryName] = item.value
      return acc
    }, {} as Record<string, number | null>)

    console.log(`[API] Successfully saved score for judge ${judgeId}, float ${floatId}`)
    
    return NextResponse.json({
      id: updatedScore[0].id,
      judgeId: updatedScore[0].judgeId,
      floatId: updatedScore[0].floatId,
      eventId: updatedScore[0].eventId,
      total: updatedScore[0].total,
      scores: itemsObject,
      createdAt: updatedScore[0].createdAt,
      updatedAt: updatedScore[0].updatedAt,
    })
  } catch (error: any) {
    console.error("Error saving score:", error)
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorDetails: any = {
      error: "Internal server error",
      message: errorMessage,
    }
    
    if (process.env.NODE_ENV === "development") {
      errorDetails.details = {
        code: error?.code,
        constraint: error?.constraint,
        stack: error?.stack,
      }
    }
    
    return NextResponse.json(errorDetails, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  // PATCH uses the same logic as POST (upsert)
  return POST(request)
}
