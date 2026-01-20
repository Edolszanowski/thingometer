import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, asc } from "drizzle-orm"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET - List all active events (public endpoint)
// Optionally filter by cityId
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cityIdParam = searchParams.get("cityId")
    const cityId = cityIdParam ? parseInt(cityIdParam, 10) : null

    try {
      // Build query - filter by cityId if provided
      let query = db
        .select({
          id: schema.events.id,
          name: schema.events.name,
          city: schema.events.city,
          eventDate: schema.events.eventDate,
          active: schema.events.active,
          entryCategoryTitle: schema.events.entryCategoryTitle,
          createdAt: schema.events.createdAt,
          updatedAt: schema.events.updatedAt,
        })
        .from(schema.events)

      // Filter by cityId if provided
      if (cityId && cityId !== 0) {
        try {
          query = query.where(eq(schema.events.cityId, cityId)) as any
        } catch (error: any) {
          // If city_id column doesn't exist, ignore filter (backward compatibility)
          if (error?.code !== "42703" && !error?.message?.includes("does not exist")) {
            throw error
          }
        }
      }

      const allEvents = await query.orderBy(asc(schema.events.eventDate))

      // Filter for active events (active is a boolean field)
      const activeEvents = allEvents.filter((event: typeof schema.events.$inferSelect) => event.active === true)

      console.log(`[api/events] Found ${allEvents.length} total events, ${activeEvents.length} active events`)
      
      return NextResponse.json(activeEvents)
    } catch (dbError: any) {
      // If events table doesn't exist yet, return empty array
      if (dbError?.code === "42P01" || dbError?.message?.includes("does not exist")) {
        console.log("[api/events] Events table does not exist yet, returning empty array")
        return NextResponse.json([])
      }
      console.error("[api/events] Database error fetching events:", {
        code: dbError?.code,
        message: dbError?.message,
        stack: dbError?.stack,
      })
      throw dbError
    }
  } catch (error: any) {
    console.error("[api/events] Error fetching active events:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    })
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

