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

// POST - Add a new category to an event
export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, categoryName, required = true, hasNoneOption = true } = body

    if (!eventId || !categoryName || !categoryName.trim()) {
      return NextResponse.json(
        { error: "Event ID and category name are required" },
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

      // Get max display order for this event
      const maxOrder = await db
        .select({ max: sql<number>`MAX(${schema.eventCategories.displayOrder})` })
        .from(schema.eventCategories)
        .where(eq(schema.eventCategories.eventId, eventIdNum))

      const nextOrder = (maxOrder[0]?.max ?? -1) + 1

      // Check if category with same name already exists for this event
      const existingCategory = await db
        .select()
        .from(schema.eventCategories)
        .where(
          and(
            eq(schema.eventCategories.eventId, eventIdNum),
            eq(schema.eventCategories.categoryName, categoryName.trim())
          )
        )
        .limit(1)

      if (existingCategory.length > 0) {
        return NextResponse.json(
          { error: "A category with this name already exists for this event" },
          { status: 400 }
        )
      }

      // Create new category
      const newCategory = await db
        .insert(schema.eventCategories)
        .values({
          eventId: eventIdNum,
          categoryName: categoryName.trim(),
          displayOrder: nextOrder,
          required: required !== false,
          hasNoneOption: hasNoneOption !== false,
        })
        .returning()

      return NextResponse.json(newCategory[0])
    } catch (dbError: any) {
      if (dbError?.code === "23505") {
        return NextResponse.json(
          { error: "A category with this name already exists for this event" },
          { status: 400 }
        )
      }
      throw dbError
    }
  } catch (error: any) {
    console.error("Error adding category:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update a category
export async function PATCH(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, categoryId, categoryName, required, hasNoneOption } = body

    if (!eventId || !categoryId) {
      return NextResponse.json(
        { error: "Event ID and category ID are required" },
        { status: 400 }
      )
    }

    const eventIdNum = parseInt(String(eventId), 10)
    const categoryIdNum = parseInt(String(categoryId), 10)
    
    if (isNaN(eventIdNum) || isNaN(categoryIdNum)) {
      return NextResponse.json(
        { error: "Invalid event ID or category ID" },
        { status: 400 }
      )
    }

    try {
      // Check if category exists and belongs to this event
      const existingCategory = await db
        .select()
        .from(schema.eventCategories)
        .where(
          and(
            eq(schema.eventCategories.id, categoryIdNum),
            eq(schema.eventCategories.eventId, eventIdNum)
          )
        )
        .limit(1)

      if (existingCategory.length === 0) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        )
      }

      // Build update object
      const updateData: any = {}
      if (categoryName !== undefined && categoryName.trim()) {
        // Check if another category with this name already exists
        const duplicateCategory = await db
          .select()
          .from(schema.eventCategories)
          .where(
            and(
              eq(schema.eventCategories.eventId, eventIdNum),
              eq(schema.eventCategories.categoryName, categoryName.trim()),
              sql`${schema.eventCategories.id} != ${categoryIdNum}`
            )
          )
          .limit(1)

        if (duplicateCategory.length > 0) {
          return NextResponse.json(
            { error: "A category with this name already exists for this event" },
            { status: 400 }
          )
        }
        updateData.categoryName = categoryName.trim()
      }
      if (required !== undefined) {
        updateData.required = required !== false
      }
      if (hasNoneOption !== undefined) {
        updateData.hasNoneOption = hasNoneOption !== false
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(existingCategory[0])
      }

      // Update category
      const updated = await db
        .update(schema.eventCategories)
        .set(updateData)
        .where(eq(schema.eventCategories.id, categoryIdNum))
        .returning()

      return NextResponse.json(updated[0])
    } catch (dbError: any) {
      if (dbError?.code === "23505") {
        return NextResponse.json(
          { error: "A category with this name already exists for this event" },
          { status: 400 }
        )
      }
      throw dbError
    }
  } catch (error: any) {
    console.error("Error updating category:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Remove a category from an event
export async function DELETE(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { eventId, categoryId } = body

    if (!eventId || !categoryId) {
      return NextResponse.json(
        { error: "Event ID and category ID are required" },
        { status: 400 }
      )
    }

    const eventIdNum = parseInt(String(eventId), 10)
    const categoryIdNum = parseInt(String(categoryId), 10)
    
    if (isNaN(eventIdNum) || isNaN(categoryIdNum)) {
      return NextResponse.json(
        { error: "Invalid event ID or category ID" },
        { status: 400 }
      )
    }

    try {
      // Check if category exists and belongs to this event
      const existingCategory = await db
        .select()
        .from(schema.eventCategories)
        .where(
          and(
            eq(schema.eventCategories.id, categoryIdNum),
            eq(schema.eventCategories.eventId, eventIdNum)
          )
        )
        .limit(1)

      if (existingCategory.length === 0) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 404 }
        )
      }

      // Check if category has any scores
      const scoreItems = await db
        .select()
        .from(schema.scoreItems)
        .where(eq(schema.scoreItems.eventCategoryId, categoryIdNum))
        .limit(1)

      if (scoreItems.length > 0) {
        return NextResponse.json(
          { error: "Cannot delete category with existing scores. You can rename it instead." },
          { status: 400 }
        )
      }

      // Delete category (cascade will handle score_items)
      await db
        .delete(schema.eventCategories)
        .where(eq(schema.eventCategories.id, categoryIdNum))

      return NextResponse.json({ success: true })
    } catch (dbError: any) {
      throw dbError
    }
  } catch (error: any) {
    console.error("Error deleting category:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

