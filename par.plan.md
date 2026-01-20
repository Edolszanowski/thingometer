# Wrong Project

# Multi-City Parade Rollout

## Prereq: Safe Test Environment Setup (run before other tasks)

### 1. Branch + Vercel Preview (TEST)

1. Ensure working tree clean: git status.
2. Update main: git checkout main && git pull.
3. Create branch: git checkout -b multi-city-parade and push git push -u origin multi-city-parade.
4. In Vercel ➜ New Project ➜ import repo ➜ choose multi-city-parade branch.
5. During setup, mark deployment as Preview/TEST, add necessary env vars, and trigger initial build (push a README change or rerun build).

### 2. Clone Supabase/Neon DB & .env.test

1. In Supabase/Neon, create new project (e.g., careeros-parade-test) in same region.
2. Export prod schema: pg_dump --schema-only  > schema.sql.
3. Import into new DB: psql  < schema.sql.
4. Copy .env ➜ .env.test; update database URL, Supabase keys, Stripe test keys, etc.
5. Add .env.test values to Vercel Preview env vars; locally, load them via cp .env.test .env.local (or dotenv -e .env.test).

### 3. CI: lint/tests + curl smoke before deploy

1. Add .github/workflows/test-preview.yml triggered on PRs to multi-city-parade.
2. Workflow steps: checkout, setup Node 20, 
pm ci, 
pm run lint, 
pm test.
3. Add curl smoke step: pwsh ./test-onboarding-curl.ps1 -Environment TEST (extend script with parade endpoints, e.g., registration, judging, announcer).
4. In Vercel ➜ Git ➜ enable “Require status checks” so preview deploy waits for workflow success.

### 4. Run migrations on cloned DB first

1. Keep migration files in repo (e.g., database/migrations).
2. Apply to TEST DB: DATABASE_URL= npm run db:migrate.
3. Verify schema + data locally (psql queries, regression SQL tests).
4. Only after QA passes, run same migration against prod DB and document run in database/README.md.

### 5. Post-merge deploy + verification cycle

1. After PR merge into multi-city-parade, wait for Vercel Preview deploy.
2. Grab preview URL, run automated suites (
pm run e2e:test --baseURL <url>, curl scripts) against it.
3. Spot-check TEST DB for new tables/data; ensure legacy features still work.
4. Once approved, plan production rollout: apply migrations to prod, merge branch into main, and redeploy production Vercel project.
5. Monitor logs/metrics post-deploy before scheduling next release.

## 1. Multi-tenant foundation

- Add cities, city_users, vents, vent_categories, company_entries, vent_judges, judge_scores, winning_categories, vent_documents, and endors tables plus migrations (with feature flags) in [database/schema.md] and scripts under [database-setup-scripts/]; include regression SQL tests to confirm legacy tables still function.
- Update auth helpers in [lib/admin-auth.ts] and middleware to resolve active city from URL/subdomain and enforce role-based access (dmin, coordinator, judge). Add unit tests covering role resolution and city scoping.
- Introduce city-scoped layouts/routes in [app/(city)/...] so /comfort/admin, /boerne/public, etc. query only their city data via new helpers in [lib/db.ts]. Add integration tests ensuring cross-city isolation.

## 2. Coordinator + registration workflows

- Extend registration forms in [app/events/[city]/register/page.tsx] (and shared components) to collect driver first/last name, email, phone, and surface coordinator-authored instruction bundles (maps, height limits, rubric). Write component tests for the new fields and documents section.
- Persist instructions/assets via vent_documents table or storage references uploaded from /[city]/admin/events/[eventId]/instructions. Add API tests ensuring uploads stay scoped to city_id.

## 3. Email validation & notifications

- Update [app/api/events/register/route.ts] (and supporting libs) to send email verification links via Resend; mark entries pending_validation until confirmed. Add tests for token generation/expiration.
- Create verification endpoint/webhook to flip status and notify coordinators; send participant confirmation that final approval/position will come later. Configure Reply-To per city while sending through support@ithriveai.com. Cover with integration tests and recorded curl flows.

## 4. Judging enhancements & winning categories

- Enhance judge UI in [app/[city]/judge/[eventId]/page.tsx] to show rubric resources, allow scoring per category, and lock scores. Add Cypress tests simulating score entry and locking.
- On lock, populate winning_categories for each entry/category and expose results to coordinators/public. Add DB tests verifying inserts and uniqueness.

## 5. Announcer prompt engine

- Build announcer console [app/[city]/announcer/[eventId]/page.tsx] streaming ordered floats (company, float name, title, description, driver info), supporting auto-scroll/manual control/font scaling. Add end-to-end tests that simulate live updates.
- Feed console from a loat_order service (Redis/pub-sub or polling API) that reacts to coordinator updates or JIT releases; include unit tests for ordering logic.

## 6. Public + participant views

- Publish parade route maps and downloadable instructions on [app/[city]/route/page.tsx], tying into vent_documents. Snapshot-test the page for different cities.
- Build participant dashboard (/[city]/positions) showing live float order/status with WebSocket or SSE updates; add integration tests for live position feeds.

## 7. Optional JIT release mode (lower priority)

- Add position_mode = 'preplanned' | 'jit' on vents; build coordinator tooling for staging floats by holding areas and releasing sequentially. Cover release sequencing with unit tests.
- Ensure announcer/participant feeds react to JIT updates in real time; extend Cypress tests to exercise JIT flows.

## 8. Vendor management (lower priority)

- Create vendor admin module under [app/[city]/admin/vendors] with CRUD for food, bands, cleanup, etc., linked to Stripe payment intents when required. Write API + UI tests for vendor creation/payments.
- Extend public/vendor views or coordinator exports as needed; ensure payment webhooks are tested via curl scripts.
