# Supabase Schema Comparison: PMS vs Thingometer

## Summary
**Status: IDENTICAL** - Both schemas are 100% identical. No differences found in table definitions, columns, constraints, or relations.

---

## Table-by-Table Analysis

### 1. `cities`
**Category: (A) Core multi-event**

**Purpose:** City management for multi-tenant support (must be defined first)

**Columns:**
- `id` (serial, primary key)
- `name` (text, not null, unique)
- `slug` (text, not null, unique) - URL-friendly version
- `display_name` (text, not null)
- `region` (text, nullable)
- `active` (boolean, not null, default true)
- `created_at` (timestamp, not null, default now)
- `updated_at` (timestamp, not null, default now)

**Differences:** None

---

### 2. `events`
**Category: (A) Core multi-event**

**Purpose:** Core event management with scoring categories

**Columns:**
- `id` (serial, primary key)
- `name` (text, not null) - e.g., "2025 Comfort Xmas Parade"
- `city` (text, not null) - Legacy, kept for backward compatibility
- `city_id` (integer, nullable, references cities.id) - Multi-tenant city reference
- `event_date` (timestamp, nullable) - Legacy, kept for backward compatibility
- `start_date` (timestamp, nullable)
- `end_date` (timestamp, nullable)
- `active` (boolean, not null, default true)
- `position_mode` (text, default "preplanned") - JIT release mode
- `entry_category_title` (text, default "Best Entry")
- `scoring_categories` (jsonb) - Default parade categories
- `created_at` (timestamp, not null, default now)
- `updated_at` (timestamp, not null, default now)

**Differences:** None

**Note:** Contains legacy `city` and `event_date` fields marked for backward compatibility.

---

### 3. `event_categories`
**Category: (B) Event-configurable**

**Purpose:** Dynamic scoring categories per event

**Columns:**
- `id` (serial, primary key)
- `event_id` (integer, not null, references events.id, cascade delete)
- `category_name` (text, not null) - e.g., "Lighting", "Theme", "Traditions"
- `display_order` (integer, not null, default 0)
- `required` (boolean, not null, default true)
- `has_none_option` (boolean, not null, default true)
- `created_at` (timestamp, not null, default now)

**Constraints:**
- Unique constraint on (`event_id`, `category_name`)

**Differences:** None

---

### 4. `judges`
**Category: (B) Event-configurable**

**Purpose:** Judge table with eventId (can be nullable for migration)

**Columns:**
- `id` (serial, primary key)
- `event_id` (integer, nullable, references events.id, cascade delete)
- `name` (text, not null) - Judge name (can repeat across events)
- `submitted` (boolean, not null, default false) - Legacy, will move to judge_submissions
- `created_at` (timestamp, not null, default now)

**Constraints:**
- Unique constraint on (`event_id`, `name`)

**Differences:** None

**Note:** Contains legacy `submitted` field marked for migration to `judge_submissions`.

---

### 5. `participants`
**Category: (D) Deprecated / optional**

**Purpose:** Historical participant data (allows quick re-entry)

**Columns:**
- `id` (serial, primary key)
- `organization` (text, not null)
- `first_name` (text, nullable)
- `last_name` (text, nullable)
- `title` (text, nullable)
- `phone` (text, nullable)
- `email` (text, nullable)
- `entry_name` (text, nullable) - Common entry name if they use the same one
- `type_of_entry` (text, nullable) - Common type of entry
- `created_at` (timestamp, not null, default now)
- `updated_at` (timestamp, not null, default now)

**Differences:** None

**Note:** No event_id reference - appears to be a historical lookup table.

---

### 6. `floats`
**Category: (C) Parade-specific**

**Purpose:** Float entries

