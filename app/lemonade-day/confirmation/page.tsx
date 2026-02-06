"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function LemonadeDayConfirmation() {
  const searchParams = useSearchParams()
  const entryId = searchParams.get("entryId")

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white p-4 flex items-center justify-center">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 border-2 border-yellow-300">
          {/* Success Header */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-yellow-600 mb-2">
              Registration Complete!
            </h1>
            <p className="text-sm text-gray-600">
              Your Lemonade Day registration has been successfully submitted.
            </p>
          </div>

          {/* Entry ID */}
          {entryId && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700">
                <strong>Entry ID:</strong> <span className="font-mono text-yellow-700">#{entryId}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Save this number for your records
              </p>
            </div>
          )}

          {/* Next Steps */}
          <div className="space-y-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">What's Next?</h2>
            
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-semibold">
                  1
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Prepare Your Stand</h3>
                  <p className="text-sm text-gray-600">
                    Set up your lemonade stand at the location you provided. Make sure you have all supplies ready!
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-semibold">
                  2
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Event Day: May 2, 2026</h3>
                  <p className="text-sm text-gray-600">
                    Judges will visit stands between 9:00 AM and 4:00 PM. Be ready to showcase your business!
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-semibold">
                  3
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Check Your Email</h3>
                  <p className="text-sm text-gray-600">
                    You'll receive updates and reminders at the email address you provided.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-semibold">
                  4
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Awards Ceremony</h3>
                  <p className="text-sm text-gray-600">
                    Winners will be announced after all judging is complete. Good luck!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Important Reminders */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">📋 Important Reminders</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Practice good food safety (clean hands, clean surfaces)</li>
              <li>• Be friendly and enthusiastic with customers and judges</li>
              <li>• Know your business plan and pricing</li>
              <li>• Have fun and learn from the experience!</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              <Link href="/">Return to Home</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1"
            >
              <a href="mailto:support@example.com">Contact Support</a>
            </Button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-center text-gray-500 mt-6">
            Questions? Contact the event coordinator or check your email for more information.
          </p>
        </div>
      </div>
    </div>
  )
}
