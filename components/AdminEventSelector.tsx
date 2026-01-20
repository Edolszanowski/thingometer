"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import Cookies from "js-cookie"

const ADMIN_EVENT_ID_COOKIE = "admin-event-id"

interface Event {
  id: number
  name: string
  city: string
  eventDate: string | null
  active: boolean
}

interface AdminEventSelectorProps {
  onEventChange?: (eventId: number | null, eventName?: string) => void
}

function getAdminPassword(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return authCookie ? authCookie.split("=")[1] : null
}

export function AdminEventSelector({ onEventChange }: AdminEventSelectorProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
    // Load saved event ID from cookie, or default to active event
    const savedEventId = Cookies.get(ADMIN_EVENT_ID_COOKIE)
    if (savedEventId) {
      const eventId = parseInt(savedEventId, 10)
      if (!isNaN(eventId)) {
        setSelectedEventId(eventId)
        // Don't call onEventChange here - let the parent handle initialization
      }
    }
  }, [])

  const fetchEvents = async () => {
    try {
      const password = getAdminPassword()
      if (!password) {
        console.log("[AdminEventSelector] No admin password found")
        setLoading(false)
        return
      }

      console.log("[AdminEventSelector] Fetching events...")
      const response = await fetch(`/api/admin/events?password=${encodeURIComponent(password)}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
      
      console.log(`[AdminEventSelector] Response status: ${response.status}`)
      
      if (!response.ok) {
        // If events table doesn't exist, that's okay - just show empty
        if (response.status === 500) {
          const error = await response.json().catch(() => ({}))
          console.log("[AdminEventSelector] Error response:", error)
          if (error.code === "TABLE_NOT_FOUND") {
            console.log("[AdminEventSelector] Events table not found, showing empty list")
            setEvents([])
            setLoading(false)
            return
          }
        }
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`[AdminEventSelector] Failed to fetch events: ${response.status} - ${errorText}`)
        throw new Error(`Failed to fetch events: ${response.status}`)
      }

      const data = await response.json()
      console.log(`[AdminEventSelector] Received ${Array.isArray(data) ? data.length : 'non-array'} events`)
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error("[AdminEventSelector] Response is not an array:", data)
        setEvents([])
        setLoading(false)
        return
      }
      
      // Map the response to match Event interface (API returns events with categories/judges)
      const eventsData: Event[] = data.map((e: any) => ({
        id: e.id,
        name: e.name,
        city: e.city,
        eventDate: e.eventDate,
        active: e.active ?? true,
      }))
      
      console.log(`[AdminEventSelector] Mapped ${eventsData.length} events:`, eventsData.map((e: Event) => ({ id: e.id, name: e.name, active: e.active })))
      setEvents(eventsData)

      // If no event is selected, default to active event
      const savedEventId = Cookies.get(ADMIN_EVENT_ID_COOKIE)
      if (!savedEventId && data.length > 0) {
        const activeEvent = data.find((e: Event) => e.active) || data[0]
        if (activeEvent && !selectedEventId) {
          setSelectedEventId(activeEvent.id)
          Cookies.set(ADMIN_EVENT_ID_COOKIE, String(activeEvent.id), { expires: 7 })
          onEventChange?.(activeEvent.id, activeEvent.name)
        }
      } else if (savedEventId) {
        const eventId = parseInt(savedEventId, 10)
        if (!isNaN(eventId) && eventId !== selectedEventId) {
          setSelectedEventId(eventId)
          const event = eventsData.find(e => e.id === eventId)
          onEventChange?.(eventId, event?.name)
        }
      }
    } catch (error) {
      console.error("Error fetching events:", error)
      toast.error("Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  const handleEventChange = (value: string) => {
    const eventId = value === "none" ? null : parseInt(value, 10)
    setSelectedEventId(eventId)
    
    if (eventId) {
      Cookies.set(ADMIN_EVENT_ID_COOKIE, String(eventId), { expires: 7 })
    } else {
      Cookies.remove(ADMIN_EVENT_ID_COOKIE)
    }
    
    const event = events.find(e => e.id === eventId)
    onEventChange?.(eventId, event?.name)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Loading events...</span>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">No events available</span>
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

export function getAdminEventId(): number | null {
  if (typeof document === "undefined") return null
  const eventId = Cookies.get(ADMIN_EVENT_ID_COOKIE)
  return eventId ? parseInt(eventId, 10) : null
}

