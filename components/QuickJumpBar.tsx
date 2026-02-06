"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getJudgeIdClient } from "@/lib/cookies-client"
import { saveManager } from "@/lib/save-manager"
import type { UiLabels } from "@/lib/labels"

interface QuickJumpBarProps {
  totalFloats: number
  currentFloatId?: number
  scoredFloatIds?: Set<number>
  labels?: UiLabels
}

type ScoreStatus = 'not_started' | 'incomplete' | 'complete' | 'no_show' | 'no_organization' | 'not_found'

interface FloatData {
  id: number
  floatNumber: number
  scoreStatus: ScoreStatus
}

export function QuickJumpBar({
  totalFloats,
  currentFloatId,
  scoredFloatIds: initialScoredFloatIds = new Set(),
  labels,
}: QuickJumpBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [floatData, setFloatData] = useState<Map<number, FloatData>>(new Map())

  const fetchFloats = async () => {
    try {
      const judgeId = getJudgeIdClient()
      if (!judgeId) return

      const timestamp = Date.now()
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'QuickJumpBar.tsx:35',message:'fetchFloats called',data:{judgeId,timestamp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const response = await fetch(`/api/floats?judgeId=${judgeId}&_t=${timestamp}`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const floats = await response.json()
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'QuickJumpBar.tsx:45',message:'Floats received from API',data:{floatCount:floats.length,statuses:floats.slice(0,5).map((f:any)=>({floatNumber:f.floatNumber,scoreStatus:f.scoreStatus}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        const map = new Map<number, FloatData>()
        const existingFloatNumbers = new Set<number>()
        
        // Sort floats by floatNumber
        const sortedFloats = [...floats].sort((a: { floatNumber: number | null; id: number }, b: { floatNumber: number | null; id: number }) => {
          if (a.floatNumber !== null && b.floatNumber !== null) {
            return a.floatNumber - b.floatNumber
          }
          if (a.floatNumber !== null && b.floatNumber === null) return -1
          if (a.floatNumber === null && b.floatNumber !== null) return 1
          return a.id - b.id
        })
        
        // Process each float from API
        sortedFloats.forEach((float: { 
          id: number
          floatNumber: number | null
          scoreStatus?: ScoreStatus
          organization?: string
        }) => {
          if (float.floatNumber === null) return
          
          // Check organization (no org = grey)
          const hasOrganization = float.organization != null && 
                                 String(float.organization).trim() !== '' && 
                                 String(float.organization).trim().toLowerCase() !== 'null'
          
          const status: ScoreStatus = !hasOrganization 
            ? 'no_organization' 
            : (float.scoreStatus || 'not_started')
          
          map.set(float.floatNumber, {
            id: float.id,
            floatNumber: float.floatNumber,
            scoreStatus: status,
          })
          existingFloatNumbers.add(float.floatNumber)
        })
        
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'QuickJumpBar.tsx:86',message:'Setting floatData state',data:{mapSize:map.size,statuses:Array.from(map.values()).slice(0,5).map(f=>({floatNumber:f.floatNumber,scoreStatus:f.scoreStatus}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        setFloatData(map)
      }
    } catch (error) {
      console.error("[QuickJumpBar] Error fetching floats:", error)
    }
  }

  useEffect(() => {
    // Fetch float data on mount
    fetchFloats()

    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'QuickJumpBar.tsx:93',message:'Event listener registered for scoreSaved',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // Listen for score saved events to update
    const handleScoreSaved = () => {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'QuickJumpBar.tsx:98',message:'scoreSaved event received',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      fetchFloats()
    }

    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchFloats()
      }
    }
    
    window.addEventListener("scoreSaved", handleScoreSaved as EventListener)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("scoreSaved", handleScoreSaved as EventListener)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  // Refresh when pathname changes (navigating between floats)
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'QuickJumpBar.tsx:119',message:'Pathname changed - scheduling fetch',data:{pathname,totalFloats},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Add small delay to ensure database has committed any pending saves
    // before fetching updated status
    const timer = setTimeout(() => {
      fetchFloats()
    }, 150)
    
    return () => clearTimeout(timer)
  }, [pathname, totalFloats])

  const handleJump = async (floatNumber: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    const floatInfo = floatData.get(floatNumber)
    
    // If float doesn't exist, don't navigate
    if (!floatInfo || floatInfo.scoreStatus === 'not_found') {
      return
    }
    
    // Trigger save with navigation flag to show spinner overlay
    window.dispatchEvent(new CustomEvent("forceSave", { detail: { showOverlay: true } }))
    
    // Wait a moment for the save event to be processed and overlay to show
    await new Promise(resolve => setTimeout(resolve, 150))
    
    if (saveManager.hasPendingSaves()) {
      try {
        await saveManager.waitForAllSaves(3000)
        // Wait a bit more to ensure save is fully processed
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch {
        saveManager.clear()
      }
    }
    
    // Use router.refresh() to ensure fresh data after navigation
    if (floatInfo?.id) {
      router.push(`/float/${floatInfo.id}`)
      router.refresh() // Force refetch of server component data
      return
    }
    
    // Fetch float ID if not in map
    try {
      const judgeId = getJudgeIdClient()
      if (!judgeId) return

      const response = await fetch(`/api/floats?judgeId=${judgeId}&_t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!response.ok) return

      const floats = await response.json()
      const float = floats.find((f: { floatNumber: number }) => f.floatNumber === floatNumber)
      
      if (float?.id) {
        router.push(`/float/${float.id}`)
        router.refresh() // Force refetch of server component data
      }
    } catch (error) {
      console.error("[QuickJumpBar] Error:", error)
    }
  }

  // Determine current float number from pathname
  const currentFloatNumber = pathname?.includes("/float/")
    ? Array.from(floatData.entries()).find(([_, data]) => data.id === currentFloatId)?.[0]
    : null

  // Helper function to get button color class based on status
  const getButtonColorClass = (scoreStatus: ScoreStatus, isCurrent: boolean): string => {
    // Base classes - smaller on mobile, larger on desktop
    let baseClass = "min-w-[36px] sm:min-w-[44px] h-8 sm:h-10 px-2 sm:px-3 rounded-md text-sm sm:text-base font-medium transition-colors cursor-pointer flex items-center justify-center "
    
    // Color rules (in priority order):
    // 1. Grey: no_organization OR not_found (highest priority)
    // 2. Dark Grey: no_show (float didn't show, all categories = 0)
    // 3. Blue: not_started (total = 0)
    // 4. Red: incomplete (total > 0 but not all categories filled)
    // 5. Green: complete (all required categories filled)
    
    switch (scoreStatus) {
      case 'no_organization':
      case 'not_found':
        baseClass += "bg-gray-400 text-white hover:bg-gray-500"
        break
      case 'no_show':
        baseClass += "bg-gray-600 text-white hover:bg-gray-700"
        break
      case 'complete':
        baseClass += "bg-[#16A34A] text-white hover:bg-[#15803D]"
        break
      case 'incomplete':
        baseClass += "bg-[#DC2626] text-white hover:bg-[#B91C1C]"
        break
      case 'not_started':
      default:
        baseClass += "bg-blue-500 text-white hover:bg-blue-600"
        break
    }
    
    // Add border for selected float (keeps original color)
    if (isCurrent) {
      baseClass += " border-4 border-yellow-400 shadow-lg"
    }
    
    return baseClass
  }

  // Create sorted array of float numbers for sequential display (1, 2, 3...)
  const sortedFloatNumbers = Array.from(floatData.values())
    .sort((a, b) => a.floatNumber - b.floatNumber)
    .map(f => f.floatNumber)

  return (
    <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
      <div className="overflow-x-auto">
        <div className="flex space-x-2 p-2 min-w-max">
          {Array.from({ length: totalFloats }, (_, i) => i + 1).map((displayNumber) => {
            // Map sequential display number (1, 2, 3...) to actual floatNumber (101, 102, 103...)
            const actualFloatNumber = sortedFloatNumbers[displayNumber - 1]
            const floatInfo = actualFloatNumber ? floatData.get(actualFloatNumber) : null
            
            // Determine status: if float doesn't exist, it's not_found (grey)
            const scoreStatus: ScoreStatus = floatInfo 
              ? floatInfo.scoreStatus 
              : 'not_found'
            
            const isCurrent = actualFloatNumber === currentFloatNumber
            const buttonClass = getButtonColorClass(scoreStatus, isCurrent)
            const floatId = floatInfo?.id

            // If float doesn't exist (not_found), show disabled grey button
            if (scoreStatus === 'not_found' || !floatInfo) {
              return (
                <button
                  key={displayNumber}
                  disabled
                  className={buttonClass + " opacity-50 cursor-not-allowed"}
                  type="button"
                  title={`${labels?.entry ?? "Float"} not found`}
                >
                  {displayNumber}
                </button>
              )
            }
            
            // Use button with handleJump for all navigation to ensure saves
            return (
              <button
                key={displayNumber}
                onClick={(e) => handleJump(actualFloatNumber, e)}
                className={buttonClass}
                type="button"
              >
                {displayNumber}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
