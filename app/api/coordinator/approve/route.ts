import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, desc, and } from "drizzle-orm"

// Force dynamic rendering
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

    // Build where clause - filter by unapproved and optionally by eventId
    let whereClause = eq(schema.floats.approved, false)
    
    // If eventId is provided, filter by it (gracefully handle if column doesn't exist yet)
    if (eventId && !isNaN(eventId)) {
      try {
        whereClause = and(
          eq(schema.floats.approved, false),
          eq(schema.floats.eventId, eventId)
        ) as any
      } catch (error: any) {
        // If eventId column doesn't exist yet, just filter by approved
        if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
          console.log("eventId column does not exist yet, filtering by approved only")
        } else {
          throw error
        }
      }
    }

    // Get all unapproved entries, ordered by submission date (newest first)
    const unapprovedEntries = await db
      .select()
      .from(schema.floats)
      .where(whereClause)
      .orderBy(desc(schema.floats.submittedAt))

    return NextResponse.json(unapprovedEntries)
  } catch (error) {
    console.error("Error fetching unapproved entries:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { entryId, approved, floatNumber, eventId } = body

    if (!entryId) {
      return NextResponse.json(
        { error: "Missing required field: entryId" },
        { status: 400 }
      )
    }

    if (approved === undefined) {
      return NextResponse.json(
        { error: "Missing required field: approved" },
        { status: 400 }
      )
    }

    const entryIdNum = typeof entryId === 'number' ? entryId : parseInt(String(entryId), 10)
    if (isNaN(entryIdNum)) {
      return NextResponse.json(
        { error: "entryId must be a valid number" },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {
      approved: approved === true,
    }

    // If eventId is provided, set it (gracefully handle if column doesn't exist yet)
    if (eventId !== undefined && eventId !== null) {
      const eventIdNum = typeof eventId === 'number' ? eventId : parseInt(String(eventId), 10)
      if (!isNaN(eventIdNum)) {
        try {
          updateData.eventId = eventIdNum
        } catch (error: any) {
          // If eventId column doesn't exist yet, skip it
          if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
            console.log("eventId column does not exist yet, skipping eventId assignment")
          } else {
            throw error
          }
        }
      }
    }

    // If approving and floatNumber is provided, set it
    if (approved === true && floatNumber !== undefined && floatNumber !== null) {
      const floatNum = typeof floatNumber === 'number' ? floatNumber : parseInt(String(floatNumber), 10)
      if (!isNaN(floatNum) && (floatNum > 0 || floatNum === 999)) {
        // Special handling for 999: allow multiple floats
        if (floatNum === 999) {
          updateData.floatNumber = floatNum
        } else {
          // For other positions: check if taken and use insertion logic
          // Check if float number is already taken
          const existingFloat = await db
            .select()
            .from(schema.floats)
            .where(eq(schema.floats.floatNumber, floatNum))
            .limit(1)

          if (existingFloat.length > 0 && existingFloat[0].id !== entryIdNum) {
            // Position is taken - push all floats at this position and higher down by 1
            const tempPosition = 99999
            
            // Get all floats at target position or higher (excluding temp position and 999)
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
          }
          
          updateData.floatNumber = floatNum
        }
      }
    }

    // Get the entry before updating (to save participant data)
    const entryBeforeUpdate = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.id, entryIdNum))
      .limit(1)

    if (entryBeforeUpdate.length === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    const entry = entryBeforeUpdate[0]

    // Update the entry
    const updated = await db
      .update(schema.floats)
      .set(updateData)
      .where(eq(schema.floats.id, entryIdNum))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    // If approving, save participant data to participants table for future use
    if (approved === true) {
      try {
        // Check if participant already exists (by organization and email)
        let existingParticipants
        if (entry.email) {
          existingParticipants = await db
            .select()
            .from(schema.participants)
            .where(
              and(
                eq(schema.participants.organization, entry.organization),
                eq(schema.participants.email, entry.email)
              )
            )
            .limit(1)
        } else {
          existingParticipants = await db
            .select()
            .from(schema.participants)
            .where(eq(schema.participants.organization, entry.organization))
            .limit(1)
        }

        if (existingParticipants.length === 0) {
          // Create new participant record
          await db
            .insert(schema.participants)
            .values({
              organization: entry.organization,
              firstName: entry.firstName,
              lastName: entry.lastName,
              title: entry.title,
              phone: entry.phone,
              email: entry.email,
              entryName: entry.entryName,
              typeOfEntry: entry.typeOfEntry,
            })
        } else {
          // Update existing participant with latest info
          await db
            .update(schema.participants)
            .set({
              firstName: entry.firstName || existingParticipants[0].firstName,
              lastName: entry.lastName || existingParticipants[0].lastName,
              title: entry.title || existingParticipants[0].title,
              phone: entry.phone || existingParticipants[0].phone,
              email: entry.email || existingParticipants[0].email,
              entryName: entry.entryName || existingParticipants[0].entryName,
              typeOfEntry: entry.typeOfEntry || existingParticipants[0].typeOfEntry,
              updatedAt: new Date(),
            })
            .where(eq(schema.participants.id, existingParticipants[0].id))
        }
      } catch (error: any) {
        // If participants table doesn't exist yet, that's okay - just log it
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.log("Participants table does not exist yet, skipping participant save")
        } else {
          console.error("Error saving participant data:", error)
          // Don't fail the approval if participant save fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      entry: updated[0],
      message: approved ? "Entry approved successfully" : "Entry updated successfully",
    })
  } catch (error: any) {
    console.error("Error updating entry:", error)

    if (error?.code === "23505" || error?.constraint?.includes("float_number")) {
      return NextResponse.json(
        { error: "Float number is already assigned to another float" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const entryId = searchParams.get("entryId")

    if (!entryId) {
      return NextResponse.json(
        { error: "Missing required parameter: entryId" },
        { status: 400 }
      )
    }

    const entryIdNum = parseInt(entryId, 10)
    if (isNaN(entryIdNum)) {
      return NextResponse.json(
        { error: "entryId must be a valid number" },
        { status: 400 }
      )
    }

    // Delete the entry
    const deleted = await db
      .delete(schema.floats)
      .where(eq(schema.floats.id, entryIdNum))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Entry deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

