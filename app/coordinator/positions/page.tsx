"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { ArrowUp, ArrowDown, Save, RefreshCw, Trash2, Plus, MapPin } from "lucide-react"
import { EventSelector, getCoordinatorEventId } from "@/components/EventSelector"
import { ParticipantLookup } from "@/components/ParticipantLookup"
import { useRealtimeCallback } from "@/hooks/useRealtimeData"
import { getLabelsForEvent } from "@/app/actions"
import { getDefaultLabels } from "@/lib/labels"
import type { UiLabels } from "@/lib/labels"

interface Float {
  id: number
  floatNumber: number | null
  organization: string
  entryName: string | null
  approved: boolean
}

function getAdminPassword(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return authCookie ? authCookie.split("=")[1] : null
}

export default function CoordinatorPositionsPage() {
  const router = useRouter()
  const [floats, setFloats] = useState<Float[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [editValue, setEditValue] = useState<string>("")
  const [signupLocked, setSignupLocked] = useState<boolean>(false)
  const [togglingLock, setTogglingLock] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isLemonadeDay, setIsLemonadeDay] = useState(false)
  const [labels, setLabels] = useState<UiLabels>(getDefaultLabels())

  useEffect(() => {
    const eventId = getCoordinatorEventId()
    setSelectedEventId(eventId)
    fetchFloats(eventId)
    fetchSignupLockStatus()
    
    // Load labels for initial event
    if (eventId) {
      getLabelsForEvent(eventId).then(setLabels).catch(() => setLabels(getDefaultLabels()))
    }
  }, [])

  // 🔴 REALTIME: Subscribe to floats changes for instant updates
  useRealtimeCallback(
    ['floats'],
    () => {
      console.log("[CoordinatorPositions] 🔴 REALTIME: Floats changed, refreshing...")
      fetchFloats(selectedEventId, false)
    },
    !loading && !saving && !deleting // Don't refresh while we're making changes
  )

  const handleEventChange = async (eventId: number | null) => {
    setSelectedEventId(eventId)
    fetchFloats(eventId)
    
    // Load labels for the event
    if (eventId) {
      try {
        const eventLabels = await getLabelsForEvent(eventId)
        setLabels(eventLabels)
        
        // Check if event is Lemonade Day
        const eventsResponse = await fetch("/api/events")
        if (eventsResponse.ok) {
          const events = await eventsResponse.json()
          const event = events.find((e: any) => e.id === eventId)
          setIsLemonadeDay(event?.type === "lemonade_day")
        }
      } catch (error) {
        console.error("Error loading event data:", error)
        setLabels(getDefaultLabels())
      }
    } else {
      setIsLemonadeDay(false)
      setLabels(getDefaultLabels())
    }
  }

  const fetchSignupLockStatus = async () => {
    try {
      const response = await fetch("/api/coordinator/settings")
      if (response.ok) {
        const data = await response.json()
        setSignupLocked(data.signupLocked || false)
      }
    } catch (error) {
      console.error("Error fetching signup lock status:", error)
    }
  }

  const toggleSignupLock = async () => {
    setTogglingLock(true)
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      const newLockStatus = !signupLocked
      const response = await fetch(`/api/coordinator/settings?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signupLocked: newLockStatus }),
      })

      if (response.status === 401) {
        router.push("/admin/dashboard")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to update signup lock status")
        return
      }

      setSignupLocked(newLockStatus)
      toast.success(newLockStatus ? "Sign-ups are now locked" : "Sign-ups are now open")
    } catch (error) {
      console.error("Error toggling signup lock:", error)
      toast.error("Failed to update signup lock status")
    } finally {
      setTogglingLock(false)
    }
  }

  const fetchFloats = useCallback(async (eventId: number | null = null, showLoading: boolean = false) => {
    if (showLoading) {
      setLoading(true)
    }
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      const eventIdToUse = eventId ?? selectedEventId
      const url = eventIdToUse
        ? `/api/coordinator/floats?password=${encodeURIComponent(password)}&eventId=${eventIdToUse}`
        : `/api/coordinator/floats?password=${encodeURIComponent(password)}`
      
      const response = await fetch(url)
      
      if (response.status === 401) {
        router.push("/admin/dashboard")
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch floats")
      }

      const data = await response.json()
      setFloats(data)
      setLastUpdate(new Date())
      if (showLoading) {
        toast.success("Floats refreshed")
      }
    } catch (error) {
      console.error("Error fetching floats:", error)
      toast.error("Failed to load floats")
    } finally {
      setLoading(false)
    }
  }, [router, selectedEventId])

  const handleEdit = (float: Float) => {
    setEditing(float.id)
    setEditValue(float.floatNumber?.toString() || "")
  }

  const handleCancel = () => {
    setEditing(null)
    setEditValue("")
  }

  const handleSave = async (floatId: number) => {
    const newFloatNumber = parseInt(editValue, 10)
    
    // Allow 999 for no-shows/cancelled floats, otherwise must be positive
    if (isNaN(newFloatNumber) || (newFloatNumber < 1 && newFloatNumber !== 999)) {
      toast.error("Float number must be a positive integer (or 999 for no-shows)")
      return
    }

    setSaving(floatId)
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      const response = await fetch(`/api/coordinator/floats?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          floatId,
          floatNumber: newFloatNumber,
        }),
      })

      if (response.status === 401) {
        router.push("/admin/dashboard")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to update float position")
        return
      }

      toast.success(`Float position updated to ${newFloatNumber}`)
      setEditing(null)
      setEditValue("")
      await fetchFloats() // Refresh the list
    } catch (error) {
      console.error("Error updating float:", error)
      toast.error("Failed to update float position")
    } finally {
      setSaving(null)
    }
  }

  const moveFloat = async (floatId: number, direction: "up" | "down") => {
    const currentIndex = floats.findIndex((f) => f.id === floatId)
    if (currentIndex === -1) return

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= floats.length) return

    const targetFloat = floats[targetIndex]
    const currentFloat = floats[currentIndex]

    // Swap float numbers - use temporary position to avoid conflicts
    setSaving(floatId)
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      // Use a temporary position (max + 100) to avoid conflicts during swap
      const validNumbers = floats.map(f => f.floatNumber).filter((n): n is number => n !== null && n !== undefined)
      const maxPosition = validNumbers.length > 0 ? Math.max(...validNumbers) : 0
      const tempPosition = maxPosition + 100
      
      // Step 1: Move current float to temporary position
      const response1 = await fetch(`/api/coordinator/floats?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floatId: currentFloat.id,
          floatNumber: tempPosition,
        }),
      })

      if (response1.status === 401) {
        router.push("/coordinator")
        return
      }

      if (!response1.ok) {
        const error1 = await response1.json().catch(() => ({}))
        toast.error(error1.error || "Failed to move float")
        return
      }

      // Step 2: Move target float to current float's position
      const response2 = await fetch(`/api/coordinator/floats?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floatId: targetFloat.id,
          floatNumber: currentFloat.floatNumber,
        }),
      })

      if (!response2.ok) {
        // Rollback: move current float back
        await fetch(`/api/coordinator/floats?password=${encodeURIComponent(password)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            floatId: currentFloat.id,
            floatNumber: currentFloat.floatNumber,
          }),
        })
        const error2 = await response2.json().catch(() => ({}))
        toast.error(error2.error || "Failed to move float")
        return
      }

      // Step 3: Move current float to target float's position
      const response3 = await fetch(`/api/coordinator/floats?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floatId: currentFloat.id,
          floatNumber: targetFloat.floatNumber,
        }),
      })

      if (!response3.ok) {
        // Rollback both
        await Promise.all([
          fetch(`/api/coordinator/floats?password=${encodeURIComponent(password)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              floatId: currentFloat.id,
              floatNumber: currentFloat.floatNumber,
            }),
          }),
          fetch(`/api/coordinator/floats?password=${encodeURIComponent(password)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              floatId: targetFloat.id,
              floatNumber: targetFloat.floatNumber,
            }),
          }),
        ])
        const error3 = await response3.json().catch(() => ({}))
        toast.error(error3.error || "Failed to move float")
        return
      }

      toast.success("Float position updated")
      await fetchFloats(selectedEventId, false) // Refresh the list with current eventId
    } catch (error) {
      console.error("Error moving float:", error)
      toast.error("Failed to move float")
    } finally {
      setSaving(null)
    }
  }

  const handleDeleteFloat = async (floatId: number, organization: string) => {
    if (!confirm(`Are you sure you want to delete "${organization}"? This will remove the float from the parade and cannot be undone.`)) {
      return
    }

    setDeleting(floatId)
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      const response = await fetch(`/api/coordinator/floats?password=${encodeURIComponent(password)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ floatId }),
      })

      if (response.status === 401) {
        router.push("/admin/dashboard")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to delete float")
        return
      }

      toast.success("Float deleted successfully")
      await fetchFloats(selectedEventId, false) // Refresh the list with current eventId
    } catch (error) {
      console.error("Error deleting float:", error)
      toast.error("Failed to delete float")
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#DC2626" }} />
          <p className="text-muted-foreground">Loading float positions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-2 sm:p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: "#DC2626" }}>
              {labels.entries} Positions
            </h1>
            <Link href="/admin/results">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                ← Admin
              </Button>
            </Link>
          </div>
          
          {/* Event selector and live indicator */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <EventSelector onEventChange={handleEventChange} />
            {lastUpdate && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live • {floats.length} floats
              </span>
            )}
          </div>

          {/* Action buttons - scrollable on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
            <ParticipantLookup onParticipantAdded={fetchFloats} />
            <Link href="/coordinator/qr">
              <Button variant="outline" size="sm" className="whitespace-nowrap text-xs sm:text-sm bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100">
                📱 QR Codes
              </Button>
            </Link>
            <Link href="/coordinator/upload">
              <Button variant="outline" size="sm" className="whitespace-nowrap text-xs sm:text-sm">
                Upload CSV
              </Button>
            </Link>
            <Link href="/coordinator/approve">
              <Button variant="outline" size="sm" className="whitespace-nowrap text-xs sm:text-sm">
                Approve
              </Button>
            </Link>
            {isLemonadeDay && (
              <Link href="/coordinator/locations">
                <Button variant="outline" size="sm" className="whitespace-nowrap text-xs sm:text-sm bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Stand Locations
                </Button>
              </Link>
            )}
            <Button
              onClick={() => fetchFloats(selectedEventId, true)}
              variant="outline"
              size="sm"
              disabled={loading}
              className="whitespace-nowrap text-xs sm:text-sm"
            >
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Sign-up lock status - compact on mobile */}
          <div className="flex items-center justify-between p-2 rounded-lg border-2 mt-2" 
               style={{ borderColor: signupLocked ? "#DC2626" : "#16A34A", backgroundColor: signupLocked ? "#fef2f2" : "#f0fdf4" }}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${signupLocked ? 'bg-red-500' : 'bg-green-500'}`}></span>
              <span className="text-sm font-medium">
                Sign-Ups: {signupLocked ? "Locked" : "Open"}
              </span>
            </div>
            <Button
              onClick={toggleSignupLock}
              disabled={togglingLock}
              size="sm"
              variant={signupLocked ? "destructive" : "default"}
              className={`text-xs ${signupLocked ? "bg-[#DC2626] hover:bg-[#DC2626]/90" : "bg-[#16A34A] hover:bg-[#16A34A]/90"}`}
            >
              {togglingLock ? "..." : signupLocked ? "Unlock" : "Lock"}
            </Button>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {floats.map((float, index) => (
            <Card 
              key={float.id} 
              className={`p-2 sm:p-4 ${!float.approved ? 'border-yellow-300 bg-yellow-50/30' : ''}`}
            >
              {editing === float.id ? (
                /* Edit mode - simplified layout */
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-medium">Position:</span>
                    <Input
                      type="number"
                      min="1"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 h-10"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(float.id)}
                      disabled={saving === float.id}
                      className="flex-1 sm:flex-none bg-[#16A34A] hover:bg-[#16A34A]/90 text-white"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={saving === float.id}
                      className="flex-1 sm:flex-none"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* Normal display mode */
                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Position number */}
                  <div
                    className="text-xl sm:text-2xl font-bold w-12 sm:w-14 text-center shrink-0"
                    style={{ color: "#DC2626" }}
                  >
                    {float.floatNumber ? `#${float.floatNumber}` : "—"}
                  </div>

                  {/* Up/Down arrows - compact on mobile */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveFloat(float.id, "up")}
                      disabled={index === 0 || saving === float.id || !float.approved}
                      className="h-7 w-7 sm:h-8 sm:w-8"
                    >
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => moveFloat(float.id, "down")}
                      disabled={index === floats.length - 1 || saving === float.id || !float.approved}
                      className="h-7 w-7 sm:h-8 sm:w-8"
                    >
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>

                  {/* Organization info - takes remaining space */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-sm sm:text-base truncate">{float.organization}</span>
                      {!float.approved && (
                        <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-yellow-200 text-yellow-800 border border-yellow-300 shrink-0">
                          Pending
                        </span>
                      )}
                    </div>
                    {float.entryName && (
                      <div className="text-xs sm:text-sm text-muted-foreground italic truncate">
                        {float.entryName}
                      </div>
                    )}
                  </div>

                  {/* Action buttons - icons on mobile, text on desktop */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(float)}
                      disabled={saving === float.id || deleting === float.id || !float.approved}
                      title={!float.approved ? "Approve first" : "Edit Position"}
                      className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3"
                    >
                      <span className="hidden sm:inline text-xs">Edit #</span>
                      <Save className="h-4 w-4 sm:hidden" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteFloat(float.id, float.organization)}
                      disabled={saving === float.id || deleting === float.id}
                      className="h-8 w-8 sm:h-9 sm:w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Add new entry button */}
        <div className="mt-4 sm:mt-6">
          <Link href={`/signup?eventId=${selectedEventId || ''}&returnTo=/coordinator/positions`}>
            <Button className="w-full sm:w-auto bg-[#16A34A] hover:bg-[#16A34A]/90 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add New Entry
            </Button>
          </Link>
        </div>

        {floats.length === 0 && (
          <Card className="p-6 sm:p-8 text-center mt-4">
            <p className="text-muted-foreground text-sm sm:text-base">No floats found for this event</p>
          </Card>
        )}
      </div>
    </div>
  )
}

