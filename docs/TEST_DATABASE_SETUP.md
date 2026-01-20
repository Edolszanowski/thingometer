# Test Database Setup Guide

This guide walks you through setting up a test Supabase database for the Parade Judge application.

## Prerequisites

- Supabase account (sign up at https://supabase.com)
- Production database access (for schema export)
- PostgreSQL client tools (`pg_dump`) installed locally

## Step 1: Create Test Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in project details:
   - **Name**: `parade-judge-test` (or similar)
   - **Database Password**: Choose a strong password (save it securely!)
   - **Region**: Choose the same region as production (for consistency)
   - **Pricing Plan**: Free tier is fine for testing
4. Click **"Create new project"**
5. Wait for project initialization (2-3 minutes)

## Step 2: Get Connection String

1. In your new Supabase project, go to **Settings** → **Database**
2. Scroll down to **"Connection string"** section
3. Select **"URI"** format
4. Copy the connection string (it will look like):
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the database password you set during project creation
6. Save this connection string securely

## Step 3: Export Schema from Production

### Option A: Using PowerShell (Windows)

```powershell
# Make sure you have production DATABASE_URL in .env.local
pwsh ./scripts/export-schema-for-test.ps1
```

### Option B: Using Bash (Linux/Mac)

```bash
# Make sure you have production DATABASE_URL in .env.local
chmod +x scripts/export-schema-for-test.sh
./scripts/export-schema-for-test.sh
```

### Option C: Manual Export

If you don't have `pg_dump` installed, you can export manually:

1. Connect to your production database using any PostgreSQL client
2. Run this query to get all table definitions:
   ```sql
   SELECT 
       'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || 
       string_agg(column_definition, ', ') || ');' AS create_statement
   FROM (
       SELECT 
           t.schemaname,
           t.tablename,
           a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) || 
           CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END AS column_definition
       FROM pg_tables t
       JOIN pg_attribute a ON a.attrelid = (t.schemaname||'.'||t.tablename)::regclass
       WHERE t.schemaname = 'public'
       ORDER BY t.tablename, a.attnum
   ) sub
   GROUP BY schemaname, tablename;
   ```

## Step 4: Import Schema to Test Database

1. Open your test Supabase project
2. Go to **SQL Editor**
3. Open the exported schema file: `supabase-migration/test/01-schema-only.sql`
4. Copy the entire contents
5. Paste into Supabase SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. Wait for execution to complete
8. Verify tables were created:
   - Go to **Table Editor**
   - You should see all tables: `events`, `floats`, `judges`, `scores`, etc.

## Step 5: Update .env.test

1. Open `.env.test` file
2. Update the following values:

```env
# Replace [PROJECT-REF], [PASSWORD], and [REGION] with actual values
DATABASE_URL_SUPABASE=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Enable Supabase
USE_SUPABASE=true

# Set test admin password (different from production)
ADMIN_PASSWORD=test_password_change_me
```

## Step 6: Apply Migrations to Test Database

Run the multi-tenant migration on the test database:

```bash
# Set environment to use test database
cp .env.test .env.local

# Apply migrations
npm run migrate:multi-tenant
```

Or use the Supabase MCP tools:

```bash
# Verify tables exist
npm run test:multi-tenant
```

## Step 7: Add to Vercel Preview Environment

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all variables from `.env.test`:
   - `DATABASE_URL_SUPABASE`
   - `USE_SUPABASE`
   - `ADMIN_PASSWORD`
   - Any other required variables
3. Make sure to set them for **Preview** environment (not Production)

## Step 8: Verify Setup

1. Push a change to trigger Vercel Preview deployment
2. Once deployed, test the preview URL:
   - Login page should work
   - Database queries should work
   - No production data should be visible

## Troubleshooting

### Connection Issues

- **"Connection refused"**: Check that you're using the pooler connection string (port 6543)
- **"Authentication failed"**: Verify password is correct (no extra spaces)
- **"Database does not exist"**: Make sure project is fully initialized

### Schema Import Issues

- **"Table already exists"**: Drop existing tables first (if re-importing)
- **"Permission denied"**: Make sure you're using the postgres user connection string
- **"Syntax error"**: Check that SQL file is valid PostgreSQL syntax

### Migration Issues

- **"Table does not exist"**: Run schema import first (Step 4)
- **"Column does not exist"**: Make sure you're using the latest schema export

## Security Notes

⚠️ **Important**: 
- Never commit `.env.test` with real credentials to git
- Use different passwords for test and production
- Regularly rotate test database passwords
- Limit access to test database (only team members who need it)

## Next Steps

After test database is set up:
1. Run CI/CD tests against test database
2. Test all features in preview environment
3. Verify city-scoped authentication works
4. Test multi-tenant features
5. Once verified, plan production rollout


