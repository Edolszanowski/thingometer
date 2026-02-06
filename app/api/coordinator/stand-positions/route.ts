import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, asc } from "drizzle-orm"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Check if request is from a coordinator (has admin-auth cookie)
function isCoordinatorRequest(request: NextRequest): boolean {
  const adminAuth = request.cookies.get("admin-auth")
  return !!adminAuth?.value
}

// GET - Fetch all stand positions for an event with assigned participants
export async function GET(request: NextRequest) {
  try {
    // MANDATORY SECURITY GUARD: Coordinator auth
    if (!isCoordinatorRequest(request)) {
      return NextResponse.json(
        { error: "Unauthorized - Coordinator access required" },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const eventIdParam = searchParams.get("eventId")
    
    if (!eventIdParam) {
      return NextResponse.json(
        { error: "eventId parameter is required" },
        { status: 400 }
      )
    }

    const eventId = parseInt(eventIdParam, 10)
    if (isNaN(eventId)) {
      return NextResponse.json(
        { error: "Invalid eventId" },
        { status: 400 }
      )
    }

    // Verify event exists and is Lemonade Day
    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, eventId))
      .limit(1)

    if (events.length === 0) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    if (events[0].type !== "lemonade_day") {
      return NextResponse.json(
        { error: "Stand positions are only available for Lemonade Day events" },
        { status: 400 }
      )
    }

    // Fetch all stand positions for this event
    const positions = await db
      .select()
      .from(schema.standPositions)
      .where(eq(schema.standPositions.eventId, eventId))
      .orderBy(asc(schema.standPositions.positionNumber))

    // Fetch all floats for this event to match participants to positions
    const floats = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.eventId, eventId))

    // Create a map of position number to participant
    const participantMap = new Map()
    floats.forEach((float) => {
      if (float.floatNumber !== null && float.floatNumber !== 999) {
        const metadata = float.metadata as any
        const childName = metadata?.child
          ? `${metadata.child.firstName} ${metadata.child.lastName}`
          : `${float.firstName || ""} ${float.lastName || ""}`.trim() || "Unknown"
        
        participantMap.set(float.floatNumber, {
          id: float.id,
          entryName: float.entryName,
          participantName: childName,
          approved: float.approved,
        })
      }
    })

    // Combine positions with participants
    const result = positions.map((pos) => ({
      id: pos.id,
      positionNumber: pos.positionNumber,
      locationData: pos.locationData,
      assignedParticipant: participantMap.get(pos.positionNumber) || null,
    }))

    return NextResponse.json({
      success: true,
      positions: result,
    })
  } catch (error: any) {
    console.error("Error fetching stand positions:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

// POST - Initialize stand positions for an event (create 1-50)
export async function POST(request: NextRequest) {
  try {
    // MANDATORY SECURITY GUARD: Coordinator auth
    if (!isCoordinatorRequest(request)) {
      return NextResponse.json(
        { error: "Unauthorized - Coordinator access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { eventId, count = 50 } = body

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      )
    }

    const eventIdNum = parseInt(eventId, 10)
    if (isNaN(eventIdNum)) {
      return NextResponse.json(
        { error: "Invalid eventId" },
        { status: 400 }
      )
    }

    // Verify event exists and is Lemonade Day
    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, eventIdNum))
      .limit(1)

    if (events.length === 0) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    if (events[0].type !== "lemonade_day") {
      return NextResponse.json(
        { error: "Stand positions can only be initialized for Lemonade Day events" },
        { status: 400 }
      )
    }

    // Check if positions already exist
    const existing = await db
      .select()
      .from(schema.standPositions)
      .where(eq(schema.standPositions.eventId, eventIdNum))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Stand positions already initialized for this event" },
        { status: 400 }
      )
    }

    // Create positions 1 through count (default 50)
    const positions = []
    for (let i = 1; i <= count; i++) {
      positions.push({
        eventId: eventIdNum,
        positionNumber: i,
        locationData: null,
      })
    }

    // Insert all positions
    const inserted = await db
      .insert(schema.standPositions)
      .values(positions)
      .returning()

    return NextResponse.json({
      success: true,
      message: `Initialized ${inserted.length} stand positions`,
      count: inserted.length,
    })
  } catch (error: any) {
    console.error("Error initializing stand positions:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}
