import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { aggregateScoresByCategory } from "@/lib/scores"
import { eq, sql } from "drizzle-orm"

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

  // Also check query parameter
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

    const aggregates = await aggregateScoresByCategory(eventId)

    // Get float details for winners
    const getWinner = async (floatId: number | null) => {
      if (!floatId) return null
      const float = await db
        .select()
        .from(schema.floats)
        .where(eq(schema.floats.id, floatId))
        .limit(1)
      return float.length > 0 ? float[0] : null
    }

    // Get top float for each category (handle ties)
    const getTopFloats = async (totals: Array<{ floatId: number | null; total: number }>) => {
      if (totals.length === 0) return []
      const maxTotal = totals[0].total
      const topFloats = totals.filter(t => t.total === maxTotal && t.floatId !== null)
      const winners = await Promise.all(
        topFloats.map((t: { floatId: number | null; total: number }) => getWinner(t.floatId!))
      )
      return winners.filter((f): f is NonNullable<typeof f> => f !== null).map(f => ({
        float: f,
        total: maxTotal,
      }))
    }

    // Get winners for each category dynamically
    const categoryWinners: Record<string, any[]> = {}
    for (const [categoryName, totals] of Object.entries(aggregates.categories)) {
      categoryWinners[categoryName] = await getTopFloats(totals)
    }

    const bestOverall = await getTopFloats(aggregates.overall)

    // Get event to retrieve entry category title
    let entryCategoryTitle = "Best Entry" // Default
    if (eventId && !isNaN(eventId)) {
      try {
        const event = await db
          .select()
          .from(schema.events)
          .where(eq(schema.events.id, eventId))
          .limit(1)
        if (event.length > 0 && event[0].entryCategoryTitle) {
          entryCategoryTitle = event[0].entryCategoryTitle
        }
      } catch (error) {
        // If column doesn't exist yet, use default
        console.log("entryCategoryTitle column may not exist yet, using default")
      }
    }

    // Add "Entry" category to the categories list (it's calculated from overall totals)
    categoryWinners["Entry"] = bestOverall

    // For backward compatibility, also provide named properties
    const bestLighting = categoryWinners['Lighting'] || []
    const bestTheme = categoryWinners['Theme'] || []
    const bestTraditions = categoryWinners['Traditions'] || []
    const bestSpirit = categoryWinners['Spirit'] || []
    const bestMusic = categoryWinners['Music'] || []

    return NextResponse.json({
      bestLighting,
      bestTheme,
      bestTraditions,
      bestSpirit,
      bestMusic,
      bestOverall,
      categories: categoryWinners, // Dynamic categories including "Entry"
      entryCategoryTitle, // Custom title for the Entry category
    })
  } catch (error) {
    console.error("Error calculating winners:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

