"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import { calculateTotalFromItems } from "@/lib/score-utils"
import { saveManager } from "@/lib/save-manager"
import { offlineQueue } from "@/lib/offline-queue"

interface Category {
  id: number
  eventId: number
  categoryName: string
  displayOrder: number
  required: boolean
  hasNoneOption: boolean
  createdAt: Date
}

interface ScoringSlidersProps {
  floatId: number
  eventId: number
  judgeId: number
  categories: Category[]
  scoringScale?: {
    min: number
    max: number
  }
  initialScore?: {
    scores?: Record<string, number | null>
  } | null
  isLemonadeDay?: boolean
}

export function ScoringSliders({ 
  floatId, 
  eventId,
  judgeId,
  categories,
  scoringScale,
  initialScore,
  isLemonadeDay: isLemonadeDayProp
}: ScoringSlidersProps) {
  const scaleMin = Number.isFinite(scoringScale?.min) ? scoringScale!.min : 0
  const scaleMax = Number.isFinite(scoringScale?.max) ? scoringScale!.max : 20

  // Sort categories by display order
  const sortedCategories = [...categories].sort((a, b) => a.displayOrder - b.displayOrder)
  
  // Initialize scores state dynamically based on categories
  const initializeScores = useCallback(() => {
    const scores: Record<string, number | null> = {}
    sortedCategories.forEach(cat => {
      scores[cat.categoryName] = initialScore?.scores?.[cat.categoryName] ?? null
    })
    return scores
  }, [categories, initialScore])

  const [scores, setScores] = useState<Record<string, number | null>>(initializeScores)
  const [showSavingOverlay, setShowSavingOverlay] = useState(false) // Only show during navigation
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [lastSavedFloatId, setLastSavedFloatId] = useState<number | null>(null)
  const [isLemonadeDay, setIsLemonadeDay] = useState(isLemonadeDayProp ?? false)
  
  // Debug: log isLemonadeDay state
  console.log('[ScoringSliders] isLemonadeDay state:', isLemonadeDay, 'prop:', isLemonadeDayProp, 'showOverlay:', showSavingOverlay)
  
  // Refs to track state for save-on-unmount
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const latestValuesRef = useRef<Record<string, number | null>>(initializeScores())
  const lastSavedValuesRef = useRef<Record<string, number | null>>(initializeScores())
  const isSavingRef = useRef(false)
  const isNavigatingSaveRef = useRef(false) // Track if this is a navigation-triggered save
  const currentFloatIdRef = useRef<number>(floatId)

  // Calculate total from current scores
  const total = calculateTotalFromItems(
    Object.values(scores).map(value => ({ value }))
  )

  // Save function - simplified for reliability (defined early so other hooks can use it)
  const saveScore = useCallback(
    async (
      scoreValues: Record<string, number | null>,
      skipToast = false,
      retryCount = 0
    ): Promise<void> => {
      const targetFloatId = currentFloatIdRef.current
      const maxRetries = 2
      
      // Skip if already saving
      if (isSavingRef.current && retryCount === 0) {
        return
      }
      
      isSavingRef.current = true
      // Only show overlay if this is a navigation-triggered save
      if (isNavigatingSaveRef.current) {
        setShowSavingOverlay(true)
      }
      
      try {
        const response = await fetch("/api/scores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            floatId: targetFloatId,
            scores: scoreValues,
          }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
          throw new Error(error.error || `HTTP ${response.status}`)
        }

        await response.json()
        lastSavedValuesRef.current = { ...scoreValues }
        
        // Dispatch scoreSaved event to notify QuickJumpBar and other components
        window.dispatchEvent(new CustomEvent("scoreSaved", { 
          detail: { floatId: targetFloatId } 
        }))
        
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/a5ba889a-046d-43d6-9254-2e116f014c22',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ScoringSliders.tsx:109',message:'Save successful - scoreSaved event dispatched',data:{floatId:targetFloatId,hasEventDispatch:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
      } catch (error: any) {
        console.error(`[ScoringSliders] Save failed:`, error)
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500))
          isSavingRef.current = false
          return saveScore(scoreValues, skipToast, retryCount + 1)
        } else {
          // After max retries, queue for offline sync instead of losing the score
          console.log(`[ScoringSliders] Max retries reached, queueing for offline sync`)
          offlineQueue.addToQueue({
            floatId: targetFloatId,
            eventId,
            judgeId,
            scores: scoreValues,
            timestamp: Date.now(),
            retryCount: 0,
          })
          
          if (!skipToast) {
            toast.warning("Saved locally - will sync when connected", { 
              duration: 3000,
              description: "Your score is safe and will upload automatically"
            })
          }
        }
        throw error
      } finally {
        isSavingRef.current = false
        isNavigatingSaveRef.current = false
        setShowSavingOverlay(false)
      }
    },
    []
  )

  // Check if this is a Lemonade Day event (only if not passed as prop)
  useEffect(() => {
    // If prop is provided, use it directly
    if (isLemonadeDayProp !== undefined) {
      setIsLemonadeDay(isLemonadeDayProp)
      return
    }
    // Fallback: fetch event type if prop not provided
    const checkEventType = async () => {
      try {
        const response = await fetch(`/api/events?id=${eventId}`)
        if (response.ok) {
          const events = await response.json()
          const event = Array.isArray(events) ? events[0] : events
          setIsLemonadeDay(event?.type === "lemonade_day")
        }
      } catch (error) {
        console.error("[ScoringSliders] Error checking event type:", error)
      }
    }
    checkEventType()
  }, [eventId, isLemonadeDayProp])

  // Update state when initialScore or floatId changes
  useEffect(() => {
    const previousFloatId = currentFloatIdRef.current
    
    // Save pending changes from previous float before switching
    if (previousFloatId !== floatId && previousFloatId !== null) {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
      }
      
      const saveData = { ...latestValuesRef.current }
      const lastSaved = { ...lastSavedValuesRef.current }
      const hasChanges = Object.keys(saveData).some(key => saveData[key] !== lastSaved[key])
      
      if (hasChanges && !isSavingRef.current) {
        const savePromise = saveScore(saveData, true, 0)
        saveManager.registerSave(previousFloatId, savePromise)
        savePromise.finally(() => saveManager.unregisterSave(previousFloatId))
      }
    }
    
    currentFloatIdRef.current = floatId
    
    // Initialize scores for new float
    const initialValues = initializeScores()
    setScores(initialValues)
    latestValuesRef.current = { ...initialValues }
    lastSavedValuesRef.current = { ...initialValues }
    
    const timer = setTimeout(() => {
      setIsInitialLoad(false)
      setLastSavedFloatId(floatId)
    }, 200)
    
    return () => clearTimeout(timer)
  }, [initialScore, floatId, initializeScores, saveScore])

  // Update score for a category - debounced to avoid too many API calls
  const updateScore = useCallback((
    categoryName: string,
    newValue: number
  ) => {
    const updatedScores = { ...scores, [categoryName]: newValue }
    setScores(updatedScores)
    latestValuesRef.current = { ...updatedScores }
    
    // Debounce saves to avoid hammering the API during slider drag
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current)
    }
    
    // Save after short delay (user stopped dragging)
    if (!isInitialLoad && currentFloatIdRef.current === floatId) {
      pendingTimerRef.current = setTimeout(() => {
        const currentFloatId = currentFloatIdRef.current
        const savePromise = saveScore(updatedScores, true, 0)
        saveManager.registerSave(currentFloatId, savePromise)
        savePromise.finally(() => saveManager.unregisterSave(currentFloatId))
      }, 300)
    }
  }, [scores, floatId, isInitialLoad, saveScore])

  // Handle "(None)" button click
  const handleNoneClick = useCallback((categoryName: string) => {
    const category = sortedCategories.find(c => c.categoryName === categoryName)
    if (!category || !category.hasNoneOption) {
      return
    }

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current)
      pendingTimerRef.current = null
    }
    
    const updatedScores = { ...scores, [categoryName]: 0 }
    setScores(updatedScores)
    latestValuesRef.current = { ...updatedScores }
    
    // Save immediately
    const currentFloatId = currentFloatIdRef.current
    const savePromise = saveScore(updatedScores, true, 0)
    saveManager.registerSave(currentFloatId, savePromise)
    savePromise.finally(() => saveManager.unregisterSave(currentFloatId))
    
    toast.success(`${categoryName} set to None`, { duration: 1500 })
  }, [scores, saveScore, sortedCategories])

  // Save on visibility change, force save event, or before unload
  useEffect(() => {
    const handleImmediateSave = (showOverlay: boolean) => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
      }
      
      const saveData = { ...latestValuesRef.current }
      const lastSaved = { ...lastSavedValuesRef.current }
      const hasChanges = Object.keys(saveData).some(
        key => saveData[key] !== lastSaved[key]
      )
      
      if (hasChanges && !isSavingRef.current && currentFloatIdRef.current) {
        // Set navigation flag to show overlay if requested
        if (showOverlay) {
          isNavigatingSaveRef.current = true
        }
        const currentFloatId = currentFloatIdRef.current
        const savePromise = saveScore(saveData, true, 0)
        saveManager.registerSave(currentFloatId, savePromise)
        savePromise.finally(() => saveManager.unregisterSave(currentFloatId))
      }
    }
    
    const handleVisibilityChange = () => {
      if (document.hidden) handleImmediateSave(false) // No overlay for visibility change
    }
    
    const handleBeforeUnload = () => handleImmediateSave(false) // No overlay for unload
    
    // Force save shows the overlay (triggered by navigation buttons or QuickJumpBar)
    const handleForceSave = (event: Event) => {
      const customEvent = event as CustomEvent<{ showOverlay?: boolean }>
      const showOverlay = customEvent.detail?.showOverlay ?? true
      handleImmediateSave(showOverlay)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('forceSave', handleForceSave)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('forceSave', handleForceSave)
      
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current)
      }
    }
  }, [saveScore])

  return (
    <div className="space-y-8 p-6">
      <div className="space-y-6">
        {sortedCategories.map((category) => {
          const categoryName = category.categoryName
          const value = scores[categoryName] ?? null

          return (
            <div key={category.id}>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xl font-semibold">
                  {categoryName}
                  {category.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {category.hasNoneOption && (
                  <button
                    onClick={() => handleNoneClick(categoryName)}
                    className={`text-base px-4 py-2 rounded border transition-colors font-semibold ${
                      value === 0 
                        ? "bg-orange-500 text-white border-orange-600 hover:bg-orange-600" 
                        : value === null
                        ? "border-dashed border-gray-400 bg-gray-50 text-gray-500"
                        : "border-gray-300 hover:bg-gray-100 text-gray-700"
                    }`}
                    type="button"
                  >
                    (None)
                  </button>
                )}
              </div>
              <Slider
                value={[value ?? 0]}
                onValueChange={(vals) => {
                  // CRITICAL: Save on every change, not just on commit
                  updateScore(categoryName, vals[0])
                }}
                onValueCommit={(vals) => {
                  // Clear any pending debounced save and save immediately on commit
                  if (pendingTimerRef.current) {
                    clearTimeout(pendingTimerRef.current)
                    pendingTimerRef.current = null
                  }
                  
                  const updatedScores = { ...scores, [categoryName]: vals[0] }
                  latestValuesRef.current = { ...updatedScores }
                  
                  if (!isInitialLoad && currentFloatIdRef.current === floatId) {
                    const currentFloatId = currentFloatIdRef.current
                    const savePromise = saveScore(updatedScores, true, 0)
                    saveManager.registerSave(currentFloatId, savePromise)
                    savePromise.finally(() => saveManager.unregisterSave(currentFloatId))
                  }
                }}
                max={scaleMax}
                min={scaleMin}
                step={1}
                className={`w-full ${value === null ? 'border-2 border-dashed border-gray-400' : ''}`}
              />
              <div className="flex justify-between text-lg text-muted-foreground mt-2">
                <span className="font-medium">{scaleMin}</span>
                <span className={`text-3xl font-bold ${value === null ? 'text-gray-400 italic' : ''}`}>
                  {value === null ? '—' : value}
                </span>
                <span className="font-medium">{scaleMax}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="pt-6 border-t-2">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">Total Score:</span>
          <span className="text-4xl font-bold" style={{ color: "#DC2626" }}>
            {total}
          </span>
        </div>
      </div>

      {/* Professional saving overlay - only shown during navigation */}
      {showSavingOverlay && (() => {
        console.log('[ScoringSliders] Rendering overlay, isLemonadeDay:', isLemonadeDay)
        return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] p-10 flex flex-col items-center gap-5 border border-gray-200">
            {isLemonadeDay ? (
              /* Lemonade Day: Creative lemon pitcher animation */
              <>
                <div className="relative w-28 h-28">
                  {/* Central pitcher/glass with lemonade */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl">🍹</span>
                  </div>
                  {/* Orbiting lemon - top */}
                  <div className="absolute inset-0 animate-spin" style={{ animationDuration: '2s' }}>
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl">🍋</span>
                  </div>
                  {/* Orbiting lemon - opposite direction */}
                  <div className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}>
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-2xl">🍋</span>
                  </div>
                  {/* Sparkle effects */}
                  <div className="absolute top-0 right-0 text-xl animate-ping" style={{ animationDuration: '1s' }}>✨</div>
                  <div className="absolute bottom-2 left-0 text-lg animate-ping" style={{ animationDuration: '1.2s', animationDelay: '0.3s' }}>✨</div>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-500 animate-pulse">
                    Squeezing the results...
                  </p>
                  <p className="text-sm text-yellow-600/70 mt-2">
                    Making lemonade magic!
                  </p>
                </div>
                {/* Bouncing lemon slices */}
                <div className="flex gap-2">
                  <span className="text-2xl animate-bounce" style={{ animationDelay: '0ms' }}>🍋</span>
                  <span className="text-2xl animate-bounce" style={{ animationDelay: '150ms' }}>🍋</span>
                  <span className="text-2xl animate-bounce" style={{ animationDelay: '300ms' }}>🍋</span>
                </div>
              </>
            ) : (
              /* Regular: Animated spinner with dual rings */
              <>
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-gray-200 rounded-full" />
                  <div className="absolute inset-0 w-16 h-16 border-4 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
                  <div className="absolute inset-2 w-12 h-12 border-4 border-[#14532D] border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#14532D] animate-pulse">
                    Saving Score...
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Please wait before navigating
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </>
            )}
          </div>
        </div>
        )
      })()}
    </div>
  )
}
