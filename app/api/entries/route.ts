import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Check if request is from a coordinator (has admin-auth cookie)
function isCoordinatorRequest(request: NextRequest): boolean {
  const adminAuth = request.cookies.get("admin-auth")
  return !!adminAuth?.value
}

export async function POST(request: NextRequest) {
  try {
    // Check if signups are locked (coordinators can bypass)
    const isCoordinator = isCoordinatorRequest(request)
    
    if (!isCoordinator) {
      const settingsResponse = await fetch(`${request.nextUrl.origin}/api/coordinator/settings`)
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json()
        if (settings.signupLocked === true) {
          return NextResponse.json(
            { error: "Parade sign-ups are currently closed. New entries are not being accepted at this time." },
            { status: 403 }
          )
        }
      }
    }
    
    const body = await request.json()
    const {
      firstName,
      lastName,
      organization,
      title,
      phone,
      email,
      driverFirstName,
      driverLastName,
      driverPhone,
      driverEmail,
      entryName,
      floatDescription,
      entryLength,
      typeOfEntry,
      hasMusic,
      comments,
      eventId: providedEventId,
      autoApprove, // Coordinator can auto-approve for last-minute entries
      metadata,
    } = body

    // Validate required fields
    if (!organization || !organization.trim()) {
      return NextResponse.json(
        { error: "Organization Name is required" },
        { status: 400 }
      )
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      )
    }

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Check if this is a Lemonade Day entry (has guardian/consent metadata)
    const isLemonadeDay = metadata?.guardian && metadata?.consent

    // Validate driver information - only required for parade entries
    if (!isLemonadeDay) {
      if (!driverFirstName || !driverFirstName.trim()) {
        return NextResponse.json(
          { error: "Driver First Name is required" },
          { status: 400 }
        )
      }

      if (!driverLastName || !driverLastName.trim()) {
        return NextResponse.json(
          { error: "Driver Last Name is required" },
          { status: 400 }
        )
      }

      if (!driverPhone || !driverPhone.trim()) {
        return NextResponse.json(
          { error: "Driver Phone Number is required" },
          { status: 400 }
        )
      }

      if (!driverEmail || !driverEmail.trim()) {
        return NextResponse.json(
          { error: "Driver Email is required" },
          { status: 400 }
        )
      }

      if (!emailRegex.test(driverEmail.trim())) {
        return NextResponse.json(
          { error: "Invalid driver email format" },
          { status: 400 }
        )
      }

      if (!typeOfEntry || !typeOfEntry.trim()) {
        return NextResponse.json(
          { error: "Type of Entry is required" },
          { status: 400 }
        )
      }
    }

    if (!floatDescription || !floatDescription.trim()) {
      return NextResponse.json(
        { error: isLemonadeDay ? "Stand description is required" : "Float Description is required" },
        { status: 400 }
      )
    }

    // For Lemonade Day: Capture IP address and user agent for e-signature audit trail
    if (isLemonadeDay && metadata?.consent) {
      const forwarded = request.headers.get("x-forwarded-for")
      const ipAddress = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown"
      const userAgent = request.headers.get("user-agent") || "unknown"
      
      // Add server-side e-signature data to consent
      metadata.consent.ipAddress = ipAddress
      metadata.consent.userAgent = userAgent
      metadata.consent.serverTimestamp = new Date().toISOString()
    }

    // Get eventId - use provided eventId if available, otherwise get active event
    let activeEventId: number | null = null
    
    // If eventId is provided in the request, use it (but validate it's active)
    if (providedEventId !== undefined && providedEventId !== null) {
      const eventIdNum = typeof providedEventId === 'number' ? providedEventId : parseInt(String(providedEventId), 10)
      if (!isNaN(eventIdNum)) {
        try {
          const event = await db
            .select()
            .from(schema.events)
            .where(
              and(
                eq(schema.events.id, eventIdNum),
                eq(schema.events.active, true)
              )
            )
            .limit(1)
          
          if (event.length > 0) {
            activeEventId = eventIdNum
          } else {
            return NextResponse.json(
              { error: "The selected event is not active or does not exist" },
              { status: 400 }
            )
          }
        } catch (error: any) {
          // If events table doesn't exist yet, that's okay - just continue without eventId
          if (error?.code !== "42P01" && !error?.message?.includes("does not exist")) {
            console.error("Error validating event:", error)
            return NextResponse.json(
              { error: "Error validating event" },
              { status: 500 }
            )
          }
        }
      }
    } else {
      // No eventId provided - try to get active event (fallback for backward compatibility)
      try {
        const activeEvents = await db
          .select()
          .from(schema.events)
          .where(eq(schema.events.active, true))
          .limit(1)
        
        if (activeEvents.length > 0) {
          activeEventId = activeEvents[0].id
        }
      } catch (error: any) {
        // If events table doesn't exist yet, that's okay - just continue without eventId
        if (error?.code !== "42P01" && !error?.message?.includes("does not exist")) {
          console.error("Error fetching active event:", error)
        }
      }
    }

    // Determine if this should be auto-approved (coordinator adding last-minute entry)
    const shouldAutoApprove = isCoordinator && autoApprove === true
    
    // Get next float number if auto-approving
    let nextFloatNumber: number | null = null
    if (shouldAutoApprove && activeEventId !== null) {
      try {
        // Get the highest float number for this event
        const existingFloats = await db
          .select({ floatNumber: schema.floats.floatNumber })
          .from(schema.floats)
          .where(eq(schema.floats.eventId, activeEventId))
        
        const maxNumber = existingFloats
          .map((f: { floatNumber: number | null }) => f.floatNumber)
          .filter((n: number | null): n is number => n !== null && n < 900) // Exclude 999 (no-shows)
          .reduce((max: number, n: number) => Math.max(max, n), 0)
        
        nextFloatNumber = maxNumber + 1
      } catch (error) {
        console.error("Error getting next float number:", error)
        nextFloatNumber = 1 // Default to 1 if error
      }
    }

    // Insert new entry
    // For Lemonade Day: use child name and guardian contact info
    // For Parade: use driver information (as per requirements)
    const entryData: any = {
      firstName: isLemonadeDay 
        ? (firstName?.trim() || null) // Child's first name (passed from form)
        : (driverFirstName?.trim() || null), // Driver first name
      lastName: isLemonadeDay
        ? (lastName?.trim() || null) // Child's last name (passed from form)
        : (driverLastName?.trim() || null), // Driver last name
      organization: organization.trim(),
      title: title?.trim() || null,
      phone: isLemonadeDay ? phone.trim() : driverPhone.trim(), // Guardian phone or Driver phone
      email: isLemonadeDay ? email.trim() : driverEmail.trim(), // Guardian email or Driver email
      entryName: entryName?.trim() || null,
      floatDescription: floatDescription.trim(),
      entryLength: entryLength?.trim() || null,
      typeOfEntry: isLemonadeDay ? "Lemonade Stand" : typeOfEntry.trim(),
      hasMusic: hasMusic === true,
      comments: comments?.trim() || null,
      approved: shouldAutoApprove, // Auto-approve if coordinator requested
      submittedAt: new Date(),
      floatNumber: nextFloatNumber, // Assign number if auto-approved
    }

    // Store dynamic/custom fields into floats.metadata (if provided)
    if (metadata && typeof metadata === "object") {
      entryData.metadata = metadata
    }
    
    // Store organization contact info in comments if different from driver (parade entries only)
    if (!isLemonadeDay && driverPhone && driverEmail) {
      if (phone.trim() !== driverPhone.trim() || email.trim() !== driverEmail.trim()) {
        const orgContactInfo = `Organization Contact: ${firstName?.trim() || ''} ${lastName?.trim() || ''} - ${phone.trim()} - ${email.trim()}`
        entryData.comments = entryData.comments 
          ? `${entryData.comments}\n\n${orgContactInfo}`
          : orgContactInfo
      }
    }

    // Add eventId if we found an active event (gracefully handle if column doesn't exist)
    if (activeEventId !== null) {
      try {
        entryData.eventId = activeEventId
      } catch (error: any) {
        // If eventId column doesn't exist yet, skip it
        if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
          console.log("eventId column does not exist yet, skipping eventId assignment")
        } else {
          throw error
        }
      }
    }

    let newEntry
    try {
      newEntry = await db
        .insert(schema.floats)
        .values(entryData)
        .returning()
    } catch (error: any) {
      // Backward compatibility if metadata column hasn't been migrated yet
      const msg = String(error?.message || "")
      if (
        (error?.code === "42703" || msg.includes("does not exist")) &&
        (msg.includes("metadata") || msg.includes("column"))
      ) {
        delete entryData.metadata
        newEntry = await db
          .insert(schema.floats)
          .values(entryData)
          .returning()
      } else {
        throw error
      }
    }

    const message = shouldAutoApprove
      ? `Entry added as Float #${nextFloatNumber} and is ready for judging!`
      : "Entry submitted successfully. It will be reviewed by the coordinator."

    return NextResponse.json({
      success: true,
      entry: newEntry[0],
      message,
      autoApproved: shouldAutoApprove,
      floatNumber: nextFloatNumber,
    })
  } catch (error: any) {
    console.error("Error creating entry:", error)
    
    // Handle unique constraint violations
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "An entry with this information already exists" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      )
    }

    // Find entries by email
    const entries = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.email, email.trim()))

    return NextResponse.json({ entries })
  } catch (error) {
    console.error("Error fetching entries:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

