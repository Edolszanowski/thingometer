import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { floats } from "@/lib/drizzle/schema"
import { eq } from "drizzle-orm"
import { isCoordinator } from "@/lib/auth"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // Authorization: Coordinator/admin only
  if (!isCoordinator()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  const body = await request.json()
  const { status } = body
  const entryId = parseInt(params.id)
  
  // Validation: Only allow expected status values
  const validStatuses = ["pending-consent", "registered", "checked-in", "judged", "completed"]
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
  }
  
  // Reject unknown fields
  const allowedFields = ["status"]
  const unknownFields = Object.keys(body).filter(key => !allowedFields.includes(key))
  if (unknownFields.length > 0) {
    return NextResponse.json({ 
      error: `Unknown fields: ${unknownFields.join(", ")}` 
    }, { status: 400 })
  }
  
  // Get current entry
  const entries = await db.select().from(floats).where(eq(floats.id, entryId)).limit(1)
  if (entries.length === 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  }
  
  const currentMetadata = entries[0].metadata || {}
  
  // Merge status update (preserve existing metadata)
  const updatedMetadata = {
    ...currentMetadata,
    status,
    statusHistory: [
      ...(currentMetadata.statusHistory || []),
      {
        status,
        timestamp: new Date().toISOString(),
        updatedBy: "coordinator", // TODO: Add actual user ID when auth is implemented
      }
    ]
  }
  
  await db.update(floats)
    .set({ metadata: updatedMetadata })
    .where(eq(floats.id, entryId))
  
  return NextResponse.json({ success: true, status })
}
