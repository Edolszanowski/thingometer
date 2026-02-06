"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { MapPin, Navigation, CheckCircle, Circle, Map as MapIcon } from "lucide-react"
import { Loader } from "@googlemaps/js-api-loader"

interface Stand {
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
    }
    child?: {
      firstName: string
      lastName: string
    }
    [key: string]: unknown
  }
}

interface ScoreStatus {
  floatId: number
  scored: boolean
}

export default function JudgeMapPage() {
  const router = useRouter()
  const [stands, setStands] = useState<Stand[]>([])
  const [scoredStands, setScoredStands] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [filterMode, setFilterMode] = useState<"all" | "unscored">("all")
  const [selectedStand, setSelectedStand] = useState<Stand | null>(null)
  
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  useEffect(() => {
    fetchStands()
  }, [])

  useEffect(() => {
    if (stands.length > 0 && mapRef.current && !mapInstanceRef.current) {
      initMap()
    }
  }, [stands])

  const fetchStands = async () => {
    try {
      setLoading(true)

      // Fetch approved floats
      const floatsResponse = await fetch("/api/floats")
      if (!floatsResponse.ok) {
        throw new Error("Failed to fetch stands")
      }

      const floatsData = await floatsResponse.json()
      const approvedStands = floatsData.floats?.filter((f: Stand) => f.approved) || []
      
      // Filter for stands with assigned locations
      const standsWithLocations = approvedStands.filter(
        (s: Stand) => s.metadata?.assignedLocation?.lat && s.metadata?.assignedLocation?.lng
      )
      
      setStands(standsWithLocations)

      // Fetch judge's scores to determine which stands have been scored
      const scoresResponse = await fetch("/api/scores")
      if (scoresResponse.ok) {
        const scoresData = await scoresResponse.json()
        const scoredIds = new Set<number>(scoresData.scores?.map((s: any) => s.floatId as number) || [])
        setScoredStands(scoredIds)
      }
    } catch (error) {
      console.error("Error fetching stands:", error)
      toast.error("Failed to load stands")
    } finally {
      setLoading(false)
    }
  }

  const initMap = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY_HERE") {
        toast.error("Google Maps API key not configured")
        return
      }

      const loader = new Loader({
        apiKey,
        version: "weekly",
      })

      await loader.loadScript()
      
      const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary
      const { AdvancedMarkerElement: Marker } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary

      // Calculate center point from all stands
      const validStands = stands.filter(
        (s) => s.metadata?.assignedLocation?.lat && s.metadata?.assignedLocation?.lng
      )

      if (validStands.length === 0) {
        toast.error("No stands with locations found")
        return
      }

      const avgLat =
        validStands.reduce((sum, s) => sum + (s.metadata!.assignedLocation!.lat || 0), 0) /
        validStands.length
      const avgLng =
        validStands.reduce((sum, s) => sum + (s.metadata!.assignedLocation!.lng || 0), 0) /
        validStands.length

      // Initialize map
      const map = new Map(mapRef.current!, {
        center: { lat: avgLat, lng: avgLng },
        zoom: 13,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: false,
      })

      mapInstanceRef.current = map

      // Create info window
      const infoWindow = new google.maps.InfoWindow()
      infoWindowRef.current = infoWindow

      // CRITICAL SAFETY: Markers created from stored metadata only (NO geocoding, NO click handlers)
      validStands.forEach((stand) => {
        const location = stand.metadata!.assignedLocation!
        const isScored = scoredStands.has(stand.id)
        const participantName = stand.metadata?.child
          ? `${stand.metadata.child.firstName} ${stand.metadata.child.lastName}`
          : `${stand.firstName || ""} ${stand.lastName || ""}`.trim() || "Unknown"

        const marker = new Marker({
          position: { lat: location.lat!, lng: location.lng! },
          map,
          label: {
            text: String(stand.floatNumber || "?"),
            color: "white",
            fontWeight: "bold",
          },
          title: stand.entryName || "Lemonade Stand",
          // Color code: green if scored, yellow if unscored
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: isScored ? "#10B981" : "#FBBF24",
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: 2,
          },
        })

        // Add click listener to show info window
        marker.addListener("click", () => {
          const content = `
            <div style="padding: 8px; max-width: 250px;">
              <h3 style="font-weight: bold; margin-bottom: 4px;">
                Stand #${stand.floatNumber || "?"}: ${stand.entryName || "Lemonade Stand"}
              </h3>
              <p style="font-size: 14px; color: #666; margin-bottom: 8px;">
                ${participantName}
              </p>
              <p style="font-size: 13px; color: #333; margin-bottom: 8px;">
                ${location.address}
              </p>
              ${
                location.instructions
                  ? `<p style="font-size: 12px; color: #666; font-style: italic; margin-bottom: 8px;">
                      ${location.instructions}
                    </p>`
                  : ""
              }
              <div style="display: flex; gap: 8px; margin-top: 12px;">
                <button 
                  onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=place_id:${location.placeId}', '_blank')"
                  style="padding: 6px 12px; background: #3B82F6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
                >
                  Navigate
                </button>
                <button 
                  onclick="window.location.href='/float/${stand.id}'"
                  style="padding: 6px 12px; background: ${isScored ? "#10B981" : "#FBBF24"}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;"
                >
                  ${isScored ? "View Score" : "Score Stand"}
                </button>
              </div>
            </div>
          `
          infoWindow.setContent(content)
          infoWindow.open(map, marker)
          setSelectedStand(stand)
        })

        markersRef.current.push(marker)
      })

      setMapLoaded(true)
    } catch (error) {
      console.error("Error loading Google Maps:", error)
      toast.error("Failed to load map. Please check your internet connection.")
    }
  }

  const openDirections = (placeId: string) => {
    // CRITICAL SAFETY: Use Place ID for directions, NOT coordinates
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=place_id:${placeId}`,
      "_blank"
    )
  }

  // Filter stands based on filter mode
  const filteredStands = stands.filter((stand) => {
    if (filterMode === "unscored") {
      return !scoredStands.has(stand.id)
    }
    return true
  })

  const unscoredCount = stands.filter((s) => !scoredStands.has(s.id)).length

  if (loading) {
    return (
      <div className="min-h-screen p-4 bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading stands...</p>
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
                <MapIcon className="h-8 w-8" />
                Lemonade Day Stands Map
              </h1>
              <p className="text-muted-foreground mt-1">
                View all stand locations and plan your judging route
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push("/judge")}>
              ← Back to Judging
            </Button>
          </div>
        </div>

        {stands.length === 0 ? (
          <Card className="p-8 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">No Stand Locations Assigned Yet</p>
            <p className="text-muted-foreground">
              Stand locations will appear here once the coordinator assigns them.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map Panel */}
            <div className="lg:col-span-2">
              <Card className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Map View</h2>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-muted-foreground">Scored</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                      <span className="text-muted-foreground">Unscored</span>
                    </div>
                  </div>
                </div>
                <div
                  ref={mapRef}
                  className="w-full h-96 lg:h-[600px] rounded-lg border border-gray-300"
                />
                {!mapLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                    <p className="text-muted-foreground">Loading map...</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Stands List Panel */}
            <div className="lg:col-span-1">
              <Card className="p-4">
                <div className="mb-4">
                  <h2 className="font-semibold text-lg mb-3">Stands</h2>
                  
                  {/* Filter Buttons */}
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant={filterMode === "all" ? "default" : "outline"}
                      onClick={() => setFilterMode("all")}
                      size="sm"
                      className="flex-1"
                    >
                      All ({stands.length})
                    </Button>
                    <Button
                      variant={filterMode === "unscored" ? "default" : "outline"}
                      onClick={() => setFilterMode("unscored")}
                      size="sm"
                      className="flex-1"
                    >
                      Unscored ({unscoredCount})
                    </Button>
                  </div>
                </div>

                {/* Scrollable stands list */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredStands.map((stand) => {
                    const isScored = scoredStands.has(stand.id)
                    const location = stand.metadata?.assignedLocation
                    const participantName = stand.metadata?.child
                      ? `${stand.metadata.child.firstName} ${stand.metadata.child.lastName}`
                      : `${stand.firstName || ""} ${stand.lastName || ""}`.trim() || "Unknown"

                    return (
                      <Card
                        key={stand.id}
                        className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
                          selectedStand?.id === stand.id ? "ring-2 ring-blue-500" : ""
                        }`}
                        onClick={() => setSelectedStand(stand)}
                      >
                        <div className="flex items-start gap-2">
                          {isScored ? (
                            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">
                              #{stand.floatNumber || "?"} {stand.entryName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {participantName}
                            </p>
                            {location && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {location.placeName || location.address}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {location && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                openDirections(location.placeId)
                              }}
                            >
                              <Navigation className="h-3 w-3 mr-1" />
                              Navigate
                            </Button>
                          )}
                          <Button
                            variant={isScored ? "outline" : "default"}
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/float/${stand.id}`)
                            }}
                          >
                            {isScored ? "View" : "Score"}
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Offline Fallback Message */}
        {stands.length > 0 && !mapLoaded && (
          <Card className="mt-4 p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Map unavailable:</strong> You can still navigate to stands using the "Navigate" buttons in the list above.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
