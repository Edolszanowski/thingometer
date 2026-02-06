"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { RefreshCw, Check, X, Eye } from "lucide-react"
import { EventSelector, getCoordinatorEventId } from "@/components/EventSelector"
import { ParticipantLookup } from "@/components/ParticipantLookup"
import { useRealtimeCallback } from "@/hooks/useRealtimeData"
import { getLabelsForEvent } from "@/app/actions"
import { getDefaultLabels } from "@/lib/labels"
import type { UiLabels } from "@/lib/labels"

interface UnapprovedEntry {
  id: number
  firstName: string | null
  lastName: string | null
  organization: string
  title: string | null
  phone: string | null
  email: string | null
  entryName: string | null
  floatDescription: string | null
  entryLength: string | null
  typeOfEntry: string | null
  hasMusic: boolean
  comments: string | null
  submittedAt: string | null
  metadata?: {
    status?: "pending-consent" | "registered" | "checked-in" | "judged" | "completed"
    [key: string]: unknown
  }
}

function getAdminPassword(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return authCookie ? authCookie.split("=")[1] : null
}

// Status badge component
function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  
  const colors = {
    "pending-consent": "bg-orange-100 text-orange-800 border-orange-300",
    "registered": "bg-blue-100 text-blue-800 border-blue-300",
    "checked-in": "bg-green-100 text-green-800 border-green-300",
    "judged": "bg-purple-100 text-purple-800 border-purple-300",
    "completed": "bg-gray-100 text-gray-800 border-gray-300",
  }
  
  const label = status.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium border ${colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"}`}>
      {label}
    </span>
  )
}

