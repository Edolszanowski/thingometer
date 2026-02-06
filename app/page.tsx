"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { HelpButton } from "@/components/HelpButton"

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
        <div className="space-y-3 sm:space-y-4">
          {/* Logo */}
          <div className="flex justify-center">
            <Image
              src="/Thingometer_logo.png"
              alt="Thingometer Events"
              width={280}
              height={140}
              priority
              className="h-auto w-[200px] sm:w-[280px]"
            />
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">
            Real-time event judging & scoring platform
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
                Sign-ups are currently closed.
              </p>
            </div>
          )}
          
          <Link href="/judge/login" className="block">
            <Button 
              className="w-full h-12 sm:h-14 text-base sm:text-lg text-white"
              style={{ backgroundColor: "var(--theme-primary, #DC2626)" }}
            >
              Judge Portal
            </Button>
          </Link>
          
          <Link href="/coordinator" className="block">
            <Button 
              variant="outline" 
              className="w-full h-12 sm:h-14 text-base sm:text-lg"
              style={{ 
                borderColor: "var(--theme-secondary, #16A34A)", 
                color: "var(--theme-secondary, #16A34A)" 
              }}
            >
              Coordinator Portal
            </Button>
          </Link>
          
          <Link href="/admin" className="block">
            <Button 
              variant="outline" 
              className="w-full h-12 sm:h-14 text-base sm:text-lg"
              style={{ 
                borderColor: "var(--theme-primary, #DC2626)", 
                color: "var(--theme-primary, #DC2626)" 
              }}
            >
              Admin Portal
            </Button>
          </Link>
        </div>
        
        {/* Brief role descriptions - minimal, high-level orientation */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-muted-foreground">
            <strong>Judges:</strong> Score entries in real-time • 
            <strong> Coordinators:</strong> Manage entries & logistics • 
            <strong> Admins:</strong> View results & manage event
          </p>
        </div>
      </div>
      
      {/* Help button - always available, never intrusive */}
      <HelpButton role="public" pageContext="landing" />
    </div>
  )
}

