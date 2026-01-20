import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getJudgeId } from "@/lib/cookies"
import { eq } from "drizzle-orm"

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log("[API/Judge/Submit] POST request received")
    
    const judgeId = await getJudgeId()
    console.log("[API/Judge/Submit] Judge ID:", judgeId)
    
    if (!judgeId) {
      console.error("[API/Judge/Submit] Judge not authenticated - no judgeId cookie found")
      return NextResponse.json({ error: "Judge not authenticated" }, { status: 401 })
    }

    // Check if judge exists and get current status
    const existingJudge = await db
      .select()
      .from(schema.judges)
      .where(eq(schema.judges.id, judgeId))
      .limit(1)

    if (existingJudge.length === 0) {
      console.error(`[API/Judge/Submit] Judge ${judgeId} not found`)
      return NextResponse.json({ error: "Judge not found" }, { status: 404 })
    }

    if (existingJudge[0].submitted) {
      console.log(`[API/Judge/Submit] Judge ${judgeId} has already submitted`)
      return NextResponse.json({ 
        error: "Judge has already submitted scores",
        judge: existingJudge[0]
      }, { status: 400 })
    }

    console.log(`[API/Judge/Submit] Updating judge ${judgeId} to submitted=true`)
    
    // Update judge to submitted
    const updated = await db
      .update(schema.judges)
      .set({ submitted: true })
      .where(eq(schema.judges.id, judgeId))
      .returning()

    if (updated.length === 0) {
      console.error(`[API/Judge/Submit] Failed to update judge ${judgeId}`)
      return NextResponse.json({ error: "Failed to update judge" }, { status: 500 })
    }

    console.log(`[API/Judge/Submit] Successfully updated judge ${judgeId}:`, updated[0])
    return NextResponse.json({ success: true, judge: updated[0] })
  } catch (error: any) {
    console.error("[API/Judge/Submit] Error submitting judge scores:", error)
    console.error("[API/Judge/Submit] Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    })
    return NextResponse.json({ 
      error: "Internal server error",
      message: error?.message || "Unknown error"
    }, { status: 500 })
  }
}

