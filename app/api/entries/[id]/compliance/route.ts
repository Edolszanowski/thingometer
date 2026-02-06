import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { floats } from "@/lib/drizzle/schema"
import { eq } from "drizzle-orm"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // TODO: Add authorization check (entry owner OR coordinator/admin)
  // For now, allow any request (will be secured in production)
  
  const body = await request.json()
  const { lemonadeDay } = body
  const entryId = parseInt(params.id)
  
  // Validation: Only allow lemonadeDay field
  if (!lemonadeDay || typeof lemonadeDay !== 'object') {
    return NextResponse.json({ 
      error: "Missing or invalid lemonadeDay data" 
    }, { status: 400 })
  }
  
  // Reject unknown top-level fields
  const allowedFields = ["lemonadeDay"]
  const unknownFields = Object.keys(body).filter(key => !allowedFields.includes(key))
  if (unknownFields.length > 0) {
    return NextResponse.json({ 
      error: `Unknown fields: ${unknownFields.join(", ")}` 
    }, { status: 400 })
  }
  
  // Server-side IP capture (best effort)
  const ipAddress = 
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null  // Optional, demo does not depend on this
  
  // Add IP to guardianConsent if present
  if (lemonadeDay.guardianConsent && ipAddress) {
    lemonadeDay.guardianConsent.ipAddress = ipAddress
  }
  
  // Get current entry
  const entries = await db.select().from(floats).where(eq(floats.id, entryId)).limit(1)
  if (entries.length === 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  }
  
  const currentMetadata = entries[0].metadata || {}
  
  // MERGE strategy: preserve existing metadata, add lemonadeDay namespace
  const updatedMetadata = {
    ...currentMetadata,
    lemonadeDay,
    status: "registered" as const,  // Update from pending-consent to registered
    statusHistory: [
      ...(currentMetadata.statusHistory || []),
      {
        status: "registered",
        timestamp: new Date().toISOString(),
      }
    ]
  }
  
  await db.update(floats)
    .set({ metadata: updatedMetadata })
    .where(eq(floats.id, entryId))
  
  return NextResponse.json({ success: true })
}
