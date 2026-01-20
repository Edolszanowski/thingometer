import Cookies from "js-cookie"

const JUDGE_ID_COOKIE = "parade-judge-id"
const JUDGE_ID_COOKIE_CLIENT = "parade-judge-id-client"

// Client-side helpers
export function getJudgeIdClient(): number | null {
  // Try to read from the client-readable cookie first
  let judgeId = Cookies.get(JUDGE_ID_COOKIE_CLIENT)
  
  // Fallback to the original cookie name (in case it's not httpOnly)
  if (!judgeId) {
    judgeId = Cookies.get(JUDGE_ID_COOKIE)
  }
  
  if (judgeId) {
    const id = parseInt(judgeId, 10)
    return isNaN(id) ? null : id
  }
  return null
}

export function setJudgeIdClient(judgeId: number): void {
  // Set both cookie names for consistency
  Cookies.set(JUDGE_ID_COOKIE, judgeId.toString(), {
    expires: 7, // 7 days
    sameSite: "lax",
  })
  Cookies.set(JUDGE_ID_COOKIE_CLIENT, judgeId.toString(), {
    expires: 7, // 7 days
    sameSite: "lax",
  })
}


