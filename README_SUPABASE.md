# Supabase Migration - Quick Start

## Overview

This migration moves your entire database (schema, data, constraints, triggers, functions, views) from Neon PostgreSQL to Supabase PostgreSQL.

## Quick Steps

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js postgres
```

### 2. Get Supabase Connection String

1. Go to https://supabase.com and create a project
2. Go to Project Settings → Database
3. Copy the "Connection string" (URI format)
4. Add to `.env.local`:

```env
DATABASE_URL_SUPABASE=postgresql://postgres.xxxxx:xxxxx@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 3. Export Schema and Data

```bash
npx tsx scripts/migrate-to-supabase.ts
```

This creates:
- `supabase-migration/01-schema.sql` - Complete schema
- `supabase-migration/02-data.sql` - All data
- `supabase-migration/MIGRATION_INSTRUCTIONS.md` - Detailed guide

### 4. Import to Supabase

1. Open Supabase Dashboard → SQL Editor
2. Copy/paste `01-schema.sql` → Run
3. Copy/paste `02-data.sql` → Run

### 5. Switch Application

In `.env.local`:
```env
USE_SUPABASE=true
```

Restart: `npm run dev`

## What Gets Migrated

✅ All tables (events, judges, floats, scores, etc.)  
✅ All constraints (primary keys, foreign keys, unique)  
✅ All triggers (score total calculation)  
✅ All functions (update_score_total)  
✅ All views (if any)  
✅ All data (complete database copy)  

## Rollback

Set `USE_SUPABASE=false` in `.env.local` to revert to Neon.

## Full Documentation

See `docs/SUPABASE_MIGRATION.md` for complete details.


