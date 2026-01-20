"use server"

import { setJudgeId, clearJudgeId } from "@/lib/cookies"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export async function selectJudge(judgeId: number) {
  await setJudgeId(judgeId)
  redirect("/floats")
}

export async function logoutJudge() {
  await clearJudgeId()
  // Also clear the judge-auth cookie
  const cookieStore = cookies()
  cookieStore.delete("judge-auth")
  redirect("/")
}

