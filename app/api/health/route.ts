import { NextResponse } from "next/server"

/**
 * Health check endpoint for connectivity verification
 * Used by offline queue to verify network connectivity
 */
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
