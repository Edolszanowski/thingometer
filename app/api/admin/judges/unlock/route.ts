import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

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

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { judgeId } = body

    if (!judgeId) {
      return NextResponse.json(
        { error: "Missing required field: judgeId" },
        { status: 400 }
      )
    }

    // Update judge to unlock (set submitted to false)
    const updated = await db
      .update(schema.judges)
      .set({ submitted: false })
      .where(eq(schema.judges.id, judgeId))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json({ error: "Judge not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, judge: updated[0] })
  } catch (error) {
    console.error("Error unlocking judge scores:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

