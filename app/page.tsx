"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  const [signupLocked, setSignupLocked] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if signups are locked
    fetch("/api/coordinator/settings")
      .then((res) => res.json())
      .then((data) => {
        setSignupLocked(data.signupLocked || false)
      })
      .catch(() => {
        setSignupLocked(false) // Default to unlocked if error
      })
  }, [])

  return (
    <div className="h-[calc(100dvh-80px)] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4 sm:space-y-6 text-center">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: "#DC2626" }}>
            Parade Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Event coordination, registration & judging
          </p>
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          {signupLocked !== true && (
            <Link href="/signup/select-event" className="block">
              <Button variant="outline" className="w-full h-12 sm:h-14 text-base sm:text-lg">
                Sign Up to Participate
              </Button>
            </Link>
          )}
          
          {signupLocked === true && (
            <div className="p-3 rounded-lg border-2 border-muted-foreground/20 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Parade sign-ups are currently closed.
              </p>
            </div>
          )}
          
          <Link href="/judge/login" className="block">
            <Button className="w-full h-12 sm:h-14 text-base sm:text-lg bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">
              Judge Portal
            </Button>
          </Link>
          
          <Link href="/admin" className="block">
            <Button variant="outline" className="w-full h-12 sm:h-14 text-base sm:text-lg border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10">
              Admin Portal
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