**Columns:**
- `id` (serial, primary key)
- `event_id` (integer, nullable, references events.id, cascade delete)
- `float_number` (integer, nullable)
- `organization` (text, not null)
- `entry_name` (text, nullable)
- `first_name` (text, nullable)
- `last_name` (text, nullable)
- `title` (text, nullable)
- `phone` (text, nullable)
- `email` (text, nullable)
- `comments` (text, nullable)
- `entry_length` (text, nullable)
- `float_description` (text, nullable)
- `type_of_entry` (text, nullable)
- `has_music` (boolean, not null, default false)
- `approved` (boolean, not null, default false)
- `submitted_at` (timestamp, nullable)

**Differences:** None

**Note:** Terminology ("floats", "float_number") is parade-specific. For other event types, this would represent "entries" or "participants".

---

### 7. `scores`
**Category: (A) Core multi-event**

**Purpose:** Score records (one per judge-float combination)

**Columns:**
- `id` (serial, primary key)
- `event_id` (integer, nullable, references events.id, cascade delete) - For filtering
- `judge_id` (integer, not null, references judges.id, cascade delete)
- `float_id` (integer, not null, references floats.id, cascade delete)
- `lighting` (integer, nullable) - Legacy column
- `theme` (integer, nullable) - Legacy column
- `traditions` (integer, nullable) - Legacy column
- `spirit` (integer, nullable) - Legacy column
- `music` (integer, nullable) - Legacy column
- `total` (integer, not null, default 0) - Calculated from score_items
- `created_at` (timestamp, not null, default now)
- `updated_at` (timestamp, not null, default now)

**Constraints:**
- Unique constraint on (`judge_id`, `float_id`)

**Differences:** None

**Note:** Contains legacy columns (lighting, theme, traditions, spirit, music) marked for migration period. Total is now calculated from `score_items`.

---

### 8. `score_items`
**Category: (A) Core multi-event**

**Purpose:** Individual category scores (dynamic categories)

**Columns:**
- `id` (serial, primary key)
- `score_id` (integer, not null, references scores.id, cascade delete)
- `event_category_id` (integer, not null, references event_categories.id, cascade delete)
- `value` (integer, nullable) - NULL = not scored, 0 = N/A selected, >0 = scored
- `created_at` (timestamp, not null, default now)
- `updated_at` (timestamp, not null, default now)

**Constraints:**
- Unique constraint on (`score_id`, `event_category_id`)

**Differences:** None

---

### 9. `judge_submissions`
**Category: (A) Core multi-event**

**Purpose:** Audit trail for judge submissions

**Columns:**
- `id` (serial, primary key)
- `event_id` (integer, not null, references events.id, cascade delete)
- `judge_id` (integer, not null, references judges.id, cascade delete)
- `submitted_at` (timestamp, not null, default now)
- `ip_address` (text, nullable) - Optional, for audit

**Constraints:**
- Unique constraint on (`event_id`, `judge_id`)

**Differences:** None

---

### 10. `settings`
**Category: (A) Core multi-event**

**Purpose:** Application-wide configuration

**Columns:**
- `id` (serial, primary key)
- `key` (text, not null, unique)
- `value` (text, not null)
- `updated_at` (timestamp, not null, default now)

**Differences:** None

---

### 11. `city_users`
**Category: (A) Core multi-event**

**Purpose:** User roles per city

**Columns:**
- `id` (serial, primary key)
- `city_id` (integer, not null, references cities.id, cascade delete)
- `user_email` (text, not null)
- `role` (text, not null) - Type: "admin" | "coordinator" | "judge"
- `created_at` (timestamp, not null, default now)
- `updated_at` (timestamp, not null, default now)

**Constraints:**
- Unique constraint on (`city_id`, `user_email`, `role`)

**Differences:** None

---

### 12. `winning_categories`
**Category: (B) Event-configurable**

**Purpose:** Track winners per category

**Columns:**
- `id` (serial, primary key)
- `event_id` (integer, not null, references events.id, cascade delete)
- `event_category_id` (integer, not null, references event_categories.id, cascade delete)
- `float_id` (integer, not null, references floats.id, cascade delete)
- `rank` (integer, not null) - 1 = first place, 2 = second, etc.
- `created_at` (timestamp, not null, default now)

