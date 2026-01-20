import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, inArray, asc } from "drizzle-orm"

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic'

function verifyAdminPassword(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    return false
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7) === password
  }

  const searchParams = request.nextUrl.searchParams
  const queryPassword = searchParams.get("password")
  return queryPassword === password
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get eventId from query params (optional)
    const searchParams = request.nextUrl.searchParams
    const eventIdParam = searchParams.get("eventId")
    const eventId = eventIdParam ? parseInt(eventIdParam, 10) : null

    // Get event categories for dynamic columns
    let categories: typeof schema.eventCategories.$inferSelect[] = []
    if (eventId && !isNaN(eventId)) {
      try {
        categories = await db
          .select()
          .from(schema.eventCategories)
          .where(eq(schema.eventCategories.eventId, eventId))
          .orderBy(asc(schema.eventCategories.displayOrder))
      } catch (error) {
        console.log("Could not fetch event categories, using defaults")
      }
    }

    // Default categories if none found
    if (categories.length === 0) {
      categories = [
        { id: 1, eventId: eventId || 0, categoryName: "Lighting", displayOrder: 0, required: true, hasNoneOption: true, createdAt: new Date() },
        { id: 2, eventId: eventId || 0, categoryName: "Theme", displayOrder: 1, required: true, hasNoneOption: true, createdAt: new Date() },
        { id: 3, eventId: eventId || 0, categoryName: "Traditions", displayOrder: 2, required: true, hasNoneOption: true, createdAt: new Date() },
        { id: 4, eventId: eventId || 0, categoryName: "Spirit", displayOrder: 3, required: true, hasNoneOption: true, createdAt: new Date() },
        { id: 5, eventId: eventId || 0, categoryName: "Music", displayOrder: 4, required: false, hasNoneOption: true, createdAt: new Date() },
      ]
    }

    // Get all judges - filter by eventId if provided
    let allJudges
    if (eventId && !isNaN(eventId)) {
      allJudges = await db
        .select()
        .from(schema.judges)
        .where(eq(schema.judges.eventId, eventId))
    } else {
      allJudges = await db.select().from(schema.judges)
    }
    
    // Get floats - filter by eventId if provided
    let allFloats
    if (eventId && !isNaN(eventId)) {
      try {
        allFloats = await db
          .select()
          .from(schema.floats)
          .where(eq(schema.floats.eventId, eventId))
          .orderBy(asc(schema.floats.floatNumber))
      } catch (error: any) {
        if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
          console.log("eventId column does not exist yet, ignoring event filter")
          allFloats = await db.select().from(schema.floats).orderBy(asc(schema.floats.floatNumber))
        } else {
          throw error
        }
      }
    } else {
      allFloats = await db.select().from(schema.floats).orderBy(asc(schema.floats.floatNumber))
    }

    // Get float IDs for filtering scores
    const floatIds = allFloats.map((f: { id: number }) => f.id)
    
    // Get scores - filter by floatIds if eventId was provided
    let allScores: typeof schema.scores.$inferSelect[]
    if (floatIds.length > 0) {
      allScores = await db
        .select()
        .from(schema.scores)
        .where(inArray(schema.scores.floatId, floatIds))
    } else {
      allScores = []
    }

    // Get all score items for these scores
    const scoreIds = allScores.map(s => s.id)
    let allScoreItems: { scoreId: number; categoryName: string; value: number | null }[] = []
    if (scoreIds.length > 0) {
      try {
        const items = await db
          .select({
            scoreId: schema.scoreItems.scoreId,
            categoryName: schema.eventCategories.categoryName,
            value: schema.scoreItems.value,
          })
          .from(schema.scoreItems)
          .innerJoin(schema.eventCategories, eq(schema.scoreItems.eventCategoryId, schema.eventCategories.id))
          .where(inArray(schema.scoreItems.scoreId, scoreIds))
        allScoreItems = items
      } catch (error) {
        console.log("Could not fetch score items, falling back to legacy columns")
      }
    }

    // Group score items by scoreId
    const scoreItemsMap = new Map<number, Map<string, number | null>>()
    for (const item of allScoreItems) {
      if (!scoreItemsMap.has(item.scoreId)) {
        scoreItemsMap.set(item.scoreId, new Map())
      }
      scoreItemsMap.get(item.scoreId)!.set(item.categoryName, item.value)
    }
    
    // Create maps for quick lookup
    type Judge = typeof schema.judges.$inferSelect
    type Float = typeof schema.floats.$inferSelect
    type Score = typeof schema.scores.$inferSelect
    
    const judgesMap = new Map<number, Judge>(allJudges.map((j: Judge) => [j.id, j]))
    const floatsMap = new Map<number, Float>(allFloats.map((f: Float) => [f.id, f]))
    
    // Combine data
    const scores = allScores.map((score: Score) => {
      const items = scoreItemsMap.get(score.id)
      const categoryScores: Record<string, number | null> = {}
      
      for (const cat of categories) {
        if (items && items.has(cat.categoryName)) {
          categoryScores[cat.categoryName] = items.get(cat.categoryName) ?? null
        } else {
          // Fallback to legacy columns if no score_items
          const legacyMap: Record<string, keyof Score> = {
            'Lighting': 'lighting',
            'Theme': 'theme',
            'Traditions': 'traditions',
            'Spirit': 'spirit',
            'Music': 'music',
          }
          const legacyKey = legacyMap[cat.categoryName]
          if (legacyKey && legacyKey in score) {
            categoryScores[cat.categoryName] = score[legacyKey] as number | null
          } else {
            categoryScores[cat.categoryName] = null
          }
        }
      }
      
      return {
        score,
        judge: judgesMap.get(score.judgeId) as Judge | undefined,
        float: floatsMap.get(score.floatId) as Float | undefined,
        categoryScores,
      }
    })

    const format = request.nextUrl.searchParams.get("format") || "json"

    if (format === "csv") {
      // Build dynamic headers based on categories
      const categoryNames = categories.map(c => c.categoryName)
      const headers = [
        "Judge ID",
        "Judge Name",
        "Judge Submitted",
        "Float Number",
        "Organization",
        "Entry Name",
        ...categoryNames,
        "Total",
        "Created At",
        "Updated At",
      ]

      const rows = scores.map(({ score, judge, float, categoryScores }) => {
        const categoryValues = categoryNames.map(name => {
          const val = categoryScores[name]
          return val === null || val === undefined ? "" : val
        })
        
        return [
          judge?.id || "",
          judge?.name || "",
          judge?.submitted ? "Yes" : "No",
          float?.floatNumber || "",
          float?.organization || "",
          float?.entryName || "",
          ...categoryValues,
          score.total ?? "",
          score.createdAt?.toISOString() || "",
          score.updatedAt?.toISOString() || "",
        ]
      })

      // Sort rows by float number, then by judge name
      rows.sort((a, b) => {
        const floatA = typeof a[3] === 'number' ? a[3] : 999
        const floatB = typeof b[3] === 'number' ? b[3] : 999
        if (floatA !== floatB) return floatA - floatB
        return String(a[1]).localeCompare(String(b[1]))
      })

      const csv = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
      ].join("\n")

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=scores-${eventId || 'all'}-${new Date().toISOString().split('T')[0]}.csv`,
        },
      })
    }

    return NextResponse.json(scores)
  } catch (error) {
    console.error("Error exporting scores:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

