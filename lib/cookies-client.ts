/**
 * Client-Side Cookie Utilities
 * 
 * Production-safe cookie operations that work correctly over HTTPS.
 * Automatically adds secure and sameSite flags when running on HTTPS.
 */

/**
 * Set a cookie with production-safe flags
 */
export function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof window === 'undefined') return
  
  const isProduction = window.location.protocol === 'https:'
  const secureFlag = isProduction ? '; secure' : ''
  
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax${secureFlag}`
  
  // Debug log in development
  if (!isProduction) {
    console.log(`[setCookie] Set ${name} (maxAge: ${maxAgeSeconds}s)`)
  }
}

/**
 * Delete a cookie with production-safe flags
 */
export function deleteCookie(name: string): void {
  if (typeof window === 'undefined') return
  
  const isProduction = window.location.protocol === 'https:'
  const secureFlag = isProduction ? '; secure' : ''
  
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${secureFlag}`
  
  // Debug log in development
  if (!isProduction) {
    console.log(`[deleteCookie] Deleted ${name}`)
  }
}

/**
 * Get a cookie value (client-side only)
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))
  
  if (!cookie) return null
  
  const value = cookie.split('=')[1]
  return value ? decodeURIComponent(value) : null
}
