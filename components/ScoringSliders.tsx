"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Slider } from "@/components/ui/slider"
import { toast } from "sonner"
import { calculateTotalFromItems } from "@/lib/score-utils"
import { saveManager } from "@/lib/save-manager"

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
  categories: Category[]
  initialScore?: {
    scores?: Record<string, number | null>
  } | null
}

export function ScoringSliders({ 
  floatId, 
  eventId,
  categories,
  initialScore
}: ScoringSlidersProps) {
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
        
      } catch (error: any) {
        console.error(`[ScoringSliders] Save failed:`, error)
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500))
          isSavingRef.current = false
          return saveScore(scoreValues, skipToast, retryCount + 1)
        } else if (!skipToast) {
          toast.error("Failed to save. Please try again.", { duration: 3000 })
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
    
    // Force save shows the overlay (triggered by navigation buttons)
    const handleForceSave = () => handleImmediateSave(true)
    
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
                max={20}
                min={0}
                step={1}
                className={`w-full ${value === null ? 'border-2 border-dashed border-gray-400' : ''}`}
              />
              <div className="flex justify-between text-lg text-muted-foreground mt-2">
                <span className="font-medium">0</span>
                <span className={`text-3xl font-bold ${value === null ? 'text-gray-400 italic' : ''}`}>
                  {value === null ? '—' : value}
                </span>
                <span className="font-medium">20</span>
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
      {showSavingOverlay && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] p-10 flex flex-col items-center gap-5 border border-gray-200">
            {/* Animated spinner with dual rings */}
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-4 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-2 w-12 h-12 border-4 border-[#14532D] border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            </div>
            
            {/* Animated text */}
            <div className="text-center">
              <p className="text-2xl font-bold text-[#14532D] animate-pulse">
                Saving Score...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Please wait before navigating
              </p>
            </div>
            
            {/* Progress dots animation */}
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2.5 h-2.5 bg-[#DC2626] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