export default function CoordinatorApprovePage() {
  const router = useRouter()
  const [entries, setEntries] = useState<UnapprovedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [floatNumberInput, setFloatNumberInput] = useState<{ [key: number]: string }>({})
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [labels, setLabels] = useState<UiLabels>(getDefaultLabels())
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchEntries = useCallback(async (eventId: number | null = null) => {
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      const eventIdToUse = eventId ?? selectedEventId
      const url = eventIdToUse
        ? `/api/coordinator/approve?password=${encodeURIComponent(password)}&eventId=${eventIdToUse}`
        : `/api/coordinator/approve?password=${encodeURIComponent(password)}`
      
      const response = await fetch(url)

      if (response.status === 401) {
        router.push("/admin/dashboard")
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch entries")
      }

      const data = await response.json()
      setEntries(data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Error fetching entries:", error)
      toast.error("Failed to load entries")
    } finally {
      setLoading(false)
    }
  }, [router, selectedEventId])

  useEffect(() => {
    const eventId = getCoordinatorEventId()
    setSelectedEventId(eventId)
    fetchEntries(eventId)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const next = await getLabelsForEvent(selectedEventId)
        if (!cancelled) setLabels(next)
      } catch {
        if (!cancelled) setLabels(getDefaultLabels())
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [selectedEventId])

  const handleEventChange = (eventId: number | null) => {
    setSelectedEventId(eventId)
    fetchEntries(eventId)
  }

  // Subscribe to realtime updates on floats table
  useRealtimeCallback(
    ['floats'],
    () => fetchEntries(selectedEventId),
    !loading
  )

  const handleApprove = async (entryId: number) => {
    setProcessing(entryId)
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      const floatNumber = floatNumberInput[entryId]
      const floatNum = floatNumber ? parseInt(floatNumber, 10) : undefined

      const response = await fetch(`/api/coordinator/approve?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryId,
          approved: true,
          floatNumber: floatNum,
          eventId: selectedEventId,
        }),
      })

      if (response.status === 401) {
        router.push("/admin/dashboard")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to approve entry")
        return
      }

      toast.success("Entry approved successfully")
      setFloatNumberInput({ ...floatNumberInput, [entryId]: "" })
      setViewing(null)
      await fetchEntries(selectedEventId)
    } catch (error) {
      console.error("Error approving entry:", error)
      toast.error("Failed to approve entry")
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (entryId: number) => {
    if (!confirm("Are you sure you want to delete this entry? This action cannot be undone.")) {
      return
    }

    setProcessing(entryId)
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      const response = await fetch(
        `/api/coordinator/approve?password=${encodeURIComponent(password)}&entryId=${entryId}`,
        {
          method: "DELETE",
        }
      )

      if (response.status === 401) {
        router.push("/admin/dashboard")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to delete entry")
        return
      }

      toast.success("Entry deleted successfully")
      setViewing(null)
      await fetchEntries(selectedEventId)
    } catch (error) {
      console.error("Error deleting entry:", error)
      toast.error("Failed to delete entry")
    } finally {
      setProcessing(null)
    }
  }

  const handleStatusUpdate = async (entryId: number, newStatus: string) => {
    setProcessing(entryId)
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin/dashboard")
        return
      }

      const response = await fetch(`/api/entries/${entryId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": password,
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.status === 401) {
        router.push("/admin/dashboard")
        return
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to update status" }))
        throw new Error(error.error || "Failed to update status")
      }

      toast.success("Status updated successfully")
      await fetchEntries(selectedEventId)
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#DC2626" }} />
          <p className="text-muted-foreground">Loading entries...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-6 space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "#DC2626" }}>
              Approve Parade Entries
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm sm:text-base text-muted-foreground">
                Review and approve entries submitted by participants
              </p>
              {lastUpdate && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Live
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <EventSelector onEventChange={handleEventChange} />
            <ParticipantLookup onParticipantAdded={() => fetchEntries(selectedEventId)} />
            <Button
              onClick={() => fetchEntries(selectedEventId)}
              variant="outline"
              className="flex items-center gap-2"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={() => router.push("/coordinator/positions")}
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Manage Positions
            </Button>
            <Button
              onClick={() => router.push("/coordinator/upload")}
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
            >
              Upload CSV
            </Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No pending entries to review</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <Card key={entry.id} className="p-4">
                <div className="flex flex-col gap-4">
                  {/* Header Section */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold">{entry.organization}</h3>
                        {entry.entryName && (
                          <span className="text-sm text-muted-foreground italic">
                            - {entry.entryName}
                          </span>
                        )}
                        <StatusBadge status={entry.metadata?.status} />
                      </div>
                      {!viewing || viewing !== entry.id ? (
                        <div className="text-sm text-muted-foreground">
                          {entry.typeOfEntry || "No type specified"} • {entry.hasMusic ? "Has Music" : "No Music"}
                        </div>
                      ) : null}
                    </div>

                    {/* View Details Button - Always visible */}
                    {viewing !== entry.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewing(entry.id)}
                        className="w-full sm:w-auto"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    )}
                  </div>

                  {/* Details Section - Shown when viewing */}
                  {viewing === entry.id && (
                    <>
                      <div className="space-y-2 text-sm border-t pt-4">
                        <div><strong>Contact:</strong> {entry.firstName || ""} {entry.lastName || ""} {entry.title ? `(${entry.title})` : ""}</div>
                        <div><strong>Phone:</strong> {entry.phone || "N/A"}</div>
                        <div><strong>Email:</strong> {entry.email || "N/A"}</div>
                        <div><strong>Type:</strong> {entry.typeOfEntry || "N/A"}</div>
                        <div><strong>Length:</strong> {entry.entryLength || "N/A"}</div>
                        <div><strong>Music:</strong> {entry.hasMusic ? "Yes" : "No"}</div>
                        {entry.floatDescription && (
                          <div className="mt-2">
                            <strong>Description:</strong>
                            <p className="text-muted-foreground mt-1">{entry.floatDescription}</p>
                          </div>
                        )}
                        {entry.comments && (
                          <div className="mt-2">
                            <strong>Comments:</strong>
                            <p className="text-muted-foreground mt-1">{entry.comments}</p>
                          </div>
                        )}
                        {entry.submittedAt && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Submitted: {new Date(entry.submittedAt).toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* Action Controls - Full width on mobile */}
                      <div className="flex flex-col sm:flex-row gap-3 border-t pt-4">
                        <div className="flex-1 space-y-3">
                          <Input
                            type="number"
                            placeholder={`${labels.entryNumber} (optional)`}
                            value={floatNumberInput[entry.id] || ""}
                            onChange={(e) =>
                              setFloatNumberInput({ ...floatNumberInput, [entry.id]: e.target.value })
                            }
                            className="w-full"
                            min="1"
                          />
                          <select 
                            value={entry.metadata?.status || "registered"}
                            onChange={(e) => handleStatusUpdate(entry.id, e.target.value)}
                            disabled={processing === entry.id}
                            className="text-sm border rounded px-3 py-2 w-full"
                          >
                            <option value="pending-consent">Pending Consent</option>
                            <option value="registered">Registered</option>
                            <option value="checked-in">Checked In</option>
                            <option value="judged">Judged</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(entry.id)}
                            disabled={processing === entry.id}
                            className="bg-[#16A34A] hover:bg-[#16A34A]/90 text-white w-full sm:w-auto"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(entry.id)}
                            disabled={processing === entry.id}
                            className="w-full sm:w-auto"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewing(null)}
                            className="w-full sm:w-auto"
                          >
                            Hide
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

