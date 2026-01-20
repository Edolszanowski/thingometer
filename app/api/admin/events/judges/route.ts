import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, sql } from "drizzle-orm"

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

// POST - Add a new judge to an event
export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, name } = body

    if (!eventId || !name || !name.trim()) {
      return NextResponse.json(
        { error: "Event ID and judge name are required" },
        { status: 400 }
      )
    }

    const eventIdNum = parseInt(String(eventId), 10)
    if (isNaN(eventIdNum)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      )
    }

    try {
      // Check if event exists
      const event = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, eventIdNum))
        .limit(1)

      if (event.length === 0) {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404 }
        )
      }

      // Check if judge with same name already exists for this event
      const existingJudge = await db
        .select()
        .from(schema.judges)
        .where(
          and(
            eq(schema.judges.eventId, eventIdNum),
            eq(schema.judges.name, name.trim())
          )
        )
        .limit(1)

      if (existingJudge.length > 0) {
        return NextResponse.json(
          { error: "A judge with this name already exists for this event" },
          { status: 400 }
        )
      }

      // Create new judge
      const newJudge = await db
        .insert(schema.judges)
        .values({
          eventId: eventIdNum,
          name: name.trim(),
          submitted: false,
        })
        .returning()

      return NextResponse.json(newJudge[0])
    } catch (dbError: any) {
      if (dbError?.code === "23505") {
        return NextResponse.json(
          { error: "A judge with this name already exists for this event" },
          { status: 400 }
        )
      }
      throw dbError
    }
  } catch (error: any) {
    console.error("Error adding judge:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update a judge's name
export async function PATCH(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, judgeId, name } = body

    if (!eventId || !judgeId || !name || !name.trim()) {
      return NextResponse.json(
        { error: "Event ID, judge ID, and judge name are required" },
        { status: 400 }
      )
    }

    const eventIdNum = parseInt(String(eventId), 10)
    const judgeIdNum = parseInt(String(judgeId), 10)
    
    if (isNaN(eventIdNum) || isNaN(judgeIdNum)) {
      return NextResponse.json(
        { error: "Invalid event ID or judge ID" },
        { status: 400 }
      )
    }

    try {
      // Check if judge exists and belongs to this event
      const existingJudge = await db
        .select()
        .from(schema.judges)
        .where(
          and(
            eq(schema.judges.id, judgeIdNum),
            eq(schema.judges.eventId, eventIdNum)
          )
        )
        .limit(1)

      if (existingJudge.length === 0) {
        return NextResponse.json(
          { error: "Judge not found" },
          { status: 404 }
        )
      }

      // Check if another judge with this name already exists for this event
      const duplicateJudge = await db
        .select()
        .from(schema.judges)
        .where(
          and(
            eq(schema.judges.eventId, eventIdNum),
            eq(schema.judges.name, name.trim()),
            sql`${schema.judges.id} != ${judgeIdNum}`
          )
        )
        .limit(1)

      if (duplicateJudge.length > 0) {
        return NextResponse.json(
          { error: "A judge with this name already exists for this event" },
          { status: 400 }
        )
      }

      // Update judge name
      const updated = await db
        .update(schema.judges)
        .set({ name: name.trim() })
        .where(eq(schema.judges.id, judgeIdNum))
        .returning()

      return NextResponse.json(updated[0])
    } catch (dbError: any) {
      if (dbError?.code === "23505") {
        return NextResponse.json(
          { error: "A judge with this name already exists for this event" },
          { status: 400 }
        )
      }
      throw dbError
    }
  } catch (error: any) {
    console.error("Error updating judge:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Remove a judge from an event (only if no scores exist)
export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, judgeId } = body

    if (!eventId || !judgeId) {
      return NextResponse.json(
        { error: "Event ID and judge ID are required" },
        { status: 400 }
      )
    }

    const eventIdNum = parseInt(String(eventId), 10)
    const judgeIdNum = parseInt(String(judgeId), 10)
    
    if (isNaN(eventIdNum) || isNaN(judgeIdNum)) {
      return NextResponse.json(
        { error: "Invalid event ID or judge ID" },
        { status: 400 }
      )
    }

    try {
      // Check if judge exists and belongs to this event
      const existingJudge = await db
        .select()
        .from(schema.judges)
        .where(
          and(
            eq(schema.judges.id, judgeIdNum),
            eq(schema.judges.eventId, eventIdNum)
          )
        )
        .limit(1)

      if (existingJudge.length === 0) {
        return NextResponse.json(
          { error: "Judge not found" },
          { status: 404 }
        )
      }

      // Check if judge has any scores
      const scores = await db
        .select()
        .from(schema.scores)
        .where(eq(schema.scores.judgeId, judgeIdNum))
        .limit(1)

      if (scores.length > 0) {
        return NextResponse.json(
          { error: "Cannot delete judge with existing scores. You can rename the judge instead." },
          { status: 400 }
        )
      }

      // Delete judge
      await db
        .delete(schema.judges)
        .where(eq(schema.judges.id, judgeIdNum))

      return NextResponse.json({ success: true })
    } catch (dbError: any) {
      throw dbError
    }
  } catch (error: any) {
    console.error("Error deleting judge:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

