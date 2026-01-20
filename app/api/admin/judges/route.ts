import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, sql, and, inArray } from "drizzle-orm"

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

async function verifyCityAccess(cityId: number | null, userEmail?: string): Promise<boolean> {
  // If no cityId provided (backward compatibility), allow access
  if (!cityId || cityId === 0) {
    return true
  }

  // Check if user has access to this city
  // For now, we'll use password-based auth, but check city_users table if userEmail is provided
  if (userEmail) {
    try {
      const cityUser = await db
        .select()
        .from(schema.cityUsers)
        .where(
          and(
            eq(schema.cityUsers.cityId, cityId),
            eq(schema.cityUsers.userEmail, userEmail)
          )
        )
        .limit(1)
      
      return cityUser.length > 0
    } catch (error) {
      // If city_users table doesn't exist, allow access (backward compatibility)
      return true
    }
  }

  // For password-based auth, allow access (will be filtered by city_id in queries)
  return true
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get cityId and eventId from query params
    const searchParams = request.nextUrl.searchParams
    const cityIdParam = searchParams.get("cityId")
    const cityId = cityIdParam ? parseInt(cityIdParam, 10) : null
    const eventIdParam = searchParams.get("eventId")
    const eventId = eventIdParam ? parseInt(eventIdParam, 10) : null

    // Verify city access
    const hasCityAccess = await verifyCityAccess(cityId)
    if (!hasCityAccess) {
      return NextResponse.json({ error: "Access denied for this city" }, { status: 403 })
    }

    // Get judges - filter by cityId and eventId
    let judges
    const conditions: any[] = []
    
    // Filter by city through events
    if (cityId && cityId !== 0) {
      try {
        // Get events for this city
        const cityEvents = await db
          .select({ id: schema.events.id })
          .from(schema.events)
          .where(eq(schema.events.cityId, cityId))
          .execute({ cache: 'no-store' })
        
        const eventIds = cityEvents.map((e: { id: number }) => e.id)
        
        if (eventIds.length > 0) {
          // Filter judges by events in this city
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
          console.log("city_id column does not exist, using eventId filter only")
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

    try {
      if (conditions.length > 0) {
        judges = await db
          .select()
          .from(schema.judges)
          .where(and(...conditions))
          .execute({ cache: 'no-store' })
      } else {
        // Get all judges (backward compatibility)
        judges = await db.select().from(schema.judges).execute({ cache: 'no-store' })
      }
    } catch (error: any) {
      // If eventId column doesn't exist yet, get all judges
      if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
        console.log("eventId column does not exist yet in judges table, getting all judges")
        judges = await db.select().from(schema.judges).execute({ cache: 'no-store' })
      } else {
        throw error
      }
    }

    const judgesWithCounts = await Promise.all(
      judges.map(async (judge: typeof schema.judges.$inferSelect) => {
        // Build where clause for scores - filter by judgeId and optionally by eventId
        let scoreWhere = eq(schema.scores.judgeId, judge.id)
        
        // If eventId is provided, filter scores by floats that belong to that event
        if (eventId && !isNaN(eventId)) {
          try {
            // Get float IDs for this event
            const eventFloats = await db
              .select({ id: schema.floats.id })
              .from(schema.floats)
              .where(eq(schema.floats.eventId, eventId))
              .execute({ cache: 'no-store' })
            
            const floatIds = eventFloats.map((f: { id: number }) => f.id)
            
            if (floatIds.length > 0) {
              // Filter scores by float IDs using inArray
              scoreWhere = and(
                eq(schema.scores.judgeId, judge.id),
                inArray(schema.scores.floatId, floatIds)
              ) as any
            } else {
              // No floats for this event, so no scores
              return {
                ...judge,
                scoreCount: 0,
              }
            }
          } catch (error: any) {
            // If eventId column doesn't exist yet, ignore the filter
            if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
              console.log("eventId column does not exist yet, ignoring event filter")
            } else {
              throw error
            }
          }
        }

        const scoreCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(schema.scores)
          .where(scoreWhere)
          .execute({ cache: 'no-store' })

        return {
          ...judge,
          scoreCount: scoreCount[0]?.count || 0,
        }
      })
    )

    // Add cache-control headers to prevent caching
    const response = NextResponse.json(judgesWithCounts)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
  } catch (error) {
    console.error("Error fetching judges:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

