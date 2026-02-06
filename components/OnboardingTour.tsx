"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ChevronRight, X } from "lucide-react"

export interface TourStep {
  title: string
  content: string
  target?: string // CSS selector for element to highlight (future enhancement)
}

interface OnboardingTourProps {
  role: string
  steps: TourStep[]
  onComplete: () => void
  storageKey?: string // Key for localStorage to track completion
}

/**
 * OnboardingTour - First-time user onboarding component
 * 
 * Help and onboarding features are designed to provide just-in-time confidence
 * rather than formal training, enabling judges, volunteers, and coordinators
 * to perform effectively with minimal instruction.
 * 
 * Key principles:
 * - Trigger only on first login
 * - 3-5 steps max
 * - Highlight "what matters now," not everything
 * - Auto-disable after completion or skip
 * - Re-triggerable from Help
 */
export function OnboardingTour({
  role,
  steps,
  onComplete,
  storageKey,
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [show, setShow] = useState(false)

  // Check if tour has been completed before
  useEffect(() => {
    const key = storageKey || `onboarding-${role}-completed`
    const completed = localStorage.getItem(key)
    if (!completed && steps.length > 0) {
      setShow(true)
    }
  }, [role, storageKey, steps.length])

  const handleComplete = useCallback(() => {
    const key = storageKey || `onboarding-${role}-completed`
    localStorage.setItem(key, "true")
    setShow(false)
    onComplete()
  }, [role, storageKey, onComplete])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleSkip = () => {
    handleComplete()
  }

  if (!show || steps.length === 0) return null

  const step = steps[currentStep]

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="max-w-md">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">{step.title}</h3>
              <p className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {steps.length}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSkip} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="prose prose-sm">
            <p className="text-gray-600">{step.content}</p>
          </div>

          <div className="flex justify-between items-center pt-4">
            <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
              Skip tour
            </Button>
            <Button onClick={handleNext}>
              {currentStep < steps.length - 1 ? (
                <>
                  Next <ChevronRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                "Get started"
              )}
            </Button>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-1 justify-center">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep
                    ? "w-8 bg-primary"
                    : index < currentStep
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Default tour steps for each role
export const defaultTourSteps: Record<string, TourStep[]> = {
  judge: [
    {
      title: "Welcome, Judge!",
      content:
        "You'll be scoring entries in real-time during the event. Let's get you familiar with the basics.",
    },
    {
      title: "Scoring Made Simple",
      content:
        "Use the sliders to rate each entry from 0-10 in each category. Your scores save automatically as you go.",
    },
    {
      title: "Navigate Easily",
      content:
        "Use the Previous and Next buttons to move between entries, or tap any entry in the list to jump directly to it.",
    },
    {
      title: "Review Before Submit",
      content:
        "Before you finish, you'll see a summary of all your scores. Once submitted, scores are final.",
    },
    {
      title: "Need Help?",
      content:
        "Tap the help button (?) at the bottom right of any page for context-specific assistance.",
    },
  ],
  coordinator: [
    {
      title: "Welcome, Coordinator!",
      content:
        "You're responsible for managing entries and event logistics. Here's a quick overview.",
    },
    {
      title: "Entry Management",
      content:
        "Review and approve submitted entries. Only approved entries appear in the judging queue.",
    },
    {
      title: "Position Assignment",
      content:
        "Assign position numbers to approved entries. This determines the order judges will see them.",
    },
    {
      title: "Need Help?",
      content:
        "The help button (?) is always available at the bottom right for detailed guidance.",
    },
  ],
  admin: [
    {
      title: "Welcome, Admin!",
      content:
        "You have full access to results, judge management, and event settings.",
    },
    {
      title: "Live Results",
      content:
        "The results dashboard updates in real-time as judges submit scores. No need to refresh.",
    },
    {
      title: "Judge Management",
      content:
        "Monitor judge progress and unlock scores if corrections are needed.",
    },
    {
      title: "Export Data",
      content:
        "Export results to CSV or PDF for awards ceremonies and record keeping.",
    },
  ],
}

/**
 * Reset onboarding for a specific role (useful for Help menu "Restart Tour" option)
 */
export function resetOnboarding(role: string, storageKey?: string) {
  const key = storageKey || `onboarding-${role}-completed`
  localStorage.removeItem(key)
}

/**
 * Check if onboarding has been completed for a role
 */
export function isOnboardingCompleted(role: string, storageKey?: string): boolean {
  if (typeof window === "undefined") return true
  const key = storageKey || `onboarding-${role}-completed`
  return localStorage.getItem(key) === "true"
}
