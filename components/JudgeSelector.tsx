"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { selectJudge } from "@/app/actions"
import { getJudgeIdClient } from "@/lib/cookies-client"
// Note: cityId is read from cookie client-side, no need to import server-side functions

interface Event {
  id: number
  name: string
  city: string
  active: boolean
  judges?: Array<{
    id: number
    name: string
    submitted: boolean
  }>
}

interface Judge {
  id: number
  name: string
  submitted: boolean
}

export function JudgeSelector() {
  const [currentJudgeId, setCurrentJudgeId] = useState<number | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [judges, setJudges] = useState<Judge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get current judge ID from cookie
    const judgeId = getJudgeIdClient()
    setCurrentJudgeId(judgeId)

    // Fetch active events filtered by city
    const fetchEvents = async () => {
      try {
        // Get city ID from cookie (client-side)
        const cookies = document.cookie.split(";")
        const cityCookie = cookies.find((c) => c.trim().startsWith("judge-city-id="))
        const cityId = cityCookie ? parseInt(cityCookie.split("=")[1], 10) : null
        
        const url = cityId && cityId !== 0 && !isNaN(cityId)
          ? `/api/events?cityId=${cityId}`
          : "/api/events"
        
        const response = await fetch(url)
        if (response.ok) {
          const eventsData = await response.json()
          const activeEvents = eventsData.filter((e: Event) => e.active)
          
          if (activeEvents.length === 0) {
            // No active events, show message
            setLoading(false)
            return
          }

          setEvents(activeEvents)

          // If only one active event, auto-select it
          if (activeEvents.length === 1) {
            setSelectedEventId(activeEvents[0].id)
            fetchJudges(activeEvents[0].id)
          }
        }
      } catch (error) {
        console.error("Error fetching events:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const fetchJudges = async (eventId: number) => {
    try {
      // Get city ID from cookie (client-side)
      const cookies = document.cookie.split(";")
      const cityCookie = cookies.find((c) => c.trim().startsWith("judge-city-id="))
      const cityId = cityCookie ? parseInt(cityCookie.split("=")[1], 10) : null
      
      const url = cityId && cityId !== 0 && !isNaN(cityId)
        ? `/api/judges?eventId=${eventId}&cityId=${cityId}`
        : `/api/judges?eventId=${eventId}`
      
      const response = await fetch(url)
      if (response.ok) {
        const judgesData = await response.json()
        setJudges(judgesData)
      }
    } catch (error) {
      console.error("Error fetching judges:", error)
    }
  }

  const handleEventSelect = (eventId: number) => {
    setSelectedEventId(eventId)
    fetchJudges(eventId)
  }

  const handleSelectJudge = async (judgeId: number) => {
    // If selecting the same judge, just navigate to floats
    if (currentJudgeId === judgeId) {
      window.location.href = "/floats"
      return
    }

    setSelecting(true)
    try {
      await selectJudge(judgeId)
      // The redirect in selectJudge will handle navigation
    } catch (error) {
      console.error("Error selecting judge:", error)
      setSelecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-lg">Loading...</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-4xl font-bold text-center mb-8" style={{ color: "#14532D" }}>
          Parade Management System
        </h1>
        <p className="text-lg text-center text-muted-foreground">
          No active events available. Please contact the administrator.
        </p>
      </div>
    )
  }

  // If event not selected yet, show event selector
  if (!selectedEventId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6">
        <h1 className="text-4xl font-bold text-center mb-8" style={{ color: "#14532D" }}>
          Parade Management System
        </h1>
        <p className="text-lg text-center mb-8">Select an event</p>
        <div className="w-full max-w-md space-y-4">
          {events.map((event) => (
            <Button
              key={event.id}
              onClick={() => handleEventSelect(event.id)}
              className="w-full h-20 text-xl bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
            >
              {event.name}
              {event.city && <span className="text-sm ml-2">({event.city})</span>}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  // Show judges for selected event
  const selectedEvent = events.find(e => e.id === selectedEventId)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6">
      <h1 className="text-4xl font-bold text-center mb-8" style={{ color: "#14532D" }}>
        Parade Management System
      </h1>
      
      {selectedEvent && (
        <div className="text-center mb-4">
          <p className="text-lg font-semibold">{selectedEvent.name}</p>
          {selectedEvent.city && (
            <p className="text-sm text-muted-foreground">{selectedEvent.city}</p>
          )}
          {events.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEventId(null)}
              className="mt-2"
            >
              Change Event
            </Button>
          )}
        </div>
      )}

      <p className="text-lg text-center mb-8">Select your judge identity</p>
      
      <div className="w-full max-w-md space-y-4">
        {judges.length === 0 ? (
          <p className="text-center text-muted-foreground">No judges available for this event.</p>
        ) : (
          judges.map((judge) => (
            <Button
              key={judge.id}
              onClick={() => handleSelectJudge(judge.id)}
              disabled={selecting}
              className="w-full h-20 text-xl bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
            >
              {judge.name}
            </Button>
          ))
        )}
      </div>
    </div>
  )
}
