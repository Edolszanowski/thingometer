"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function SubmitButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault()
    e?.stopPropagation()
    
    console.log("[SubmitButton] handleSubmit called")
    
    if (!confirm("Are you sure you want to finalize your scores? You can submit even if some floats weren't shown. This action cannot be undone.")) {
      console.log("[SubmitButton] User cancelled confirmation")
      return
    }

    console.log("[SubmitButton] User confirmed, starting submission...")
    setLoading(true)
    
    try {
      console.log("[SubmitButton] Making POST request to /api/judge/submit")
      const response = await fetch("/api/judge/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Ensure cookies are sent
      })

      console.log("[SubmitButton] Response status:", response.status, response.statusText)

      if (response.ok) {
        const data = await response.json()
        console.log("[SubmitButton] Submission successful:", data)
        toast.success("Scores finalized successfully!")
        
        // Small delay to ensure toast is visible before navigation
        setTimeout(() => {
          console.log("[SubmitButton] Navigating to /submit")
          router.push("/submit")
        }, 500)
      } else {
        const error = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[SubmitButton] Submission failed:", error)
        toast.error(error.error || "Failed to submit scores")
        setLoading(false)
      }
    } catch (error) {
      console.error("[SubmitButton] Error submitting scores:", error)
      toast.error("Failed to submit scores. Please try again.")
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleSubmit}
      disabled={loading}
      type="button"
      className="w-full h-14 text-lg bg-[#DC2626] hover:bg-[#DC2626]/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Finalizing..." : "Finalize My Scores"}
    </Button>
  )
}

