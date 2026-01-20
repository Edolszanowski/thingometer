#!/bin/bash
# Export schema from production database for test database setup
# Usage: ./scripts/export-schema-for-test.sh

set -e

echo "=========================================="
echo "Exporting Schema for Test Database"
echo "=========================================="

# Load environment variables from .env.local
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
else
    echo "Error: .env.local file not found"
    echo "Please create .env.local with your production DATABASE_URL"
    exit 1
fi

if [ -z "$DATABASE_URL" ] && [ -z "$DATABASE_URL_SUPABASE" ]; then
    echo "Error: DATABASE_URL or DATABASE_URL_SUPABASE not set in .env.local"
    exit 1
fi

# Use DATABASE_URL_SUPABASE if USE_SUPABASE=true, otherwise DATABASE_URL
if [ "$USE_SUPABASE" = "true" ] && [ -n "$DATABASE_URL_SUPABASE" ]; then
    DB_URL="$DATABASE_URL_SUPABASE"
else
    DB_URL="$DATABASE_URL"
fi

echo "Using database: ${DB_URL:0:50}..."

# Create output directory
mkdir -p supabase-migration/test

# Export schema only (no data)
echo "Exporting schema..."
pg_dump "$DB_URL" \
    --schema-only \
    --no-owner \
    --no-acl \
    --file=supabase-migration/test/01-schema-only.sql

# Export schema with data (for reference)
echo "Exporting schema with data..."
pg_dump "$DB_URL" \
    --schema-only \
    --no-owner \
    --no-acl \
    --file=supabase-migration/test/01-schema-with-data.sql

echo ""
echo "=========================================="
echo "Schema exported successfully!"
echo "=========================================="
echo ""
echo "Files created:"
echo "  - supabase-migration/test/01-schema-only.sql"
echo "  - supabase-migration/test/01-schema-with-data.sql"
echo ""
echo "Next steps:"
echo "1. Create a new Supabase project for testing"
echo "2. Copy the contents of 01-schema-only.sql"
echo "3. Paste into Supabase SQL Editor and run"
echo "4. Update .env.test with your test database connection string"
echo ""


