import { redirect } from "next/navigation"
import { getJudgeId } from "@/lib/cookies"
import { cookies } from "next/headers"
import { JudgeProgress } from "@/components/JudgeProgress"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { createClient } from "@supabase/supabase-js"
import { getDefaultLabels, labelsFromRules, type EventTypeRules } from "@/lib/labels"
import { Map as MapIcon } from "lucide-react"

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

type JudgeRow = {
  id: number
  name: string
  eventId: number | null
}

type FloatRow = {
  id: number
  eventId: number | null
  floatNumber: number | null
  organization: string
  entryName: string | null
  firstName: string | null
  lastName: string | null
  title: string | null
  phone: string | null
  email: string | null
  comments: string | null
  entryLength: string | null
  floatDescription: string | null
  typeOfEntry: string | null
  hasMusic: boolean
  approved: boolean
  submittedAt: string | null
  createdAt: string | null
  metadata: Record<string, unknown>
}

type ScoreRow = {
  id: number
  eventId: number | null
  judgeId: number
  floatId: number
  lighting: number | null
  theme: number | null
  traditions: number | null
  spirit: number | null
  music: number | null
  total: number
  createdAt: string | null
  updatedAt: string | null
}

export default async function FloatsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const judgeId = await getJudgeId()
  
  if (!judgeId) {
    redirect("/judge")
  }

  // Get judge info (including eventId)
  const { data: judgeRow, error: judgeError } = await supabase
    .from("judges")
    .select("id,name,event_id")
    .eq("id", judgeId)
    .single()

  if (judgeError || !judgeRow) {
    redirect("/judge")
  }

  const judge: JudgeRow = {
    id: judgeRow.id,
    name: judgeRow.name,
    eventId: judgeRow.event_id ?? null,
  }

  const judgeName = judge.name
  const judgeEventId = judge.eventId

  // Compute labels and check event type
  let labels = getDefaultLabels()
  let isLemonadeDay = false
  if (judgeEventId) {
    try {
      const { data: eventForLabels, error: eventForLabelsError } = await supabase
        .from("events")
        .select("event_type_id,type")
        .eq("id", judgeEventId)
        .single()

      if (!eventForLabelsError && eventForLabels) {
        // Check if this is a Lemonade Day event
        isLemonadeDay = eventForLabels.type === "lemonade_day"
        
        // If Lemonade Day, use stand terminology
        if (isLemonadeDay) {
          labels = {
            entry: "Stand",
            entryPlural: "Stands",
            entryNumber: "Stand #",
            entryDescription: "Stand Description",
          }
        } else if (eventForLabels.event_type_id) {
          // Otherwise, try to get labels from event_types
          const { data: eventType, error: eventTypeError } = await supabase
            .from("event_types")
            .select("rules")
            .eq("id", eventForLabels.event_type_id)
            .single()

          if (!eventTypeError) {
            labels = labelsFromRules(eventType?.rules as EventTypeRules | null | undefined)
          }
        }
      }
    } catch {
      // Keep default labels on any failure (page should still work).
      labels = getDefaultLabels()
    }
  }

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
      // Filter by city through events
      if (cityId && cityId !== 0) {
        try {
          const { data: event, error: eventError } = await supabase
            .from("events")
            .select("city_id")
            .eq("id", judgeEventId)
            .single()

          if (eventError) {
            throw eventError
          }

          if (event && typeof event.city_id === "number" && event.city_id !== cityId) {
            redirect("/judge/login")
          }
        } catch (error: any) {
          // If city_id column doesn't exist, ignore filter (backward compatibility)
          const msg = String(error?.message || "")
          if (error?.code !== "42703" && !msg.includes("does not exist")) {
            throw error
          }
        }
      }

      const { data: floatsData, error: floatsError } = await supabase
        .from("floats")
        .select(
          "id,event_id,float_number,organization,entry_name,first_name,last_name,title,phone,email,comments,entry_length,float_description,type_of_entry,has_music,approved,submitted_at,created_at,metadata"
        )
        .eq("approved", true)
        .eq("event_id", judgeEventId)

      if (floatsError) {
        throw floatsError
      }
      
      // Sort floats: non-null floatNumbers first (ascending), then nulls
      const floatsRaw: FloatRow[] = (floatsData || []).map((f: any) => ({
        id: f.id,
        eventId: f.event_id ?? null,
        floatNumber: f.float_number ?? null,
        organization: f.organization,
        entryName: f.entry_name ?? null,
        firstName: f.first_name ?? null,
        lastName: f.last_name ?? null,
        title: f.title ?? null,
        phone: f.phone ?? null,
        email: f.email ?? null,
        comments: f.comments ?? null,
        entryLength: f.entry_length ?? null,
        floatDescription: f.float_description ?? null,
        typeOfEntry: f.type_of_entry ?? null,
        hasMusic: Boolean(f.has_music),
        approved: Boolean(f.approved),
        submittedAt: f.submitted_at ?? null,
        createdAt: f.created_at ?? null,
        metadata: (f.metadata ?? {}) as Record<string, unknown>,
      }))

      allFloats = floatsRaw.sort((a: FloatRow, b: FloatRow) => {
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
        console.log(`[FloatsPage] Float order: ${allFloats.slice(0, 5).map((f: FloatRow) => `#${f.floatNumber ?? 'null'}`).join(', ')}`)
      }
    } catch (error: any) {
      // If eventId column doesn't exist yet, fall back to all approved floats
      const msg = String(error?.message || "")
      if (error?.code === "42703" || (msg.includes("column") && msg.includes("does not exist"))) {
        console.log("[FloatsPage] eventId column doesn't exist, showing all approved floats")
        const { data: floatsData, error: floatsError } = await supabase
          .from("floats")
          .select(
            "id,event_id,float_number,organization,entry_name,first_name,last_name,title,phone,email,comments,entry_length,float_description,type_of_entry,has_music,approved,submitted_at,created_at,metadata"
          )
          .eq("approved", true)

        if (floatsError) {
          throw floatsError
        }
        
        const floatsRaw: FloatRow[] = (floatsData || []).map((f: any) => ({
          id: f.id,
          eventId: f.event_id ?? null,
          floatNumber: f.float_number ?? null,
          organization: f.organization,
          entryName: f.entry_name ?? null,
          firstName: f.first_name ?? null,
          lastName: f.last_name ?? null,
          title: f.title ?? null,
          phone: f.phone ?? null,
          email: f.email ?? null,
          comments: f.comments ?? null,
          entryLength: f.entry_length ?? null,
          floatDescription: f.float_description ?? null,
          typeOfEntry: f.type_of_entry ?? null,
          hasMusic: Boolean(f.has_music),
          approved: Boolean(f.approved),
          submittedAt: f.submitted_at ?? null,
          createdAt: f.created_at ?? null,
          metadata: (f.metadata ?? {}) as Record<string, unknown>,
        }))

        allFloats = floatsRaw.sort((a: FloatRow, b: FloatRow) => {
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
    const { data: floatsData, error: floatsError } = await supabase
      .from("floats")
      .select(
        "id,event_id,float_number,organization,entry_name,first_name,last_name,title,phone,email,comments,entry_length,float_description,type_of_entry,has_music,approved,submitted_at,created_at,metadata"
      )
      .eq("approved", true)

    if (floatsError) {
      throw floatsError
    }
    
    const floatsRaw: FloatRow[] = (floatsData || []).map((f: any) => ({
      id: f.id,
      eventId: f.event_id ?? null,
      floatNumber: f.float_number ?? null,
      organization: f.organization,
      entryName: f.entry_name ?? null,
      firstName: f.first_name ?? null,
      lastName: f.last_name ?? null,
      title: f.title ?? null,
      phone: f.phone ?? null,
      email: f.email ?? null,
      comments: f.comments ?? null,
      entryLength: f.entry_length ?? null,
      floatDescription: f.float_description ?? null,
      typeOfEntry: f.type_of_entry ?? null,
      hasMusic: Boolean(f.has_music),
      approved: Boolean(f.approved),
      submittedAt: f.submitted_at ?? null,
      createdAt: f.created_at ?? null,
      metadata: (f.metadata ?? {}) as Record<string, unknown>,
    }))

    allFloats = floatsRaw.sort((a: FloatRow, b: FloatRow) => {
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
    ? Math.max(...allFloats.map((f: FloatRow) => f.floatNumber).filter((n: number | null): n is number => n !== null))
    : 0

  // Get scored float IDs
  const { data: scoresData, error: scoresError } = await supabase
    .from("scores")
    .select("id,event_id,judge_id,float_id,lighting,theme,traditions,spirit,music,total,created_at,updated_at")
    .eq("judge_id", judgeId)

  if (scoresError) {
    throw scoresError
  }

  const scores: ScoreRow[] = (scoresData || []).map((s: any) => ({
    id: s.id,
    eventId: s.event_id ?? null,
    judgeId: s.judge_id,
    floatId: s.float_id,
    lighting: s.lighting ?? null,
    theme: s.theme ?? null,
    traditions: s.traditions ?? null,
    spirit: s.spirit ?? null,
    music: s.music ?? null,
    total: s.total ?? 0,
    createdAt: s.created_at ?? null,
    updatedAt: s.updated_at ?? null,
  }))

  const scoresMap = new Map<number, ScoreRow>(scores.map((s: ScoreRow) => [s.floatId, s]))

  // IMPORTANT: Use the same status calculation logic as the API
  // This ensures cards and QuickJumpBar show the same colors
  // Note: This is legacy fallback logic. The API uses score_items for accurate status.
  const getScoreStatus = (score: ScoreRow | undefined): 'not_started' | 'incomplete' | 'complete' | 'no_show' => {
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
  const floatsWithScores = allFloats.map((float: FloatRow) => {
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
            <div className="flex gap-2">
              {isLemonadeDay && (
                <Link href="/judge/map">
                  <Button variant="outline" size="sm">
                    <MapIcon className="h-4 w-4 mr-1" />
                    View Map
                  </Button>
                </Link>
              )}
              <Link href="/review">
                <Button variant="outline">Review Scores</Button>
              </Link>
            </div>
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

