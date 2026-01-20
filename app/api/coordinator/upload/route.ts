import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"

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

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { entries } = body

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "Entries array is required and must not be empty" },
        { status: 400 }
      )
    }

    // Validate required fields - only organization is truly required for CSV upload
    // Other fields can be empty/null and will be handled gracefully
    const requiredFields = ['organization'] // Only organization is required
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      
      // Check if field exists in entry object (even if empty)
      for (const field of requiredFields) {
        // Check if field is missing from object entirely (not just empty)
        if (!(field in entry)) {
          return NextResponse.json(
            { error: `Entry ${i + 1} is missing required field: ${field} (field not mapped or missing from CSV)` },
            { status: 400 }
          )
        }
        
        // Check if field has a non-empty value
        const fieldValue = entry[field]
        if (fieldValue === null || fieldValue === undefined || String(fieldValue).trim() === '') {
          return NextResponse.json(
            { error: `Entry ${i + 1} has empty required field: ${field}` },
            { status: 400 }
          )
        }
      }

      // Validate email format only if email is provided and not empty
      if (entry.email && String(entry.email).trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(String(entry.email).trim())) {
          return NextResponse.json(
            { error: `Entry ${i + 1} has invalid email format: ${entry.email}` },
            { status: 400 }
          )
        }
      }
    }

    // Insert entries
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      try {
        const insertData: any = {
          firstName: (entry.firstName && String(entry.firstName).trim()) || null,
          lastName: (entry.lastName && String(entry.lastName).trim()) || null,
          organization: String(entry.organization || '').trim(),
          title: (entry.title && String(entry.title).trim()) || null,
          phone: (entry.phone && String(entry.phone).trim()) || null,
          email: (entry.email && String(entry.email).trim()) || null,
          entryName: (entry.entryName && String(entry.entryName).trim()) || null,
          floatDescription: (entry.floatDescription && String(entry.floatDescription).trim()) || null,
          entryLength: (entry.entryLength && String(entry.entryLength).trim()) || null,
          typeOfEntry: (entry.typeOfEntry && String(entry.typeOfEntry).trim()) || null,
          hasMusic: entry.hasMusic === true || entry.hasMusic === 'true' || entry.hasMusic === 'Yes' || entry.hasMusic === 'yes',
          comments: (entry.comments && String(entry.comments).trim()) || null,
          approved: entry.approved !== false, // Default to true for CSV uploads
          submittedAt: new Date(),
          floatNumber: entry.floatNumber ? parseInt(String(entry.floatNumber), 10) : null,
        }

        // Add eventId if provided (gracefully handle if column doesn't exist yet)
        if (entry.eventId !== undefined && entry.eventId !== null) {
          const eventIdNum = typeof entry.eventId === 'number' ? entry.eventId : parseInt(String(entry.eventId), 10)
          if (!isNaN(eventIdNum)) {
            try {
              insertData.eventId = eventIdNum
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

        await db.insert(schema.floats).values(insertData)
        successCount++
      } catch (error: any) {
        errorCount++
        errors.push(`Entry ${i + 1}: ${error?.message || 'Unknown error'}`)
        console.error(`Error inserting entry ${i + 1}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully uploaded ${successCount} entries${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
    })
  } catch (error: any) {
    console.error("Error uploading entries:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    )
  }
}

