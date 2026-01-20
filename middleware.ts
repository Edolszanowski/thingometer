import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get("host") || undefined

  // Extract city slug from URL path or subdomain (without database query)
  // Middleware cannot use database connections, so we'll extract and pass to pages
  let citySlug: string | null = null
  
  // Try subdomain first (e.g., comfort.parade.com)
  if (hostname) {
    const subdomain = hostname.split(".")[0]
    if (subdomain && subdomain !== "www" && subdomain !== "localhost" && !subdomain.includes("vercel")) {
      citySlug = subdomain
    }
  }

  // Try URL path (e.g., /comfort/admin)
  if (!citySlug) {
    const pathParts = pathname.split("/").filter(Boolean)
    if (pathParts.length > 0) {
      // Check if first part looks like a city slug (not api, _next, etc.)
      const potentialSlug = pathParts[0]
      if (!potentialSlug.startsWith("_") && 
          potentialSlug !== "api" && 
          potentialSlug !== "admin" && 
          potentialSlug !== "judge" &&
          potentialSlug !== "coordinator" &&
          potentialSlug !== "signup" &&
          potentialSlug !== "floats" &&
          potentialSlug !== "review" &&
          potentialSlug !== "submit") {
        citySlug = potentialSlug
      }
    }
  }

  // Add city context to headers for downstream use
  const response = NextResponse.next()
  
  if (citySlug) {
    response.headers.set("x-city-slug", citySlug)
  }

  // Add security headers
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Rate limiting could be added here
  // For now, we'll rely on Vercel's built-in rate limiting

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}

