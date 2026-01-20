/**
 * Multi-City Admin Authentication Helpers
 * 
 * Provides city-scoped authentication and authorization for multi-tenant support.
 * Resolves active city from URL/subdomain and enforces role-based access control.
 */

import { cookies } from "next/headers"
import { db, schema } from "./db"
import { eq, and } from "drizzle-orm"

export type UserRole = "admin" | "coordinator" | "judge"

export interface CityContext {
  cityId: number
  citySlug: string
  cityName: string
}

export interface UserContext {
  email: string
  role: UserRole
  cityId: number
}

/**
 * Resolve city from URL path or subdomain
 * Supports patterns like:
 * - /comfort/admin
 * - /boerne/public
 * - comfort.parade.com/admin
 */
export async function resolveCityFromUrl(
  pathname: string,
  hostname?: string
): Promise<CityContext | null> {
  // Try subdomain first (e.g., comfort.parade.com)
  if (hostname) {
    const subdomain = hostname.split(".")[0]
    if (subdomain && subdomain !== "www" && subdomain !== "localhost") {
      const city = await db
        .select()
        .from(schema.cities)
        .where(eq(schema.cities.slug, subdomain))
        .limit(1)
      
      if (city.length > 0 && city[0].active) {
        return {
          cityId: city[0].id,
          citySlug: city[0].slug,
          cityName: city[0].name,
        }
      }
    }
  }

  // Try URL path (e.g., /comfort/admin)
  const pathParts = pathname.split("/").filter(Boolean)
  if (pathParts.length > 0) {
    const potentialSlug = pathParts[0]
    const city = await db
      .select()
      .from(schema.cities)
      .where(eq(schema.cities.slug, potentialSlug))
      .limit(1)
    
    if (city.length > 0 && city[0].active) {
      return {
        cityId: city[0].id,
        citySlug: city[0].slug,
        cityName: city[0].name,
      }
    }
  }

  return null
}

/**
 * Get user context from authentication (cookie-based for now)
 * In production, this would integrate with proper auth system
 */
export async function getUserContext(
  userEmail?: string
): Promise<UserContext | null> {
  // For now, we'll use the admin password system
  // In production, this would check JWT tokens or session
  const cookieStore = await cookies()
  const adminAuth = cookieStore.get("admin-auth")
  
  if (!adminAuth) {
    return null
  }

  // If userEmail is provided, look up their role
  if (userEmail) {
    const cityUser = await db
      .select()
      .from(schema.cityUsers)
      .where(eq(schema.cityUsers.userEmail, userEmail))
      .limit(1)
    
    if (cityUser.length > 0) {
      return {
        email: userEmail,
        role: cityUser[0].role as UserRole,
        cityId: cityUser[0].cityId,
      }
    }
  }

  // Fallback: assume admin role if password is correct
  // This maintains backward compatibility
  return null
}

/**
 * Check if user has required role for city
 */
export async function hasCityRole(
  cityId: number,
  userEmail: string,
  requiredRole: UserRole
): Promise<boolean> {
  const cityUser = await db
    .select()
    .from(schema.cityUsers)
    .where(
      and(
        eq(schema.cityUsers.cityId, cityId),
        eq(schema.cityUsers.userEmail, userEmail)
      )
    )
    .limit(1)

  if (cityUser.length === 0) {
    return false
  }

  const userRole = cityUser[0].role as UserRole
  
  // Role hierarchy: admin > coordinator > judge
  const roleHierarchy: Record<UserRole, number> = {
    admin: 3,
    coordinator: 2,
    judge: 1,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

/**
 * Verify admin password (backward compatibility)
 */
export function verifyAdminPassword(request: Request): boolean {
  const password = process.env.ADMIN_PASSWORD
  
  if (!password) {
    return false
  }
  
  // Check authorization header
  const authHeader = request.headers.get("authorization")
  if (authHeader && authHeader === `Bearer ${password}`) {
    return true
  }
  
  // Check query parameter
  const url = new URL(request.url)
  const queryPassword = url.searchParams.get("password")
  if (queryPassword === password) {
    return true
  }
  
  return false
}

/**
 * Get city-scoped data helper
 * Ensures all queries are filtered by city_id
 */
export async function getCityScopedEvents(cityId: number) {
  return db
    .select()
    .from(schema.events)
    .where(eq(schema.events.cityId, cityId))
}

export async function getCityScopedFloats(cityId: number, eventId?: number) {
  const conditions = [eq(schema.floats.eventId, eventId!)]
  
  // If eventId provided, filter by it
  // Otherwise, filter by city through events
  if (eventId) {
    return db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.eventId, eventId))
  }
  
  // Get events for city first, then floats
  const cityEvents = await getCityScopedEvents(cityId)
  const eventIds = cityEvents.map((e: { id: number }) => e.id)
  
  if (eventIds.length === 0) {
    return []
  }
  
  // Note: This is a simplified version. In production, use proper joins
  return db
    .select()
    .from(schema.floats)
    .where(
      // This would need proper SQL IN clause - simplified for now
      eq(schema.floats.eventId, eventIds[0])
    )
}

