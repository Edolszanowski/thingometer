"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, Edit2, Trash2, Save, X, GripVertical } from "lucide-react"
import Link from "next/link"

interface Category {
  id?: number
  categoryName?: string
  name?: string // Support both categoryName (from DB) and name (from form)
  required?: boolean
  hasNone?: boolean
  hasNoneOption?: boolean // Support both hasNone and hasNoneOption
}

interface Judge {
  id?: number
  name: string
}

interface Event {
  id: number
  name: string
  city: string
  eventDate: string | Date | null
  startDate: string | Date | null
  endDate: string | Date | null
  active: boolean
  entryCategoryTitle?: string
  categories?: Category[]
  judges?: Judge[]
}

function getAdminPassword(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return authCookie ? authCookie.split("=")[1] : null
}

export default function AdminEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    eventDate: "",
    startDate: "",
    endDate: "",
    active: true,
    scoringCategories: [
      { name: "Lighting", required: true, hasNone: true },
      { name: "Theme", required: true, hasNone: true },
      { name: "Traditions", required: true, hasNone: true },
      { name: "Spirit", required: true, hasNone: true },
      { name: "Music", required: false, hasNone: true },
    ],
    judges: ["Judge 1", "Judge 2", "Judge 3"] as string[],
  })
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events?password=${encodeURIComponent(password)}`)
      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch events")
      }

      const data = await response.json()
      setEvents(data)
    } catch (error) {
      console.error("Error fetching events:", error)
      toast.error("Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.city) {
      toast.error("Name and city are required")
      return
    }

    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events?password=${encodeURIComponent(password)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          city: formData.city,
          eventDate: formData.eventDate || null,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          active: formData.active,
          scoringCategories: formData.scoringCategories,
          judges: formData.judges,
        }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        const errorMessage = error.error || "Failed to create event"
        toast.error(errorMessage)
        if (error.code === "TABLE_NOT_FOUND") {
          console.error("Migration required:", errorMessage)
        }
        return
      }

      toast.success("Event created successfully")
      setShowForm(false)
      setFormData({
        name: "",
        city: "",
        eventDate: "",
        startDate: "",
        endDate: "",
        active: true,
        scoringCategories: [
          { name: "Lighting", required: true, hasNone: true },
          { name: "Theme", required: true, hasNone: true },
          { name: "Traditions", required: true, hasNone: true },
          { name: "Spirit", required: true, hasNone: true },
          { name: "Music", required: false, hasNone: true },
        ] as Array<{ name: string; required: boolean; hasNone: boolean }>,
        judges: ["Judge 1", "Judge 2", "Judge 3"],
      })
      await fetchEvents()
    } catch (error) {
      console.error("Error creating event:", error)
      toast.error("Failed to create event")
    }
  }

  const handleUpdate = async (eventId: number, updates: Partial<Event>) => {
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId, ...updates }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to update event")
        return
      }

      toast.success("Event updated successfully")
      setEditing(null)
      await fetchEvents()
    } catch (error) {
      console.error("Error updating event:", error)
      toast.error("Failed to update event")
    }
  }

  const handleUpdateJudge = async (eventId: number, judgeId: number, newName: string) => {
    if (!newName.trim()) {
      toast.error("Judge name cannot be empty")
      return
    }

    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events/judges?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, judgeId, name: newName.trim() }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to update judge")
        return
      }

      toast.success("Judge updated successfully")
      await fetchEvents()
    } catch (error) {
      console.error("Error updating judge:", error)
      toast.error("Failed to update judge")
    }
  }

  const handleRemoveJudge = async (eventId: number, judgeId: number) => {
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events/judges?password=${encodeURIComponent(password)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, judgeId }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to remove judge")
        return
      }

      toast.success("Judge removed successfully")
      await fetchEvents()
    } catch (error) {
      console.error("Error removing judge:", error)
      toast.error("Failed to remove judge")
    }
  }

  const handleAddCategory = async (eventId: number, categoryName: string) => {
    if (!categoryName.trim()) {
      toast.error("Category name cannot be empty")
      return
    }

    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events/categories?password=${encodeURIComponent(password)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          eventId, 
          categoryName: categoryName.trim(),
          required: true,
          hasNoneOption: true,
        }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to add category")
        return
      }

      toast.success("Category added successfully")
      await fetchEvents()
    } catch (error) {
      console.error("Error adding category:", error)
      toast.error("Failed to add category")
    }
  }

  const handleUpdateCategory = async (eventId: number, categoryId: number, newName: string) => {
    if (!newName.trim()) {
      toast.error("Category name cannot be empty")
      return
    }

    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events/categories?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, categoryId, categoryName: newName.trim() }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to update category")
        return
      }

      toast.success("Category updated successfully")
      await fetchEvents()
    } catch (error) {
      console.error("Error updating category:", error)
      toast.error("Failed to update category")
    }
  }

  const handleUpdateCategoryRequired = async (eventId: number, categoryId: number, required: boolean) => {
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events/categories?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, categoryId, required }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to update category")
        return
      }

      await fetchEvents()
    } catch (error) {
      console.error("Error updating category:", error)
      toast.error("Failed to update category")
    }
  }

  const handleUpdateCategoryHasNone = async (eventId: number, categoryId: number, hasNoneOption: boolean) => {
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events/categories?password=${encodeURIComponent(password)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, categoryId, hasNoneOption }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to update category")
        return
      }

      await fetchEvents()
    } catch (error) {
      console.error("Error updating category:", error)
      toast.error("Failed to update category")
    }
  }

  const handleRemoveCategory = async (eventId: number, categoryId: number) => {
    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events/categories?password=${encodeURIComponent(password)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, categoryId }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to remove category")
        return
      }

      toast.success("Category removed successfully")
      await fetchEvents()
    } catch (error) {
      console.error("Error removing category:", error)
      toast.error("Failed to remove category")
    }
  }

  const handleAddJudge = async (eventId: number, judgeName: string) => {
    if (!judgeName.trim()) {
      toast.error("Judge name cannot be empty")
      return
    }

    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events/judges?password=${encodeURIComponent(password)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, name: judgeName.trim() }),
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to add judge")
        return
      }

      toast.success("Judge added successfully")
      await fetchEvents()
    } catch (error) {
      console.error("Error adding judge:", error)
      toast.error("Failed to add judge")
    }
  }

  const handleDelete = async (eventId: number, eventName: string) => {
    if (!confirm(`Are you sure you want to delete "${eventName}" and ALL associated data?\n\nThis will delete:\n- All floats in this event\n- All scores for this event\n- All categories for this event\n- All judges for this event\n\nThis action CANNOT be undone!`)) {
      return
    }

    try {
      const password = getAdminPassword()
      if (!password) {
        router.push("/admin")
        return
      }

      const response = await fetch(`/api/admin/events?password=${encodeURIComponent(password)}&id=${eventId}`, {
        method: "DELETE",
      })

      if (response.status === 401) {
        router.push("/admin")
        return
      }

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || "Failed to delete event")
        return
      }

      toast.success("Event deleted successfully")
      await fetchEvents()
    } catch (error) {
      console.error("Error deleting event:", error)
      toast.error("Failed to delete event")
    }
  }

  const addCategory = () => {
    setFormData({
      ...formData,
      scoringCategories: [
        ...formData.scoringCategories,
        { name: "", required: true, hasNone: true },
      ],
    })
  }

  const removeCategory = (index: number) => {
    setFormData({
      ...formData,
      scoringCategories: formData.scoringCategories.filter((_, i) => i !== index),
    })
  }

  const updateCategory = (index: number, field: string, value: any) => {
    const updated = [...formData.scoringCategories]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, scoringCategories: updated })
  }

  const addJudge = () => {
    setFormData({
      ...formData,
      judges: [...formData.judges, ""],
    })
  }

  const removeJudge = (index: number) => {
    setFormData({
      ...formData,
      judges: formData.judges.filter((_, i) => i !== index),
    })
  }

  const updateJudge = (index: number, value: string) => {
    const updated = [...formData.judges]
    updated[index] = value
    setFormData({ ...formData, judges: updated })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading events...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-full overflow-x-hidden">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "#14532D" }}>
          Manage Events
        </h1>
        <div className="flex gap-2">
          <Link href="/admin/results">
            <Button variant="outline" className="text-xs sm:text-sm">Back to Dashboard</Button>
          </Link>
        </div>
      </div>

      <Card className="p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Parade Events</h2>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#16A34A] hover:bg-[#16A34A]/90 text-white text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancel" : "Create New Event"}
          </Button>
        </div>

        {showForm && (
          <div className="space-y-6 p-3 sm:p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Event Name *</label>
                <Input
                  placeholder="e.g., 2025 Comfort Xmas Parade"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City *</label>
                <Input
                  placeholder="e.g., Comfort"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Start Date (Optional)</label>
                <Input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
                <Input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="active" className="text-sm font-medium">
                  Active (visible to coordinators)
                </label>
              </div>
            </div>

            {/* Scoring Categories */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <label className="block text-sm font-medium">Scoring Categories</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Define the criteria judges will use to score floats (e.g., Lighting, Theme, Creativity)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCategory}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Category
                </Button>
              </div>
              <div className="space-y-2">
                {formData.scoringCategories.map((category, index) => (
                  <div key={index} className="flex gap-2 items-center p-2 border rounded bg-white">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Category name (e.g., Lighting)"
                      value={category.name}
                      onChange={(e) => updateCategory(index, "categoryName", e.target.value)}
                      className="flex-1"
                    />
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap group relative" title="Required categories must have a score (1-20) or None (0) before a judge can submit">
                      <input
                        type="checkbox"
                        checked={category.required !== false}
                        onChange={(e) => updateCategory(index, "required", e.target.checked)}
                        className="h-3 w-3"
                      />
                      <span>Required</span>
                      <span className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        Judges must score this category before submitting
                      </span>
                    </label>
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap group relative" title="If enabled, judges can click a '(None)' button to set score to 0, meaning this category doesn't apply to the float (e.g., Music for floats without music)">
                      <input
                        type="checkbox"
                        checked={category.hasNone !== false}
                        onChange={(e) => updateCategory(index, "hasNone", e.target.checked)}
                        className="h-3 w-3"
                      />
                      <span>Has None</span>
                      <span className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        Allows judges to select "(None)" (score = 0) for this category when it doesn't apply
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCategory(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Judges */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium">Judges</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addJudge}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Judge
                </Button>
              </div>
              <div className="space-y-2">
                {formData.judges.map((judge, index) => (
                  <div key={index} className="flex gap-2 items-center p-2 border rounded bg-white">
                    <Input
                      placeholder="Judge name (e.g., Judge 1)"
                      value={judge}
                      onChange={(e) => updateJudge(index, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeJudge(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleCreate} className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white text-xs sm:text-sm w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[100px]">City</TableHead>
                <TableHead className="min-w-[120px]">Start Date</TableHead>
                <TableHead className="min-w-[120px]">End Date</TableHead>
                <TableHead className="min-w-[80px]">Status</TableHead>
                <TableHead className="min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  {editing === event.id ? (
                    <>
                      <TableCell colSpan={6} className="p-4">
                        <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-1">Event Name *</label>
                              <Input
                                defaultValue={event.name}
                                onBlur={(e) => {
                                  if (e.target.value !== event.name) {
                                    handleUpdate(event.id, { name: e.target.value })
                                  }
                                }}
                                className="text-xs sm:text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">City *</label>
                              <Input
                                defaultValue={event.city}
                                onBlur={(e) => {
                                  if (e.target.value !== event.city) {
                                    handleUpdate(event.id, { city: e.target.value })
                                  }
                                }}
                                className="text-xs sm:text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Start Date (Optional)</label>
                              <Input
                                type="datetime-local"
                                defaultValue={event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : ""}
                                onBlur={(e) => {
                                  const newDateStr = e.target.value
                                  const oldDateStr = event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : ""
                                  if (newDateStr !== oldDateStr) {
                                    // API expects Date object or null
                                    const newDate = newDateStr ? new Date(newDateStr) : null
                                    handleUpdate(event.id, { startDate: newDate as any as string | null })
                                  }
                                }}
                                className="text-xs sm:text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
                              <Input
                                type="datetime-local"
                                defaultValue={event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : ""}
                                onBlur={(e) => {
                                  const newDateStr = e.target.value
                                  const oldDateStr = event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : ""
                                  if (newDateStr !== oldDateStr) {
                                    // API expects Date object or null
                                    const newDate = newDateStr ? new Date(newDateStr) : null
                                    handleUpdate(event.id, { endDate: newDate as any as string | null })
                                  }
                                }}
                                className="text-xs sm:text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`active-${event.id}`}
                                defaultChecked={event.active}
                                onChange={(e) => handleUpdate(event.id, { active: e.target.checked })}
                                className="h-4 w-4"
                              />
                              <label htmlFor={`active-${event.id}`} className="text-sm font-medium">
                                Active (visible to coordinators)
                              </label>
                            </div>
                          </div>
                          
                          {/* Categories Management (Editable) */}
                          <div className="border-t pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <label className="block text-sm font-medium">Scoring Categories</label>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Define the criteria judges will use to score floats. The "Entry" category is automatically calculated from total scores.
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const categoryName = prompt("Enter category name:")
                                  if (categoryName && categoryName.trim()) {
                                    await handleAddCategory(event.id, categoryName.trim())
                                  }
                                }}
                                className="text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Category
                              </Button>
                            </div>
                            
                            {/* Entry Category Title - Special category */}
                            <div className="mb-4 p-3 border-2 border-blue-200 rounded-md bg-blue-50">
                              <label className="block text-sm font-medium mb-1">Entry Category Title</label>
                              <Input
                                placeholder="e.g., Best Entry, Best Overall Entry"
                                defaultValue={(event as any).entryCategoryTitle || "Best Entry"}
                                onBlur={(e) => {
                                  const newTitle = e.target.value.trim() || "Best Entry"
                                  const oldTitle = (event as any).entryCategoryTitle || "Best Entry"
                                  if (newTitle !== oldTitle) {
                                    handleUpdate(event.id, { entryCategoryTitle: newTitle })
                                  }
                                }}
                                className="text-xs sm:text-sm bg-white"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                This is the title for the overall/entry award (automatically calculated from total scores - not scored directly by judges)
                              </p>
                            </div>
                            
                            {/* Regular Scoring Categories */}
                            <div className="space-y-2">
                              {event.categories && event.categories.length > 0 ? (
                                event.categories.map((category: any, index: number) => (
                                  <div key={category.id || index} className="flex gap-2 items-center p-2 border rounded bg-white">
                                    <GripVertical className="h-4 w-4 text-gray-400" />
                                    <Input
                                      placeholder="Category name (e.g., Lighting)"
                                      defaultValue={category.categoryName || category.name || ""}
                                      onBlur={async (e) => {
                                        const newName = e.target.value.trim()
                                        const oldName = category.categoryName || category.name || ""
                                        if (newName && newName !== oldName) {
                                          await handleUpdateCategory(event.id, category.id, newName)
                                        }
                                      }}
                                      className="flex-1 text-xs sm:text-sm"
                                    />
                                    <label className="flex items-center gap-1 text-xs whitespace-nowrap group relative" title="Required categories must have a score (1-20) or None (0) before a judge can submit">
                                      <input
                                        type="checkbox"
                                        defaultChecked={category.required !== false}
                                        onChange={async (e) => {
                                          await handleUpdateCategoryRequired(event.id, category.id, e.target.checked)
                                        }}
                                        className="h-3 w-3"
                                      />
                                      <span>Required</span>
                                    </label>
                                    <label className="flex items-center gap-1 text-xs whitespace-nowrap group relative" title="If enabled, judges can click a '(None)' button to set score to 0">
                                      <input
                                        type="checkbox"
                                        defaultChecked={category.hasNoneOption !== false || category.hasNone !== false}
                                        onChange={async (e) => {
                                          await handleUpdateCategoryHasNone(event.id, category.id, e.target.checked)
                                        }}
                                        className="h-3 w-3"
                                      />
                                      <span>Has None</span>
                                    </label>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        if (confirm(`Are you sure you want to remove "${category.categoryName || category.name}"? This will delete all scores for this category.`)) {
                                          await handleRemoveCategory(event.id, category.id)
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">No categories added yet</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Judges Management */}
                          <div className="border-t pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <label className="block text-sm font-medium">Judges</label>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Manage judges for this event. Judges with scores cannot be deleted but can be renamed.
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const judgeName = prompt("Enter judge name:")
                                  if (judgeName && judgeName.trim()) {
                                    await handleAddJudge(event.id, judgeName.trim())
                                  }
                                }}
                                className="text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Judge
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {event.judges && event.judges.length > 0 ? (
                                event.judges.map((judge: any, index: number) => (
                                  <div key={judge.id || index} className="flex gap-2 items-center p-2 border rounded bg-white">
                                    <Input
                                      placeholder="Judge name (e.g., Judge 1)"
                                      defaultValue={judge.name}
                                      onBlur={async (e) => {
                                        const newName = e.target.value.trim()
                                        if (newName && newName !== judge.name) {
                                          // Update judge name
                                          await handleUpdateJudge(event.id, judge.id, newName)
                                        }
                                      }}
                                      className="flex-1 text-xs sm:text-sm"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        if (confirm(`Are you sure you want to remove "${judge.name}"? This cannot be undone if the judge has scores.`)) {
                                          await handleRemoveJudge(event.id, judge.id)
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                      title={judge.id ? "Remove judge" : "Cancel adding judge"}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">No judges added yet</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditing(null)}
                              className="text-xs sm:text-sm"
                            >
                              <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium text-xs sm:text-sm min-w-[150px]">
                        <div>
                          <div>{event.name}</div>
                          {expandedEvent === event.id && (
                            <div className="mt-2 text-xs text-muted-foreground space-y-1">
                              {event.categories && event.categories.length > 0 && (
                                <div>
                                  <strong>Categories:</strong> {event.categories.map(c => (c as any).categoryName || (c as any).name || "").filter(Boolean).join(", ")}
                                </div>
                              )}
                              {event.judges && event.judges.length > 0 && (
                                <div>
                                  <strong>Judges:</strong> {event.judges.map(j => j.name).join(", ")}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm min-w-[100px]">{event.city}</TableCell>
                      <TableCell className="text-xs sm:text-sm min-w-[120px]">
                        {event.startDate
                          ? new Date(event.startDate).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {event.endDate
                          ? new Date(event.endDate).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="min-w-[80px]">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            event.active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {event.active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <div className="flex gap-1 sm:gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
                            className="text-xs sm:text-sm p-1 sm:p-2"
                            title="View details"
                          >
                            {expandedEvent === event.id ? "▼" : "▶"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(event.id)}
                            className="text-xs sm:text-sm p-1 sm:p-2"
                          >
                            <Edit2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(event.id, event.name)}
                            className="text-red-600 hover:text-red-700 text-xs sm:text-sm p-1 sm:p-2"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
