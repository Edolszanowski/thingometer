"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { Search, Plus, X } from "lucide-react"
import { getCoordinatorEventId } from "./EventSelector"

interface Participant {
  id: number
  organization: string
  firstName: string | null
  lastName: string | null
  title: string | null
  phone: string | null
  email: string | null
  entryName: string | null
  typeOfEntry: string | null
}

interface ParticipantLookupProps {
  onParticipantAdded?: () => void
}

export function ParticipantLookup({ onParticipantAdded }: ParticipantLookupProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  function getAdminPassword(): string | null {
    if (typeof document === "undefined") return null
    const cookies = document.cookie.split(";")
    const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
    return authCookie ? authCookie.split("=")[1] : null
  }

  const searchParticipants = async () => {
    if (!searchQuery.trim()) {
      setParticipants([])
      setShowResults(false)
      return
    }

    setLoading(true)
    try {
      const password = getAdminPassword()
      if (!password) {
        toast.error("Not authenticated")
        return
      }

      const response = await fetch(
        `/api/coordinator/participants?password=${encodeURIComponent(password)}&q=${encodeURIComponent(searchQuery)}&limit=10`
      )

      if (response.status === 401) {
        toast.error("Not authenticated")
        return
      }

      if (!response.ok) {
        throw new Error("Failed to search participants")
      }

      const data = await response.json()
      setParticipants(data)
      setShowResults(true)
    } catch (error) {
      console.error("Error searching participants:", error)
      toast.error("Failed to search participants")
    } finally {
      setLoading(false)
    }
  }

  const addParticipant = async (participant: Participant) => {
    try {
      const password = getAdminPassword()
      if (!password) {
        toast.error("Not authenticated")
        return
      }

      const eventId = getCoordinatorEventId()

      const response = await fetch(
        `/api/coordinator/participants?password=${encodeURIComponent(password)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participantId: participant.id, // For backward compatibility
            organization: participant.organization,
            email: participant.email,
            firstName: participant.firstName,
            lastName: participant.lastName,
            title: participant.title,
            phone: participant.phone,
            entryName: participant.entryName,
            typeOfEntry: participant.typeOfEntry,
            eventId: eventId,
          }),
        }
      )

      if (response.status === 401) {
        toast.error("Not authenticated")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to add participant")
        return
      }

      toast.success(`Added ${participant.organization} to entries`)
      setSearchQuery("")
      setParticipants([])
      setShowResults(false)
      onParticipantAdded?.()
    } catch (error) {
      console.error("Error adding participant:", error)
      toast.error("Failed to add participant")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      searchParticipants()
    }
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Search previous participants..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            if (e.target.value.trim()) {
              searchParticipants()
            } else {
              setParticipants([])
              setShowResults(false)
            }
          }}
          onKeyPress={handleKeyPress}
          className="w-64"
        />
        <Button
          onClick={searchParticipants}
          disabled={loading}
          variant="outline"
          size="icon"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {showResults && participants.length > 0 && (
        <Card className="absolute z-10 mt-2 w-full max-w-md max-h-96 overflow-y-auto shadow-lg">
          <div className="p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {participants.length} result{participants.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowResults(false)
                  setParticipants([])
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {participants.map((participant) => (
                <Card
                  key={participant.id}
                  className="p-3 hover:bg-muted cursor-pointer"
                  onClick={() => addParticipant(participant)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{participant.organization}</div>
                      {participant.entryName && (
                        <div className="text-sm text-muted-foreground italic">
                          {participant.entryName}
                        </div>
                      )}
                      {(participant.firstName || participant.lastName) && (
                        <div className="text-xs text-muted-foreground">
                          {participant.firstName} {participant.lastName}
                          {participant.title && ` (${participant.title})`}
                        </div>
                      )}
                      {participant.typeOfEntry && (
                        <div className="text-xs text-muted-foreground">
                          Type: {participant.typeOfEntry}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        addParticipant(participant)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Card>
      )}

      {showResults && participants.length === 0 && searchQuery.trim() && !loading && (
        <Card className="absolute z-10 mt-2 w-full max-w-md shadow-lg p-4">
          <p className="text-sm text-muted-foreground text-center">
            No participants found
          </p>
        </Card>
      )}
    </div>
  )
}

