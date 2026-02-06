"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { setCookie } from "@/lib/cookies-client"

interface City {
  id: number
  name: string
  slug: string
  displayName: string
}

export default function AdminPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [cityId, setCityId] = useState<number | null>(null)
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCities, setLoadingCities] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    // Fetch active cities
    fetch("/api/cities")
      .then((res) => res.json())
      .then((data) => {
        if (data.length > 0) {
          setCities(data)
          // Auto-select first city if only one
          if (data.length === 1) {
            setCityId(data[0].id)
          }
        } else {
          // No cities - backward compatibility mode
          setCityId(0) // Use 0 as "no city" indicator
        }
        setLoadingCities(false)
      })
      .catch(() => {
        // If cities API fails, allow login without city (backward compatibility)
        setCityId(0)
        setLoadingCities(false)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (cityId === null) {
      toast.error("Please select a city")
      return
    }

    setLoading(true)

    try {
      // Verify password and city
      const response = await fetch(
        `/api/admin/judges?password=${encodeURIComponent(password)}&cityId=${cityId}`
      )

      if (response.ok) {
        // Store admin session with city (1 hour expiry)
        setCookie('admin-auth', password, 3600)
        setCookie('admin-city-id', String(cityId), 3600)
        toast.success("Access granted")
        router.push("/admin/dashboard")
      } else if (response.status === 401) {
        toast.error("Incorrect password. Try again.")
        setPassword("")
      } else if (response.status === 403) {
        toast.error("Access denied for this city.")
        setPassword("")
      } else {
        toast.error("Failed to verify password. Please try again.")
        setPassword("")
      }
    } catch (error) {
      console.error("Error verifying password:", error)
      toast.error("Failed to verify password")
    } finally {
      setLoading(false)
    }
  }

  if (loadingCities) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground">Loading cities...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold" style={{ color: "#14532D" }}>
            Admin Access
          </h1>
          <p className="text-muted-foreground">
            Select your city and enter the admin password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* City Selection */}
          {cities.length > 0 && (
            <div>
              <label htmlFor="city" className="block text-sm font-medium mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <select
                id="city"
                value={cityId || ""}
                onChange={(e) => setCityId(parseInt(e.target.value, 10))}
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="">Select a city...</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pr-12"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          <Button
            type="submit"
            disabled={loading || cityId === null}
            className="w-full h-12 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
          >
            {loading ? "Verifying..." : "Access Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  )
}

