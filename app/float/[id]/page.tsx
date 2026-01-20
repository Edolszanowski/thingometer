import { redirect } from "next/navigation"
import { getJudgeId } from "@/lib/cookies"
import { db, schema } from "@/lib/db"
import { getEventCategories, getScoreWithItems } from "@/lib/scores"
import { eq, and, asc } from "drizzle-orm"
import { ScoringSliders } from "@/components/ScoringSliders"
import { NavigationButtons } from "@/components/NavigationButtons"
import { QuickJumpBar } from "@/components/QuickJumpBar"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

export default async function FloatPage({
  params,
}: {
  params: { id: string }
}) {
  const judgeId = await getJudgeId()
  
  if (!judgeId) {
    redirect("/judge")
  }

  const floatId = parseInt(params.id, 10)
  if (isNaN(floatId)) {
    redirect("/floats")
  }

  // Get float details (only approved floats)
  const float = await db
    .select()
    .from(schema.floats)
    .where(
      and(
        eq(schema.floats.id, floatId),
        eq(schema.floats.approved, true)
      )
    )
    .limit(1)

  if (float.length === 0) {
    redirect("/floats")
  }

  const floatData = float[0]
  const eventId = floatData.eventId

  if (!eventId) {
    redirect("/floats")
  }

  // Get event categories
  const categories = await getEventCategories(eventId)
  if (categories.length === 0) {
    // Fallback to default categories if none exist
    console.warn(`[FloatPage] No categories found for event ${eventId}, using defaults`)
  }

  // Get existing score with items
  const scoreWithItems = await getScoreWithItems(judgeId, floatId)
  
  // Convert score items to the format expected by ScoringSliders
  const initialScore = scoreWithItems ? {
    scores: scoreWithItems.items,
  } : null

  // Get judge's eventId to filter floats
  const judgeData = await db
    .select()
    .from(schema.judges)
    .where(eq(schema.judges.id, judgeId))
    .limit(1)
  
  const judgeEventId = judgeData.length > 0 ? judgeData[0].eventId : null

  // Get all approved floats for navigation - filter by judge's eventId if available
  // CRITICAL: Order by floatNumber to match coordinator's order exactly
  const allFloats = judgeEventId
    ? await db
        .select()
        .from(schema.floats)
        .where(
          and(
            eq(schema.floats.approved, true),
            eq(schema.floats.eventId, judgeEventId)
          )
        )
        .orderBy(asc(schema.floats.floatNumber))
    : await db
        .select()
        .from(schema.floats)
        .where(eq(schema.floats.approved, true))
        .orderBy(asc(schema.floats.floatNumber))
  
  // totalFloats should be the maximum float number, not the count
  const totalFloats = allFloats.length > 0 
    ? Math.max(...allFloats.map((f: typeof schema.floats.$inferSelect) => f.floatNumber).filter((n: number | null): n is number => n !== null))
    : 0

  const currentIndex = allFloats.findIndex((f: typeof schema.floats.$inferSelect) => f.id === floatId)
  const previousFloat = currentIndex > 0 ? allFloats[currentIndex - 1] : null
  const nextFloat = currentIndex < allFloats.length - 1 ? allFloats[currentIndex + 1] : null

  // Get scored float IDs for QuickJumpBar
  const allScores = await db
    .select()
    .from(schema.scores)
    .where(eq(schema.scores.judgeId, judgeId))
  const scoredFloatIds = new Set<number>(allScores.map((s: typeof schema.scores.$inferSelect) => s.floatId).filter((id: number | null): id is number => id !== null))

  // Check if judge has submitted
  const judge = await db
    .select()
    .from(schema.judges)
    .where(eq(schema.judges.id, judgeId))
    .limit(1)
  const isSubmitted = judge.length > 0 && judge[0].submitted

  // If submitted, redirect to review page
  if (isSubmitted) {
    redirect("/review")
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "#DC2626" }}>
          {judge[0].name}
        </div>
        <Link href="/judge">
          <Button variant="ghost" size="sm" className="text-xs">
            Change Judge
          </Button>
        </Link>
      </div>
      <QuickJumpBar
        totalFloats={totalFloats}
        currentFloatId={floatId}
        scoredFloatIds={scoredFloatIds}
      />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#DC2626" }}>
            Float #{floatData.floatNumber}
          </h1>
          <p className="text-lg text-muted-foreground">
            {floatData.organization}
          </p>
          {floatData.entryName && (
            <p className="text-sm text-muted-foreground italic mt-1">
              {floatData.entryName}
            </p>
          )}
        </div>

        <ScoringSliders
          floatId={floatId}
          eventId={eventId}
          categories={categories}
          initialScore={initialScore}
        />

        <NavigationButtons
          previousFloat={previousFloat}
          nextFloat={nextFloat}
        />
      </div>
    </div>
  )
}
