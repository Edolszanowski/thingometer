"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { MapPin, Navigation, CheckCircle, AlertCircle, User } from "lucide-react"
import { EventSelector, getCoordinatorEventId } from "@/components/EventSelector"
import { LocationAssignmentModal } from "@/components/LocationAssignmentModal"

interface LocationData {
  placeId: string
  address: string
  lat: number
  lng: number
  placeName?: string
  instructions?: string
  assignedBy: string
  assignedAt: string
}

interface StandPosition {
  id: number
  positionNumber: number
  locationData?: LocationData
  assignedParticipant?: {
    id: number
    entryName: string
    participantName: string
    approved: boolean
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
  const [positions, setPositions] = useState<StandPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [isLemonadeDay, setIsLemonadeDay] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<StandPosition | null>(null)
  const [filterMode, setFilterMode] = useState<"all" | "unassigned">("unassigned")
  const [initializing, setInitializing] = useState(false)

  useEffect(() => {
    const eventId = getCoordinatorEventId()
    
    if (eventId) {
      setSelectedEventId(eventId)
      fetchPositions(eventId)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchPositions = async (eventId: number) => {
    try {
      const password = getAdminPassword()
      
      if (!password) {
        router.push("/admin")
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
            router.push("/coordinator/approve")
            return
          }
        }
      }

      // Fetch stand positions for this event
      const response = await fetch(
        `/api/coordinator/stand-positions?eventId=${eventId}`
      )

      if (response.status === 401 || response.status === 403) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        // If positions don't exist yet, offer to initialize them
        if (response.status === 404) {
          setPositions([])
          setLoading(false)
          return
        }
        throw new Error("Failed to fetch stand positions")
      }

      const data = await response.json()
      setPositions(data.positions || [])
    } catch (error) {
      console.error("Error fetching positions:", error)
      toast.error("Failed to load stand positions")
    } finally {
      setLoading(false)
    }
  }

  const handleInitializePositions = async () => {
    if (!selectedEventId) return
    
    setInitializing(true)
    try {
      const response = await fetch("/api/coordinator/stand-positions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: selectedEventId,
          count: 50,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to initialize positions" }))
        toast.error(error.error || "Failed to initialize positions")
        return
      }

      toast.success("Stand positions initialized successfully!")
      fetchPositions(selectedEventId)
    } catch (error) {
      console.error("Error initializing positions:", error)
      toast.error("An error occurred. Please try again.")
    } finally {
      setInitializing(false)
    }
  }

  const handleEventChange = (eventId: number | null) => {
    setSelectedEventId(eventId)
    if (eventId !== null) {
      fetchPositions(eventId)
    }
  }

  const handleAssignLocation = (position: StandPosition) => {
    setSelectedPosition(position)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedPosition(null)
  }

  const handleSuccess = () => {
    // Refresh positions list
    if (selectedEventId) {
      fetchPositions(selectedEventId)
    }
  }

  const openDirections = (placeId: string) => {
    // Use Place ID for directions (NOT coordinates)
    const url = `https://www.google.com/maps/dir/?api=1&destination=place_id:${placeId}`
    window.open(url, "_blank")
  }

  // Filter positions based on filter mode
  const filteredPositions = positions.filter((position) => {
    if (filterMode === "unassigned") {
      return !position.locationData
    }
    return true
  })

  const assignedCount = positions.filter((p) => p.locationData).length
  const unassignedCount = positions.length - assignedCount
  const participantCount = positions.filter((p) => p.assignedParticipant).length

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
                Assign GPS locations to stand positions for Lemonade Day
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push("/coordinator")}>
              ← Back to Coordinator
            </Button>
          </div>

