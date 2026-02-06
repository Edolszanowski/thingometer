"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type Judge = {
  id: number
  name: string
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  const isProduction = window.location.protocol === 'https:'
  const secureFlag = isProduction ? '; secure' : ''
  // Don't set domain - let browser handle it automatically for better compatibility
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax${secureFlag}`
  
  // Debug: verify cookie was set
  console.log(`[setCookie] Set ${name}=${value.substring(0, 10)}... (maxAge: ${maxAgeSeconds}s, secure: ${isProduction})`)
  console.log(`[setCookie] Current cookies:`, document.cookie)
}

function JudgeLoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const token = searchParams.get("token")

  const EVENT_ID = Number(
    process.env.NEXT_PUBLIC_THINGOMETER_EVENT_ID ?? process.env.THINGOMETER_EVENT_ID
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [password, setPassword] = useState("")
  const [judges, setJudges] = useState<Judge[] | null>(null)
  const [eventName, setEventName] = useState<string | null>(null)
  const [judgeCertification, setJudgeCertification] = useState(false)

  // ---------------------------------------------------------------------------
  // QR TOKEN LOGIN (AUTO)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!token) return

    setLoading(true)
    setError(null)

    fetch(`/api/judge/auth?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Authentication failed")
        if (data?.mode !== "qr") throw new Error("Authentication failed")

        // Keep your requested session payload for future UI use.
        sessionStorage.setItem(
          "thingometer_judge",
          JSON.stringify({
            judgeId: data.judge.id,
            judgeName: data.judge.name,
            eventId: data.event.id,
            eventName: data.event.name,
          })
        )

        // QR success: set existing cookies and redirect immediately.
        // (cookie names and redirect target are required by existing judge flow)
        document.cookie = `judge-auth=${token}; path=/`
        document.cookie = `parade-judge-id=${data.judge.id}; path=/`

        router.replace("/judge")
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [token, router])

  // ---------------------------------------------------------------------------
  // PASSWORD FALLBACK
  // ---------------------------------------------------------------------------
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!EVENT_ID) {
      setError("Event not configured")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/judge/auth?eventId=${EVENT_ID}&password=${encodeURIComponent(password)}`
      )

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Authentication failed")
        setLoading(false)
        return
      }

      // Existing judge flow expects a judge-auth cookie to access /judge.
      setCookie("judge-auth", password, 60 * 60)

      setJudges(data.judges)
      setEventName(data.event.name)
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // JUDGE SELECTION
  // ---------------------------------------------------------------------------
  function handleJudgeSelect(judge: Judge) {
    if (!judgeCertification) {
      setError("Please accept the Judge Certification to continue")
      return
    }

    sessionStorage.setItem(
      "thingometer_judge",
      JSON.stringify({
        judgeId: judge.id,
        judgeName: judge.name,
        eventId: EVENT_ID,
        eventName,
      })
    )

    // Compatibility with existing scoring pages:
    const sevenDays = 60 * 60 * 24 * 7
    setCookie("parade-judge-id", String(judge.id), sevenDays)
    setCookie("parade-judge-id-client", String(judge.id), sevenDays)

    router.push("/judge")
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  // QR auth must short-circuit rendering (no password UI flash) while redirecting.
  if (token && loading && !error) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold text-center">Judge Login</h1>

        {loading && <p className="text-center">Loading…</p>}

        {error && <p className="text-center text-red-600 text-sm">{error}</p>}

        {(!token || error) && !judges && !loading && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Event Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded border px-3 py-2"
                required
              />
            </label>

            <button type="submit" className="w-full rounded bg-black text-white py-2">
              Continue
            </button>
          </form>
        )}

        {judges && (
          <div className="space-y-4">
            <p className="text-sm text-center">
              Select your name for <strong>{eventName}</strong>
            </p>

            {/* Judge Certification */}
            <div className="mb-4 p-4 border rounded-lg bg-blue-50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={judgeCertification}
                  onChange={(e) => setJudgeCertification(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                />
                <div>
                  <span className="font-medium text-blue-900">Judge Certification</span>
                  <p className="text-sm text-blue-800 mt-1">
                    I agree to score all stands fairly and independently, without bias or favoritism.
                  </p>
                </div>
              </label>
            </div>

            <ul className="divide-y rounded border">
              {judges.map((judge) => (
                <li key={judge.id}>
                  <button
                    onClick={() => handleJudgeSelect(judge)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!judgeCertification}
                  >
                    {judge.name}
                  </button>
                </li>
              ))}
            </ul>

            {!judgeCertification && (
              <p className="text-xs text-center text-gray-500">
                Please accept the Judge Certification above to continue
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function JudgeLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6">Loading…</div>}>
      <JudgeLoginInner />
    </Suspense>
  )
}

