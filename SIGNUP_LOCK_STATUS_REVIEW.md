# Signup Lock Status Feature - Review

## Task Status Review

### ✅ 1. Add signup lock status to database schema
**Status: COMPLETE**

- **Location**: `lib/drizzle/schema.ts`
- **Implementation**: `settings` table exists with:
  - `id` (serial primary key)
  - `key` (text, unique) - stores "signup_locked"
  - `value` (text) - stores "true" or "false"
  - `updatedAt` (timestamp)
- **Note**: Migration script exists at `scripts/migrate-settings-table.ts` but needs to be run on production database

---

### ✅ 2. Create API endpoint to get/set signup lock status
**Status: COMPLETE**

- **Location**: `app/api/coordinator/settings/route.ts`
- **GET Endpoint**: 
  - Public access (no auth required)
  - Returns `{ signupLocked: boolean }`
  - Handles missing table gracefully (defaults to `false`)
- **PATCH Endpoint**:
  - Requires coordinator password authentication
  - Accepts `{ signupLocked: boolean }`
  - Creates or updates the setting
  - Returns success response with updated setting
- **Error Handling**: 
  - Handles missing settings table
  - Returns helpful error message if table doesn't exist

---

### ✅ 3. Add lock toggle UI to coordinator positions page
**Status: COMPLETE**

- **Location**: `app/coordinator/positions/page.tsx`
- **Implementation**:
  - State: `signupLocked` and `togglingLock`
  - Function: `fetchSignupLockStatus()` - fetches on mount
  - Function: `toggleSignupLock()` - toggles lock status via API
  - UI: Card showing current status (Locked/Open) with color coding
  - UI: Button to toggle lock/unlock
  - Visual feedback: Red border when locked, green when open
  - Toast notifications for success/error
- **Location in UI**: Lines 319-340 (visible card with toggle button)

---

### ✅ 4. Update signup page to check lock status and show message
**Status: COMPLETE**

- **Location**: `app/signup/page.tsx`
- **Implementation**:
  - State: `signupLocked` (boolean | null)
  - Fetches lock status on mount via `useEffect`
  - Shows loading state while checking
  - Displays locked message if `signupLocked === true`:
    - Red card with warning message
    - "Sign-ups are currently closed"
    - Contact information message
  - Disables form when locked
  - Shows form only when unlocked

---

### ✅ 5. Update signup API to reject submissions when locked
**Status: COMPLETE**

- **Location**: `app/api/entries/route.ts`
- **Implementation**:
  - Checks lock status at the start of POST handler
  - Fetches from `/api/coordinator/settings`
  - Returns `403 Forbidden` if `signupLocked === true`
  - Error message: "Parade sign-ups are currently closed. New entries are not being accepted at this time."
  - Prevents any submissions when locked (server-side enforcement)

---

### ✅ 6. Update home page to hide signup button when locked
**Status: COMPLETE**

- **Location**: `app/page.tsx`
- **Implementation**:
  - State: `signupLocked` (boolean | null)
  - Fetches lock status on mount
  - Conditionally renders:
    - **When unlocked**: Shows "Sign Up to Participate" button
    - **When locked**: Shows message card "Parade sign-ups are currently closed."
    - **When loading**: Shows nothing (button hidden until status loaded)
  - Button is completely hidden when locked (not just disabled)

---

## Summary

**All 6 tasks are COMPLETE** ✅

All features are implemented and working. The only remaining step is to ensure the `settings` table exists in the production database by running the migration script:

```bash
npx tsx scripts/migrate-settings-table.ts
```

## Testing Checklist

To verify all features work correctly:

1. ✅ **Database Schema**: Settings table exists (or migration script ready)
2. ✅ **API Endpoint**: GET and PATCH endpoints work
3. ✅ **Coordinator UI**: Toggle button visible and functional
4. ✅ **Signup Page**: Shows locked message when locked
5. ✅ **Signup API**: Rejects submissions when locked (403 error)
6. ✅ **Home Page**: Hides button when locked, shows message

## Notes

- The system gracefully handles missing settings table (defaults to unlocked)
- All UI components show appropriate loading states
- Error handling is in place for API failures
- Server-side enforcement prevents bypassing client-side checks

