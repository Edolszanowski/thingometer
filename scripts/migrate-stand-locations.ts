/**
 * Migration Script: Move location data from floats.metadata.assignedLocation to stand_positions table
 * 
 * This script:
 * 1. Finds all floats with assignedLocation in metadata
 * 2. Creates stand_positions records for each unique (eventId, floatNumber) combination
 * 3. Copies location data to the new table
 * 4. Keeps old data in metadata for rollback safety (doesn't delete)
 */

import { db, schema } from "../lib/db"
import { eq, and, isNotNull } from "drizzle-orm"

async function migrateStandLocations() {
  console.log("Starting stand location migration...")
  
  try {
    // Get all floats that have a float_number and event_id
    const floats = await db
      .select()
      .from(schema.floats)
      .where(
        and(
          isNotNull(schema.floats.floatNumber),
          isNotNull(schema.floats.eventId)
        )
      )

    console.log(`Found ${floats.length} floats with position numbers`)

    let migratedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const float of floats) {
      // Check if this float has location data in metadata
      const metadata = float.metadata as any
      const assignedLocation = metadata?.assignedLocation

      if (!assignedLocation || !float.floatNumber || !float.eventId) {
        skippedCount++
        continue
      }

      try {
        // Check if stand position already exists
        const existing = await db
          .select()
          .from(schema.standPositions)
          .where(
            and(
              eq(schema.standPositions.eventId, float.eventId),
              eq(schema.standPositions.positionNumber, float.floatNumber)
            )
          )
          .limit(1)

        if (existing.length > 0) {
          // Position already exists, check if it has location data
          if (existing[0].locationData) {
            console.log(
              `  Skipping Stand #${float.floatNumber} (Event ${float.eventId}) - already has location`
            )
            skippedCount++
            continue
          } else {
            // Update existing position with location data
            await db
              .update(schema.standPositions)
              .set({
                locationData: {
                  placeId: assignedLocation.placeId,
                  address: assignedLocation.address,
                  lat: assignedLocation.lat || 0,
                  lng: assignedLocation.lng || 0,
                  placeName: assignedLocation.placeName || null,
                  instructions: assignedLocation.instructions || null,
                  assignedBy: assignedLocation.assignedBy || "migration",
                  assignedAt: assignedLocation.assignedAt || new Date().toISOString(),
                },
                updatedAt: new Date(),
              })
              .where(eq(schema.standPositions.id, existing[0].id))

            console.log(
              `  ✓ Updated Stand #${float.floatNumber} (Event ${float.eventId}) - ${assignedLocation.address}`
            )
            migratedCount++
          }
        } else {
          // Create new stand position
          await db.insert(schema.standPositions).values({
            eventId: float.eventId,
            positionNumber: float.floatNumber,
            locationData: {
              placeId: assignedLocation.placeId,
              address: assignedLocation.address,
              lat: assignedLocation.lat || 0,
              lng: assignedLocation.lng || 0,
              placeName: assignedLocation.placeName || null,
              instructions: assignedLocation.instructions || null,
              assignedBy: assignedLocation.assignedBy || "migration",
              assignedAt: assignedLocation.assignedAt || new Date().toISOString(),
            },
          })

          console.log(
            `  ✓ Created Stand #${float.floatNumber} (Event ${float.eventId}) - ${assignedLocation.address}`
          )
          migratedCount++
        }
      } catch (error: any) {
        console.error(
          `  ✗ Error migrating Stand #${float.floatNumber} (Event ${float.eventId}):`,
          error.message
        )
        errorCount++
      }
    }

    console.log("\nMigration complete!")
    console.log(`  Migrated: ${migratedCount}`)
    console.log(`  Skipped: ${skippedCount}`)
    console.log(`  Errors: ${errorCount}`)
    console.log("\nNote: Old location data in floats.metadata has been preserved for rollback safety")
  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  }
}

// Run migration
migrateStandLocations()
  .then(() => {
    console.log("\nMigration script finished successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\nMigration script failed:", error)
    process.exit(1)
  })
