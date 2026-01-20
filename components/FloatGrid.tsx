"use client"

import { useEffect, useState, useCallback } from "react"
import { usePathname } from "next/navigation"
import { FloatCard } from "./FloatCard"
import type { Float } from "@/lib/drizzle/schema"
import type { Score } from "@/lib/drizzle/schema"
import { getJudgeIdClient } from "@/lib/cookies-client"
import { useRealtimeCallback } from "@/hooks/useRealtimeData"
import type { UiLabels } from "@/lib/labels"

type ScoreStatus = 'not_started' | 'incomplete' | 'complete' | 'no_show' | 'no_organization' | 'not_found'

interface FloatWithScore extends Float {
  score: Score | null
  scored: boolean
  scoreStatus?: ScoreStatus
}

interface FloatGridProps {
  initialFloats?: FloatWithScore[]
  onProgressUpdate?: (completed: number, total: number) => void
  labels?: UiLabels
}

export function FloatGrid({ initialFloats, onProgressUpdate, labels }: FloatGridProps) {
  // CRITICAL: Always start with empty array to force fresh fetch from API
  // Server-side data may be stale - API is the single source of truth
  const [floats, setFloats] = useState<FloatWithScore[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  // const pathname = usePathname() // COMMENTED OUT: Only used by aggressive refresh (see below)

  const fetchFloats = useCallback(async () => {
    const judgeId = getJudgeIdClient()
    if (!judgeId) {
      window.location.href = "/judge"
      return
    }

    try {
      // Add cache-busting timestamp and no-store to ensure fresh data from database
      const timestamp = Date.now()
      const response = await fetch(`/api/floats?judgeId=${judgeId}&_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
      if (response.ok) {
        const data = await response.json()
        
        // Sort floats by floatNumber (same as coordinator view)
        const sortedData = [...data].sort((a: FloatWithScore, b: FloatWithScore) => {
          // Sort by floatNumber (nulls last), then by id for consistency
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
        
        setFloats(sortedData)
        setLastUpdate(new Date())
        
        // Report progress to parent component (count both complete and no_show as finished)
        if (onProgressUpdate) {
          const completed = sortedData.filter((f: FloatWithScore) => 
            f.scoreStatus === 'complete' || f.scoreStatus === 'no_show'
          ).length
          onProgressUpdate(completed, sortedData.length)
        }
      }
    } catch (error) {
      console.error("[FloatGrid] Error fetching floats:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFloats()

    // ============================================================
    // COMMENTED OUT: These handlers are redundant with Supabase Realtime
    // Uncomment if realtime updates are not working properly
    // ============================================================
    
    // // Listen for score saved events to update immediately
    // const handleScoreSaved = (event: CustomEvent) => {
    //   const { floatId } = event.detail
    //   console.log(`[FloatGrid] 📢 Score saved event for float ${floatId}, refreshing`)
    //   fetchFloats()
    // }

    // // Refresh when page becomes visible (user returns to tab/window)
    // const handleVisibilityChange = () => {
    //   if (!document.hidden) {
    //     console.log("[FloatGrid] Page became visible, refreshing floats")
    //     fetchFloats()
    //   }
    // }

    // // Refresh on focus (user switches back to window)
    // const handleFocus = () => {
    //   console.log("[FloatGrid] Window focused, refreshing floats")
    //   fetchFloats()
    // }
    
    // window.addEventListener("scoreSaved", handleScoreSaved as EventListener)
    // document.addEventListener("visibilitychange", handleVisibilityChange)
    // window.addEventListener("focus", handleFocus)

    // return () => {
    //   window.removeEventListener("scoreSaved", handleScoreSaved as EventListener)
    //   document.removeEventListener("visibilitychange", handleVisibilityChange)
    //   window.removeEventListener("focus", handleFocus)
    // }
    // ============================================================
  }, [fetchFloats])

  // Subscribe to floats and scores changes via Supabase Realtime
  useRealtimeCallback(
    ['floats', 'scores', 'score_items'],
    fetchFloats,
    !loading
  )

  // ============================================================
  // COMMENTED OUT: Aggressive refresh is redundant with Supabase Realtime
  // Uncomment if realtime updates are not working properly
  // ============================================================
  // // AGGRESSIVE: Refresh when pathname changes (navigating to float list page)
  // useEffect(() => {
  //   if (pathname === '/floats') {
  //     console.log("[FloatGrid] Navigated to /floats - refreshing IMMEDIATELY")
  //     fetchFloats()
  //     // Multiple refreshes to ensure we get the latest data
  //     setTimeout(() => {
  //       console.log("[FloatGrid] Second refresh after navigation...")
  //       fetchFloats()
  //     }, 200)
  //     setTimeout(() => {
  //       console.log("[FloatGrid] Third refresh after navigation...")
  //       fetchFloats()
  //     }, 600)
  //   }
  // }, [pathname, fetchFloats])
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p>Loading {labels?.entryPlural ?? "floats"}...</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Realtime indicator */}
      {lastUpdate && (
        <div className="mb-4 flex items-center justify-end gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span>Live • {floats.length} {labels?.entryPlural ?? "floats"}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {floats.map((float) => (
          <FloatCard
            key={float.id}
            float={float}
            score={float.score}
            scored={float.scored}
            scoreStatus={float.scoreStatus}
            labels={labels}
          />
        ))}
      </div>
    </div>
  )
}
