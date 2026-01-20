// Client-side authentication utilities

/**
 * Check if the current user is a coordinator (has admin-auth cookie)
 * This is a client-side only function
 */
export function isCoordinator(): boolean {
  if (typeof document === "undefined") return false
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return !!authCookie
}

/**
 * Check if the current user is a judge (has judgeId cookie)
 * This is a client-side only function
 */
export function isJudge(): boolean {
  if (typeof document === "undefined") return false
  const cookies = document.cookie.split(";")
  const judgeCookie = cookies.find((c) => c.trim().startsWith("judgeId="))
  return !!judgeCookie
}

/**
 * Get the current judge ID from cookies (client-side)
 * Returns null if not logged in as a judge
 */
export function getJudgeIdClient(): number | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const judgeCookie = cookies.find((c) => c.trim().startsWith("judgeId="))
  if (!judgeCookie) return null
  const value = judgeCookie.split("=")[1]
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? null : parsed
}

