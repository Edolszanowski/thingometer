/**
 * Apply Multi-Tenant Migration to Neon (Fixed Order)
 */

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

async function applyMigration() {
  try {
    const { neon } = require("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL)

    console.log("🔧 Applying Multi-Tenant Migration to Neon (Fixed Order)...\n")

    // Execute in correct order: tables first, then indexes, then policies
    const migrations = [
      // 1. Create cities table
      `CREATE TABLE IF NOT EXISTS public.cities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        region TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,

      // 2. Create city_users table
      `CREATE TABLE IF NOT EXISTS public.city_users (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
        user_email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'coordinator', 'judge')),
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (city_id, user_email, role)
      )`,

      // 3. Add columns to events table
      `ALTER TABLE public.events 
       ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES public.cities(id) ON DELETE SET NULL`,

      `ALTER TABLE public.events
       ADD COLUMN IF NOT EXISTS position_mode TEXT DEFAULT 'preplanned' CHECK (position_mode IN ('preplanned', 'jit'))`,

      // 4. Create winning_categories table
      `CREATE TABLE IF NOT EXISTS public.winning_categories (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
        event_category_id INTEGER NOT NULL REFERENCES public.event_categories(id) ON DELETE CASCADE,
        float_id INTEGER NOT NULL REFERENCES public.floats(id) ON DELETE CASCADE,
        rank INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (event_id, event_category_id, float_id),
        UNIQUE (event_id, event_category_id, rank)
      )`,

      // 5. Create event_documents table
      `CREATE TABLE IF NOT EXISTS public.event_documents (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
        city_id INTEGER REFERENCES public.cities(id) ON DELETE SET NULL,
        document_type TEXT NOT NULL CHECK (document_type IN ('map', 'rubric', 'instructions', 'height_limits', 'other')),
        title TEXT NOT NULL,
        file_path TEXT,
        file_url TEXT,
        description TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,

      // 6. Create vendors table
      `CREATE TABLE IF NOT EXISTS public.vendors (
        id SERIAL PRIMARY KEY,
        city_id INTEGER NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES public.events(id) ON DELETE SET NULL,
        vendor_type TEXT NOT NULL CHECK (vendor_type IN ('food', 'band', 'cleanup', 'equipment', 'other')),
        name TEXT NOT NULL,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        description TEXT,
        cost DECIMAL(10, 2),
        payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
        stripe_payment_intent_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`,

      // 7. Create company_entries view
      `CREATE OR REPLACE VIEW public.company_entries AS
       SELECT 
         id,
         event_id,
         float_number as entry_number,
         organization as company_name,
         entry_name,
         first_name,
         last_name,
         title,
         phone,
         email,
         comments,
         entry_length,
         float_description as description,
         type_of_entry,
         has_music,
         approved,
         submitted_at,
         created_at
       FROM public.floats`,

      // 8. Create indexes
      `CREATE INDEX IF NOT EXISTS idx_cities_slug ON public.cities(slug)`,
      `CREATE INDEX IF NOT EXISTS idx_cities_active ON public.cities(active)`,
      `CREATE INDEX IF NOT EXISTS idx_city_users_city_id ON public.city_users(city_id)`,
      `CREATE INDEX IF NOT EXISTS idx_city_users_email ON public.city_users(user_email)`,
      `CREATE INDEX IF NOT EXISTS idx_events_city_id ON public.events(city_id)`,
      `CREATE INDEX IF NOT EXISTS idx_winning_categories_event_id ON public.winning_categories(event_id)`,
      `CREATE INDEX IF NOT EXISTS idx_winning_categories_category_id ON public.winning_categories(event_category_id)`,
      `CREATE INDEX IF NOT EXISTS idx_winning_categories_float_id ON public.winning_categories(float_id)`,
      `CREATE INDEX IF NOT EXISTS idx_event_documents_event_id ON public.event_documents(event_id)`,
      `CREATE INDEX IF NOT EXISTS idx_event_documents_city_id ON public.event_documents(city_id)`,
      `CREATE INDEX IF NOT EXISTS idx_event_documents_type ON public.event_documents(document_type)`,
      `CREATE INDEX IF NOT EXISTS idx_vendors_city_id ON public.vendors(city_id)`,
      `CREATE INDEX IF NOT EXISTS idx_vendors_event_id ON public.vendors(event_id)`,
      `CREATE INDEX IF NOT EXISTS idx_vendors_type ON public.vendors(vendor_type)`,

      // 9. Enable RLS and create policies
      `ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY IF NOT EXISTS "Allow all operations on cities" ON public.cities FOR ALL USING (true) WITH CHECK (true)`,

      `ALTER TABLE public.city_users ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY IF NOT EXISTS "Allow all operations on city_users" ON public.city_users FOR ALL USING (true) WITH CHECK (true)`,

      `ALTER TABLE public.winning_categories ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY IF NOT EXISTS "Allow all operations on winning_categories" ON public.winning_categories FOR ALL USING (true) WITH CHECK (true)`,

      `ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY IF NOT EXISTS "Allow all operations on event_documents" ON public.event_documents FOR ALL USING (true) WITH CHECK (true)`,

      `ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY IF NOT EXISTS "Allow all operations on vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true)`,
    ]

    console.log(`Executing ${migrations.length} statements...\n`)

    for (let i = 0; i < migrations.length; i++) {
      try {
        await sql(migrations[i])
        console.log(`✓ ${i + 1}/${migrations.length}`)
      } catch (error: any) {
        if (!error.message?.includes("already exists") && 
            !error.message?.includes("duplicate") &&
            !error.message?.includes("does not exist")) {
          console.error(`✗ ${i + 1} failed:`, error.message)
        } else {
          console.log(`⊘ ${i + 1} skipped`)
        }
      }
    }

    // Verify
    console.log("\n🔍 Verifying migration...\n")
    const verify = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('cities', 'city_users', 'winning_categories', 'event_documents', 'vendors')
      ORDER BY table_name
    `
    
    console.log("Tables found:")
    verify.forEach((row: any) => {
      console.log(`  ✓ ${row.table_name}`)
    })

    if (verify.length === 5) {
      console.log("\n✅ All multi-tenant tables created successfully!")
    } else {
      console.log(`\n⚠️  Only ${verify.length}/5 tables found`)
    }

  } catch (error: any) {
    console.error("\n❌ Error:", error.message)
    console.error(error)
    process.exit(1)
  }
}

applyMigration().catch(console.error)


