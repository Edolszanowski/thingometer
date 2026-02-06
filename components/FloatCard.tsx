"use client"

import { Card, CardContent } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Float } from "@/lib/drizzle/schema"
import type { Score } from "@/lib/drizzle/schema"
import { saveManager } from "@/lib/save-manager"
import type { UiLabels } from "@/lib/labels"

type ScoreStatus = 'not_started' | 'incomplete' | 'complete' | 'no_show' | 'no_organization' | 'not_found'

interface FloatCardProps {
  float: Float
  score: Score | null
  scored: boolean
  scoreStatus?: ScoreStatus
  labels?: UiLabels
  displayNumber?: number // Sequential display number (1, 2, 3...) to match QuickJumpBar
}

export function FloatCard({ float, score, scored, scoreStatus = 'not_started', labels, displayNumber }: FloatCardProps) {
  const router = useRouter()

  const handleClick = async () => {
    // CRITICAL: Wait for any pending saves before navigating
    if (saveManager.hasPendingSaves()) {
      console.log(`[FloatCard] Pending saves detected, waiting before navigation...`)
      
      // Show loading indicator
      const loadingToast = toast.loading("Saving scores...", { id: `nav-save-${float.id}` })
      
      try {
        // Wait for all pending saves to complete (with timeout)
        await saveManager.waitForAllSaves()
        toast.dismiss(loadingToast)
        toast.success("Scores saved", { id: `nav-save-${float.id}`, duration: 1000 })
      } catch (error) {
        toast.dismiss(loadingToast)
        console.error(`[FloatCard] Error waiting for saves:`, error)
        // Continue with navigation even if save times out
      }
    }
    
    router.push(`/float/${float.id}`)
  }

  // Determine card styling based on scoreStatus
  let cardClass = "cursor-pointer transition-all hover:shadow-lg "
  let statusText = ""
  let statusColor = ""
  
  switch (scoreStatus) {
    case 'no_organization':
    case 'not_found':
      cardClass += "border-gray-400 bg-gray-100 opacity-70 cursor-not-allowed"
      statusText = "⚠ No Org / Not Found"
      statusColor = "text-gray-600"
      break
    case 'no_show':
      cardClass += "border-gray-500 bg-gray-200"
      statusText = "✗ No Show"
      statusColor = "text-gray-700"
      break
    case 'complete':
      cardClass += "border-[#16A34A] bg-[#16A34A]/10"
      statusText = "✓ Complete"
      statusColor = "text-[#16A34A]"
      break
    case 'incomplete':
      cardClass += "border-[#DC2626] bg-[#DC2626]/10"
      statusText = "⚠ Incomplete"
      statusColor = "text-[#DC2626]"
      break
    case 'not_started':
    default:
      cardClass += "border-blue-500 bg-blue-500/10"
      statusText = "◎ Not Started"
      statusColor = "text-blue-600"
      break
  }

  return (
    <Card
      onClick={handleClick}
      className={cardClass}
    >
      <CardContent className="p-4">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{labels?.entryNumber ?? "Float #"}{displayNumber ?? float.floatNumber}</h3>
            {statusText && (
              <span className={`text-sm font-semibold ${statusColor}`}>
                {statusText}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{float.organization}</p>
          {float.entryName && (
            <p className="text-xs text-muted-foreground italic">
              {float.entryName}
            </p>
          )}
          {score && (
            <p className="text-lg font-bold mt-2" style={{ color: "#DC2626" }}>
              Total: {score.total}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

