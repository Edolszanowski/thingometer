import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, or, ilike, and, desc } from "drizzle-orm"

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

// GET - Search participants (queries from floats table, not participants table)
export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q") || ""
    const limit = parseInt(searchParams.get("limit") || "20", 10)

    try {
      // Query from floats table - get distinct participants based on organization and email
      // This gives us a lookup of previous participants from actual parade entries
      if (!query.trim()) {
        // Return recent distinct participants from floats
        const allFloats = await db
          .select({
            organization: schema.floats.organization,
            firstName: schema.floats.firstName,
            lastName: schema.floats.lastName,
            title: schema.floats.title,
            phone: schema.floats.phone,
            email: schema.floats.email,
            entryName: schema.floats.entryName,
            typeOfEntry: schema.floats.typeOfEntry,
            submittedAt: schema.floats.submittedAt,
          })
          .from(schema.floats)
          .orderBy(desc(schema.floats.submittedAt))
          .limit(limit * 5) // Get more to account for duplicates

        // Deduplicate by organization + email, keeping most recent
        const participantMap = new Map<string, typeof allFloats[0] & { id: number }>()
        let idCounter = 1
        for (const float of allFloats) {
          const key = `${float.organization}|${float.email || ''}`
          if (!participantMap.has(key)) {
            participantMap.set(key, { ...float, id: idCounter++ })
          }
        }

        const participants = Array.from(participantMap.values()).slice(0, limit)
        return NextResponse.json(participants)
      }

      // Search by organization, firstName, lastName, email, or entryName in floats table
      const searchTerm = `%${query.trim()}%`
      const matchingFloats = await db
        .select({
          organization: schema.floats.organization,
          firstName: schema.floats.firstName,
          lastName: schema.floats.lastName,
          title: schema.floats.title,
          phone: schema.floats.phone,
          email: schema.floats.email,
          entryName: schema.floats.entryName,
          typeOfEntry: schema.floats.typeOfEntry,
          submittedAt: schema.floats.submittedAt,
        })
        .from(schema.floats)
        .where(
          or(
            ilike(schema.floats.organization, searchTerm),
            ilike(schema.floats.firstName, searchTerm),
            ilike(schema.floats.lastName, searchTerm),
            ilike(schema.floats.email, searchTerm),
            ilike(schema.floats.entryName, searchTerm)
          )
        )
        .limit(limit * 5) // Get more to account for duplicates

      // Deduplicate by organization + email, keeping most recent
      const participantMap = new Map<string, typeof matchingFloats[0] & { id: number }>()
      let idCounter = 1
      for (const float of matchingFloats) {
        const key = `${float.organization}|${float.email || ''}`
        if (!participantMap.has(key)) {
          participantMap.set(key, { ...float, id: idCounter++ })
        }
      }

      const participants = Array.from(participantMap.values()).slice(0, limit)
      return NextResponse.json(participants)
    } catch (dbError: any) {
      console.error("Error searching participants from floats:", dbError)
      throw dbError
    }
  } catch (error) {
    console.error("Error searching participants:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new float entry from participant data (searches floats table, not participants)
export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { participantId, eventId, floatNumber, organization, email } = body

    // Support both participantId (for backward compatibility) and direct data
    let participantData: any = null

    if (participantId) {
      // Find participant from floats table by matching organization and email
      // Since we deduplicate in GET, we need to find the most recent float with matching org/email
      if (organization && email) {
        const matchingFloats = await db
          .select()
          .from(schema.floats)
          .where(
            and(
              eq(schema.floats.organization, organization),
              eq(schema.floats.email, email)
            )
          )
          .orderBy(desc(schema.floats.submittedAt))
          .limit(1)

        if (matchingFloats.length > 0) {
          participantData = matchingFloats[0]
        }
      } else if (organization) {
        const matchingFloats = await db
          .select()
          .from(schema.floats)
          .where(eq(schema.floats.organization, organization))
          .orderBy(desc(schema.floats.submittedAt))
          .limit(1)

        if (matchingFloats.length > 0) {
          participantData = matchingFloats[0]
        }
      }

      if (!participantData) {
        return NextResponse.json({ error: "Participant not found in floats table" }, { status: 404 })
      }
    } else if (organization) {
      // Direct data provided
      participantData = {
        organization,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        title: body.title || null,
        phone: body.phone || null,
        email: body.email || null,
        entryName: body.entryName || null,
        typeOfEntry: body.typeOfEntry || null,
      }
    } else {
      return NextResponse.json(
        { error: "Missing required field: participantId or organization" },
        { status: 400 }
      )
    }

    // Create new float entry from participant data
    const entryData: any = {
      organization: participantData.organization,
      firstName: participantData.firstName || null,
      lastName: participantData.lastName || null,
      title: participantData.title || null,
      phone: participantData.phone || null,
      email: participantData.email || null,
      entryName: participantData.entryName || null,
      typeOfEntry: participantData.typeOfEntry || null,
      approved: false, // Coordinator will need to approve
      floatNumber: floatNumber || null,
    }

    // Add eventId if provided
    if (eventId !== undefined && eventId !== null) {
      const eventIdNum = typeof eventId === 'number' ? eventId : parseInt(String(eventId), 10)
      if (!isNaN(eventIdNum)) {
        entryData.eventId = eventIdNum
      }
    }

    const newEntry = await db
      .insert(schema.floats)
      .values(entryData)
      .returning()

    return NextResponse.json({
      success: true,
      entry: newEntry[0],
      message: "Entry created from participant successfully",
    })
  } catch (error: any) {
    console.error("Error creating entry from participant:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

