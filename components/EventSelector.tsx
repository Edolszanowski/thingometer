"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Cookies from "js-cookie"

const COORDINATOR_EVENT_ID_COOKIE = "coordinator-event-id"

interface Event {
  id: number
  name: string
  city: string
  eventDate: string | null
  active: boolean
}

interface EventSelectorProps {
  onEventChange?: (eventId: number | null) => void
}

export function EventSelector({ onEventChange }: EventSelectorProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load saved event ID from cookie FIRST, before fetching events
    const savedEventId = Cookies.get(COORDINATOR_EVENT_ID_COOKIE)
    if (savedEventId) {
      const eventId = parseInt(savedEventId, 10)
      if (!isNaN(eventId)) {
        setSelectedEventId(eventId)
        // Don't call onEventChange here - let fetchEvents handle it after events are loaded
      }
    }
    fetchEvents()
  }, [])

  // Re-fetch events if password becomes available (e.g., after login)
  useEffect(() => {
    const password = getAdminPassword()
    if (password && events.length === 0 && !loading) {
      console.log("[EventSelector] Password now available, re-fetching events")
      fetchEvents()
    }
  }, [events.length, loading])

  const fetchEvents = async () => {
    try {
      const password = getAdminPassword()
      if (!password) {
        console.error("[EventSelector] No admin password found in cookie")
        setEvents([])
        setLoading(false)
        return
      }

      const url = `/api/admin/events?password=${encodeURIComponent(password)}`
      console.log("[EventSelector] Fetching events from:", url)
      const response = await fetch(url)
      
      console.log("[EventSelector] Response status:", response.status)
      
      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401) {
          console.error("[EventSelector] Unauthorized - password may be incorrect")
          setEvents([])
          setLoading(false)
          return
        }
        
        // If events table doesn't exist, that's okay - just show empty
        if (response.status === 500) {
          const error = await response.json().catch(() => ({}))
          console.error("[EventSelector] Server error:", error)
          if (error.code === "TABLE_NOT_FOUND") {
            setEvents([])
            setLoading(false)
            return
          }
        }
        
        const errorText = await response.text().catch(() => "Unknown error")
        console.error("[EventSelector] Failed to fetch events:", response.status, errorText)
        throw new Error(`Failed to fetch events: ${response.status}`)
      }

      const data = await response.json()
      console.log("[EventSelector] Received events:", data.length)
      
      // Sort events by date (earliest to latest) - events are already sorted by API, but ensure client-side sort
      const sortedEvents = [...data].sort((a, b) => {
        const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0
        const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0
        return dateA - dateB // Ascending order (earliest first)
      })
      setEvents(sortedEvents)

      // Check if there's already a saved eventId in cookie (use fresh read)
      const savedEventId = Cookies.get(COORDINATOR_EVENT_ID_COOKIE)
      const savedEventIdNum = savedEventId ? parseInt(savedEventId, 10) : null
      let hasValidSavedEvent = false

      // If there's a saved event in cookie, use it (even if state hasn't updated yet)
      if (savedEventIdNum !== null && !isNaN(savedEventIdNum)) {
        const savedEvent = sortedEvents.find((e: Event) => e.id === savedEventIdNum)
        if (savedEvent) {
          hasValidSavedEvent = true
          // Only update if different from current selection to prevent loops
          if (selectedEventId !== savedEventIdNum) {
            setSelectedEventId(savedEventIdNum)
            onEventChange?.(savedEventIdNum)
          }
        } else {
          // Saved event not found in list - clear cookie
          Cookies.remove(COORDINATOR_EVENT_ID_COOKIE)
        }
      }

      // Only auto-select if there's NO valid saved event in cookie AND no event is currently selected
      if (!hasValidSavedEvent && !selectedEventId && sortedEvents.length > 0) {
        // Find the "next" event (earliest future event, or earliest active event if no future dates)
        const now = new Date()
        const nextEvent = sortedEvents.find((e: Event) => {
          if (!e.eventDate) return e.active // If no date, prefer active events
          const eventDate = new Date(e.eventDate)
          return eventDate >= now && e.active
        }) || sortedEvents.find((e: Event) => e.active) || sortedEvents[0]
        
        if (nextEvent && selectedEventId !== nextEvent.id) {
          setSelectedEventId(nextEvent.id)
          Cookies.set(COORDINATOR_EVENT_ID_COOKIE, String(nextEvent.id), { expires: 7 })
          onEventChange?.(nextEvent.id)
        }
      }
    } catch (error) {
      console.error("[EventSelector] Error fetching events:", error)
      toast.error("Failed to load events")
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const handleEventChange = (value: string) => {
    const eventId = value === "none" ? null : parseInt(value, 10)
    setSelectedEventId(eventId)
    
    if (eventId) {
      Cookies.set(COORDINATOR_EVENT_ID_COOKIE, String(eventId), { expires: 7 })
    } else {
      Cookies.remove(COORDINATOR_EVENT_ID_COOKIE)
    }
    
    onEventChange?.(eventId)
  }

  function getAdminPassword(): string | null {
    if (typeof document === "undefined") return null
    const cookies = document.cookie.split(";")
    const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
    return authCookie ? authCookie.split("=")[1] : null
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Loading events...</span>
      </div>
    )
  }

  if (events.length === 0) {
    const password = getAdminPassword()
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {password ? "No events available" : "Not authenticated - please log in"}
        </span>
        {password ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/admin/events", "_blank")}
          >
            Create Event
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = "/admin"}
          >
            Log In
          </Button>
        )}
      </div>
    )
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId)

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">Event:</label>
      <select
        value={selectedEventId ? String(selectedEventId) : "none"}
        onChange={(e) => handleEventChange(e.target.value)}
        className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-[250px]"
      >
        <option value="none">All Events</option>
        {events.map((event) => (
          <option key={event.id} value={String(event.id)}>
            {event.name} {event.active ? "✓" : ""}
          </option>
        ))}
      </select>
      {selectedEvent && (
        <span className="text-xs text-muted-foreground">
          {selectedEvent.city}
        </span>
      )}
    </div>
  )
}

export function getCoordinatorEventId(): number | null {
  if (typeof document === "undefined") return null
  const eventId = Cookies.get(COORDINATOR_EVENT_ID_COOKIE)
  return eventId ? parseInt(eventId, 10) : null
}

