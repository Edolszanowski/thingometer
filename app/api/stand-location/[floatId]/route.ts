import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET - Retrieve stand location for a float/entry by its ID
// This fetches the location from stand_positions based on the float's position number
export async function GET(
  request: NextRequest,
  { params }: { params: { floatId: string } }
) {
  try {
    const floatId = parseInt(params.floatId, 10)
    if (isNaN(floatId)) {
      return NextResponse.json(
        { error: "Invalid float ID" },
        { status: 400 }
      )
    }

    // Get the float/entry
    const floats = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.id, floatId))
      .limit(1)

    if (floats.length === 0) {
      return NextResponse.json(
        { error: "Float not found" },
        { status: 404 }
      )
    }

    const float = floats[0]

    // If no float number or no event ID, no location can be assigned
    if (!float.floatNumber || !float.eventId) {
      return NextResponse.json({
        success: true,
        location: null,
      })
    }

    // Fetch the stand position for this event and position number
    const positions = await db
      .select()
      .from(schema.standPositions)
      .where(
        and(
          eq(schema.standPositions.eventId, float.eventId),
          eq(schema.standPositions.positionNumber, float.floatNumber)
        )
      )
      .limit(1)

    if (positions.length === 0 || !positions[0].locationData) {
      return NextResponse.json({
        success: true,
        location: null,
      })
    }

    return NextResponse.json({
      success: true,
      location: positions[0].locationData,
    })
  } catch (error: any) {
    console.error("Error fetching stand location:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}
