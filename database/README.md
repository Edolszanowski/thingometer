# Database Migrations

This directory contains database migration files for the Parade Management System.

## Migration Files

Migrations are stored in `supabase-migration/` directory and applied using Supabase MCP tools or directly via SQL.

## Migration Process

1. Create migration file in `supabase-migration/` with descriptive name (e.g., `05-add-multi-tenant-tables.sql`)
2. Test migration on TEST database first
3. Apply to production after verification
4. Document changes in this README

## Current Migrations

- `01-schema-fixed.sql` - Initial schema
- `02-data.sql` - Initial data
- `03-enable-realtime.sql` - Realtime subscriptions
- `04-enable-rls.sql` - Row Level Security policies

## Regression Testing

After each migration, run regression tests to ensure:
- Legacy tables still function correctly
- Existing queries work as expected
- Data integrity is maintained


