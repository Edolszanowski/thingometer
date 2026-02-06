"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Calendar, MapPin, Users, Trophy, Mail, Phone } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function LemonadeDaySuccessPage() {
  const searchParams = useSearchParams()
  const standName = searchParams.get("standName") || "Your Lemonade Stand"
  const childName = searchParams.get("childName") || "your child"
  const email = searchParams.get("email") || ""
  
  // Generate registration ID on client side only to avoid hydration mismatch
  const [registrationId, setRegistrationId] = useState("")
  
  useEffect(() => {
    setRegistrationId(Math.random().toString(36).substring(2, 10).toUpperCase())
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🍋 Registration Complete!
          </h1>
          <p className="text-xl text-gray-600">
            Thank you for registering <strong>{standName}</strong>
          </p>
        </div>

        {/* What Happens Next */}
        <Card className="mb-6 border-2 border-green-300 bg-white shadow-lg">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-2xl text-green-900">✅ What Happens Next?</CardTitle>
            <CardDescription className="text-green-700">
              Here's what to expect in the coming days
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">📧 Confirmation Email</h3>
                  <p className="text-gray-600 text-sm">
                    You'll receive a confirmation email at <strong>{email || "your registered email"}</strong> within the next few minutes. 
                    Please check your spam folder if you don't see it.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">👥 Coordinator Review</h3>
                  <p className="text-gray-600 text-sm">
                    Our event coordinators will review your registration within 1-2 business days. 
                    You'll receive an email once your stand is approved.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-amber-600" />
                    Stand Location Assignment
                  </h3>
                  <p className="text-gray-600 text-sm">
                    After approval, coordinators will assign a specific location for {childName}'s lemonade stand. 
                    You'll receive an email with the exact address and setup instructions.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    Event Day Preparation
                  </h3>
                  <p className="text-gray-600 text-sm">
                    You'll receive detailed instructions about event day timing, setup requirements, 
                    and what to bring. Make sure to arrive at your assigned location on time!
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                  5
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    Judging & Awards
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Judges will visit stands throughout the event. After judging is complete, 
                    you'll be able to view your scores and see if you won any awards!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Reminders */}
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-xl text-amber-900">📋 Important Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-amber-900">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span><strong>Keep your email handy:</strong> All updates will be sent to {email || "your registered email"}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span><strong>Food Safety:</strong> Remember to practice good hygiene - clean hands, clean surfaces, and safe ingredients</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span><strong>Stand Setup:</strong> You'll need to provide your own table, chairs, signage, and supplies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span><strong>Parent Supervision:</strong> A parent or guardian must be present at all times during the event</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-6 border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-xl text-blue-900">💬 Questions or Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800 mb-4">
              If you have any questions or need to make changes to your registration, please contact the event coordinator:
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3 text-blue-900">
                <Mail className="h-4 w-4" />
                <span>Email: <a href="mailto:coordinator@lemonadeday.org" className="underline font-medium">coordinator@lemonadeday.org</a></span>
              </div>
              <div className="flex items-center gap-3 text-blue-900">
                <Phone className="h-4 w-4" />
                <span>Phone: <a href="tel:555-123-4567" className="underline font-medium">(555) 123-4567</a></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Return to Home
            </Button>
          </Link>
          <Button 
            size="lg" 
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            onClick={() => window.print()}
          >
            📄 Print This Page
          </Button>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-sm text-gray-500">
          {registrationId && <p>Registration ID: {registrationId}</p>}
          <p className={registrationId ? "mt-1" : ""}>Registered on {new Date().toLocaleDateString("en-US", { 
            weekday: "long", 
            year: "numeric", 
            month: "long", 
            day: "numeric" 
          })}</p>
        </div>
      </div>
    </div>
  )
}
