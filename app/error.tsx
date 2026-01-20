"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to error reporting service in production
    if (process.env.NODE_ENV === "production") {
      console.error("Application error:", error)
      // TODO: Send to error tracking service (Sentry, etc.)
    }
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-4xl font-bold" style={{ color: "#DC2626" }}>
          Something went wrong!
        </h1>
        <p className="text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        {process.env.NODE_ENV === "development" && (
          <div className="text-left bg-gray-100 p-4 rounded text-sm">
            <p className="font-semibold">Error details:</p>
            <p className="text-red-600">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-gray-500">Digest: {error.digest}</p>
            )}
          </div>
        )}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={reset}
            className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
          >
            Try Again
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  )
}

