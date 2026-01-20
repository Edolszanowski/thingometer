"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"

interface Event {
  id: number
  name: string
  city: string
  eventDate: string | null
  active: boolean
}

export default function SelectEventPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)

  useEffect(() => {
    fetchActiveEvents()
  }, [])

  const fetchActiveEvents = async () => {
    try {
      // Public endpoint for active events
      const response = await fetch("/api/events")
      
      if (!response.ok) {
        // If events table doesn't exist, that's okay - just show no events
        if (response.status === 500) {
          const error = await response.json().catch(() => ({}))
          if (error.code === "TABLE_NOT_FOUND") {
            setEvents([])
            setLoading(false)
            return
          }
        }
        throw new Error("Failed to fetch events")
      }

      const allEvents = await response.json()
      // API already filters for active events, but double-check in case
      const activeEvents = allEvents.filter((e: Event) => e.active === true)
      
      console.log(`[SelectEventPage] Received ${allEvents.length} events, ${activeEvents.length} are active`)
      setEvents(activeEvents)

      // If only one active event, automatically select it and proceed
      if (activeEvents.length === 1) {
        setSelectedEventId(activeEvents[0].id)
        // Auto-proceed to signup form
        router.push(`/signup?eventId=${activeEvents[0].id}`)
      }
    } catch (error) {
      console.error("Error fetching events:", error)
      toast.error("Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectEvent = (eventId: number) => {
    setSelectedEventId(eventId)
    router.push(`/signup?eventId=${eventId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen p-4 bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#DC2626" }} />
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="min-h-screen p-4 bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#DC2626" }}>
              No Active Events
            </h1>
            <p className="text-muted-foreground mb-4">
              There are currently no active parade events available for registration.
            </p>
            <p className="text-sm text-muted-foreground">
              An administrator needs to create an event first before participants can sign up.
            </p>
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="w-full"
            >
              Return to Home
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="container mx-auto max-w-2xl">
        <Card className="p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#DC2626" }}>
              Select Parade Event
            </h1>
            <p className="text-muted-foreground">
              Please select the parade event you would like to register for.
            </p>
          </div>

          <div className="space-y-3">
            {events.map((event) => (
              <Card
                key={event.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedEventId === event.id
                    ? "border-2"
                    : "border"
                }`}
                style={{
                  borderColor: selectedEventId === event.id ? "#DC2626" : undefined,
                }}
                onClick={() => handleSelectEvent(event.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1">{event.name}</h3>
                    <p className="text-sm text-muted-foreground">{event.city}</p>
                    {event.eventDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(event.eventDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectEvent(event.id)
                    }}
                    className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
                  >
                    Select
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-6">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

