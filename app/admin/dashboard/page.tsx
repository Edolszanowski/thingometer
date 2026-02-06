"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { BarChart3, Calendar, Users, FileText, Settings, ArrowRight } from "lucide-react"
import { AdminEventSelector, getAdminEventId } from "@/components/AdminEventSelector"
import Link from "next/link"
import { deleteCookie } from "@/lib/cookies-client"

interface Event {
  id: number
  name: string
  city: string
  eventDate: string | null
  active: boolean
  categories?: Array<{ id: number; categoryName: string }>
  judges?: Array<{ id: number; name: string }>
}

interface EventStats {
  entryCount: number
  judgeCount: number
  completedJudges: number
  approvedEntries: number
}

function getAdminPassword(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return authCookie ? authCookie.split("=")[1] : null
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [eventStats, setEventStats] = useState<EventStats | null>(null)
  const [hasEvents, setHasEvents] = useState(false)

  const fetchEvents = useCallback(async () => {
    const password = getAdminPassword()
    if (!password) {
      router.push("/admin")
      return []
    }

    try {
      const response = await fetch(`/api/admin/events?password=${encodeURIComponent(password)}`)
      if (response.status === 401) {
        router.push("/admin")
        return []
      }

      if (!response.ok) {
        throw new Error("Failed to fetch events")
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error("Error fetching events:", error)
      toast.error("Failed to load events")
      return []
    }
  }, [router])

  const fetchEventStats = useCallback(async (eventId: number) => {
    const password = getAdminPassword()
    if (!password) return

    try {
      // Fetch entries and judges for the selected event
      const [entriesRes, judgesRes] = await Promise.all([
        fetch(`/api/floats?eventId=${eventId}`),
        fetch(`/api/judges?eventId=${eventId}`)
      ])

      if (entriesRes.ok && judgesRes.ok) {
        const entries = await entriesRes.json()
        const judges = await judgesRes.json()

        setEventStats({
          entryCount: entries.length,
          judgeCount: judges.length,
          completedJudges: judges.filter((j: any) => j.submitted).length,
          approvedEntries: entries.filter((e: any) => e.approved).length,
        })
      }
    } catch (error) {
      console.error("Error fetching event stats:", error)
    }
  }, [])

  useEffect(() => {
    const initDashboard = async () => {
      const eventsData = await fetchEvents()
      setEvents(eventsData)

      if (eventsData.length === 0) {
        // No events - route to event creation
        toast.info("Create your first event to get started")
        setTimeout(() => {
          router.push("/admin/events")
        }, 1500)
      } else {
        // Events exist - show dashboard
        setHasEvents(true)
        
        // Load saved event ID or default to first event
        const savedEventId = getAdminEventId()
        const eventId = savedEventId || eventsData[0].id
        setSelectedEventId(eventId)
        
        // Fetch stats for selected event
        fetchEventStats(eventId)
      }
      
      setLoading(false)
    }

    initDashboard()
  }, [fetchEvents, fetchEventStats, router])

  const handleEventChange = (eventId: number | null) => {
    setSelectedEventId(eventId)
    if (eventId) {
      fetchEventStats(eventId)
    }
  }

  const handleExportCSV = async () => {
    const password = getAdminPassword()
    if (!password || !selectedEventId) return

    try {
      const response = await fetch(
        `/api/admin/scores?password=${encodeURIComponent(password)}&format=csv&eventId=${selectedEventId}`
      )

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `event-${selectedEventId}-scores.csv`
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
        <div className="text-center">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!hasEvents) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting to event creation...</p>
        </div>
      </div>
    )
  }

  const currentEvent = events.find(e => e.id === selectedEventId)

  return (
    <div className="min-h-screen container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#14532D" }}>
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage events, view results, and coordinate judging
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AdminEventSelector onEventChange={handleEventChange} />
          <Button
            onClick={() => {
              deleteCookie('admin-auth')
              deleteCookie('admin-event-id')
              deleteCookie('admin-city-id')
              router.push("/admin")
            }}
            variant="outline"
            size="sm"
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Event Summary */}
      {currentEvent && (
        <Card className="p-6 mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {currentEvent.name}
              </h2>
              <p className="text-sm text-gray-600">
                {currentEvent.city} • {currentEvent.eventDate 
                  ? new Date(currentEvent.eventDate).toLocaleDateString() 
                  : "Date TBD"}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              currentEvent.active 
                ? "bg-green-100 text-green-800" 
                : "bg-gray-100 text-gray-600"
            }`}>
              {currentEvent.active ? "Active" : "Inactive"}
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      {eventStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{eventStats.entryCount}</p>
                <p className="text-xs text-muted-foreground">Total Entries</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{eventStats.approvedEntries}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{eventStats.judgeCount}</p>
                <p className="text-xs text-muted-foreground">Judges</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {eventStats.completedJudges}/{eventStats.judgeCount}
                </p>
                <p className="text-xs text-muted-foreground">Judges Complete</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* View Results */}
          <Link href={`/admin/results${selectedEventId ? `?eventId=${selectedEventId}` : ''}`}>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-300">
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-lg mb-1">View Results</h3>
              <p className="text-sm text-muted-foreground">
                See real-time winners and judge completion status
              </p>
            </Card>
          </Link>

          {/* Manage Events */}
          <Link href="/admin/events">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-300">
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Manage Events</h3>
              <p className="text-sm text-muted-foreground">
                Create, edit, and configure events and scoring
              </p>
            </Card>
          </Link>

          {/* Coordinator Portal */}
          <Link href="/coordinator/positions">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-300">
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Settings className="h-6 w-6 text-purple-600" />
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Coordinator Portal</h3>
              <p className="text-sm text-muted-foreground">
                Approve entries and manage positions
              </p>
            </Card>
          </Link>

          {/* Export Data */}
          <Card 
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-orange-300"
            onClick={handleExportCSV}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Export Data</h3>
            <p className="text-sm text-muted-foreground">
              Download scores and results as CSV
            </p>
          </Card>

          {/* Approve Entries */}
          <Link href="/coordinator/approve">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-red-300">
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 bg-red-100 rounded-lg">
                  <Users className="h-6 w-6 text-red-600" />
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Approve Entries</h3>
              <p className="text-sm text-muted-foreground">
                Review and approve participant submissions
              </p>
            </Card>
          </Link>

          {/* Generate QR Codes */}
          <Link href="/coordinator/qr">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-indigo-300">
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-indigo-600" />
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Judge QR Codes</h3>
              <p className="text-sm text-muted-foreground">
                Generate login QR codes for judges
              </p>
            </Card>
          </Link>
        </div>
      </div>

      {/* Event Details */}
      {currentEvent && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4">Event Configuration</h2>
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-sm text-gray-500 mb-2">Scoring Categories</h3>
                <div className="space-y-1">
                  {currentEvent.categories && currentEvent.categories.length > 0 ? (
                    currentEvent.categories.map((cat) => (
                      <div key={cat.id} className="text-sm">
                        • {cat.categoryName}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No categories configured</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-medium text-sm text-gray-500 mb-2">Judges</h3>
                <div className="space-y-1">
                  {currentEvent.judges && currentEvent.judges.length > 0 ? (
                    currentEvent.judges.map((judge) => (
                      <div key={judge.id} className="text-sm">
                        • {judge.name}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No judges assigned</p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href="/admin/events">
                <Button variant="outline" size="sm">
                  Edit Event Configuration
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
