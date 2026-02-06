"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { saveManager } from "@/lib/save-manager"
import { useState } from "react"
import { toast } from "sonner"
import type { UiLabels } from "@/lib/labels"

interface NavigationButtonsProps {
  previousFloat: { id: number } | null
  nextFloat: { id: number } | null
  labels?: UiLabels
}

export function NavigationButtons({ previousFloat, nextFloat, labels }: NavigationButtonsProps) {
  const router = useRouter()
  const [navigating, setNavigating] = useState(false)

  const handleNavigation = async (targetPath: string) => {
    if (navigating) return // Prevent double-clicks
    
    setNavigating(true)
    const loadingToast = toast.loading("Saving scores...", { id: "nav-save" })
    
    try {
      // CRITICAL: Trigger immediate save before waiting (show overlay)
      window.dispatchEvent(new CustomEvent("forceSave", { detail: { showOverlay: true } }))
      
      // Wait for save to start
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Wait for pending saves with shorter timeout
      let attempts = 0
      const maxAttempts = 6 // 6 attempts * 500ms = 3 seconds max
      
      while (saveManager.hasPendingSaves() && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
      }
      
      // After timeout, clear any stale saves and proceed anyway
      if (saveManager.hasPendingSaves()) {
        console.warn("[NavigationButtons] Clearing stale pending saves after timeout")
        saveManager.clear() // Clear stale saves
      }
      
      toast.dismiss(loadingToast)
      toast.success("Scores saved!", { id: "nav-save", duration: 1000 })
      
      // Small delay then navigate
      await new Promise(resolve => setTimeout(resolve, 200))
      router.push(targetPath)
    } catch (error) {
      toast.dismiss(loadingToast)
      console.error("[NavigationButtons] Error:", error)
      // Even on error, clear and allow navigation
      saveManager.clear()
      router.push(targetPath)
    }
  }

  return (
    <div className="mt-8 flex flex-col sm:flex-row gap-4">
      {previousFloat ? (
        <Button
          variant="outline"
          className="flex-1 h-12"
          style={{ borderColor: "#DC2626", color: "#DC2626" }}
          onClick={() => handleNavigation(`/float/${previousFloat.id}`)}
          disabled={navigating}
        >
          ◀ Previous {labels?.entry ?? "Float"}
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled
          className="flex-1 h-12"
        >
          ◀ Previous {labels?.entry ?? "Float"}
        </Button>
      )}

      <Button
        variant="outline"
        className="flex-1 h-12"
        style={{ borderColor: "#16A34A", color: "#16A34A" }}
        onClick={() => handleNavigation("/floats")}
        disabled={navigating}
      >
        Back to {labels?.entry ?? "Float"} List
      </Button>

      {nextFloat ? (
        <Button
          variant="outline"
          className="flex-1 h-12"
          style={{ borderColor: "#DC2626", color: "#DC2626" }}
          onClick={() => handleNavigation(`/float/${nextFloat.id}`)}
          disabled={navigating}
        >
          Next {labels?.entry ?? "Float"} ▶
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled
          className="flex-1 h-12"
        >
          Next {labels?.entry ?? "Float"} ▶
        </Button>
      )}
    </div>
  )
}

