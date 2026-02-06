import { redirect } from "next/navigation"
import { getJudgeId } from "@/lib/cookies"
import { db, schema } from "@/lib/db"
import { getEventCategories, getScoreWithItems } from "@/lib/scores"
import { eq, and, asc } from "drizzle-orm"
import { ScoringSliders } from "@/components/ScoringSliders"
import { NavigationButtons } from "@/components/NavigationButtons"
import { QuickJumpBar } from "@/components/QuickJumpBar"
import { OfflineIndicator } from "@/components/OfflineIndicator"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { loadLabelsForEventId } from "@/lib/labels-server"
import { createClient } from "@supabase/supabase-js"
import { MapPin, Navigation } from "lucide-react"

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
  const labels = await loadLabelsForEventId(eventId)
  
  // Debug: log labels to verify event type detection
  console.log('[FloatPage] eventId:', eventId, 'labels.entry:', labels.entry, 'isLemonadeDay:', labels.entry === "Stand")

  if (!eventId) {
    redirect("/floats")
  }

  // Lemonade Day scoring scale support (event-configurable via event_types.rules.scoringScale).
  // Default is parade behavior: 0–20.
  let scoringScale: { min: number; max: number } = { min: 0, max: 20 }
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey)

      const { data: eventRow, error: eventRowError } = await supabase
        .from("events")
        .select("event_type_id")
        .eq("id", eventId)
        .single()

      if (!eventRowError && eventRow?.event_type_id) {
        const { data: eventType, error: eventTypeError } = await supabase
          .from("event_types")
          .select("rules")
          .eq("id", eventRow.event_type_id)
          .single()

        if (!eventTypeError) {
          const raw = (eventType as any)?.rules?.scoringScale
          const min = Number(raw?.min)
          const max = Number(raw?.max)
          if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
            scoringScale = { min, max }
          }
        }
      }
    }
  } catch {
    // Fall back to default scale
    scoringScale = { min: 0, max: 20 }
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
  
  // Calculate sequential display number (1, 2, 3...) to match QuickJumpBar
  const displayNumber = currentIndex >= 0 ? currentIndex + 1 : floatData.floatNumber

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
      {/* Offline indicator - shows connection status and pending syncs */}
      <OfflineIndicator />
      
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "#DC2626" }}>
          {judge[0].name}
        </div>
        <Link href="/api/judge/logout?returnTo=/judge/login">
          <Button variant="ghost" size="sm" className="text-xs">
            Change Judge
          </Button>
        </Link>
      </div>
      <QuickJumpBar
        totalFloats={totalFloats}
        currentFloatId={floatId}
        scoredFloatIds={scoredFloatIds}
        labels={labels}
      />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#DC2626" }}>
            {(labels.entryNumber ?? "Float #")}{displayNumber}
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

        {/* LEMONADE DAY: Show assigned stand location (SAFETY: NO lat/lng displayed) */}
        {floatData.metadata?.assignedLocation && (
          <Card className="mb-6 p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-2 text-blue-900">
                  <MapPin className="h-5 w-5" />
                  Stand Location
                </h3>
                {floatData.metadata.assignedLocation.placeName && (
                  <p className="text-sm mt-2 font-medium text-blue-900">
                    {floatData.metadata.assignedLocation.placeName}
                  </p>
                )}
                <p className="text-sm text-blue-800 mt-1">
                  {floatData.metadata.assignedLocation.address}
                </p>
                {floatData.metadata.assignedLocation.instructions && (
                  <p className="text-sm text-blue-700 mt-2 p-2 bg-blue-100 rounded italic">
                    <strong>Instructions:</strong> {floatData.metadata.assignedLocation.instructions}
                  </p>
                )}
              </div>
              <Button
                onClick={() => {
                  // CRITICAL SAFETY: Use Place ID for directions, NOT coordinates
                  const placeId = (floatData.metadata as any)?.assignedLocation?.placeId
                  if (placeId) {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=place_id:${placeId}`,
                      "_blank"
                    )
                  }
                }}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                <Navigation className="h-4 w-4 mr-1" />
                Navigate
              </Button>
            </div>
          </Card>
        )}

        <ScoringSliders
          floatId={floatId}
          eventId={eventId}
          judgeId={judgeId}
          categories={categories}
          scoringScale={scoringScale}
          initialScore={initialScore}
          isLemonadeDay={labels.entry === "Stand"}
        />

        <NavigationButtons
          previousFloat={previousFloat}
          nextFloat={nextFloat}
          labels={labels}
        />
      </div>
    </div>
  )
}
