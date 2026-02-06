"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CoordinatorPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to admin login if not authenticated, otherwise go to positions
    const cookies = document.cookie.split(";")
    const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
    
    if (authCookie) {
      // Already authenticated as admin, go directly to positions
      router.push("/coordinator/positions")
    } else {
      // Not authenticated, redirect to admin login
      router.push("/admin")
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}
