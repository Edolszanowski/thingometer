"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { MapPin, Navigation, CheckCircle, AlertCircle } from "lucide-react"
import { EventSelector, getCoordinatorEventId } from "@/components/EventSelector"
import { LocationAssignmentModal } from "@/components/LocationAssignmentModal"

interface Entry {
  id: number
  floatNumber: number | null
  entryName: string | null
  firstName: string | null
  lastName: string | null
  organization: string
  approved: boolean
  metadata?: {
    assignedLocation?: {
      placeId: string
      address: string
      lat?: number
      lng?: number
      placeName?: string
      instructions?: string
      assignedBy: string
      assignedAt: string
    }
    child?: {
      firstName: string
      lastName: string
    }
    [key: string]: unknown
  }
}

function getAdminPassword(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return authCookie ? authCookie.split("=")[1] : null
}

export default function CoordinatorLocationsPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [isLemonadeDay, setIsLemonadeDay] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [filterMode, setFilterMode] = useState<"all" | "unassigned">("unassigned")

  useEffect(() => {
    const eventId = getCoordinatorEventId()
    if (eventId) {
      setSelectedEventId(eventId)
      fetchEntries(eventId)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchEntries = async (eventId: number) => {
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      setLoading(true)

      // Fetch event details to check if it's Lemonade Day
      const eventsResponse = await fetch("/api/events")
      if (eventsResponse.ok) {
        const events = await eventsResponse.json()
        const event = events.find((e: any) => e.id === eventId)
        if (event) {
          const isLD = event.type === "lemonade_day"
          setIsLemonadeDay(isLD)
          
          if (!isLD) {
            toast.error("Stand locations are only available for Lemonade Day events")
            router.push("/coordinator")
            return
          }
        }
      }

      // Fetch approved entries for this event
      const response = await fetch(
        `/api/coordinator/floats?password=${encodeURIComponent(password)}&eventId=${eventId}`
      )

      if (response.status === 401) {
        router.push("/admin/dashboard")
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch entries")
      }

      const data = await response.json()
      // Filter for approved entries only
      const approvedEntries = data.floats?.filter((e: Entry) => e.approved) || []
      setEntries(approvedEntries)
    } catch (error) {
      console.error("Error fetching entries:", error)
      toast.error("Failed to load entries")
    } finally {
      setLoading(false)
    }
  }

  const handleEventChange = (eventId: number) => {
    setSelectedEventId(eventId)
    fetchEntries(eventId)
  }

  const handleAssignLocation = (entry: Entry) => {
    setSelectedEntry(entry)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedEntry(null)
  }

  const handleSuccess = () => {
    // Refresh entries list
    if (selectedEventId) {
      fetchEntries(selectedEventId)
    }
  }

  const openDirections = (placeId: string) => {
    // Use Place ID for directions (NOT coordinates)
    const url = `https://www.google.com/maps/dir/?api=1&destination=place_id:${placeId}`
    window.open(url, "_blank")
  }

  // Filter entries based on filter mode
  const filteredEntries = entries.filter((entry) => {
    if (filterMode === "unassigned") {
      return !entry.metadata?.assignedLocation
    }
    return true
  })

  const assignedCount = entries.filter((e) => e.metadata?.assignedLocation).length
  const unassignedCount = entries.length - assignedCount

  if (loading) {
    return (
      <div className="min-h-screen p-4 bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: "#FBBF24" }}>
                <MapPin className="h-8 w-8" />
                Stand Locations
              </h1>
              <p className="text-muted-foreground mt-1">
                Assign GPS locations to approved Lemonade Day stands
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push("/coordinator")}>
              ← Back to Coordinator
            </Button>
          </div>

          {/* Event Selector */}
          <EventSelector
            selectedEventId={selectedEventId}
            onEventChange={handleEventChange}
          />
        </div>

        {!selectedEventId ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Please select an event to manage stand locations.</p>
          </Card>
        ) : !isLemonadeDay ? (
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <p className="text-lg font-medium mb-2">Stand Locations Not Available</p>
            <p className="text-muted-foreground">
              Stand location assignment is only available for Lemonade Day events.
            </p>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Approved Stands</p>
                <p className="text-2xl font-bold">{entries.length}</p>
              </Card>
              <Card className="p-4 bg-green-50 border-green-200">
                <p className="text-sm text-green-700">Locations Assigned</p>
                <p className="text-2xl font-bold text-green-800">{assignedCount}</p>
              </Card>
              <Card className="p-4 bg-amber-50 border-amber-200">
                <p className="text-sm text-amber-700">Needs Location</p>
                <p className="text-2xl font-bold text-amber-800">{unassignedCount}</p>
              </Card>
            </div>

            {/* Filter */}
            <div className="mb-4 flex gap-2">
              <Button
                variant={filterMode === "unassigned" ? "default" : "outline"}
                onClick={() => setFilterMode("unassigned")}
                size="sm"
              >
                Unassigned ({unassignedCount})
              </Button>
              <Button
                variant={filterMode === "all" ? "default" : "outline"}
                onClick={() => setFilterMode("all")}
                size="sm"
              >
                All Stands ({entries.length})
              </Button>
            </div>

            {/* Entries List */}
            {filteredEntries.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium mb-2">
                  {filterMode === "unassigned"
                    ? "All stands have locations assigned!"
                    : "No approved stands found"}
                </p>
                <p className="text-muted-foreground">
                  {filterMode === "unassigned"
                    ? "Great work! All approved stands have been assigned locations."
                    : "Approved stands will appear here once participants register and are approved."}
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((entry) => {
                  const hasLocation = !!entry.metadata?.assignedLocation
                  const childName = entry.metadata?.child
                    ? `${entry.metadata.child.firstName} ${entry.metadata.child.lastName}`
                    : `${entry.firstName || ""} ${entry.lastName || ""}`.trim() || "Unknown"

                  return (
                    <Card
                      key={entry.id}
                      className={`p-4 ${
                        hasLocation
                          ? "bg-green-50 border-green-200"
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {hasLocation ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-amber-600" />
                            )}
                            <h3 className="font-semibold text-lg">
                              {entry.floatNumber ? `Stand #${entry.floatNumber}` : "Pending #"}
                              {entry.entryName && ` - ${entry.entryName}`}
                            </h3>
                          </div>
                          <p className="text-sm text-muted-foreground ml-8">
                            Participant: {childName}
                          </p>
                          {hasLocation && entry.metadata?.assignedLocation && (
                            <div className="ml-8 mt-2 text-sm">
                              <p className="font-medium">
                                {entry.metadata.assignedLocation.placeName || "Location Assigned"}
                              </p>
                              <p className="text-muted-foreground">
                                {entry.metadata.assignedLocation.address}
                              </p>
                              {entry.metadata.assignedLocation.instructions && (
                                <p className="text-xs italic text-gray-600 mt-1">
                                  Note: {entry.metadata.assignedLocation.instructions}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {hasLocation && entry.metadata?.assignedLocation && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDirections(entry.metadata!.assignedLocation!.placeId)}
                            >
                              <Navigation className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant={hasLocation ? "outline" : "default"}
                            size="sm"
                            onClick={() => handleAssignLocation(entry)}
                          >
                            <MapPin className="h-4 w-4 mr-1" />
                            {hasLocation ? "Edit" : "Assign"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Location Assignment Modal */}
      {selectedEntry && (
        <LocationAssignmentModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          entryId={selectedEntry.id}
          entryName={selectedEntry.entryName || "Lemonade Stand"}
          participantName={
            selectedEntry.metadata?.child
              ? `${selectedEntry.metadata.child.firstName} ${selectedEntry.metadata.child.lastName}`
              : `${selectedEntry.firstName || ""} ${selectedEntry.lastName || ""}`.trim() || "Unknown"
          }
          currentLocation={selectedEntry.metadata?.assignedLocation}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
