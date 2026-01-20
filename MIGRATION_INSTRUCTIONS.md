# CRITICAL: Database Migration Required

## Issue
The production database still has `NOT NULL` constraints on score columns (`lighting`, `theme`, `traditions`, `spirit`, `music`), but the application code now sends `NULL` values for unscored categories. This causes errors like:

```
null value in column "lighting" of relation "scores" violates not-null constraint
```

## Solution
Run the migration script to make score columns nullable.

## Steps to Run Migration

### Option 1: Using Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Pull production environment variables**:
   ```bash
   vercel env pull .env.local
   ```
   This will download the production `DATABASE_URL` to your local `.env.local` file.

3. **Run the migration script**:
   ```bash
   npx tsx scripts/migrate-scores-nullable.ts
   ```

4. **Verify the migration**:
   The script will output verification results showing:
   - Number of unscored records (NULL)
   - Number of scored records

### Option 2: Manual Migration

1. **Get your production DATABASE_URL** from Vercel:
   - Go to your Vercel project settings
   - Navigate to Environment Variables
   - Copy the `DATABASE_URL` value

2. **Temporarily set it in `.env.local`**:
   ```env
   DATABASE_URL=your_production_connection_string_here
   ```

3. **Run the migration**:
   ```bash
   npx tsx scripts/migrate-scores-nullable.ts
   ```

4. **Remove the production URL** from `.env.local` after migration completes

### Option 3: Direct SQL (Advanced)

If you have direct database access, you can run these SQL commands:

```sql
-- Make columns nullable
ALTER TABLE scores 
  ALTER COLUMN lighting DROP NOT NULL,
  ALTER COLUMN lighting DROP DEFAULT,
  ALTER COLUMN theme DROP NOT NULL,
  ALTER COLUMN theme DROP DEFAULT,
  ALTER COLUMN traditions DROP NOT NULL,
  ALTER COLUMN traditions DROP DEFAULT,
  ALTER COLUMN spirit DROP NOT NULL,
  ALTER COLUMN spirit DROP DEFAULT,
  ALTER COLUMN music DROP NOT NULL,
  ALTER COLUMN music DROP DEFAULT;

-- Convert unscored records (all 0s) to NULL
UPDATE scores
SET 
  lighting = NULL,
  theme = NULL,
  traditions = NULL,
  spirit = NULL,
  music = NULL
WHERE 
  lighting = 0 
  AND theme = 0 
  AND traditions = 0 
  AND spirit = 0 
  AND music = 0;
```

## Temporary Workaround

The API has been updated with a fallback that converts `NULL` to `0` if the database still has `NOT NULL` constraints. However, this is **not ideal** because:
- It loses the distinction between "not scored" (NULL) and "N/A selected" (0)
- Score status calculations may be incorrect
- Judges may see incorrect completion status

**The migration MUST be run** for the system to work correctly.

## After Migration

Once the migration is complete:
1. The application will correctly save `NULL` for unscored categories
2. Score status calculations will be accurate
3. Judges will see correct completion indicators (blue/red/green)
4. The fallback code will no longer be needed (but it's harmless to leave it)

## Verification

After running the migration, test by:
1. Scoring a float with some categories left unscored (NULL)
2. Verifying the scores save without errors
3. Checking that the float shows correct status (incomplete/complete)
4. Navigating between floats and verifying scores persist

## Important Notes

- **Backup**: Consider backing up your database before running the migration
- **Downtime**: The migration is quick (< 1 second) but consider running during low-traffic periods
- **Data Loss**: The migration converts unscored records (all 0s) to NULL. Judges will need to re-enter scores for these records if they were previously saved as all 0s.

