# Supabase Migration Instructions

## Prerequisites

1. **Supabase Project Created**
   - Go to https://supabase.com
   - Create a new project
   - Note your project connection string

2. **Connection String Format**
   Add to .env.local:
   ```
   DATABASE_URL_SUPABASE=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

## Migration Steps

### Step 1: Update Database Connection

Update `lib/db.ts` to use Supabase connection:
```typescript
import { postgres } from "@vercel/postgres"
import { drizzle } from "drizzle-orm/vercel-postgres"
// OR use @supabase/supabase-js with drizzle-orm/postgres-js
```

### Step 2: Import Schema to Supabase

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste contents of `01-schema.sql`
3. Run the SQL script
4. Verify all tables, constraints, and triggers are created

### Step 3: Import Data to Supabase

1. In Supabase SQL Editor
2. Copy and paste contents of `02-data.sql`
3. Run the SQL script
4. Verify data is imported correctly

### Step 4: Update Application Configuration

1. Update `lib/db.ts` to use Supabase connection
2. Update `DATABASE_URL` in .env.local to point to Supabase
3. Test the application

### Step 5: Verify Migration

Run test scripts to verify:
```bash
npm run test:db
```

## Rollback Plan

If migration fails:
1. Keep Neon database active
2. Revert `DATABASE_URL` to Neon connection string
3. Fix issues and retry migration

## Notes

- Supabase uses standard PostgreSQL, so most features should work identically
- Connection pooling is handled automatically by Supabase
- Row Level Security (RLS) can be enabled later if needed
- Backup your Neon database before migration
