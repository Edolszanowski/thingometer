# Supabase Migration Guide

This guide will help you migrate your Parade Management System database from Neon PostgreSQL to Supabase.

## Prerequisites

1. **Supabase Account**
   - Sign up at https://supabase.com
   - Create a new project
   - Note your project connection string

2. **Environment Variables**
   - Keep your existing `DATABASE_URL` (Neon) for migration
   - Add `DATABASE_URL_SUPABASE` to `.env.local`

## Migration Steps

### Step 1: Install Dependencies

```bash
npm install @supabase/supabase-js postgres
```

### Step 2: Export Schema and Data from Neon

Run the migration export script:

```bash
npx tsx scripts/migrate-to-supabase.ts
```

This will create:
- `supabase-migration/01-schema.sql` - Complete schema (tables, constraints, triggers, functions, views)
- `supabase-migration/02-data.sql` - All data export
- `supabase-migration/MIGRATION_INSTRUCTIONS.md` - Detailed instructions

### Step 3: Set Up Supabase Connection String

Add to `.env.local`:

```env
# Supabase Connection String
# Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DATABASE_URL_SUPABASE=postgresql://postgres.xxxxx:xxxxx@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Enable Supabase (set to true to switch from Neon to Supabase)
USE_SUPABASE=true
```

**Getting Your Supabase Connection String:**
1. Go to Supabase Dashboard → Project Settings → Database
2. Find "Connection string" section
3. Select "URI" format
4. Copy the connection string
5. Replace `[YOUR-PASSWORD]` with your database password

### Step 4: Import Schema to Supabase

1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of `supabase-migration/01-schema.sql`
3. Paste into SQL Editor
4. Click "Run" to execute
5. Verify all tables, constraints, triggers, and functions are created

### Step 5: Import Data to Supabase

1. In Supabase SQL Editor
2. Copy the entire contents of `supabase-migration/02-data.sql`
3. Paste into SQL Editor
4. Click "Run" to execute
5. Verify data is imported correctly

### Step 6: Switch Application to Supabase

1. Update `.env.local`:
   ```env
   USE_SUPABASE=true
   DATABASE_URL_SUPABASE=your_supabase_connection_string
   ```

2. Restart your development server:
   ```bash
   npm run dev
   ```

3. Test the application to ensure everything works

### Step 7: Verify Migration

Run test scripts:

```bash
npm run test:db
npm run test:scoring
```

## Database Schema Overview

The following tables will be migrated:

1. **events** - Event management
2. **event_categories** - Dynamic scoring categories
3. **judges** - Judge information
4. **participants** - Historical participant data
5. **floats** - Float entries
6. **scores** - Score records
7. **score_items** - Individual category scores
8. **judge_submissions** - Submission audit trail
9. **settings** - Application settings

## Constraints and Triggers

The migration includes:
- **Primary Keys** - All tables
- **Foreign Keys** - Referential integrity
- **Unique Constraints** - Prevent duplicates
- **Triggers** - Auto-update score totals
- **Functions** - `update_score_total()` for score calculation

## Rollback Plan

If migration fails:

1. Set `USE_SUPABASE=false` in `.env.local` (or remove it)
2. Application will revert to Neon connection
3. Fix issues and retry migration

## Differences Between Neon and Supabase

Both use PostgreSQL, so functionality is identical. Key differences:

- **Connection Pooling**: Supabase handles this automatically
- **Connection String Format**: Slightly different format
- **Dashboard**: Supabase provides a web-based SQL editor
- **Row Level Security**: Available in Supabase (optional)

## Troubleshooting

### Connection Issues

- Verify connection string format
- Check password is correct
- Ensure project is active in Supabase dashboard

### Schema Import Errors

- Check for existing tables (drop if needed for fresh start)
- Verify all dependencies are created in correct order
- Check trigger function is created before triggers

### Data Import Errors

- Verify foreign key constraints are satisfied
- Check for duplicate primary keys
- Ensure all referenced records exist

## Support

For issues:
1. Check Supabase Dashboard → Logs
2. Review SQL Editor error messages
3. Verify environment variables are set correctly