          {/* Event Selector */}
          <EventSelector
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
        ) : positions.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-blue-500" />
            <p className="text-lg font-medium mb-2">Stand Positions Not Initialized</p>
            <p className="text-muted-foreground mb-4">
              This event needs stand positions to be created before you can assign locations.
            </p>
            <Button 
              onClick={handleInitializePositions}
              disabled={initializing}
            >
              {initializing ? "Initializing..." : "Initialize 50 Stand Positions"}
            </Button>
          </Card>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Stand Positions</p>
                <p className="text-2xl font-bold">{positions.length}</p>
              </Card>
              <Card className="p-4 bg-green-50 border-green-200">
                <p className="text-sm text-green-700">Locations Assigned</p>
                <p className="text-2xl font-bold text-green-800">{assignedCount}</p>
              </Card>
              <Card className="p-4 bg-amber-50 border-amber-200">
                <p className="text-sm text-amber-700">Needs Location</p>
                <p className="text-2xl font-bold text-amber-800">{unassignedCount}</p>
              </Card>
              <Card className="p-4 bg-blue-50 border-blue-200">
                <p className="text-sm text-blue-700">Participants Assigned</p>
                <p className="text-2xl font-bold text-blue-800">{participantCount}</p>
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
                All Positions ({positions.length})
              </Button>
            </div>

            {/* Positions List */}
            {filteredPositions.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium mb-2">
                  {filterMode === "unassigned"
                    ? "All positions have locations assigned!"
                    : "No positions found"}
                </p>
                <p className="text-muted-foreground">
                  {filterMode === "unassigned"
                    ? "Great work! All stand positions have been assigned locations."
                    : "Stand positions will appear here once initialized."}
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredPositions.map((position) => {
                  const hasLocation = !!position.locationData
                  const hasParticipant = !!position.assignedParticipant
                  
                  // Determine card color
                  let cardClass = "p-4 "
                  if (hasLocation && hasParticipant) {
                    cardClass += "bg-green-50 border-green-200" // Green: Location + Participant
                  } else if (hasLocation && !hasParticipant) {
                    cardClass += "bg-blue-50 border-blue-200" // Blue: Location only
                  } else if (!hasLocation && hasParticipant) {
                    cardClass += "bg-amber-50 border-amber-200" // Amber: Participant only
                  } else {
                    cardClass += "bg-gray-50 border-gray-200" // Gray: Empty
                  }

                  return (
                    <Card
                      key={position.id}
                      className={cardClass}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {hasLocation ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-gray-400" />
                            )}
                            <h3 className="font-semibold text-lg">
                              Stand #{position.positionNumber}
                            </h3>
                            {hasParticipant && (
                              <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                <User className="h-3 w-3" />
                                Participant Assigned
                              </span>
                            )}
                          </div>
                          
                          {hasParticipant && position.assignedParticipant && (
                            <p className="text-sm text-muted-foreground ml-8">
                              Participant: {position.assignedParticipant.participantName}
                              {position.assignedParticipant.entryName && ` - ${position.assignedParticipant.entryName}`}
                            </p>
                          )}
                          
                          {hasLocation && position.locationData && (
                            <div className="ml-8 mt-2 text-sm">
                              <p className="font-medium">
                                {position.locationData.placeName || "Location Assigned"}
                              </p>
                              <p className="text-muted-foreground">
                                {position.locationData.address}
                              </p>
                              {position.locationData.instructions && (
                                <p className="text-xs italic text-gray-600 mt-1">
                                  Note: {position.locationData.instructions}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {hasLocation && position.locationData && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDirections(position.locationData!.placeId)}
                            >
                              <Navigation className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant={hasLocation ? "outline" : "default"}
                            size="sm"
                            onClick={() => handleAssignLocation(position)}
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
      {selectedPosition && (
        <LocationAssignmentModal
          isOpen={modalOpen}
          onClose={handleModalClose}
          positionId={selectedPosition.id}
          positionNumber={selectedPosition.positionNumber}
          participantName={selectedPosition.assignedParticipant?.participantName}
          currentLocation={selectedPosition.locationData}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
