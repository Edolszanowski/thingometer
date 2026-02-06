"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader } from "@googlemaps/js-api-loader"
import { MapPin, Navigation } from "lucide-react"

interface LocationData {
  placeId: string
  address: string
  lat?: number
  lng?: number
  placeName?: string
  instructions?: string
  assignedBy?: string
  assignedAt?: string
}

interface LocationAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  entryId: number
  entryName: string
  participantName: string
  currentLocation?: LocationData
  onSuccess: () => void
}

export function LocationAssignmentModal({
  isOpen,
  onClose,
  entryId,
  entryName,
  participantName,
  currentLocation,
  onSuccess,
}: LocationAssignmentModalProps) {
  const [loading, setLoading] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [locationData, setLocationData] = useState<Partial<LocationData>>({
    placeId: currentLocation?.placeId || "",
    address: currentLocation?.address || "",
    lat: currentLocation?.lat,
    lng: currentLocation?.lng,
    placeName: currentLocation?.placeName || "",
    instructions: currentLocation?.instructions || "",
  })

  const mapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    if (!isOpen || !mapRef.current) return

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
          libraries: ["places", "geocoding"],
        })

        // Load Maps library
        // @ts-ignore - Loader.importLibrary exists but TypeScript doesn't recognize it
        const { Map } = await loader.importLibrary("maps") as google.maps.MapsLibrary
        // @ts-ignore - Loader.importLibrary exists but TypeScript doesn't recognize it
        const { Marker } = await loader.importLibrary("marker") as google.maps.MarkerLibrary

        // Initialize map centered on Boerne, TX (or current location if available)
        const center = locationData.lat && locationData.lng
          ? { lat: locationData.lat, lng: locationData.lng }
          : { lat: 29.7949, lng: -98.7319 } // Boerne, TX default

        const map = new Map(mapRef.current!, {
          center,
          zoom: 15,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: false,
        })

        mapInstanceRef.current = map

        // Add existing marker if location is set
        if (locationData.lat && locationData.lng) {
          const marker = new Marker({
            position: { lat: locationData.lat, lng: locationData.lng },
            map,
            draggable: true,
          })
          markerRef.current = marker

          // Update location when marker is dragged
          marker.addListener("dragend", async () => {
            const position = marker.getPosition()
            if (position) {
              const lat = position.lat()
              const lng = position.lng()
              await reverseGeocode(lat, lng)
            }
          })
        }

        // Add click listener for placing marker
        map.addListener("click", async (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const lat = e.latLng.lat()
            const lng = e.latLng.lng()
            placeMarker(lat, lng)
            await reverseGeocode(lat, lng)
          }
        })

        // Initialize autocomplete
        if (searchInputRef.current) {
          // @ts-ignore - Loader.importLibrary exists but TypeScript doesn't recognize it
          const { Autocomplete } = await loader.importLibrary("places") as google.maps.PlacesLibrary
          const autocomplete = new Autocomplete(searchInputRef.current, {
            types: ["address"],
            componentRestrictions: { country: "us" },
          })
          autocompleteRef.current = autocomplete

          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace()
            if (place.geometry?.location && place.place_id) {
              const lat = place.geometry.location.lat()
              const lng = place.geometry.location.lng()
              
              // CRITICAL: Capture Place ID as PRIMARY reference
              setLocationData({
                placeId: place.place_id,  // PRIMARY
                address: place.formatted_address || "",
                lat,  // CACHE ONLY
                lng,  // CACHE ONLY
                placeName: locationData.placeName,
                instructions: locationData.instructions,
              })

              map.setCenter({ lat, lng })
              placeMarker(lat, lng)
            }
          })
        }

        setMapLoaded(true)
      } catch (error) {
        console.error("Error loading Google Maps:", error)
        toast.error("Failed to load map. You can still enter address manually.")
      }
    }

    initMap()

    return () => {
      // Cleanup
      if (markerRef.current) {
        markerRef.current.setMap(null)
      }
    }
  }, [isOpen])

  const placeMarker = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null)
    }

    // Create new marker
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      draggable: true,
    })

    markerRef.current = marker

    // Update location when marker is dragged
    marker.addListener("dragend", async () => {
      const position = marker.getPosition()
      if (position) {
        const newLat = position.lat()
        const newLng = position.lng()
        await reverseGeocode(newLat, newLng)
      }
    })
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const geocoder = new google.maps.Geocoder()
      const result = await geocoder.geocode({ location: { lat, lng } })
      
      if (result.results[0]) {
        // CRITICAL: Capture Place ID from reverse geocoding
        setLocationData(prev => ({
          ...prev,
          placeId: result.results[0].place_id,  // PRIMARY
          address: result.results[0].formatted_address,
          lat,  // CACHE ONLY
          lng,  // CACHE ONLY
        }))
      }
    } catch (error) {
      console.error("Reverse geocoding error:", error)
      toast.error("Could not determine address for this location")
    }
  }

  const handleSave = async () => {
    // Validate required fields
    if (!locationData.placeId || !locationData.address) {
      toast.error("Please select a location on the map or search for an address")
      return
    }

    if (!locationData.lat || !locationData.lng) {
      toast.error("Location coordinates are missing")
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/coordinator/locations/${entryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          placeId: locationData.placeId,  // PRIMARY
          address: locationData.address,
          lat: locationData.lat,  // CACHE
          lng: locationData.lng,  // CACHE
          placeName: locationData.placeName || null,
          instructions: locationData.instructions || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to assign location" }))
        toast.error(error.error || "Failed to assign location")
        setLoading(false)
        return
      }

      toast.success("Stand location assigned successfully!")
      onSuccess()
      onClose()
    } catch (error) {
      console.error("Error assigning location:", error)
      toast.error("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Assign Stand Location
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {entryName} - {participantName}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Address Search */}
          <div>
            <label htmlFor="addressSearch" className="block text-sm font-medium mb-1">
              Search Address
            </label>
            <Input
              id="addressSearch"
              ref={searchInputRef}
              placeholder="Search for an address..."
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Type an address or click on the map below
            </p>
          </div>

          {/* Google Map */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Map Location
            </label>
            <div
              ref={mapRef}
              className="w-full h-96 rounded-lg border border-gray-300"
              style={{ minHeight: "400px" }}
            />
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                <p className="text-muted-foreground">Loading map...</p>
              </div>
            )}
          </div>

          {/* Selected Address Display */}
          {locationData.address && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900">Selected Address:</p>
              <p className="text-sm text-blue-800">{locationData.address}</p>
              {locationData.lat && locationData.lng && (
                <p className="text-xs text-blue-600 mt-1">
                  Coordinates: {locationData.lat.toFixed(6)}, {locationData.lng.toFixed(6)}
                </p>
              )}
            </div>
          )}

          {/* Place Name (Optional) */}
          <div>
            <label htmlFor="placeName" className="block text-sm font-medium mb-1">
              Place Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="placeName"
              value={locationData.placeName || ""}
              onChange={(e) => setLocationData({ ...locationData, placeName: e.target.value })}
              placeholder="e.g., Downtown Park, Main Street Corner"
            />
            <p className="text-xs text-muted-foreground mt-1">
              A friendly name for this location
            </p>
          </div>

          {/* Instructions (Optional) */}
          <div>
            <label htmlFor="instructions" className="block text-sm font-medium mb-1">
              Instructions for Participant <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="instructions"
              value={locationData.instructions || ""}
              onChange={(e) => setLocationData({ ...locationData, instructions: e.target.value })}
              placeholder="e.g., Near the fountain on the east side, Look for the blue tent"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Helpful details to help participants find their exact spot
            </p>
          </div>

          {/* Preview */}
          {locationData.address && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
              <h4 className="font-semibold text-amber-900 mb-2">Preview (What Participant Will See)</h4>
              <p className="font-medium text-amber-900">
                {locationData.placeName || "Assigned Stand Location"}
              </p>
              <p className="text-sm text-amber-800 mt-1">
                {locationData.address}
              </p>
              {locationData.instructions && (
                <p className="text-sm italic text-amber-700 mt-2 p-2 bg-amber-100 rounded">
                  <strong>Instructions:</strong> {locationData.instructions}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  if (locationData.placeId) {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=place_id:${locationData.placeId}`,
                      "_blank"
                    )
                  }
                }}
              >
                <Navigation className="h-4 w-4 mr-1" />
                Get Directions (Preview)
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !locationData.placeId || !locationData.address}
          >
            {loading ? "Saving..." : currentLocation ? "Update Location" : "Assign Location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
