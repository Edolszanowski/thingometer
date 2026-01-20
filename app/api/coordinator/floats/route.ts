import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, asc, and, gte, ne, or, isNull } from "drizzle-orm"

// Force dynamic rendering since we use request headers and searchParams
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

    console.log(`[api/coordinator/floats] Fetching floats with eventId: ${eventId}`)

    // Build where clause - coordinators should see ALL floats (approved and unapproved) for position management
    // If eventId is provided, filter by it; otherwise show all floats
    let whereClause: any = undefined
    
    // If eventId is provided, filter by it
    if (eventId && !isNaN(eventId)) {
      try {
        whereClause = eq(schema.floats.eventId, eventId)
        console.log(`[api/coordinator/floats] Filtering by eventId: ${eventId} (showing all floats, approved and unapproved)`)
      } catch (error: any) {
        // If eventId column doesn't exist yet, show all floats
        if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
          console.log("[api/coordinator/floats] eventId column does not exist yet, showing all floats")
          whereClause = undefined
        } else {
          console.error("[api/coordinator/floats] Error building where clause:", error)
          throw error
        }
      }
    } else {
      console.log("[api/coordinator/floats] No eventId provided, showing all floats")
    }

    // Get all floats (approved and unapproved) ordered by float number
    // Coordinators need to see all floats to manage positions
    const floats = whereClause
      ? await db
          .select()
          .from(schema.floats)
          .where(whereClause)
          .orderBy(asc(schema.floats.floatNumber))
      : await db
          .select()
          .from(schema.floats)
          .orderBy(asc(schema.floats.floatNumber))

    console.log(`[api/coordinator/floats] Found ${floats.length} floats`)
    
    // Log first few floats for debugging
    if (floats.length > 0) {
      console.log(`[api/coordinator/floats] Sample floats:`, floats.slice(0, 3).map((f: typeof schema.floats.$inferSelect) => ({
        id: f.id,
        organization: f.organization,
        eventId: f.eventId,
        approved: f.approved,
        floatNumber: f.floatNumber
      })))
    } else {
      // If no floats found, check if there are any floats at all (for debugging)
      let allFloats
      if (eventId && !isNaN(eventId)) {
        // Check floats for this specific eventId
        try {
          allFloats = await db
            .select()
            .from(schema.floats)
            .where(eq(schema.floats.eventId, eventId))
            .limit(10)
        } catch (error: any) {
          // If eventId column doesn't exist, get all floats
          allFloats = await db.select().from(schema.floats).limit(10)
        }
      } else {
        allFloats = await db.select().from(schema.floats).limit(10)
      }
      
      console.log(`[api/coordinator/floats] Total floats in database (matching criteria): ${allFloats.length}`)
      if (allFloats.length > 0) {
        console.log(`[api/coordinator/floats] Sample of all floats:`, allFloats.map((f: typeof schema.floats.$inferSelect) => ({
          id: f.id,
          organization: f.organization,
          eventId: f.eventId,
          approved: f.approved,
          floatNumber: f.floatNumber
        })))
      } else {
        console.log(`[api/coordinator/floats] No floats found with eventId=${eventId}`)
      }
    }

    return NextResponse.json(floats)
  } catch (error) {
    console.error("[api/coordinator/floats] Error fetching floats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      )
    }

    const { floatId, floatNumber } = body

    // Check if floatId is provided and valid
    if (floatId === undefined || floatId === null) {
      return NextResponse.json(
        { error: "Missing required field: floatId" },
        { status: 400 }
      )
    }

    // Check if floatNumber is provided (allow 0 for temporary positions during swaps)
    if (floatNumber === undefined || floatNumber === null) {
      return NextResponse.json(
        { error: "Missing required field: floatNumber" },
        { status: 400 }
      )
    }

    // Validate floatId is a number
    const floatIdNum = typeof floatId === 'number' ? floatId : parseInt(String(floatId), 10)
    if (isNaN(floatIdNum)) {
      return NextResponse.json(
        { error: "floatId must be a valid number" },
        { status: 400 }
      )
    }

    // Validate float number is an integer (allow 0 for temporary positions)
    const floatNum = typeof floatNumber === 'number' ? floatNumber : parseInt(String(floatNumber), 10)
    if (isNaN(floatNum)) {
      return NextResponse.json(
        { error: "Float number must be a valid integer" },
        { status: 400 }
      )
    }
    
    // Allow temporary high numbers for swaps (positions >= 100 are considered temporary)
    // Normal positions must be positive (>= 1), but we allow high numbers for swap operations
    if (floatNum < 0) {
      return NextResponse.json(
        { error: "Float number must be a non-negative integer" },
        { status: 400 }
      )
    }

    // If floatNumber is 0, it's a temporary position during swap - allow it
    if (floatNum === 0) {
      // Allow 0 as temporary position
    } else if (floatNum < 1) {
      return NextResponse.json(
        { error: "Float number must be a positive integer (or 0 for temporary positions)" },
        { status: 400 }
      )
    }

    // Special handling for position 999: allow multiple floats
    // For all other positions: insert and push others down
    if (floatNum === 999) {
      // Position 999: Allow multiple floats (no-shows/cancelled)
      // Just update this float to 999, no need to check uniqueness
      const updated = await db
        .update(schema.floats)
        .set({ floatNumber: floatNum })
        .where(eq(schema.floats.id, floatIdNum))
        .returning()

      if (updated.length === 0) {
        return NextResponse.json({ error: "Float not found" }, { status: 404 })
      }

      return NextResponse.json(updated[0])
    }

    // For all other positions: Insert and push others down
    // Get the current float being moved
    const currentFloat = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.id, floatIdNum))
      .limit(1)

    if (currentFloat.length === 0) {
      return NextResponse.json({ error: "Float not found" }, { status: 404 })
    }

    const oldFloatNumber = currentFloat[0].floatNumber

    // If moving to the same position, no change needed
    if (oldFloatNumber === floatNum) {
      return NextResponse.json(currentFloat[0])
    }

    // Check if target position is already taken
    const existingFloat = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.floatNumber, floatNum))
      .limit(1)

    if (existingFloat.length > 0 && existingFloat[0].id !== floatIdNum) {
      // Position is taken - push all floats at this position and higher down by 1
      // First, move the current float to a temporary high position to avoid conflicts
      const tempPosition = 99999
      
      await db
        .update(schema.floats)
        .set({ floatNumber: tempPosition })
        .where(eq(schema.floats.id, floatIdNum))

      // Get all floats at target position or higher (excluding temp position and 999)
      // Filter out null values and only get floats with valid numbers
      const allFloats = await db
        .select()
        .from(schema.floats)
      
      const floatsToShift = allFloats.filter((f: typeof schema.floats.$inferSelect) => 
        f.floatNumber !== null && 
        f.floatNumber >= floatNum && 
        f.floatNumber !== tempPosition && 
        f.floatNumber !== 999
      )

      // Shift all floats down by 1
      for (const float of floatsToShift) {
        await db
          .update(schema.floats)
          .set({ floatNumber: float.floatNumber! + 1 })
          .where(eq(schema.floats.id, float.id))
      }

      // Now move the current float to the target position
      const updated = await db
        .update(schema.floats)
        .set({ floatNumber: floatNum })
        .where(eq(schema.floats.id, floatIdNum))
        .returning()

      if (updated.length === 0) {
        return NextResponse.json({ error: "Failed to update float" }, { status: 500 })
      }

      return NextResponse.json(updated[0])
    } else {
      // Position is free - just update
      const updated = await db
        .update(schema.floats)
        .set({ floatNumber: floatNum })
        .where(eq(schema.floats.id, floatIdNum))
        .returning()

      if (updated.length === 0) {
        return NextResponse.json({ error: "Float not found" }, { status: 404 })
      }

      return NextResponse.json(updated[0])
    }
  } catch (error: any) {
    console.error("Error updating float position:", error)
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      constraint: error?.constraint,
      stack: error?.stack,
    })
    
    // Handle unique constraint violation
    if (error?.code === "23505" || error?.constraint?.includes("float_number")) {
      return NextResponse.json(
        { error: "Float number is already assigned to another float" },
        { status: 400 }
      )
    }

    // Return more detailed error in development
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json(
        { 
          error: "Internal server error",
          details: error?.message || String(error)
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("Error parsing request body:", parseError)
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      )
    }

    const { floatId } = body

    if (floatId === undefined || floatId === null) {
      return NextResponse.json(
        { error: "Missing required field: floatId" },
        { status: 400 }
      )
    }

    const floatIdNum = typeof floatId === 'number' ? floatId : parseInt(String(floatId), 10)
    if (isNaN(floatIdNum)) {
      return NextResponse.json(
        { error: "floatId must be a valid number" },
        { status: 400 }
      )
    }

    // Check if float exists
    const existingFloat = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.id, floatIdNum))
      .limit(1)

    if (existingFloat.length === 0) {
      return NextResponse.json({ error: "Float not found" }, { status: 404 })
    }

    // Delete the float (cascade will handle scores)
    await db
      .delete(schema.floats)
      .where(eq(schema.floats.id, floatIdNum))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting float:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
