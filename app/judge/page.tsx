import { redirect } from "next/navigation"
import { JudgeSelector } from "@/components/JudgeSelector"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

async function getCookie(name: string): Promise<string | null> {
  const cookieStore = await cookies()
  const c = cookieStore.get(name)
  return c?.value ?? null
}

export default async function JudgePage() {
  const judgeAuth = await getCookie("judge-auth")
  // Try both cookie names (server-side and client-side)
  let judgeIdRaw = await getCookie("parade-judge-id")
  if (!judgeIdRaw) {
    judgeIdRaw = await getCookie("parade-judge-id-client")
  }

  // If either cookie is missing, redirect to login.
  if (!judgeAuth || !judgeIdRaw) {
    console.log('[JudgePage] Missing cookies - judgeAuth:', !!judgeAuth, 'judgeId:', !!judgeIdRaw)
    redirect("/judge/login")
  }
  
  const judgeId = Number.parseInt(judgeIdRaw, 10)
  if (!Number.isFinite(judgeId) || judgeId <= 0) {
    redirect("/api/judge/logout")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // Fail closed: treat as invalid/stale auth.
    redirect("/api/judge/logout")
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Validate judge exists and is tied to exactly one event.
  const { data: judge, error: judgeError } = await supabase
    .from("judges")
    .select("id,name,event_id,access_token")
    .eq("id", judgeId)
    .single()

  if (judgeError || !judge || !judge.event_id) {
    redirect("/api/judge/logout")
  }

  // Validate the event exists and is active.
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,active")
    .eq("id", judge.event_id)
    .single()

  if (eventError || !event || !event.active) {
    redirect("/api/judge/logout")
  }

  // Validate auth cookie:
  // - QR sessions can store the judge access token directly
  // - Password sessions store the event password; validate against settings key judge_event_password:<eventId>
  const authMatchesToken = judge.access_token === judgeAuth
  if (!authMatchesToken) {
    const passwordKey = `judge_event_password:${judge.event_id}`
    const { data: setting, error: settingError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", passwordKey)
      .single()

    const passwordOk =
      !settingError && setting && typeof setting.value === "string" && setting.value === judgeAuth

    if (!passwordOk) {
      redirect("/api/judge/logout")
    }
  }

  // Always show judge selector - allow judges to change their selection
  // Don't auto-redirect even if judgeId exists - let them explicitly select

  return (
    <div className="min-h-screen">
      <JudgeSelector />
    </div>
  )
}

