# Lemonade Day Organization Setup Guide

## Overview

This guide explains how to set up the organization field for Lemonade Day events, which enables the child-safe form to display the host organization dynamically.

## What Changed

### 1. Database Schema
Added `organization` column to the `events` table to store the host organization name.

**Schema Update:**
```typescript
// lib/drizzle/schema.ts
export const events = pgTable("events", {
  // ... other fields
  organization: text("organization"), // Host organization (e.g., "Greater Boerne Chamber of Commerce")
  // ... other fields
})
```

### 2. Setup Script
Updated `scripts/setup-lemonade-day.ts` to include organization in event configuration.

**Configuration:**
```typescript
const EVENT_CONFIG = {
  name: "Lemonade Day 2026",
  city: "Boerne",
  organization: "Greater Boerne Chamber of Commerce", // Required field
  event_date: new Date("2026-05-02T09:00:00-05:00"),
  type: "lemonade_day",
  // ... other fields
}
```

### 3. Signup Form
The form now reads the organization from event data and displays it as a locked field.

**Form Behavior:**
- **Lemonade Day**: Shows "Event Host" field (read-only) with organization from database
- **Parade Events**: Shows editable "Organization Name" field (unchanged)

## Setup Instructions

### Step 1: Apply Database Migration

**Option A: Using Migration Script (Recommended)**
```bash
npx tsx scripts/apply-organization-migration.ts
```

**Option B: Manual SQL (If script fails)**
1. Go to Supabase Dashboard → SQL Editor
2. Run this SQL:
```sql
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS organization TEXT;

COMMENT ON COLUMN events.organization IS 'Host organization for the event';

UPDATE events 
SET organization = 'Greater Boerne Chamber of Commerce'
WHERE type = 'lemonade_day' 
  AND organization IS NULL;
```

### Step 2: Run Lemonade Day Setup

After the migration is applied, run the setup script:

```bash
npx tsx scripts/setup-lemonade-day.ts
```

This will:
- Create or update the "Lemonade Day 2026" event
- Set `organization` to "Greater Boerne Chamber of Commerce"
- Configure all scoring categories and judges

### Step 3: Verify the Setup

1. **Check Database:**
```bash
# Query to verify organization field
SELECT id, name, city, organization, type 
FROM events 
WHERE type = 'lemonade_day';
```

2. **Test the Form:**
- Navigate to: `http://localhost:3000/signup?eventId=4`
- Verify "Event Host" field shows "Greater Boerne Chamber of Commerce"
- Verify field is disabled (gray background)
- Submit form and check backend receives correct organization

## Customizing for Other Cities

To create a Lemonade Day event for a different city/organization:

### 1. Update Setup Script

Edit `scripts/setup-lemonade-day.ts`:

```typescript
const EVENT_CONFIG = {
  name: "Lemonade Day 2026",
  city: "Your City Name",
  organization: "Your Chamber of Commerce or Organization", // Change this
  event_date: new Date("2026-05-02T09:00:00-05:00"),
  type: "lemonade_day",
  // ... rest of config
}
```

### 2. Run Setup

```bash
npx tsx scripts/setup-lemonade-day.ts
```

### 3. Verify

The signup form will now show your organization name in the "Event Host" field.

## Technical Details

### How It Works

1. **Event Data Fetch:**
   - Form fetches event data from `/api/events`
   - Includes `organization` field in response

2. **Dynamic Display:**
   ```typescript
   const eventOrganization = eventData?.organization || eventData?.hostOrganization || ""
   ```

3. **Form Rendering:**
   ```tsx
   {isLemonadeDay && (
     <Input
       value={eventOrganization}
       disabled
       className="bg-gray-100"
     />
   )}
   ```

4. **Backend Submission:**
   ```typescript
   organization: isLemonadeDay ? eventOrganization : formData.organization.trim()
   ```

### Fallback Behavior

If `organization` field is not set in the database:
- The "Event Host" field will be empty
- Backend will receive an empty string
- Form will still submit successfully

**To fix:** Run the setup script or manually update the event in the database.

## Files Modified

1. **Schema:**
   - `lib/drizzle/schema.ts` - Added organization column

2. **Setup Script:**
   - `scripts/setup-lemonade-day.ts` - Added organization to EVENT_CONFIG

3. **Migration:**
   - `supabase-migration/09-add-organization-to-events.sql` - SQL migration
   - `scripts/apply-organization-migration.ts` - Migration script

4. **Signup Form:**
   - `app/signup/page.tsx` - Reads and displays organization dynamically

## Troubleshooting

### Issue: "Event Host" field is empty

**Solution:**
1. Check if migration was applied: `SELECT organization FROM events WHERE id = 4;`
2. If NULL, run setup script: `npx tsx scripts/setup-lemonade-day.ts`
3. Verify in database: Organization should now be populated

### Issue: Organization not updating in form

**Solution:**
1. Clear browser cache
2. Restart dev server: `npm run dev`
3. Check browser console for API errors
4. Verify `/api/events` returns organization field

### Issue: Migration script fails

**Solution:**
1. Apply SQL manually via Supabase Dashboard
2. Copy SQL from `supabase-migration/09-add-organization-to-events.sql`
3. Run in SQL Editor
4. Then run setup script

## Best Practices

1. **Always set organization** when creating Lemonade Day events
2. **Use full organization name** (e.g., "Greater Boerne Chamber of Commerce")
3. **Test the form** after setup to verify organization displays correctly
4. **Document custom organizations** if managing multiple cities

## Support

For issues or questions:
1. Check this documentation first
2. Review the setup script: `scripts/setup-lemonade-day.ts`
3. Verify database schema: `lib/drizzle/schema.ts`
4. Check form implementation: `app/signup/page.tsx`
