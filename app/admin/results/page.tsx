"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AdminWinnerCard } from "@/components/AdminWinnerCard"
import { AdminJudgeStatus } from "@/components/AdminJudgeStatus"
import { AdminEventSelector, getAdminEventId } from "@/components/AdminEventSelector"
import { WinnersFullscreen } from "@/components/WinnersFullscreen"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Link from "next/link"
import type { Float } from "@/lib/drizzle/schema"
import { useRealtimeCallback } from "@/hooks/useRealtimeData"
import { getLabelsForEvent } from "@/app/actions"
import type { UiLabels } from "@/lib/labels"
import { getDefaultLabels } from "@/lib/labels"

interface Winner {
  float: Float
  total: number
}

interface JudgeStatus {
  id: number
  name: string
  submitted: boolean
  scoreCount: number
}

interface WinnersData {
  bestLighting: Winner[]
  bestTheme: Winner[]
  bestTraditions: Winner[]
  bestSpirit: Winner[]
  bestMusic: Winner[]
  bestOverall: Winner[]
  categories?: Record<string, Winner[]> // Dynamic categories
  entryCategoryTitle?: string
}

function getAdminPassword(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return authCookie ? authCookie.split("=")[1] : null
}

export default function AdminResultsPage() {
  const router = useRouter()
  const [winners, setWinners] = useState<WinnersData | null>(null)
  const [judges, setJudges] = useState<JudgeStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [eventName, setEventName] = useState<string>("")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [labels, setLabels] = useState<UiLabels>(getDefaultLabels())

  // Initialize selectedEventId from cookie on mount
  useEffect(() => {
    const savedEventId = getAdminEventId()
    if (savedEventId !== null && selectedEventId === null) {
      setSelectedEventId(savedEventId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load event-specific labels (server action) when selectedEventId changes
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const next = await getLabelsForEvent(selectedEventId)
        if (!cancelled) setLabels(next)
      } catch (err) {
        if (!cancelled) setLabels(getDefaultLabels())
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedEventId])

  const fetchData = useCallback(async () => {
    const password = getAdminPassword()
    if (!password) {
      router.push("/admin")
      return
    }

    try {
      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now()
      const eventIdParam = selectedEventId ? `&eventId=${selectedEventId}` : ''
      const [winnersRes, judgesRes] = await Promise.all([
        fetch(`/api/admin/winners?password=${encodeURIComponent(password)}&_t=${timestamp}${eventIdParam}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/admin/judges?password=${encodeURIComponent(password)}&_t=${timestamp}${eventIdParam}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ])

      if (!winnersRes.ok || !judgesRes.ok) {
        if (winnersRes.status === 401 || judgesRes.status === 401) {
          router.push("/admin")
          return
        }
        throw new Error("Failed to fetch data")
      }

      const winnersData = await winnersRes.json()
      const judgesData = await judgesRes.json()

      setWinners(winnersData)
      setJudges(judgesData)
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Error fetching admin data:", error)
      toast.error("Failed to load admin data")
    } finally {
      setLoading(false)
    }
  }, [router, selectedEventId])

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Subscribe to realtime updates on scores, judges, and floats tables
  useRealtimeCallback(
    ['scores', 'score_items', 'judges', 'floats', 'judge_submissions'],
    fetchData,
    !loading // Only enable after initial load
  )

  const handleExportCSV = async () => {
    const password = getAdminPassword()
    if (!password) {
      router.push("/admin")
      return
    }

    try {
      const eventIdParam = selectedEventId ? `&eventId=${selectedEventId}` : ''
      const response = await fetch(
        `/api/admin/scores?password=${encodeURIComponent(password)}&format=csv${eventIdParam}`
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "scores.csv"
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success("CSV exported successfully")
      } else {
        toast.error("Failed to export CSV")
      }
    } catch (error) {
      console.error("Error exporting CSV:", error)
      toast.error("Failed to export CSV")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading admin dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-full overflow-x-hidden">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "#14532D" }}>
            Admin Dashboard
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <AdminEventSelector onEventChange={(eventId, name) => {
              if (eventId !== selectedEventId) {
                setSelectedEventId(eventId)
                setEventName(name || "")
                setLoading(true)
              } else if (name && !eventName) {
                setEventName(name)
              }
            }} />
            {lastUpdate && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live • Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/events" className="flex-1 sm:flex-none min-w-[120px]">
            <Button variant="outline" style={{ borderColor: "#14532D", color: "#14532D" }} className="w-full text-xs sm:text-sm">
              Manage Events
            </Button>
          </Link>
          <Link href="/coordinator/positions" className="flex-1 sm:flex-none min-w-[120px]">
            <Button
              variant="outline"
              style={{ borderColor: "#DC2626", color: "#DC2626" }}
              className="w-full text-xs sm:text-sm"
            >
              Coordinator
            </Button>
          </Link>
          <Button
            onClick={handleExportCSV}
            variant="outline"
            style={{ borderColor: "#16A34A", color: "#16A34A" }}
            className="flex-1 sm:flex-none min-w-[120px] text-xs sm:text-sm"
          >
            Export CSV
          </Button>
          <Button
            onClick={() => {
              // Clear admin auth cookie
              document.cookie = "admin-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
              // Clear admin event cookie
              document.cookie = "admin-event-id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
              router.push("/admin")
            }}
            variant="outline"
            className="flex-1 sm:flex-none min-w-[80px] text-xs sm:text-sm"
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Judge Completion Status</h2>
        <div className="overflow-x-auto">
          <AdminJudgeStatus judges={judges} />
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold">Category Winners</h2>
          {winners && (
            <WinnersFullscreen winners={winners} eventName={eventName} labels={labels} />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {winners && (
            <>
              {/* Show dynamic categories if available */}
              {winners.categories && Object.keys(winners.categories).length > 0 ? (
                <>
                  {Object.entries(winners.categories).map(([categoryName, categoryWinners]) => {
                    // Special handling for "Entry" category - use custom title
                    if (categoryName === "Entry") {
                      const title = winners.entryCategoryTitle || "Best Entry"
                      return (
                        <AdminWinnerCard
                          key={categoryName}
                          title={title}
                          winners={categoryWinners}
                          labels={labels}
                        />
                      )
                    }
                    // Regular categories
                    return (
                      <AdminWinnerCard
                        key={categoryName}
                        title={`Best ${categoryName}`}
                        winners={categoryWinners}
                        labels={labels}
                      />
                    )
                  })}
                </>
              ) : (
                <>
                  {/* Fallback to hardcoded categories for backward compatibility */}
                  <AdminWinnerCard
                    title="Best Lighting"
                    winners={winners.bestLighting}
                    labels={labels}
                  />
                  <AdminWinnerCard
                    title="Best Theme"
                    winners={winners.bestTheme}
                    labels={labels}
                  />
                  <AdminWinnerCard
                    title="Best Traditions"
                    winners={winners.bestTraditions}
                    labels={labels}
                  />
                  <AdminWinnerCard
                    title="Best Spirit"
                    winners={winners.bestSpirit}
                    labels={labels}
                  />
                  <AdminWinnerCard
                    title="Best Music"
                    winners={winners.bestMusic}
                    labels={labels}
                  />
                  <AdminWinnerCard
                    title="Best Overall Entry"
                    winners={winners.bestOverall}
                    labels={labels}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

