import { cookies } from "next/headers"

const JUDGE_ID_COOKIE = "parade-judge-id"

export async function getJudgeId(): Promise<number | null> {
  try {
    const cookieStore = await cookies()
    const judgeIdCookie = cookieStore.get(JUDGE_ID_COOKIE)
    if (judgeIdCookie?.value) {
      const judgeId = parseInt(judgeIdCookie.value, 10)
      return isNaN(judgeId) ? null : judgeId
    }
    return null
  } catch (error) {
    console.error("Error getting judge ID from cookie:", error)
    return null
  }
}

export async function setJudgeId(judgeId: number): Promise<void> {
  try {
    const cookieStore = await cookies()
    // Set httpOnly cookie for server-side access (security)
    cookieStore.set(JUDGE_ID_COOKIE, judgeId.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    // Also set a non-httpOnly cookie for client-side access
    // This allows QuickJumpBar and other client components to read the judge ID
    cookieStore.set(`${JUDGE_ID_COOKIE}-client`, judgeId.toString(), {
      httpOnly: false, // Allow client-side JavaScript to read
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
  } catch (error) {
    console.error("Error setting judge ID cookie:", error)
  }
}

export async function clearJudgeId(): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(JUDGE_ID_COOKIE)
    cookieStore.delete(`${JUDGE_ID_COOKIE}-client`)
  } catch (error) {
    console.error("Error clearing judge ID cookie:", error)
  }
}

