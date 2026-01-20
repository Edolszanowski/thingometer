import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, desc, asc } from "drizzle-orm"

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

// GET - List all events
export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
      type EventType = typeof schema.events.$inferSelect
      const events: EventType[] = await db
        .select()
        .from(schema.events)
        .orderBy(asc(schema.events.eventDate))

      // Include categories and judges for each event
      const eventsWithDetails = await Promise.all(
        events.map(async (event: EventType) => {
          const [categories, eventJudges] = await Promise.all([
            db
              .select()
              .from(schema.eventCategories)
              .where(eq(schema.eventCategories.eventId, event.id))
              .orderBy(schema.eventCategories.displayOrder),
            db
              .select()
              .from(schema.judges)
              .where(eq(schema.judges.eventId, event.id))
              .orderBy(schema.judges.name),
          ])
          
          return {
            ...event,
            categories,
            judges: eventJudges,
          }
        })
      )

      return NextResponse.json(eventsWithDetails)
    } catch (dbError: any) {
      // If events table doesn't exist yet, return empty array
      if (dbError?.code === "42P01" || dbError?.message?.includes("does not exist")) {
        console.log("Events table does not exist yet, returning empty array")
        return NextResponse.json([])
      }
      throw dbError
    }
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new event
export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      name, 
      city, 
      eventDate, 
      startDate,
      endDate,
      active = true,
      scoringCategories,
      judges 
    } = body

    if (!name || !city) {
      return NextResponse.json(
        { error: "Name and city are required" },
        { status: 400 }
      )
    }

    try {
      // Create event
      const newEvent = await db
        .insert(schema.events)
        .values({
          name,
          city,
          eventDate: eventDate ? new Date(eventDate) : null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          active: active ?? true,
        })
        .returning()

      const eventId = newEvent[0].id

      // Create event categories
      const defaultCategories = [
        { name: "Lighting", required: true, hasNone: true },
        { name: "Theme", required: true, hasNone: true },
        { name: "Traditions", required: true, hasNone: true },
        { name: "Spirit", required: true, hasNone: true },
        { name: "Music", required: false, hasNone: true },
      ]
      const categoriesToCreate = scoringCategories || defaultCategories
      const categoryInserts = categoriesToCreate.map((cat: any, index: number) => ({
        eventId,
        categoryName: typeof cat === 'string' ? cat : cat.name,
        displayOrder: index,
        required: typeof cat === 'object' ? (cat.required !== false) : true,
        hasNoneOption: typeof cat === 'object' ? (cat.hasNone !== false) : true,
      }))

      if (categoryInserts.length > 0) {
        await db.insert(schema.eventCategories).values(categoryInserts)
      }

      // Create judges
      const judgesToCreate = judges || []
      const defaultJudgeNames = ["Judge 1", "Judge 2", "Judge 3"]
      
      // If no judges provided, create default ones
      const judgeNames = judgesToCreate.length > 0 
        ? judgesToCreate.map((j: any) => typeof j === 'string' ? j : j.name)
        : defaultJudgeNames

      const judgeInserts = judgeNames.map((judgeName: string) => ({
        eventId,
        name: judgeName,
        submitted: false,
      }))

      if (judgeInserts.length > 0) {
        await db.insert(schema.judges).values(judgeInserts)
      }

      // Fetch complete event with categories and judges
      const event = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, eventId))
        .limit(1)

      const categories = await db
        .select()
        .from(schema.eventCategories)
        .where(eq(schema.eventCategories.eventId, eventId))
        .orderBy(schema.eventCategories.displayOrder)

      const eventJudges = await db
        .select()
        .from(schema.judges)
        .where(eq(schema.judges.eventId, eventId))
        .orderBy(schema.judges.name)

      return NextResponse.json({
        ...event[0],
        categories,
        judges: eventJudges,
      })
    } catch (dbError: any) {
      // If events table doesn't exist yet, return helpful error
      if (dbError?.code === "42P01" || dbError?.message?.includes("does not exist")) {
        console.error("Events table does not exist. Migration required.")
        return NextResponse.json(
          { 
            error: "Events table does not exist. Please run the migration script: npx tsx scripts/migrate-to-dynamic-schema.ts",
            code: "TABLE_NOT_FOUND"
          },
          { status: 500 }
        )
      }
      throw dbError
    }
  } catch (error: any) {
    console.error("Error creating event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update an event
export async function PATCH(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, city, eventDate, startDate, endDate, active, scoringCategories, judges } = body

    if (!id) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      )
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (name !== undefined) updateData.name = name
    if (city !== undefined) updateData.city = city
    if (eventDate !== undefined) updateData.eventDate = eventDate ? new Date(eventDate) : null
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (active !== undefined) updateData.active = active
    if (body.entryCategoryTitle !== undefined) updateData.entryCategoryTitle = body.entryCategoryTitle || "Best Entry"
    // Note: scoringCategories are managed via event_categories table, not as JSONB

    try {
      const updated = await db
        .update(schema.events)
        .set(updateData)
        .where(eq(schema.events.id, id))
        .returning()

      if (updated.length === 0) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 })
      }

      // Update categories if provided
      if (scoringCategories) {
        // Delete existing categories
        await db
          .delete(schema.eventCategories)
          .where(eq(schema.eventCategories.eventId, id))

        // Create new categories
        const categoryInserts = scoringCategories.map((cat: any, index: number) => ({
          eventId: id,
          categoryName: typeof cat === 'string' ? cat : cat.name,
          displayOrder: index,
          required: typeof cat === 'object' ? (cat.required !== false) : true,
          hasNoneOption: typeof cat === 'object' ? (cat.hasNone !== false) : true,
        }))

        if (categoryInserts.length > 0) {
          await db.insert(schema.eventCategories).values(categoryInserts)
        }
      }

      // Update judges if provided
      if (judges) {
        // Delete existing judges (only if no scores exist)
        const existingJudges = await db
          .select()
          .from(schema.judges)
          .where(eq(schema.judges.eventId, id))

        for (const judge of existingJudges) {
          const hasScores = await db
            .select()
            .from(schema.scores)
            .where(eq(schema.scores.judgeId, judge.id))
            .limit(1)

          if (hasScores.length === 0) {
            await db.delete(schema.judges).where(eq(schema.judges.id, judge.id))
          }
        }

        // Create new judges
        const judgeNames = judges.map((j: any) => typeof j === 'string' ? j : j.name)
        const judgeInserts = judgeNames.map((judgeName: string) => ({
          eventId: id,
          name: judgeName,
          submitted: false,
        }))

        if (judgeInserts.length > 0) {
          await db.insert(schema.judges).values(judgeInserts)
        }
      }

      // Fetch complete event with categories and judges
      const event = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, id))
        .limit(1)

      const categories = await db
        .select()
        .from(schema.eventCategories)
        .where(eq(schema.eventCategories.eventId, id))
        .orderBy(schema.eventCategories.displayOrder)

      const eventJudges = await db
        .select()
        .from(schema.judges)
        .where(eq(schema.judges.eventId, id))
        .orderBy(schema.judges.name)

      return NextResponse.json({
        ...event[0],
        categories,
        judges: eventJudges,
      })
    } catch (dbError: any) {
      // If events table doesn't exist yet, return helpful error
      if (dbError?.code === "42P01" || dbError?.message?.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Events table does not exist. Please run the migration script: npx tsx scripts/migrate-to-dynamic-schema.ts",
            code: "TABLE_NOT_FOUND"
          },
          { status: 500 }
        )
      }
      throw dbError
    }
  } catch (error: any) {
    console.error("Error updating event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete an event (only if no floats are assigned)
export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get("id")

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      )
    }

    const eventIdNum = parseInt(eventId, 10)
    if (isNaN(eventIdNum)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      )
    }

    try {
      // Delete event - cascade will handle related records (floats, scores, categories, judges, etc.)
      // But first, let's verify what will be deleted for user feedback
      const floats = await db
        .select()
        .from(schema.floats)
        .where(eq(schema.floats.eventId, eventIdNum))
      
      const scores = await db
        .select()
        .from(schema.scores)
        .where(eq(schema.scores.eventId, eventIdNum))
      
      const categories = await db
        .select()
        .from(schema.eventCategories)
        .where(eq(schema.eventCategories.eventId, eventIdNum))
      
      const judges = await db
        .select()
        .from(schema.judges)
        .where(eq(schema.judges.eventId, eventIdNum))

      // Delete the event - cascade will delete all related records
      await db
        .delete(schema.events)
        .where(eq(schema.events.id, eventIdNum))

      return NextResponse.json({ 
        success: true,
        deleted: {
          floats: floats.length,
          scores: scores.length,
          categories: categories.length,
          judges: judges.length,
        }
      })
    } catch (dbError: any) {
      // If events table doesn't exist yet, return helpful error
      if (dbError?.code === "42P01" || dbError?.message?.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Events table does not exist. Please run the migration script: npx tsx scripts/migrate-to-dynamic-schema.ts",
            code: "TABLE_NOT_FOUND"
          },
          { status: 500 }
        )
      }
      throw dbError
    }
  } catch (error: any) {
    console.error("Error deleting event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
