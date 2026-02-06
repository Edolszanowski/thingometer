"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { isCoordinator } from "@/lib/auth"
import { getEntryAttributesForEvent, getLabelsForEvent } from "@/app/actions"
import { getDefaultLabels } from "@/lib/labels"
import type { UiLabels } from "@/lib/labels"

// Predefined type of entry options from CSV data
const TYPE_OF_ENTRY_OPTIONS = [
  "Fire Truck",
  "Fire Engine",
  "Patrol Unit",
  "Float",
  "Truck and Trailer Float",
  "Truck Pulling Float",
  "Truck/Trailer Float",
  "Car",
  "Classic Car",
  "Truck",
  "Walker",
  "On foot",
  "Slingshot",
  "Jeep Club",
  "Canteen",
  "Trailer",
  "Mini Electric Truck",
  "Mechanics Truck",
  "Tractors",
  "Truck with Trailer",
  "Float with trailer",
  "truck w/trailer",
  "Truck & Float",
  "Pickup w/ 16' trailer and Truck w/ train",
  "Float, gooseneck trailer",
  "72 Dodge Dart",
  "hummer",
  "Queens Float",
  "Other",
]

type ExtraField = {
  key: string
  label: string
  type: "text" | "textarea" | "number" | "select" | "boolean"
  required?: boolean
  placeholder?: string
  options?: string[]
  helpText?: string
}

function SignUpPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [signupLocked, setSignupLocked] = useState<boolean | null>(null)
  const [isCoordinatorUser, setIsCoordinatorUser] = useState(false)
  const [showCoordinatorMode, setShowCoordinatorMode] = useState(false)
  const [eventId, setEventId] = useState<number | null>(null)
  const [eventData, setEventData] = useState<{ name: string; city: string; type?: string; organization?: string; hostOrganization?: string } | null>(null)
  const [checkingEvent, setCheckingEvent] = useState(true)
  const [labels, setLabels] = useState<UiLabels>(getDefaultLabels())
  
  // Child-safe form mode for Lemonade Day events
  const isLemonadeDay = eventData?.type === "lemonade_day"
  const eventOrganization = eventData?.organization || eventData?.hostOrganization || ""
  const [extraFields, setExtraFields] = useState<ExtraField[]>([])
  const [metadata, setMetadata] = useState<Record<string, unknown>>({})
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    organization: "",
    title: "",
    phone: "",
    email: "",
    driverFirstName: "",
    driverLastName: "",
    driverPhone: "",
    driverEmail: "",
    entryName: "",
    floatDescription: "",
    entryLength: "",
    typeOfEntry: "",
    typeOfEntryOther: "",
    hasMusic: false,
    comments: "",
    autoApprove: true, // Default to true for coordinators (last-minute entries)
    // Lemonade Day specific fields
    guardianFirstName: "",
    guardianLastName: "",
    guardianEmail: "",
    guardianPhone: "",
    guardianCity: "",
    guardianState: "",
    guardianPostalCode: "",
    guardianRelationship: "",
    childFirstName: "",
    childLastName: "",
    childGrade: "",
    childAge: "",
    // Additional Lemonade Day fields
    childSchool: "",
    consentTerms: false,
    consentSignature: "",
    consentPhotography: false,
    consentFoodSafety: false,
    consentLiability: false,
    consentJudging: false,
  })

  useEffect(() => {
    // Check if user is a coordinator (can bypass lock)
    const coordUser = isCoordinator()
    setIsCoordinatorUser(coordUser)

    // Only show coordinator mode if explicitly coming from coordinator portal (has returnTo param)
    const returnTo = searchParams.get("returnTo")
    const fromCoordinator = !!(coordUser && returnTo?.includes("/coordinator"))
    setShowCoordinatorMode(fromCoordinator)

    // Get eventId from URL params
    const eventIdParam = searchParams.get("eventId")
    if (eventIdParam) {
      const parsedEventId = parseInt(eventIdParam, 10)
      if (!isNaN(parsedEventId)) {
        setEventId(parsedEventId)
        // Fetch event data for title, type, and organization
        fetch(`/api/events`)
          .then((res) => res.json())
          .then((events) => {
            const event = events.find((e: any) => e.id === parsedEventId)
            if (event) {
              setEventData({ 
                name: event.name, 
                city: event.city, 
                type: event.type,
                organization: event.organization || "",
                hostOrganization: event.hostOrganization || ""
              })
            }
          })
          .catch(() => {
            // Ignore errors
          })
      }
    }

    // Check if signups are locked (but coordinators from portal can bypass)
    fetch("/api/coordinator/settings")
      .then((res) => res.json())
      .then((data) => {
        // Coordinators coming from portal can always add entries
        setSignupLocked(fromCoordinator ? false : (data.signupLocked || false))
      })
      .catch(() => {
        setSignupLocked(false) // Default to unlocked if error
      })
      .finally(() => {
        setCheckingEvent(false)
      })

    // If no eventId in URL, check for active events and redirect if needed
    if (!eventIdParam) {
      checkActiveEvents()
    } else {
      setCheckingEvent(false)
    }
  }, [searchParams])

  // Sync eventOrganization to formData for Lemonade Day
  // This ensures the organization field is pre-filled when:
  // 1. Event data loads (eventOrganization becomes available)
  // 2. User navigates to a Lemonade Day event
  useEffect(() => {
    if (isLemonadeDay && eventOrganization && eventOrganization.trim() !== "") {
      setFormData(prev => {
        // Only update if the organization is different (avoid infinite loops)
        if (prev.organization !== eventOrganization) {
          return { ...prev, organization: eventOrganization }
        }
        return prev
      })
    }
  }, [isLemonadeDay, eventOrganization])

  // Load event-specific labels (server action) when eventId is known
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!eventId) {
        setLabels(getDefaultLabels())
        return
      }
      try {
        const next = await getLabelsForEvent(eventId)
        if (!cancelled) setLabels(next)
      } catch {
        if (!cancelled) setLabels(getDefaultLabels())
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [eventId])

  // Load event-configured extra entry fields (stored to floats.metadata)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!eventId) {
        setExtraFields([])
        setMetadata({})
        return
      }
      try {
        const cfg = await getEntryAttributesForEvent(eventId)
        const fields = Array.isArray(cfg?.extraFields) ? (cfg.extraFields as ExtraField[]) : []
        if (!cancelled) {
          setExtraFields(fields)
          // Keep existing values for keys that still exist; drop removed keys.
          setMetadata((prev) => {
            const next: Record<string, unknown> = {}
            for (const f of fields) {
              next[f.key] = prev[f.key] ?? (f.type === "boolean" ? false : "")
            }
            return next
          })
        }
      } catch {
        if (!cancelled) {
          setExtraFields([])
          setMetadata({})
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [eventId])

  const checkActiveEvents = async () => {
    try {
      const response = await fetch("/api/events")
      if (!response.ok) {
        setCheckingEvent(false)
        return
      }

      const allEvents = await response.json()
      // API already filters for active events, but double-check in case
      const activeEvents = allEvents.filter((e: any) => e.active === true)
      
      console.log(`[SignUpPage] Found ${activeEvents.length} active events`)

      if (activeEvents.length === 0) {
        // No active events - redirect to selection page which will show message
        router.replace("/signup/select-event")
      } else if (activeEvents.length === 1) {
        // Only one active event - auto-redirect with eventId
        router.replace(`/signup?eventId=${activeEvents[0].id}`)
      } else {
        // Multiple active events - redirect to selection page
        router.replace("/signup/select-event")
      }
    } catch (error) {
      console.error("Error checking events:", error)
      setCheckingEvent(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      // Lemonade Day validation
      if (isLemonadeDay) {
        // Guardian validation
        if (!formData.guardianFirstName.trim()) {
          toast.error("Parent/Guardian First Name is required")
          setLoading(false)
          return
        }
        if (!formData.guardianLastName.trim()) {
          toast.error("Parent/Guardian Last Name is required")
          setLoading(false)
          return
        }
        if (!formData.guardianEmail.trim()) {
          toast.error("Parent/Guardian Email is required")
          setLoading(false)
          return
        }
        if (!emailRegex.test(formData.guardianEmail.trim())) {
          toast.error("Please enter a valid email address")
          setLoading(false)
          return
        }
        if (!formData.guardianPhone.trim()) {
          toast.error("Parent/Guardian Phone is required")
          setLoading(false)
          return
        }
        if (!formData.guardianCity.trim()) {
          toast.error("City is required")
          setLoading(false)
          return
        }
        if (!formData.guardianState.trim()) {
          toast.error("State is required")
          setLoading(false)
          return
        }
        if (!formData.guardianPostalCode.trim()) {
          toast.error("Zip Code is required")
          setLoading(false)
          return
        }
        if (!formData.guardianRelationship) {
          toast.error("Relationship to Participant is required")
          setLoading(false)
          return
        }

        // Child validation
        if (!formData.childFirstName.trim()) {
          toast.error("Child's First Name is required")
          setLoading(false)
          return
        }
        if (!formData.childLastName.trim()) {
          toast.error("Child's Last Name is required")
          setLoading(false)
          return
        }

        // Organization validation (should be pre-filled from event)
        if (!eventOrganization && !formData.organization.trim()) {
          toast.error("Event organization is not configured. Please contact the administrator.")
          setLoading(false)
          return
        }

        // Stand validation
        if (!formData.entryName.trim()) {
          toast.error("Stand Name is required")
          setLoading(false)
          return
        }
        if (!formData.floatDescription.trim()) {
          toast.error("Please tell us about your lemonade stand")
          setLoading(false)
          return
        }

        // E-Signature Consent validation
        if (!formData.consentTerms) {
          toast.error("You must agree to the Terms and Conditions")
          setLoading(false)
          return
        }
        if (!formData.consentFoodSafety) {
          toast.error("Food Safety Awareness acknowledgment is required")
          setLoading(false)
          return
        }
        if (!formData.consentLiability) {
          toast.error("Liability Acknowledgment is required")
          setLoading(false)
          return
        }
        if (!formData.consentJudging) {
          toast.error("Judging & Scoring Consent is required")
          setLoading(false)
          return
        }
        if (!formData.consentSignature.trim()) {
          toast.error("Please type your full name to sign")
          setLoading(false)
          return
        }
        // Verify signature matches guardian name (case-insensitive)
        const expectedSignature = `${formData.guardianFirstName} ${formData.guardianLastName}`.trim().toLowerCase()
        const actualSignature = formData.consentSignature.trim().toLowerCase()
        if (actualSignature !== expectedSignature) {
          toast.error("Signature must match guardian name: " + `${formData.guardianFirstName} ${formData.guardianLastName}`)
          setLoading(false)
          return
        }
      } else {
        // Parade validation
        if (!formData.organization.trim()) {
          toast.error("Organization Name is required")
          setLoading(false)
          return
        }
        if (!formData.phone.trim()) {
          toast.error("Phone number is required")
          setLoading(false)
          return
        }
        if (!formData.email.trim()) {
          toast.error("Email is required")
          setLoading(false)
          return
        }
        if (!emailRegex.test(formData.email.trim())) {
          toast.error("Please enter a valid email address")
          setLoading(false)
          return
        }
        
        // Driver validation - only for parade events
        if (!formData.driverFirstName.trim()) {
          toast.error("Driver First Name is required")
          setLoading(false)
          return
        }
        if (!formData.driverLastName.trim()) {
          toast.error("Driver Last Name is required")
          setLoading(false)
          return
        }
        if (!formData.driverPhone.trim()) {
          toast.error("Driver Phone Number is required")
          setLoading(false)
          return
        }
        if (!formData.driverEmail.trim()) {
          toast.error("Driver Email is required")
          setLoading(false)
          return
        }
        if (!emailRegex.test(formData.driverEmail.trim())) {
          toast.error("Please enter a valid driver email address")
          setLoading(false)
          return
        }
        
        if (!formData.floatDescription.trim()) {
          toast.error(`${labels.entryDescription} is required`)
          setLoading(false)
          return
        }
      }

      // Type of Entry validation - only for parade events
      let finalTypeOfEntry = "Lemonade Stand" // Default for Lemonade Day
      if (!isLemonadeDay) {
        finalTypeOfEntry = formData.typeOfEntry === "Other" 
          ? formData.typeOfEntryOther.trim() 
          : formData.typeOfEntry

        if (!finalTypeOfEntry) {
          toast.error("Type of Entry is required")
          setLoading(false)
          return
        }
      }

      // Validate required dynamic fields (extraFields -> floats.metadata)
      for (const f of extraFields) {
        if (!f.required) continue
        const v = metadata[f.key]
        const isEmpty =
          v == null ||
          (typeof v === "string" && v.trim() === "") ||
          (typeof v === "number" && Number.isNaN(v))

        if (isEmpty) {
          toast.error(`${f.label} is required`)
          setLoading(false)
          return
        }
      }

      // Use metadata directly for submission
      // Note: Location assignment is handled by coordinators, not participants
      const metadataForSubmit: Record<string, unknown> = metadata

      // Build metadata for Lemonade Day with guardian, child, stand, and consent info
      let finalMetadata = metadataForSubmit
      if (isLemonadeDay) {
        finalMetadata = {
          ...metadataForSubmit,
          guardian: {
            firstName: formData.guardianFirstName.trim(),
            lastName: formData.guardianLastName.trim(),
            email: formData.guardianEmail.trim(),
            phone: formData.guardianPhone.trim(),
            city: formData.guardianCity.trim(),
            state: formData.guardianState.trim(),
            postalCode: formData.guardianPostalCode.trim(),
            relationship: formData.guardianRelationship,
          },
          child: {
            firstName: formData.childFirstName.trim(),
            lastName: formData.childLastName.trim(),
          grade: formData.childGrade || null,
          age: formData.childAge ? parseInt(formData.childAge, 10) : null,
          school: formData.childSchool.trim() || null,
        },
        consent: {
            // E-Signature Data (captured client-side)
            terms: formData.consentTerms,
            foodSafety: formData.consentFoodSafety,
            liability: formData.consentLiability,
            judging: formData.consentJudging,
            signature: formData.consentSignature.trim(),
            signedAt: new Date().toISOString(),
            termsVersion: "lemonade-day-2026-v1",
            photography: formData.consentPhotography,
            // Note: ipAddress, userAgent, and serverTimestamp are added by the API
          },
          status: "pending-consent" as const,
        }
      }

      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // For Lemonade Day: use guardian info as contact, child name as participant
          firstName: isLemonadeDay ? formData.childFirstName.trim() : (formData.firstName.trim() || null),
          lastName: isLemonadeDay ? formData.childLastName.trim() : (formData.lastName.trim() || null),
          organization: isLemonadeDay ? (eventOrganization || formData.organization.trim()) : formData.organization.trim(),
          title: isLemonadeDay ? null : (formData.title.trim() || null),
          phone: isLemonadeDay ? formData.guardianPhone.trim() : formData.phone.trim(),
          email: isLemonadeDay ? formData.guardianEmail.trim() : formData.email.trim(),
          driverFirstName: isLemonadeDay ? null : formData.driverFirstName.trim(),
          driverLastName: isLemonadeDay ? null : formData.driverLastName.trim(),
          driverPhone: isLemonadeDay ? null : formData.driverPhone.trim(),
          driverEmail: isLemonadeDay ? null : formData.driverEmail.trim(),
          entryName: formData.entryName.trim() || null,
          floatDescription: formData.floatDescription.trim(),
          entryLength: isLemonadeDay ? null : (formData.entryLength.trim() || null),
          typeOfEntry: finalTypeOfEntry,
          hasMusic: isLemonadeDay ? false : formData.hasMusic,
          comments: formData.comments.trim() || null,
          eventId: eventId,
          autoApprove: showCoordinatorMode ? formData.autoApprove : false,
          metadata: finalMetadata,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to submit entry" }))
        toast.error(error.error || "Failed to submit entry. Please try again.")
        setLoading(false)
        return
      }

      const result = await response.json()
      
      // CANONICAL RULE: event.type === "lemonade_day" is the ONLY trigger
      if (eventData && (eventData as any).type === "lemonade_day") {
        // Lemonade Day registration is complete - redirect to success page with details
        const successParams = new URLSearchParams({
          standName: formData.entryName || formData.floatDescription.substring(0, 50),
          childName: formData.childFirstName || "your child",
          email: formData.guardianEmail,
        })
        window.location.href = `/lemonade-day/success?${successParams.toString()}`
        return
      }
      
      if (result.autoApproved) {
        toast.success(`🎉 ${(labels.entryNumber ?? "Float #")}${result.floatNumber} added and ready for judging!`)
      } else {
        toast.success("Entry submitted successfully! It will be reviewed by the coordinator.")
      }
      
      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        organization: "",
        title: "",
        phone: "",
        email: "",
        driverFirstName: "",
        driverLastName: "",
        driverPhone: "",
        driverEmail: "",
        entryName: "",
        floatDescription: "",
        entryLength: "",
        typeOfEntry: "",
        typeOfEntryOther: "",
        hasMusic: false,
        comments: "",
        autoApprove: true,
        guardianFirstName: "",
        guardianLastName: "",
        guardianEmail: "",
        guardianPhone: "",
        guardianCity: "",
        guardianState: "",
        guardianPostalCode: "",
        guardianRelationship: "",
        childFirstName: "",
        childLastName: "",
        childGrade: "",
        childAge: "",
        childSchool: "",
        consentTerms: false,
        consentSignature: "",
        consentPhotography: false,
        consentFoodSafety: false,
        consentLiability: false,
        consentJudging: false,
      })

      // Check if there's a returnTo parameter in the URL
      const returnTo = searchParams.get("returnTo")
      if (returnTo) {
        // Redirect back to the coordinator positions page
        setTimeout(() => {
          router.push(returnTo)
        }, 1500)
      } else {
        // Default redirect to home
        setTimeout(() => {
          router.push("/")
        }, 2000)
      }
    } catch (error) {
      console.error("Error submitting entry:", error)
      toast.error("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (signupLocked === null || checkingEvent) {
    return (
      <div className="min-h-screen p-4 bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (signupLocked) {
    return (
      <div className="min-h-screen p-4 bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#DC2626" }}>
              Sign-Ups Closed
            </h1>
            <p className="text-muted-foreground">
              Parade sign-ups are currently closed. New entries are not being accepted at this time.
            </p>
          </div>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="w-full"
          >
            Return to Home
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="container mx-auto max-w-2xl">
        {/* Coordinator banner - only show when explicitly from coordinator portal */}
        {showCoordinatorMode && (
          <div className="mb-4 p-3 rounded-lg border-2 border-blue-500 bg-blue-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-medium">👤 Coordinator Mode</span>
              <span className="text-sm text-blue-600 hidden sm:inline">
                — You can add entries even when public sign-ups are closed
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/coordinator/positions")}
              className="text-blue-600 border-blue-300 hover:bg-blue-100"
            >
              ← Back
            </Button>
          </div>
        )}
        
        <Card className="p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#DC2626" }}>
              {isLemonadeDay
                ? `${eventData?.city} Lemonade Day – Register Your Lemonade Stand`
                : eventData 
                  ? `${eventData.city} ${eventData.name} Participant Entry Sign-up`
                  : showCoordinatorMode 
                    ? "Add Parade Entry" 
                    : "Parade Entry Sign-Up"}
            </h1>
            <p className="text-muted-foreground">
              {isLemonadeDay
                ? "Parents or guardians: please help your child fill out this form."
                : showCoordinatorMode 
                  ? "Add a new entry to the parade. The entry will need to be approved after submission."
                  : "Submit your information to participate in the parade. Your entry will be reviewed by the coordinator."
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* LEMONADE DAY: Parent/Guardian Section FIRST */}
            {isLemonadeDay ? (
              <>
                {/* Section 1: Parent / Mentor / Guardian Information */}
                <div className="space-y-4">
                  <div className="pb-2 border-b">
                    <h3 className="text-lg font-semibold" style={{ color: "#FBBF24" }}>
                      👨‍👩‍👧 Parent / Guardian / Mentor Information
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      This information is for the adult responsible for the participant.
                    </p>
                  </div>

                  {/* Guardian Name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="guardianFirstName" className="block text-sm font-medium mb-1">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="guardianFirstName"
                        value={formData.guardianFirstName}
                        onChange={(e) => setFormData({ ...formData, guardianFirstName: e.target.value })}
                        placeholder="Parent/Guardian First Name"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="guardianLastName" className="block text-sm font-medium mb-1">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="guardianLastName"
                        value={formData.guardianLastName}
                        onChange={(e) => setFormData({ ...formData, guardianLastName: e.target.value })}
                        placeholder="Parent/Guardian Last Name"
                        required
                      />
                    </div>
                  </div>

                  {/* Guardian Contact */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="guardianEmail" className="block text-sm font-medium mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="guardianEmail"
                        type="email"
                        value={formData.guardianEmail}
                        onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                        placeholder="parent@email.com"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="guardianPhone" className="block text-sm font-medium mb-1">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="guardianPhone"
                        type="tel"
                        value={formData.guardianPhone}
                        onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                        placeholder="(830) 123-4567"
                        required
                      />
                    </div>
                  </div>

                  {/* Guardian Location */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <label htmlFor="guardianCity" className="block text-sm font-medium mb-1">
                        City <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="guardianCity"
                        value={formData.guardianCity}
                        onChange={(e) => setFormData({ ...formData, guardianCity: e.target.value })}
                        placeholder="Boerne"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="guardianState" className="block text-sm font-medium mb-1">
                        State <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="guardianState"
                        value={formData.guardianState}
                        onChange={(e) => setFormData({ ...formData, guardianState: e.target.value })}
                        placeholder="TX"
                        maxLength={2}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="guardianPostalCode" className="block text-sm font-medium mb-1">
                        Zip Code <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="guardianPostalCode"
                        value={formData.guardianPostalCode}
                        onChange={(e) => setFormData({ ...formData, guardianPostalCode: e.target.value })}
                        placeholder="78006"
                        required
                      />
                    </div>
                  </div>

                  {/* Relationship to Participant */}
                  <div>
                    <label htmlFor="guardianRelationship" className="block text-sm font-medium mb-1">
                      Relationship to Participant <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="guardianRelationship"
                      value={formData.guardianRelationship}
                      onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      required
                    >
                      <option value="">Select relationship...</option>
                      <option value="Parent">Parent</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Mentor">Mentor</option>
                      <option value="Group Leader">Group Leader</option>
                      <option value="Teacher">Teacher</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Section 2: Child Participant Information */}
                <div className="space-y-4 pt-4">
                  <div className="pb-2 border-b">
                    <h3 className="text-lg font-semibold" style={{ color: "#FBBF24" }}>
                      🧒 Child Participant Information
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Information about the young entrepreneur running the lemonade stand.
                    </p>
                  </div>

                  {/* Child Name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="childFirstName" className="block text-sm font-medium mb-1">
                        Child's First Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="childFirstName"
                        value={formData.childFirstName}
                        onChange={(e) => setFormData({ ...formData, childFirstName: e.target.value })}
                        placeholder="Child's First Name"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="childLastName" className="block text-sm font-medium mb-1">
                        Child's Last Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="childLastName"
                        value={formData.childLastName}
                        onChange={(e) => setFormData({ ...formData, childLastName: e.target.value })}
                        placeholder="Child's Last Name"
                        required
                      />
                    </div>
                  </div>

                  {/* Child Grade and Age */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="childGrade" className="block text-sm font-medium mb-1">
                        Grade <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <select
                        id="childGrade"
                        value={formData.childGrade}
                        onChange={(e) => setFormData({ ...formData, childGrade: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">Select grade...</option>
                        <option value="K">Kindergarten</option>
                        <option value="1">1st Grade</option>
                        <option value="2">2nd Grade</option>
                        <option value="3">3rd Grade</option>
                        <option value="4">4th Grade</option>
                        <option value="5">5th Grade</option>
                        <option value="6">6th Grade</option>
                        <option value="7">7th Grade</option>
                        <option value="8">8th Grade</option>
                        <option value="9">9th Grade</option>
                        <option value="10">10th Grade</option>
                        <option value="11">11th Grade</option>
                        <option value="12">12th Grade</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="childAge" className="block text-sm font-medium mb-1">
                        Age <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <Input
                        id="childAge"
                        type="number"
                        min="5"
                        max="18"
                        value={formData.childAge}
                        onChange={(e) => setFormData({ ...formData, childAge: e.target.value })}
                        placeholder="e.g., 10"
                      />
                    </div>
                  </div>

                  {/* School */}
                  <div>
                    <label htmlFor="childSchool" className="block text-sm font-medium mb-1">
                      School <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="childSchool"
                      value={formData.childSchool}
                      onChange={(e) => setFormData({ ...formData, childSchool: e.target.value })}
                      placeholder="School Name"
                    />
                  </div>
                </div>

                {/* Event Host (read-only display) */}
                <div className="pt-4">
                  <label htmlFor="eventHost" className="block text-sm font-medium mb-1">
                    Event Host
                  </label>
                  <Input
                    id="eventHost"
                    value={formData.organization || eventOrganization}
                    disabled
                    className="bg-gray-100 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This event is hosted by {formData.organization || eventOrganization || "the organizing organization"}.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* PARADE: Original Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                      First Name <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="First Name"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                      Last Name <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Last Name"
                    />
                  </div>
                </div>

                {/* Organization */}
                <div>
                  <label htmlFor="organization" className="block text-sm font-medium mb-1">
                    Organization Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="organization"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    placeholder="Organization Name"
                    required
                  />
                </div>

                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-1">
                    Title <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Your Title/Role"
                  />
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(830) 123-4567"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Driver Information Section - Only for parade events */}
            {!isLemonadeDay && (
              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-4" style={{ color: "#DC2626" }}>
                  Driver Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="driverFirstName" className="block text-sm font-medium mb-1">
                      Driver First Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="driverFirstName"
                      value={formData.driverFirstName || ""}
                      onChange={(e) => setFormData({ ...formData, driverFirstName: e.target.value })}
                      placeholder="Driver First Name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="driverLastName" className="block text-sm font-medium mb-1">
                      Driver Last Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="driverLastName"
                      value={formData.driverLastName || ""}
                      onChange={(e) => setFormData({ ...formData, driverLastName: e.target.value })}
                      placeholder="Driver Last Name"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="driverPhone" className="block text-sm font-medium mb-1">
                      Driver Phone Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="driverPhone"
                      type="tel"
                      value={formData.driverPhone || ""}
                      onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                      placeholder="(830) 123-4567"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="driverEmail" className="block text-sm font-medium mb-1">
                      Driver Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="driverEmail"
                      type="email"
                      value={formData.driverEmail || ""}
                      onChange={(e) => setFormData({ ...formData, driverEmail: e.target.value })}
                      placeholder="driver@email.com"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Lemonade Day: Stand Information Section */}
            {isLemonadeDay && (
              <div className="space-y-4 pt-4">
                <div className="pb-2 border-b">
                  <h3 className="text-lg font-semibold" style={{ color: "#FBBF24" }}>
                    🍋 Lemonade Stand Information
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tell us about your lemonade stand business!
                  </p>
                </div>

                {/* Stand Name */}
                <div>
                  <label htmlFor="entryName" className="block text-sm font-medium mb-1">
                    Stand Name <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    What's the name of your lemonade stand? Be creative!
                  </p>
                  <Input
                    id="entryName"
                    value={formData.entryName}
                    onChange={(e) => setFormData({ ...formData, entryName: e.target.value })}
                    placeholder="e.g., Sunny's Super Lemonade, The Lemon Drop Shop"
                    required
                  />
                </div>

                {/* Stand Description */}
                <div>
                  <label htmlFor="floatDescription" className="block text-sm font-medium mb-1">
                    Tell us about your lemonade stand <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    What makes your stand special? What will you sell? Any fun flavors or decorations?
                  </p>
                  <Textarea
                    id="floatDescription"
                    value={formData.floatDescription}
                    onChange={(e) => setFormData({ ...formData, floatDescription: e.target.value })}
                    placeholder="Tell us about your lemonade stand, your flavors, decorations, and what makes it unique..."
                    rows={4}
                    required
                  />
                </div>
              </div>
            )}

            {/* Parade: Entry Name / Description */}
            {!isLemonadeDay && (
              <>
                <div>
                  <label htmlFor="entryName" className="block text-sm font-medium mb-1">
                    Entry Name <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="entryName"
                    value={formData.entryName}
                    onChange={(e) => setFormData({ ...formData, entryName: e.target.value })}
                    placeholder="Short name for your entry"
                  />
                </div>

                <div>
                  <label htmlFor="floatDescription" className="block text-sm font-medium mb-1">
                    {labels.entryDescription} <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    id="floatDescription"
                    value={formData.floatDescription}
                    onChange={(e) => setFormData({ ...formData, floatDescription: e.target.value })}
                    placeholder={`Describe your ${labels.entry.toLowerCase()}, what it represents, and any special features...`}
                    rows={5}
                    required
                  />
                </div>
              </>
            )}

            {/* Entry Length and Type - Only for parade events */}
            {!isLemonadeDay && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="entryLength" className="block text-sm font-medium mb-1">
                      Entry Length <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="entryLength"
                      value={formData.entryLength}
                      onChange={(e) => setFormData({ ...formData, entryLength: e.target.value })}
                      placeholder="e.g., 40 ft"
                    />
                  </div>
                  <div>
                    <label htmlFor="typeOfEntry" className="block text-sm font-medium mb-1">
                      Type of Entry <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="typeOfEntry"
                      value={formData.typeOfEntry}
                      onChange={(e) => setFormData({ ...formData, typeOfEntry: e.target.value, typeOfEntryOther: "" })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      required
                    >
                      <option value="">Select type...</option>
                      {TYPE_OF_ENTRY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {formData.typeOfEntry === "Other" && (
                      <Input
                        className="mt-2"
                        value={formData.typeOfEntryOther}
                        onChange={(e) => setFormData({ ...formData, typeOfEntryOther: e.target.value })}
                        placeholder="Specify type of entry"
                        required
                      />
                    )}
                  </div>
                </div>

                {/* Music */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Will your entry have music? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasMusic"
                        checked={formData.hasMusic === true}
                        onChange={() => setFormData({ ...formData, hasMusic: true })}
                        className="w-4 h-4"
                        required
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasMusic"
                        checked={formData.hasMusic === false}
                        onChange={() => setFormData({ ...formData, hasMusic: false })}
                        className="w-4 h-4"
                        required
                      />
                      <span>No</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* E-Signature Consent Section - Lemonade Day Only */}
            {isLemonadeDay && (
              <div className="space-y-4 pt-4">
                <div className="pb-2 border-b">
                  <h3 className="text-lg font-semibold" style={{ color: "#FBBF24" }}>
                    ✍️ Parent/Guardian Consent & Authorization
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please review and sign below to complete registration
                  </p>
                </div>

                {/* Required Acknowledgments */}
                <div className="p-4 rounded-lg border-2 border-red-300 bg-red-50">
                  <h4 className="font-semibold text-red-900 mb-3">✅ Required Acknowledgments</h4>
                  <p className="text-sm text-red-800 mb-4">
                    All of the following are required for participation:
                  </p>

                  <div className="space-y-3">
                    {/* Guardian Approval */}
                    <label className="flex items-start gap-3 p-3 border-2 border-red-400 rounded-lg bg-white cursor-pointer hover:bg-red-50 transition-colors">
                      <input
                        type="checkbox"
                        id="consentTerms"
                        checked={formData.consentTerms}
                        onChange={(e) => setFormData({ ...formData, consentTerms: e.target.checked })}
                        className="mt-0.5 h-5 w-5 rounded border-red-400 text-red-600 focus:ring-red-500"
                        required
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-red-900 text-sm">
                          Parent or Guardian Approval <span className="text-red-500">*</span>
                        </span>
                        <p className="text-xs text-red-800 mt-1">
                          I am the parent or legal guardian and approve my child's participation in National Lemonade Day.
                        </p>
                      </div>
                    </label>

                    {/* Food Safety */}
                    <label className="flex items-start gap-3 p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        id="consentFoodSafety"
                        checked={formData.consentFoodSafety}
                        onChange={(e) => setFormData({ ...formData, consentFoodSafety: e.target.checked })}
                        className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        required
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm">
                          Food Safety Awareness <span className="text-red-500">*</span>
                        </span>
                        <p className="text-xs text-gray-600 mt-1">
                          I understand that basic food safety practices are expected, including clean hands, clean surfaces, and safe ingredients.
                        </p>
                      </div>
                    </label>

                    {/* Liability */}
                    <label className="flex items-start gap-3 p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        id="consentLiability"
                        checked={formData.consentLiability}
                        onChange={(e) => setFormData({ ...formData, consentLiability: e.target.checked })}
                        className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        required
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm">
                          Liability Acknowledgment <span className="text-red-500">*</span>
                        </span>
                        <p className="text-xs text-gray-600 mt-1">
                          I understand participation is voluntary and I assume responsibility for my child's lemonade stand activity.
                        </p>
                      </div>
                    </label>

                    {/* Judging Consent */}
                    <label className="flex items-start gap-3 p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        id="consentJudging"
                        checked={formData.consentJudging}
                        onChange={(e) => setFormData({ ...formData, consentJudging: e.target.checked })}
                        className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        required
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm">
                          Judging & Scoring Consent <span className="text-red-500">*</span>
                        </span>
                        <p className="text-xs text-gray-600 mt-1">
                          I consent to my child's lemonade stand being judged and scored as part of the event.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Signature Field */}
                  <div className="mt-4 pt-4 border-t-2 border-red-300">
                    <label htmlFor="consentSignature" className="block text-sm font-medium text-red-900 mb-1">
                      Type your full legal name to sign <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-red-700 mb-2">
                      Must match guardian name entered above ({formData.guardianFirstName} {formData.guardianLastName})
                    </p>
                    <Input
                      id="consentSignature"
                      value={formData.consentSignature}
                      onChange={(e) => setFormData({ ...formData, consentSignature: e.target.value })}
                      placeholder="Type your full legal name"
                      className="border-red-300 focus:border-red-500 bg-white"
                      style={{ fontFamily: "cursive", fontSize: "1.1rem" }}
                      required
                    />
                  </div>
                </div>

                {/* Media Release (Optional) */}
                <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <h4 className="font-semibold text-gray-700 mb-3">Media Release <span className="text-muted-foreground font-normal">(Optional)</span></h4>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="consentPhotography"
                      checked={formData.consentPhotography}
                      onChange={(e) => setFormData({ ...formData, consentPhotography: e.target.checked })}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                    />
                    <label htmlFor="consentPhotography" className="text-sm text-gray-700 cursor-pointer">
                      I consent to photographs and/or videos of my child being taken and used for event promotion, social media, and marketing purposes.
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <label htmlFor="comments" className="block text-sm font-medium mb-1">
                {isLemonadeDay ? "Anything else you want to tell us?" : "Additional Comments"} <span className="text-muted-foreground">(optional)</span>
              </label>
              {isLemonadeDay && (
                <p className="text-xs text-muted-foreground mb-2">
                  Optional notes or questions
                </p>
              )}
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                placeholder={isLemonadeDay ? "Any questions or special information..." : "Any additional information or special requirements..."}
                rows={3}
              />
            </div>

            {/* Event-configurable extra fields (stored in metadata) */}
            {extraFields.length > 0 && (
              <div className="space-y-4">
                <div className="pt-2">
                  <h3 className="text-lg font-semibold">Additional Information</h3>
                  <p className="text-sm text-muted-foreground">
                    These questions may vary by event.
                  </p>
                </div>

                {extraFields.map((f) => {
                  const value = metadata[f.key]
                  const baseLabel = (
                    <>
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </>
                  )

                  if (f.type === "textarea") {
                    return (
                      <div key={f.key}>
                        <label className="block text-sm font-medium mb-1">{baseLabel}</label>
                        {f.helpText && (
                          <p className="text-xs text-muted-foreground mb-2">{f.helpText}</p>
                        )}
                        <Textarea
                          value={typeof value === "string" ? value : String(value ?? "")}
                          onChange={(e) =>
                            setMetadata((prev) => ({ ...prev, [f.key]: e.target.value }))
                          }
                          placeholder={f.placeholder}
                          rows={4}
                        />
                      </div>
                    )
                  }

                  if (f.type === "select") {
                    return (
                      <div key={f.key}>
                        <label className="block text-sm font-medium mb-1">{baseLabel}</label>
                        {f.helpText && (
                          <p className="text-xs text-muted-foreground mb-2">{f.helpText}</p>
                        )}
                        <select
                          value={typeof value === "string" ? value : String(value ?? "")}
                          onChange={(e) =>
                            setMetadata((prev) => ({ ...prev, [f.key]: e.target.value }))
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="">Select...</option>
                          {(f.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  }

                  if (f.type === "boolean") {
                    const checked = Boolean(value)
                    return (
                      <div key={f.key} className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setMetadata((prev) => ({ ...prev, [f.key]: e.target.checked }))
                          }
                          className="mt-1 h-4 w-4"
                        />
                        <div>
                          <label className="text-sm font-medium">{baseLabel}</label>
                          {f.helpText && (
                            <p className="text-xs text-muted-foreground">{f.helpText}</p>
                          )}
                        </div>
                      </div>
                    )
                  }

                  // text | number default
                  return (
                    <div key={f.key}>
                      <label className="block text-sm font-medium mb-1">{baseLabel}</label>
                      {f.helpText && (
                        <p className="text-xs text-muted-foreground mb-2">{f.helpText}</p>
                      )}
                      <Input
                        type={f.type === "number" ? "number" : "text"}
                        value={
                          typeof value === "number"
                            ? String(value)
                            : (typeof value === "string" ? value : String(value ?? ""))
                        }
                        onChange={(e) =>
                          setMetadata((prev) => ({
                            ...prev,
                            [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                          }))
                        }
                        placeholder={f.placeholder}
                      />
                    </div>
                  )
                })}
              </div>
            )}

            {/* Coordinator: Auto-approve option for last-minute entries - only from coordinator portal */}
            {showCoordinatorMode && (
              <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoApprove}
                    onChange={(e) => setFormData({ ...formData, autoApprove: e.target.checked })}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="font-semibold text-green-800">
                      ⚡ Add as Last-Minute Entry
                    </span>
                    <p className="text-sm text-green-700 mt-1">
                      Auto-approve and assign {labels.entry.toLowerCase()} number immediately. 
                      Judges will see this entry right away.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={loading}
                className={`w-full text-white ${
                  showCoordinatorMode && formData.autoApprove 
                    ? "bg-green-600 hover:bg-green-700" 
                    : "bg-[#DC2626] hover:bg-[#DC2626]/90"
                }`}
                size="lg"
              >
                {loading 
                  ? "Submitting..." 
                  : showCoordinatorMode && formData.autoApprove 
                    ? "⚡ Add & Approve Entry" 
                    : "Submit Entry"
                }
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen p-4 bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SignUpPageContent />
    </Suspense>
  )
}

