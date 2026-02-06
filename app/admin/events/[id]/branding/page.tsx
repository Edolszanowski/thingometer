"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Save, Eye } from "lucide-react"
import Link from "next/link"

interface ThemePreset {
  id: number
  name: string
  slug: string
  description: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    foreground: string
  }
  accessibilityMode: string
}

interface EventBranding {
  id?: number
  eventId: number
  themePreset?: string
  textContrastMode: string
  logoUrl?: string
  logoDarkUrl?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  backgroundImageUrl?: string
  customCss?: string
}

/**
 * Event Branding Management Page
 * 
 * Administrative customization is intentionally constrained, preview-driven,
 * and reversible to prevent unintentional design errors while maintaining
 * professional results.
 */
export default function EventBrandingPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [presets, setPresets] = useState<ThemePreset[]>([])
  const [eventName, setEventName] = useState("")
  
  // Form state
  const [preset, setPreset] = useState("custom")
  const [primaryColor, setPrimaryColor] = useState("#DC2626")
  const [secondaryColor, setSecondaryColor] = useState("#16A34A")
  const [accentColor, setAccentColor] = useState("#F59E0B")
  const [contrastMode, setContrastMode] = useState("auto")
  const [logoUrl, setLogoUrl] = useState("")

  // Load presets and existing branding
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // Load theme presets
        const presetsRes = await fetch("/api/admin/theme-presets")
        if (presetsRes.ok) {
          const presetsData = await presetsRes.json()
          setPresets(presetsData)
        }

        // Load event info and branding
        const eventRes = await fetch(`/api/admin/events/${eventId}/branding`)
        if (eventRes.ok) {
          const eventData = await eventRes.json()
          setEventName(eventData.eventName || `Event ${eventId}`)
          
          if (eventData.branding) {
            const b = eventData.branding
            setPreset(b.themePreset || "custom")
            setPrimaryColor(b.primaryColor || "#DC2626")
            setSecondaryColor(b.secondaryColor || "#16A34A")
            setAccentColor(b.accentColor || "#F59E0B")
            setContrastMode(b.textContrastMode || "auto")
            setLogoUrl(b.logoUrl || "")
          }
        }
      } catch (error) {
        console.error("Error loading branding data:", error)
        toast.error("Failed to load branding configuration")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [eventId])

  // Apply preset colors when preset changes
  useEffect(() => {
    if (preset !== "custom") {
      const selectedPreset = presets.find((p) => p.slug === preset)
      if (selectedPreset) {
        setPrimaryColor(selectedPreset.colors.primary)
        setSecondaryColor(selectedPreset.colors.secondary)
        setAccentColor(selectedPreset.colors.accent)
      }
    }
  }, [preset, presets])

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/events/${eventId}/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themePreset: preset === "custom" ? null : preset,
          textContrastMode: contrastMode,
          primaryColor,
          secondaryColor,
          accentColor,
          logoUrl: logoUrl || null,
        }),
      })

      if (response.ok) {
        toast.success("Branding saved successfully")
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to save branding")
      }
    } catch (error) {
      console.error("Error saving branding:", error)
      toast.error("Failed to save branding")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/events">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Button>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">Event Branding</h1>
      <p className="text-muted-foreground mb-6">{eventName}</p>

      <div className="space-y-8">
        {/* Theme Preset Selection */}
        <div className="space-y-2">
          <Label>Theme Preset</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Start with a professionally designed theme or customize your own
          </p>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger>
              <SelectValue placeholder="Select a theme preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom Theme</SelectItem>
              {presets.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.name} {p.accessibilityMode === "outdoor" && "(Outdoor-optimized)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Color Customization */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Colors</h2>
          <p className="text-sm text-muted-foreground">
            {preset === "custom"
              ? "Define your custom brand colors"
              : "Override preset colors if needed"}
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#DC2626"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#16A34A"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#F59E0B"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contrast Mode */}
        <div className="space-y-2">
          <Label>Contrast Mode</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Enhance visibility for outdoor events in bright sunlight
          </p>
          <Select value={contrastMode} onValueChange={setContrastMode}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (Standard)</SelectItem>
              <SelectItem value="high">High Contrast</SelectItem>
              <SelectItem value="maximum">Maximum Contrast (Bright Sun)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logo URL */}
        <div className="space-y-2">
          <Label>Event Logo URL</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Provide a URL to your event logo (PNG or SVG with transparent background recommended)
          </p>
          <Input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
          />
        </div>

        {/* Live Preview */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Preview</h2>
          <p className="text-sm text-muted-foreground mb-4">
            See how your branding will appear to judges
          </p>
          <div
            className={`border rounded-lg p-6 ${
              contrastMode === "high"
                ? "contrast-high"
                : contrastMode === "maximum"
                ? "contrast-maximum"
                : ""
            }`}
            style={{
              backgroundColor: "#FFFFFF",
            }}
          >
            {logoUrl && (
              <div className="mb-4">
                <img
                  src={logoUrl}
                  alt="Event logo"
                  className="h-12 object-contain"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>
            )}
            <h4
              className="text-2xl font-bold mb-4"
              style={{ color: primaryColor }}
            >
              Sample Heading
            </h4>
            <p className="text-gray-600 mb-4">
              This is how text will appear on your event pages.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button style={{ backgroundColor: primaryColor, color: "#FFFFFF" }}>
                Primary Button
              </Button>
              <Button
                variant="outline"
                style={{ borderColor: secondaryColor, color: secondaryColor }}
              >
                Secondary Button
              </Button>
              <Button
                variant="ghost"
                style={{ color: accentColor }}
              >
                Accent Link
              </Button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/judge/login?preview=1&event=${eventId}`} target="_blank">
              <Eye className="h-4 w-4 mr-2" />
              Preview Live
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