**Constraints:**
- Unique constraint on (`event_id`, `event_category_id`, `float_id`)
- Unique constraint on (`event_id`, `event_category_id`, `rank`)

**Differences:** None

---

### 13. `event_documents`
**Category: (B) Event-configurable**

**Purpose:** Store event-related documents

**Columns:**
- `id` (serial, primary key)
- `event_id` (integer, not null, references events.id, cascade delete)
- `city_id` (integer, nullable, references cities.id, set null on delete)
- `document_type` (text, not null) - Type: "map" | "rubric" | "instructions" | "height_limits" | "other"
- `title` (text, not null)
- `file_path` (text, nullable)
- `file_url` (text, nullable)
- `description` (text, nullable)
- `display_order` (integer, not null, default 0)
- `created_at` (timestamp, not null, default now)
- `updated_at` (timestamp, not null, default now)

**Differences:** None

---

### 14. `vendors`
**Category: (C) Parade-specific**

**Purpose:** Vendor management

**Columns:**
- `id` (serial, primary key)
- `city_id` (integer, not null, references cities.id, cascade delete)
- `event_id` (integer, nullable, references events.id, set null on delete)
- `vendor_type` (text, not null) - Type: "food" | "band" | "cleanup" | "equipment" | "other"
- `name` (text, not null)
- `contact_name` (text, nullable)
- `contact_email` (text, nullable)
- `contact_phone` (text, nullable)
- `description` (text, nullable)
- `cost` (text, nullable) - Decimal stored as text in Drizzle
- `payment_status` (text, default "pending") - Type: "pending" | "paid" | "cancelled"
- `stripe_payment_intent_id` (text, nullable)
- `created_at` (timestamp, not null, default now)
- `updated_at` (timestamp, not null, default now)

**Differences:** None

**Note:** Vendor management appears specific to parade operations (food vendors, bands, cleanup, etc.).

---

## Categorization Summary

### (A) Core multi-event (8 tables)
- `cities` - Multi-tenant foundation
- `events` - Core event management
- `scores` - Core scoring system
- `score_items` - Dynamic scoring implementation
- `judge_submissions` - Audit trail
- `settings` - Application configuration
- `city_users` - Multi-tenant authentication

### (B) Event-configurable (4 tables)
- `event_categories` - Per-event scoring categories
- `judges` - Per-event judge assignments
- `winning_categories` - Per-event winner tracking
- `event_documents` - Per-event document storage

### (C) Parade-specific (2 tables)
- `floats` - Parade entry terminology and structure
- `vendors` - Parade vendor management

### (D) Deprecated / optional (1 table)
- `participants` - Historical lookup table (no event_id reference)

---

## Key Observations

1. **No Schema Differences:** The schemas are identical between PMS and Thingometer projects.

2. **Legacy Fields Present:**
   - `events.city` and `events.event_date` - marked as legacy for backward compatibility
   - `judges.submitted` - marked as legacy, will move to `judge_submissions`
   - `scores.lighting`, `scores.theme`, `scores.traditions`, `scores.spirit`, `scores.music` - legacy columns for migration period

3. **Parade-Specific Terminology:**
   - Table name `floats` and column `float_number` are parade-specific
   - Default scoring categories in `events.scoring_categories` are parade-oriented
   - `vendors` table with types like "band" and "cleanup" are parade-specific

4. **Multi-Event Architecture:**
   - Strong multi-tenant support via `cities` and `city_users`
   - Events can belong to cities via `city_id`
   - Most tables reference `event_id` for event scoping

5. **Dynamic Scoring System:**
   - Legacy hardcoded categories in `scores` table
   - Modern dynamic system via `event_categories` and `score_items`
   - Both systems coexist during migration period

---

## Recommendations for Generalization

To make this schema work for non-parade events:

1. **Rename `floats` to `entries`** - More generic terminology
2. **Rename `float_number` to `entry_number`** - More generic
3. **Remove parade-specific defaults** from `events.scoring_categories`
4. **Consider making `vendors` optional** or event-type-specific
5. **Remove legacy columns** after migration period ends
