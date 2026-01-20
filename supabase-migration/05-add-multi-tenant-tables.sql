-- ============================================================================
-- Multi-City Parade Rollout - Multi-Tenant Foundation
-- Migration: 05-add-multi-tenant-tables.sql
-- ============================================================================
-- This migration adds tables for multi-city/multi-tenant support:
-- - cities: City management
-- - city_users: User roles per city
-- - company_entries: Alternative name for floats/entries (for clarity)
-- - winning_categories: Track winners per category
-- - event_documents: Store event-related documents (maps, rubrics, etc.)
-- - vendors: Vendor management (food, bands, cleanup, etc.)

-- ============================================================================
-- CITIES - City management
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE, -- e.g., "Comfort", "Boerne"
  slug TEXT NOT NULL UNIQUE, -- URL-friendly version: "comfort", "boerne"
  display_name TEXT NOT NULL, -- Display name: "Comfort, TX"
  region TEXT, -- State/region
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cities_slug ON public.cities(slug);
CREATE INDEX IF NOT EXISTS idx_cities_active ON public.cities(active);

-- ============================================================================
-- CITY_USERS - User roles per city
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.city_users (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL, -- User identifier (email)
  role TEXT NOT NULL CHECK (role IN ('admin', 'coordinator', 'judge')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (city_id, user_email, role)
);

CREATE INDEX IF NOT EXISTS idx_city_users_city_id ON public.city_users(city_id);
CREATE INDEX IF NOT EXISTS idx_city_users_email ON public.city_users(user_email);

-- ============================================================================
-- Add city_id to events table (nullable for migration)
-- ============================================================================
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES public.cities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_city_id ON public.events(city_id);

-- Add position_mode for JIT release mode (from section 7)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS position_mode TEXT DEFAULT 'preplanned' CHECK (position_mode IN ('preplanned', 'jit'));

-- ============================================================================
-- COMPANY_ENTRIES - Alternative view/table for entries (aliased to floats)
-- Note: This is a view that maps to floats table for clarity
-- ============================================================================
-- We'll use floats table as company_entries, but add a view for clarity
CREATE OR REPLACE VIEW public.company_entries AS
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
FROM public.floats;

-- ============================================================================
-- WINNING_CATEGORIES - Track winners per category
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.winning_categories (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_category_id INTEGER NOT NULL REFERENCES public.event_categories(id) ON DELETE CASCADE,
  float_id INTEGER NOT NULL REFERENCES public.floats(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL, -- 1 = first place, 2 = second, etc.
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (event_id, event_category_id, float_id),
  UNIQUE (event_id, event_category_id, rank) -- One winner per rank per category
);

CREATE INDEX IF NOT EXISTS idx_winning_categories_event_id ON public.winning_categories(event_id);
CREATE INDEX IF NOT EXISTS idx_winning_categories_category_id ON public.winning_categories(event_category_id);
CREATE INDEX IF NOT EXISTS idx_winning_categories_float_id ON public.winning_categories(float_id);

-- ============================================================================
-- EVENT_DOCUMENTS - Store event-related documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.event_documents (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  city_id INTEGER REFERENCES public.cities(id) ON DELETE SET NULL, -- For city-wide documents
  document_type TEXT NOT NULL CHECK (document_type IN ('map', 'rubric', 'instructions', 'height_limits', 'other')),
  title TEXT NOT NULL,
  file_path TEXT, -- Path to file in storage (Supabase Storage or external)
  file_url TEXT, -- Full URL to document
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_documents_event_id ON public.event_documents(event_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_city_id ON public.event_documents(city_id);
CREATE INDEX IF NOT EXISTS idx_event_documents_type ON public.event_documents(document_type);

-- ============================================================================
-- VENDORS - Vendor management
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendors (
  id SERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES public.events(id) ON DELETE SET NULL, -- Optional: event-specific vendors
  vendor_type TEXT NOT NULL CHECK (vendor_type IN ('food', 'band', 'cleanup', 'equipment', 'other')),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  description TEXT,
  cost DECIMAL(10, 2), -- Cost amount
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  stripe_payment_intent_id TEXT, -- Stripe payment intent ID
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_city_id ON public.vendors(city_id);
CREATE INDEX IF NOT EXISTS idx_vendors_event_id ON public.vendors(event_id);
CREATE INDEX IF NOT EXISTS idx_vendors_type ON public.vendors(vendor_type);

-- ============================================================================
-- Enable RLS on new tables
-- ============================================================================
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on cities" ON public.cities FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.city_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on city_users" ON public.city_users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.winning_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on winning_categories" ON public.winning_categories FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on event_documents" ON public.event_documents FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);


