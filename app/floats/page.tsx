import { redirect } from "next/navigation"
import { getJudgeId } from "@/lib/cookies"
import { cookies } from "next/headers"
import { db, schema } from "@/lib/db"
import { eq, asc, and, inArray } from "drizzle-orm"
import { JudgeProgress } from "@/components/JudgeProgress"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { loadLabelsForEventId } from "@/lib/labels"

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

export default async function FloatsPage() {
  const judgeId = await getJudgeId()
  
  if (!judgeId) {
    redirect("/judge")
  }

  // Get judge info (including eventId)
  const judge = await db
    .select()
    .from(schema.judges)
    .where(eq(schema.judges.id, judgeId))
    .limit(1)

  if (judge.length === 0) {
    redirect("/judge")
  }

  const judgeName = judge[0].name
  const judgeEventId = judge[0].eventId
  const labels = await loadLabelsForEventId(judgeEventId)

  // Get city ID from cookie
  const cookieStore = await cookies()
  const cityCookie = cookieStore.get("judge-city-id")
  const cityId = cityCookie?.value ? parseInt(cityCookie.value, 10) : null

  console.log(`[FloatsPage] Judge ${judgeId} (${judgeName}) has eventId: ${judgeEventId}, cityId: ${cityId}`)

  // Get approved floats - filter by judge's eventId and cityId if available
  let allFloats
  if (judgeEventId) {
    // Filter by judge's event and city
    try {
      const conditions: any[] = [
        eq(schema.floats.approved, true),
        eq(schema.floats.eventId, judgeEventId)
      ]

      // Filter by city through events
      if (cityId && cityId !== 0) {
        try {
          // Verify event belongs to city
          const event = await db
            .select({ cityId: schema.events.cityId })
            .from(schema.events)
            .where(eq(schema.events.id, judgeEventId))
            .limit(1)
          
          if (event.length > 0 && event[0].cityId !== cityId) {
            // Event doesn't belong to judge's city - deny access
            redirect("/judge/login")
          }
        } catch (error: any) {
          // If city_id column doesn't exist, ignore filter (backward compatibility)
          if (error?.code !== "42703" && !error?.message?.includes("does not exist")) {
            throw error
          }
        }
      }

      const floatsRaw = await db
        .select()
        .from(schema.floats)
        .where(and(...conditions))
      
      // Sort floats: non-null floatNumbers first (ascending), then nulls
      allFloats = floatsRaw.sort((a: typeof schema.floats.$inferSelect, b: typeof schema.floats.$inferSelect) => {
        if (a.floatNumber !== null && b.floatNumber !== null) {
          return a.floatNumber - b.floatNumber
        }
        if (a.floatNumber !== null && b.floatNumber === null) {
          return -1
        }
        if (a.floatNumber === null && b.floatNumber !== null) {
          return 1
        }
        return a.id - b.id
      })
      
      console.log(`[FloatsPage] Found ${allFloats.length} approved floats for event ${judgeEventId}`)
      if (allFloats.length > 0) {
        console.log(`[FloatsPage] Float order: ${allFloats.slice(0, 5).map((f: typeof schema.floats.$inferSelect) => `#${f.floatNumber ?? 'null'}`).join(', ')}`)
      }
    } catch (error: any) {
      // If eventId column doesn't exist yet, fall back to all approved floats
      if (error?.code === "42703" || (error?.message?.includes("column") && error?.message?.includes("does not exist"))) {
        console.log("[FloatsPage] eventId column doesn't exist, showing all approved floats")
        const floatsRaw = await db
          .select()
          .from(schema.floats)
          .where(eq(schema.floats.approved, true))
        
        allFloats = floatsRaw.sort((a: typeof schema.floats.$inferSelect, b: typeof schema.floats.$inferSelect) => {
          if (a.floatNumber !== null && b.floatNumber !== null) {
            return a.floatNumber - b.floatNumber
          }
          if (a.floatNumber !== null && b.floatNumber === null) {
            return -1
          }
          if (a.floatNumber === null && b.floatNumber !== null) {
            return 1
          }
          return a.id - b.id
        })
      } else {
        throw error
      }
    }
  } else {
    // No eventId on judge - show all approved floats (backward compatibility)
    console.log("[FloatsPage] Judge has no eventId, showing all approved floats")
    const floatsRaw = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.approved, true))
    
    allFloats = floatsRaw.sort((a: typeof schema.floats.$inferSelect, b: typeof schema.floats.$inferSelect) => {
      if (a.floatNumber !== null && b.floatNumber !== null) {
        return a.floatNumber - b.floatNumber
      }
      if (a.floatNumber !== null && b.floatNumber === null) {
        return -1
      }
      if (a.floatNumber === null && b.floatNumber !== null) {
        return 1
      }
      return a.id - b.id
    })
  }
  // totalFloats should be the maximum float number, not the count
  // This ensures buttons are shown for all float numbers, even if some are missing
  const totalFloats = allFloats.length > 0 
    ? Math.max(...allFloats.map((f: typeof schema.floats.$inferSelect) => f.floatNumber).filter((n: number | null): n is number => n !== null))
    : 0

  // Get scored float IDs
  const scores = await db
    .select()
    .from(schema.scores)
    .where(eq(schema.scores.judgeId, judgeId))
  type ScoreType = typeof schema.scores.$inferSelect
  const scoresMap = new Map<number, ScoreType>(scores.map((s: ScoreType) => [s.floatId, s]))

  // IMPORTANT: Use the same status calculation logic as the API
  // This ensures cards and QuickJumpBar show the same colors
  // Note: This is legacy fallback logic. The API uses score_items for accurate status.
  const getScoreStatus = (score: typeof scores[0] | undefined): 'not_started' | 'incomplete' | 'complete' | 'no_show' => {
    if (!score) {
      return 'not_started'
    }
    
    // Use Number() conversion to match API logic exactly
    const lighting = score.lighting != null ? Number(score.lighting) : null
    const theme = score.theme != null ? Number(score.theme) : null
    const traditions = score.traditions != null ? Number(score.traditions) : null
    const spirit = score.spirit != null ? Number(score.spirit) : null
    const music = score.music != null ? Number(score.music) : null
    
    // Check if all values are null (not started)
    const allNull = lighting === null && theme === null && traditions === null && spirit === null && music === null
    
    if (allNull) {
      return 'not_started'
    }
    
    // Check if all values are 0 (no-show - float didn't appear)
    const allZero = lighting === 0 && theme === 0 && traditions === 0 && spirit === 0 && music === 0
    
    if (allZero) {
      return 'no_show'
    }
    
    // Check if all values are filled (non-null)
    const allFilled = lighting !== null && theme !== null && traditions !== null && spirit !== null && music !== null
    
    if (allFilled) {
      return 'complete'
    }
    
    return 'incomplete'
  }

  // Prepare floats with scores and scoreStatus
  const floatsWithScores = allFloats.map((float: typeof schema.floats.$inferSelect) => {
    const score = scoresMap.get(float.id)
    const scoreStatus = getScoreStatus(score)
    
    return {
      ...float,
      score: score || null,
      scored: scoreStatus === 'complete' || scoreStatus === 'no_show', // Count as "scored" if complete or no-show
      scoreStatus,
    }
  })

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold" style={{ color: "#14532D" }}>
              {judgeName}
            </h1>
            <Link href="/review">
              <Button variant="outline">Review Scores</Button>
            </Link>
          </div>
          {/* Progress will be rendered by JudgeProgress client component */}
        </div>
      </div>
      <JudgeProgress
        judgeName={judgeName}
        totalFloats={totalFloats}
        initialFloats={floatsWithScores}
        labels={labels}
      />
    </div>
  )
}

