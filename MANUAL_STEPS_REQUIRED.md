# Manual Steps Required - Multi-City Parade Rollout

<div style="background-color: #ff0000; color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h2 style="color: #ffffff; margin-top: 0;">⚠️ MANUAL ACTION REQUIRED ⚠️</h2>
  <p style="color: #ffffff; font-size: 16px; line-height: 1.6;">
    The following steps require manual intervention and cannot be fully automated.
    Please complete these before deploying to production.
  </p>
</div>

## Prerequisites - Manual Steps

### 1. Branch + Vercel Preview Setup
<div style="background-color: #ff0000; color: #ffffff; padding: 15px; border-radius: 5px; margin: 10px 0;">
**ACTION REQUIRED:**
1. Ensure working tree clean: `git status`
2. Update main: `git checkout main && git pull`
3. Create branch: `git checkout -b multi-city-parade` and push `git push -u origin multi-city-parade`
4. In Vercel ➜ New Project ➜ import repo ➜ choose `multi-city-parade` branch
5. During setup, mark deployment as Preview/TEST, add necessary env vars, and trigger initial build
</div>

### 2. Clone Supabase/Neon DB & .env.test
<div style="background-color: #ff0000; color: #ffffff; padding: 15px; border-radius: 5px; margin: 10px 0;">
**ACTION REQUIRED:**
1. In Supabase/Neon, create new project (e.g., `careeros-parade-test`) in same region
2. Export prod schema: `pg_dump --schema-only > schema.sql`
3. Import into new DB: `psql < schema.sql`
4. Copy `.env` ➜ `.env.test`; update database URL, Supabase keys, Stripe test keys, etc.
5. Add `.env.test` values to Vercel Preview env vars; locally, load them via `cp .env.test .env.local`
</div>

### 3. Vercel Git Integration
<div style="background-color: #ff0000; color: #ffffff; padding: 15px; border-radius: 5px; margin: 10px 0;">
**ACTION REQUIRED:**
In Vercel ➜ Git ➜ enable "Require status checks" so preview deploy waits for workflow success
</div>

## Completed Automated Steps ✅

- ✅ CI workflow setup (`.github/workflows/test-preview.yml`)
- ✅ Migration system setup (`database/README.md`)
- ✅ Multi-tenant tables created (cities, city_users, winning_categories, event_documents, vendors)
- ✅ Auth helpers created (`lib/admin-auth.ts`)
- ✅ Middleware updated for city resolution
- ✅ Drizzle schema updated with new tables

## Next Steps - Implementation Required

### City-Scoped Routes
The application needs to be restructured to support city-scoped routes:
- Current: `/admin`, `/judge`, `/coordinator`
- New: `/[city]/admin`, `/[city]/judge`, `/[city]/coordinator`

This requires:
1. Creating route group structure: `app/(city)/[citySlug]/...`
2. Updating all route handlers to extract city from URL
3. Updating all database queries to filter by city_id
4. Testing cross-city isolation

### Email Integration
- Install Resend package: `npm install resend`
- Add `RESEND_API_KEY` to environment variables
- Configure email templates
- Set up webhook endpoints for email verification

### Stripe Integration (for Vendors)
- Install Stripe package: `npm install stripe`
- Add `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` to environment variables
- Configure webhook endpoints for payment processing

## Testing Checklist

After completing manual steps, run:

1. **Database Tests:**
   ```bash
   npm run test:db
   ```

2. **Integration Tests:**
   ```bash
   npm run test:integration
   ```

3. **Manual Testing:**
   - Create test city in database
   - Test city-scoped routes
   - Verify cross-city isolation
   - Test email verification flow
   - Test vendor payment flow

## Notes

- All database migrations have been applied successfully
- RLS policies are in place for all tables
- The system maintains backward compatibility with existing single-city setup
- City slug resolution works via URL path or subdomain


