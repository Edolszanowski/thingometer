import { config } from "dotenv"
import { resolve } from "path"
import { neon } from "@neondatabase/serverless"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

const sql = neon(process.env.DATABASE_URL!)

async function migrate() {
  console.log("Starting events system migration...")

  try {
    // Create events table
    console.log("Creating events table...")
    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        event_date TIMESTAMP,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `
    console.log("✓ Events table created")

    // Create participants table
    console.log("Creating participants table...")
    await sql`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        organization TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        title TEXT,
        phone TEXT,
        email TEXT,
        entry_name TEXT,
        type_of_entry TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `
    console.log("✓ Participants table created")

    // Create a default event for existing data
    console.log("Creating default event for existing floats...")
    const defaultEvent = await sql`
      INSERT INTO events (name, city, active)
      VALUES ('Default Event', 'Default City', true)
      ON CONFLICT DO NOTHING
      RETURNING id
    `
    
    let defaultEventId: number
    if (defaultEvent.length > 0) {
      defaultEventId = defaultEvent[0].id
    } else {
      const existingEvent = await sql`SELECT id FROM events WHERE name = 'Default Event' LIMIT 1`
      defaultEventId = existingEvent[0]?.id
    }

    if (!defaultEventId) {
      throw new Error("Failed to create or find default event")
    }

    console.log(`✓ Default event created/found with ID: ${defaultEventId}`)

    // Add event_id column to floats table if it doesn't exist
    console.log("Adding event_id column to floats table...")
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'floats' AND column_name = 'event_id'
        ) THEN
          ALTER TABLE floats ADD COLUMN event_id INTEGER;
        END IF;
      END $$;
    `

    // Set all existing floats to the default event
    console.log("Assigning existing floats to default event...")
    await sql`
      UPDATE floats 
      SET event_id = ${defaultEventId}
      WHERE event_id IS NULL
    `
    console.log("✓ Existing floats assigned to default event")

    // Make event_id NOT NULL and add foreign key constraint
    console.log("Adding foreign key constraint...")
    await sql`
      DO $$
      BEGIN
        -- Make event_id NOT NULL
        ALTER TABLE floats ALTER COLUMN event_id SET NOT NULL;
        
        -- Add foreign key constraint if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'floats_event_id_events_id_fk'
        ) THEN
          ALTER TABLE floats 
          ADD CONSTRAINT floats_event_id_events_id_fk 
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `
    console.log("✓ Foreign key constraint added")

    // Populate participants table from existing floats
    console.log("Populating participants table from existing floats...")
    await sql`
      INSERT INTO participants (organization, first_name, last_name, title, phone, email, entry_name, type_of_entry)
      SELECT DISTINCT ON (organization, COALESCE(email, ''))
        organization,
        first_name,
        last_name,
        title,
        phone,
        email,
        entry_name,
        type_of_entry
      FROM floats
      WHERE organization IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM participants p 
          WHERE p.organization = floats.organization 
            AND COALESCE(p.email, '') = COALESCE(floats.email, '')
        )
      ORDER BY organization, COALESCE(email, ''), submitted_at DESC NULLS LAST
    `
    console.log("✓ Participants table populated from existing floats")

    console.log("\n✅ Migration completed successfully!")
    console.log("\nNext steps:")
    console.log("1. Go to Admin Dashboard and create your first event (e.g., '2025 Comfort Xmas Parade')")
    console.log("2. Assign floats to the correct event")
    console.log("3. Use the participants table to quickly add previous participants to new events")

  } catch (error: any) {
    console.error("❌ Migration failed:", error)
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    })
    process.exit(1)
  }
}

migrate()

