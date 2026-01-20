/**
 * City-Scoped Authentication Helpers
 * 
 * Provides functions to get and validate city context from cookies
 */

import { cookies } from "next/headers"

const CITY_ID_COOKIE = "judge-city-id"
const ADMIN_CITY_ID_COOKIE = "admin-city-id"

/**
 * Get city ID from judge session cookie
 */
export async function getJudgeCityId(): Promise<number | null> {
  try {
    const cookieStore = await cookies()
    const cityCookie = cookieStore.get(CITY_ID_COOKIE)
    if (cityCookie?.value) {
      const cityId = parseInt(cityCookie.value, 10)
      return isNaN(cityId) ? null : cityId
    }
    return null
  } catch (error) {
    console.error("Error getting judge city ID from cookie:", error)
    return null
  }
}

/**
 * Get city ID from admin session cookie
 */
export async function getAdminCityId(): Promise<number | null> {
  try {
    const cookieStore = await cookies()
    const cityCookie = cookieStore.get(ADMIN_CITY_ID_COOKIE)
    if (cityCookie?.value) {
      const cityId = parseInt(cityCookie.value, 10)
      return isNaN(cityId) ? null : cityId
    }
    return null
  } catch (error) {
    console.error("Error getting admin city ID from cookie:", error)
    return null
  }
}

/**
 * Get city ID from either judge or admin session
 */
export async function getCityId(): Promise<number | null> {
  const judgeCityId = await getJudgeCityId()
  if (judgeCityId) return judgeCityId
  
  return await getAdminCityId()
}

/**
 * Set city ID cookie (client-side)
 */
export function setCityIdClient(cityId: number, isAdmin: boolean = false): void {
  const cookieName = isAdmin ? ADMIN_CITY_ID_COOKIE : CITY_ID_COOKIE
  document.cookie = `${cookieName}=${cityId}; path=/; max-age=3600`
}

/**
 * Get city ID from cookie (client-side)
 */
export function getCityIdClient(isAdmin: boolean = false): number | null {
  const cookieName = isAdmin ? ADMIN_CITY_ID_COOKIE : CITY_ID_COOKIE
  if (typeof document === "undefined") return null
  
  const cookies = document.cookie.split(";")
  const cityCookie = cookies.find((c) => c.trim().startsWith(`${cookieName}=`))
  if (!cityCookie) return null
  
  const value = cityCookie.split("=")[1]
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? null : parsed
}


