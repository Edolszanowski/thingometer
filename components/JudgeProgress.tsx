"use client"

import { useState, useCallback, useEffect } from "react"
import { FloatGrid } from "./FloatGrid"
import { QuickJumpBar } from "./QuickJumpBar"
import { getJudgeIdClient } from "@/lib/cookies-client"
import type { UiLabels } from "@/lib/labels"

type ScoreStatus = 'not_started' | 'incomplete' | 'complete' | 'no_show' | 'no_organization' | 'not_found'

interface FloatWithScore {
  id: number
  floatNumber: number | null
  scoreStatus?: ScoreStatus
}

interface JudgeProgressProps {
  judgeName: string
  totalFloats: number
  initialFloats?: FloatWithScore[]
  labels?: UiLabels
}

export function JudgeProgress({ judgeName, totalFloats, initialFloats, labels }: JudgeProgressProps) {
  // Start with null to indicate "loading" - don't show incorrect "0 of X"
  const [scoredCount, setScoredCount] = useState<number | null>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [scoredFloatIds, setScoredFloatIds] = useState<Set<number>>(new Set())

  // Callback when FloatGrid updates with fresh data from API
  const handleProgressUpdate = useCallback((completed: number, total: number) => {
    setScoredCount(completed)
    setTotalCount(total)
  }, [])

  // Fetch fresh progress data from API on mount (single source of truth)
  useEffect(() => {
    const fetchProgress = async () => {
      const judgeId = getJudgeIdClient()
      if (!judgeId) return

      try {
        const response = await fetch(`/api/floats?judgeId=${judgeId}&_t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (response.ok) {
          const floats = await response.json()
          // Count both 'complete' and 'no_show' as finished (no_show = all zeros = float didn't show)
          const completed = floats.filter((f: { scoreStatus?: string }) => 
            f.scoreStatus === 'complete' || f.scoreStatus === 'no_show'
          )
          setScoredCount(completed.length)
          setTotalCount(floats.length)
          setScoredFloatIds(new Set(completed.map((f: { id: number }) => f.id)))
        }
      } catch (error) {
        console.error('[JudgeProgress] Error fetching progress:', error)
        // Fallback to initialFloats if API fails
        if (initialFloats) {
          const completed = initialFloats.filter(f => 
            f.scoreStatus === 'complete' || f.scoreStatus === 'no_show'
          )
          setScoredCount(completed.length)
          setTotalCount(initialFloats.length)
        }
      }
    }

    fetchProgress()
  }, [initialFloats])

  // Calculate percentage only when we have valid data
  const progressPercentage = (scoredCount !== null && totalCount !== null && totalCount > 0) 
    ? (scoredCount / totalCount) * 100 
    : 0

  const isLoading = scoredCount === null || totalCount === null

  return (
    <>
      {/* Progress Indicator - inside the sticky header area */}
      <div className="container mx-auto px-4 pb-4">
        <div className="flex items-center gap-3">
          {isLoading ? (
            <span className="text-sm text-muted-foreground">
              Loading progress...
            </span>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                Progress: <strong>{scoredCount}</strong> of <strong>{totalCount}</strong> {labels?.entryPlural ?? "floats"} completed
              </span>
              <div className="flex-1 max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#16A34A] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-sm font-semibold" style={{ color: "#16A34A" }}>
                {Math.round(progressPercentage)}%
              </span>
            </>
          )}
        </div>
      </div>
      
      <QuickJumpBar
        totalFloats={totalFloats}
        currentFloatId={undefined}
        scoredFloatIds={scoredFloatIds}
        labels={labels}
      />
      
      <FloatGrid 
        initialFloats={initialFloats as any} 
        onProgressUpdate={handleProgressUpdate}
        labels={labels}
      />
    </>
  )
}

