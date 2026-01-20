import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

function verifyAdminPassword(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const password = process.env.ADMIN_PASSWORD
  
  if (!password) {
    return false
  }
  
  // Check authorization header
  if (authHeader && authHeader === `Bearer ${password}`) {
    return true
  }
  
  // Check query parameter
  const searchParams = request.nextUrl.searchParams
  const queryPassword = searchParams.get("password")
  if (queryPassword === password) {
    return true
  }
  
  return false
}

// GET - Get signup lock status
export async function GET(request: NextRequest) {
  try {
    // Get signup lock status (public can access this)
    const setting = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "signup_locked"))
      .limit(1)

    const isLocked = setting.length > 0 && setting[0].value === "true"

    return NextResponse.json({ signupLocked: isLocked })
  } catch (error: any) {
    console.error("Error fetching signup lock status:", error)
    // If table doesn't exist, default to unlocked
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      console.log("Settings table does not exist yet, defaulting to unlocked")
      return NextResponse.json({ signupLocked: false })
    }
    // Default to unlocked if error
    return NextResponse.json({ signupLocked: false })
  }
}

// PATCH - Update signup lock status (coordinator only)
export async function PATCH(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { signupLocked } = body

    if (typeof signupLocked !== "boolean") {
      return NextResponse.json(
        { error: "signupLocked must be a boolean" },
        { status: 400 }
      )
    }

    // Check if setting exists
    const existing = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "signup_locked"))
      .limit(1)

    if (existing.length > 0) {
      // Update existing setting
      const updated = await db
        .update(schema.settings)
        .set({
          value: signupLocked ? "true" : "false",
          updatedAt: new Date(),
        })
        .where(eq(schema.settings.key, "signup_locked"))
        .returning()

      return NextResponse.json({ 
        success: true, 
        signupLocked: signupLocked,
        setting: updated[0]
      })
    } else {
      // Create new setting
      const created = await db
        .insert(schema.settings)
        .values({
          key: "signup_locked",
          value: signupLocked ? "true" : "false",
        })
        .returning()

      return NextResponse.json({ 
        success: true, 
        signupLocked: signupLocked,
        setting: created[0]
      })
    }
  } catch (error: any) {
    console.error("Error updating signup lock status:", error)
    
    // If table doesn't exist, return helpful error
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      return NextResponse.json(
        { 
          error: "Settings table does not exist. Please run the migration script: npx tsx scripts/migrate-settings-table.ts",
          code: "TABLE_NOT_FOUND"
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

