import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getEventJudges } from "@/lib/scores"
import { eq, and, inArray } from "drizzle-orm"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET - Get judges for an event (or all judges if no eventId)
// Optionally filter by cityId
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const eventIdParam = searchParams.get("eventId")
    const eventId = eventIdParam ? parseInt(eventIdParam, 10) : null
    const cityIdParam = searchParams.get("cityId")
    const cityId = cityIdParam ? parseInt(cityIdParam, 10) : null

    // Build conditions
    const conditions: any[] = []

    // Filter by city through events
    if (cityId && cityId !== 0) {
      try {
        // Get events for this city
        const cityEvents = await db
          .select({ id: schema.events.id })
          .from(schema.events)
          .where(eq(schema.events.cityId, cityId))
        
        const eventIds = cityEvents.map((e: { id: number }) => e.id)
        
        if (eventIds.length > 0) {
          if (eventId && !isNaN(eventId)) {
            // Also filter by specific eventId if provided
            if (eventIds.includes(eventId)) {
              conditions.push(eq(schema.judges.eventId, eventId))
            } else {
              // Event doesn't belong to this city
              return NextResponse.json([])
            }
          } else {
            // Filter by any event in this city
            conditions.push(inArray(schema.judges.eventId, eventIds))
          }
        } else {
          // No events for this city
          return NextResponse.json([])
        }
      } catch (error: any) {
        // If city_id column doesn't exist, fall back to eventId only
        if (error?.code === "42703" || error?.message?.includes("does not exist")) {
          if (eventId && !isNaN(eventId)) {
            conditions.push(eq(schema.judges.eventId, eventId))
          }
        } else {
          throw error
        }
      }
    } else if (eventId && !isNaN(eventId)) {
      // No city filter, but eventId provided
      conditions.push(eq(schema.judges.eventId, eventId))
    }

    // Execute query
    if (conditions.length > 0) {
      const judges = await db
        .select()
        .from(schema.judges)
        .where(and(...conditions))
        .orderBy(schema.judges.name)
      return NextResponse.json(judges)
    } else {
      // Get all judges (for backward compatibility)
      const judges = await db
        .select()
        .from(schema.judges)
        .orderBy(schema.judges.name)
      return NextResponse.json(judges)
    }
  } catch (error: any) {
    console.error("Error fetching judges:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

