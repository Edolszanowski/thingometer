import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { generateJudgeToken } from "@/lib/judge-tokens"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check for coordinator auth
    const adminAuth = request.cookies.get("admin-auth")
    if (!adminAuth?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get("eventId")

    // Fetch judges (optionally filtered by event)
    let judges
    if (eventId) {
      judges = await db
        .select()
        .from(schema.judges)
        .where(eq(schema.judges.eventId, parseInt(eventId)))
    } else {
      judges = await db.select().from(schema.judges)
    }

    // Generate tokens for each judge
    const judgesWithTokens = judges.map((judge: typeof schema.judges.$inferSelect) => ({
      id: judge.id,
      name: judge.name,
      eventId: judge.eventId,
      token: generateJudgeToken(judge.id, judge.eventId || undefined),
    }))

    return NextResponse.json(judgesWithTokens)
  } catch (error) {
    console.error("Error generating QR tokens:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

