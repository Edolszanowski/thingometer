import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Multi-Tenant Routing Middleware
 * 
 * Routing Rule:
 * Path-based routing (thingometer.com/{tenant}) is the canonical system of record.
 * Subdomain routing ({tenant}.thingometer.com) is an optional alias resolved by
 * middleware for branding, sales, or white-label use cases.
 * Both resolve to the same tenant and share one code path.
 * 
 * Priority Rule:
 * 1. If subdomain is detected and valid → resolve tenant
 * 2. Else, path-based tenant slug
 * 3. Both map to the same tenant context
 * 
 * From a customer perspective, routing is abstracted. The platform provides the
 * appropriate URL based on branding and deployment needs, without requiring
 * user configuration or technical decision-making.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get("host") || ""

  // Cities function as tenants within the multi-tenant architecture
  // and may represent cities, chambers, counties, or organizations.
  let citySlug: string | null = null

  // Priority 1: Subdomain (boerne.thingometer.com) - optional alias
  // Subdomain routing is an optional alias resolved by middleware for
  // branding, sales, or white-label use cases.
  const parts = hostname.split(".")
  if (parts.length >= 3) {
    const subdomain = parts[0]
    if (
      subdomain !== "www" &&
      !subdomain.includes("localhost") &&
      !subdomain.includes("vercel") &&
      !subdomain.includes("preview")
    ) {
      citySlug = subdomain
    }
  }

  // Priority 2: Path-based (/boerne/...) - canonical routing
  // Path-based routing is the canonical system of record.
  if (!citySlug) {
    const pathMatch = pathname.match(/^\/([a-z0-9-]+)/)
    if (pathMatch && !isReservedPath(pathMatch[1])) {
      citySlug = pathMatch[1]
    }
  }

  // Add city context to headers and cookies for downstream use
  const response = NextResponse.next()

  if (citySlug) {
    // Set header for server-side access
    response.headers.set("x-city-slug", citySlug)
    
    // Set cookie for client-side access (30 day expiry)
    response.cookies.set("city-slug", citySlug, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    })
  }

  // Add security headers
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  return response
}

/**
 * Reserved paths that should not be treated as tenant slugs.
 * These are the application's core routes.
 */
function isReservedPath(path: string): boolean {
  const reserved = [
    "api",
    "admin",
    "judge",
    "coordinator",
    "signup",
    "floats",
    "float",
    "review",
    "submit",
    "_next",
    "favicon.ico",
    "robots.txt",
    "sitemap.xml",
    "icon.svg",
  ]
  return reserved.includes(path) || path.startsWith("_")
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next (Next.js internals - static, image, etc.)
     * - favicon.ico (favicon file)
     * - Static files with extensions
     */
    "/((?!api|_next|favicon\\.ico|.*\\..*).*)",
  ],
}

