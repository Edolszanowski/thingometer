"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { logoutJudge } from "@/app/actions"

export function LogoutButton() {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to logout?")) {
      return
    }
    
    setLoading(true)
    try {
      await logoutJudge()
    } catch (error) {
      console.error("Logout error:", error)
      // Force redirect even on error
      window.location.href = "/"
    }
  }

  return (
    <Button
      onClick={handleLogout}
      disabled={loading}
      variant="ghost"
      className="w-full h-12 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
    >
      {loading ? "Logging out..." : "Logout"}
    </Button>
  )
}

