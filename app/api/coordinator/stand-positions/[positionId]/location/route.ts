import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Check if request is from a coordinator (has admin-auth cookie)
function isCoordinatorRequest(request: NextRequest): boolean {
  const adminAuth = request.cookies.get("admin-auth")
  return !!adminAuth?.value
}

// PATCH - Update location data for a stand position
export async function PATCH(
  request: NextRequest,
  { params }: { params: { positionId: string } }
) {
  try {
    // MANDATORY SECURITY GUARD 1: Coordinator auth
    if (!isCoordinatorRequest(request)) {
      return NextResponse.json(
        { error: "Unauthorized - Coordinator access required" },
        { status: 403 }
      )
    }

    const positionId = parseInt(params.positionId, 10)
    if (isNaN(positionId)) {
      return NextResponse.json(
        { error: "Invalid position ID" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { placeId, address, lat, lng, placeName, instructions } = body

    // Validate required fields
    if (!placeId || !address) {
      return NextResponse.json(
        { error: "Place ID and address are required" },
        { status: 400 }
      )
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "Latitude and longitude must be numbers" },
        { status: 400 }
      )
    }

    // MANDATORY SECURITY GUARD 2: Verify position exists
    const positions = await db
      .select()
      .from(schema.standPositions)
      .where(eq(schema.standPositions.id, positionId))
      .limit(1)

    if (positions.length === 0) {
      return NextResponse.json(
        { error: "Stand position not found" },
        { status: 404 }
      )
    }

    const position = positions[0]

    // MANDATORY SECURITY GUARD 3: Verify event is Lemonade Day
    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, position.eventId))
      .limit(1)

    if (events.length === 0) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    if (events[0].type !== "lemonade_day") {
      return NextResponse.json(
        { error: "Location assignment is only available for Lemonade Day events" },
        { status: 400 }
      )
    }

    // Get coordinator ID from cookie (for audit trail)
    const coordinatorId = request.cookies.get("admin-auth")?.value || "unknown"

    // Build location data object
    const locationData = {
      placeId,  // PRIMARY: Google Place ID (source of truth)
      address,  // Formatted address
      lat,      // CACHE ONLY: For map rendering
      lng,      // CACHE ONLY: For map rendering
      placeName: placeName || null,
      instructions: instructions || null,
      assignedBy: coordinatorId,
      assignedAt: new Date().toISOString(),
    }

    // Update the position
    const updatedPositions = await db
      .update(schema.standPositions)
      .set({ 
        locationData,
        updatedAt: new Date(),
      })
      .where(eq(schema.standPositions.id, positionId))
      .returning()

    return NextResponse.json({
      success: true,
      position: updatedPositions[0],
      message: "Stand location assigned successfully",
    })
  } catch (error: any) {
    console.error("Error assigning stand location:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

// GET - Retrieve location for a stand position
export async function GET(
  request: NextRequest,
  { params }: { params: { positionId: string } }
) {
  try {
    const positionId = parseInt(params.positionId, 10)
    if (isNaN(positionId)) {
      return NextResponse.json(
        { error: "Invalid position ID" },
        { status: 400 }
      )
    }

    const positions = await db
      .select()
      .from(schema.standPositions)
      .where(eq(schema.standPositions.id, positionId))
      .limit(1)

    if (positions.length === 0) {
      return NextResponse.json(
        { error: "Stand position not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      position: positions[0],
    })
  } catch (error: any) {
    console.error("Error fetching stand position:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
