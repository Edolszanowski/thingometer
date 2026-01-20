import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET - List all active cities
export async function GET(request: NextRequest) {
  try {
    const cities = await db
      .select({
        id: schema.cities.id,
        name: schema.cities.name,
        slug: schema.cities.slug,
        displayName: schema.cities.displayName,
        region: schema.cities.region,
        active: schema.cities.active,
      })
      .from(schema.cities)
      .where(eq(schema.cities.active, true))

    return NextResponse.json(cities)
  } catch (error: any) {
    console.error("[api/cities] Error fetching cities:", error)
    // If cities table doesn't exist, return empty array for backward compatibility
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      return NextResponse.json([])
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


