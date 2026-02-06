"use client"

import { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { isCoordinator } from "@/lib/auth"
import { useRouter } from "next/navigation"

interface JudgeWithToken {
  id: number
  name: string
  eventId: number | null
  token: string
}

interface Event {
  id: number
  name: string
}

export default function CoordinatorQRPage() {
  const router = useRouter()
  const [judges, setJudges] = useState<JudgeWithToken[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [selectedJudge, setSelectedJudge] = useState<JudgeWithToken | null>(null)
  const [loading, setLoading] = useState(true)
  const [baseUrl, setBaseUrl] = useState("")

  useEffect(() => {
    // Check coordinator access
    if (!isCoordinator()) {
      router.push("/admin/dashboard")
      return
    }

    // Get base URL for QR codes
    setBaseUrl(window.location.origin)

    // Fetch events
    const fetchEvents = async () => {
      try {
        const eventsRes = await fetch("/api/admin/events?password=MERRYXMAS2025!")
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json()
          setEvents(eventsData)
          // Auto-select active event
          const activeEvent = eventsData.find((e: Event & { active: boolean }) => e.active)
          if (activeEvent) {
            setSelectedEventId(activeEvent.id)
          }
        }
      } catch (error) {
        console.error("Error fetching events:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [router])

  // Fetch judges with tokens when event changes
  useEffect(() => {
    const fetchJudges = async () => {
      try {
        const url = selectedEventId 
          ? `/api/coordinator/qr-tokens?eventId=${selectedEventId}`
          : `/api/coordinator/qr-tokens`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setJudges(data)
        }
      } catch (error) {
        console.error("Error fetching judges:", error)
      }
    }

    fetchJudges()
  }, [selectedEventId])

  // Generate QR code URL for a judge (using pre-generated token)
  const getJudgeQRUrl = (judge: JudgeWithToken) => {
    return `${baseUrl}/judge/quick/${judge.token}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-red-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-green-800">
              📱 Judge QR Codes
            </h1>
            <Link href="/coordinator">
              <Button variant="outline" size="sm">
                ← Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Event selector */}
        {events.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select Event:</label>
            <select
              value={selectedEventId || ""}
              onChange={(e) => {
                setSelectedEventId(e.target.value ? parseInt(e.target.value) : null)
                setSelectedJudge(null)
              }}
              className="w-full max-w-md p-2 border rounded-lg"
            >
              <option value="">All Events</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Selected Judge QR Code (Full Screen View) */}
        {selectedJudge && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col">
            <div className="bg-green-800 text-white p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedJudge.name}</h2>
              <Button
                variant="ghost"
                className="text-white hover:bg-green-700"
                onClick={() => setSelectedJudge(null)}
              >
                ✕ Close
              </Button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="bg-white p-8 rounded-2xl shadow-2xl border-4 border-green-600">
                <QRCodeSVG
                  value={getJudgeQRUrl(selectedJudge)}
                  size={Math.min(window.innerWidth - 100, 350)}
                  level="M"
                  includeMargin={true}
                />
              </div>
              <p className="mt-6 text-2xl font-bold text-green-800 text-center">
                {selectedJudge.name}
              </p>
              <p className="mt-2 text-lg text-gray-600 text-center">
                Scan to login and start judging
              </p>
            </div>
          </div>
        )}

        {/* Judge Grid */}
        {judges.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No judges found for the selected event.
            </p>
            <Link href="/coordinator/judges" className="mt-4 inline-block">
              <Button>Add Judges</Button>
            </Link>
          </Card>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Tap a judge to show their QR code full-screen. 
              Judges scan the code to instantly login on their device.
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {judges.map(judge => (
                <Card
                  key={judge.id}
                  className="p-4 cursor-pointer hover:shadow-lg hover:border-green-500 transition-all"
                  onClick={() => setSelectedJudge(judge)}
                >
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 p-2 rounded-lg mb-3">
                      <QRCodeSVG
                        value={getJudgeQRUrl(judge)}
                        size={100}
                        level="L"
                      />
                    </div>
                    <p className="font-semibold text-center text-sm truncate w-full">
                      {judge.name}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Instructions */}
        <Card className="mt-8 p-6 bg-blue-50 border-blue-200">
          <h3 className="font-bold text-blue-800 mb-3">📋 How to Use</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-700">
            <li>Tap a judge's card to show their QR code full-screen</li>
            <li>Have the judge scan the QR code with their phone camera</li>
            <li>They'll be automatically logged in and ready to judge!</li>
          </ol>
          <p className="mt-4 text-sm text-blue-600">
            💡 <strong>Tip:</strong> Each judge has a unique QR code. 
            The code works on any device with a camera.
          </p>
        </Card>
      </div>
    </div>
  )
}

