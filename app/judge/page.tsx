import { redirect } from "next/navigation"
import { getJudgeId } from "@/lib/cookies"
import { JudgeSelector } from "@/components/JudgeSelector"
import { cookies } from "next/headers"

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

function getJudgeAuth(): string | null {
  const cookieStore = cookies()
  const authCookie = cookieStore.get("judge-auth")
  return authCookie?.value || null
}

export default async function JudgePage() {
  // Check if judge is authenticated (has login password)
  const judgeAuth = getJudgeAuth()
  if (!judgeAuth) {
    redirect("/judge/login")
  }
  
  // Always show judge selector - allow judges to change their selection
  // Don't auto-redirect even if judgeId exists - let them explicitly select

  return (
    <div className="min-h-screen">
      <JudgeSelector />
    </div>
  )
}

