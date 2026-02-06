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

// PATCH - Assign stand location to a Lemonade Day entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: { entryId: string } }
) {
  try {
    // MANDATORY SECURITY GUARD 1: Coordinator auth
    if (!isCoordinatorRequest(request)) {
      return NextResponse.json(
        { error: "Unauthorized - Coordinator access required" },
        { status: 403 }
      )
    }

    const entryId = parseInt(params.entryId, 10)
    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: "Invalid entry ID" },
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

    // MANDATORY SECURITY GUARD 2: Verify entry exists
    const entries = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.id, entryId))
      .limit(1)

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      )
    }

    const entry = entries[0]

    // MANDATORY SECURITY GUARD 3: Verify event is Lemonade Day
    if (entry.eventId) {
      const events = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, entry.eventId))
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
    } else {
      return NextResponse.json(
        { error: "Entry must be associated with an event" },
        { status: 400 }
      )
    }

    // MANDATORY SECURITY GUARD 4: Verify entry is approved
    if (!entry.approved) {
      return NextResponse.json(
        { error: "Entry must be approved before assigning a location" },
        { status: 400 }
      )
    }

    // Get coordinator ID from cookie (for audit trail)
    const coordinatorId = request.cookies.get("admin-auth")?.value || "unknown"

    // Update metadata.assignedLocation (NO separate tables, NO duplication)
    const currentMetadata = (entry.metadata as any) || {}
    const updatedMetadata = {
      ...currentMetadata,
      assignedLocation: {
        placeId,  // PRIMARY: Google Place ID (source of truth)
        address,  // Formatted address
        lat,      // CACHE ONLY: For map rendering
        lng,      // CACHE ONLY: For map rendering
        placeName: placeName || null,
        instructions: instructions || null,
        assignedBy: coordinatorId,
        assignedAt: new Date().toISOString(),
      },
    }

    // Update the entry
    const updatedEntries = await db
      .update(schema.floats)
      .set({ metadata: updatedMetadata })
      .where(eq(schema.floats.id, entryId))
      .returning()

    return NextResponse.json({
      success: true,
      entry: updatedEntries[0],
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

// GET - Retrieve assigned location for an entry
export async function GET(
  request: NextRequest,
  { params }: { params: { entryId: string } }
) {
  try {
    const entryId = parseInt(params.entryId, 10)
    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: "Invalid entry ID" },
        { status: 400 }
      )
    }

    const entries = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.id, entryId))
      .limit(1)

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "Entry not found" },
        { status: 404 }
      )
    }

    const entry = entries[0]
    const assignedLocation = (entry.metadata as any)?.assignedLocation || null

    return NextResponse.json({
      success: true,
      assignedLocation,
    })
  } catch (error: any) {
    console.error("Error fetching stand location:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
