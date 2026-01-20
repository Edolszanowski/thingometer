# Comprehensive Testing Guide

## Quick Test Commands

```bash
# Test scoring system and winner calculation
npm run test:scoring

# Test coordinator position management
npm run test:coordinator

# Test database connectivity
npm run test:db

# Run all tests
npm run test:scoring && npm run test:coordinator && npm run test:db
```

### Public Signup Flow Testing

1. **Event Selection (Multiple Active Events)**
   - [ ] Create multiple active events in admin
   - [ ] Navigate to home page
   - [ ] Click "Sign Up to Participate"
   - [ ] Verify event selection page appears
   - [ ] Select an event
   - [ ] Verify redirect to signup form with selected event

2. **Event Selection (Single Active Event)**
   - [ ] Deactivate all events except one
   - [ ] Navigate to home page
   - [ ] Click "Sign Up to Participate"
   - [ ] Verify direct redirect to signup form (no selection page)
   - [ ] Verify event is pre-selected

3. **Public Signup Form**
   - [ ] Fill in all required fields
   - [ ] Select "Type of Entry" from dropdown or type new value
   - [ ] Toggle "Has Music" checkbox
   - [ ] Submit form
   - [ ] Verify success message
   - [ ] Verify entry appears in coordinator approval queue

4. **Signup Lock**
   - [ ] Coordinator locks public signups
   - [ ] Navigate to home page
   - [ ] Verify "Sign Up to Participate" button is disabled/hidden
   - [ ] Try to access `/signup` directly
   - [ ] Verify access is blocked or form is disabled

5. **Coordinator Approval**
   - [ ] Navigate to `/coordinator/approve`
   - [ ] Verify unapproved entries are listed
   - [ ] Verify entries are filtered by selected event
   - [ ] Click "Approve" on an entry
   - [ ] Verify entry moves to approved list
   - [ ] Verify entry appears in positions page
   - [ ] Click "Reject" on an entry
   - [ ] Verify entry is removed from queue

## Manual Testing Checklist

### Judge Flow Testing

1. **Judge Login**
   - [ ] Navigate to `/judge/login`
   - [ ] Enter judge password
   - [ ] Verify redirect to judge selection page

2. **Judge Selection**
   - [ ] Navigate to `/judge`
   - [ ] Verify judge selector is displayed (not auto-redirected)
   - [ ] Select Judge 1, 2, or 3
   - [ ] Verify redirect to `/floats`
   - [ ] Verify "Change Judge" button is available
   - [ ] Click "Change Judge"
   - [ ] Verify return to judge selection page
   - [ ] Select different judge
   - [ ] Verify can switch between judges

3. **Float Scoring**
   - [ ] Click on a float card
   - [ ] Adjust all 5 sliders (Lighting, Theme, Traditions, Spirit, Music)
   - [ ] Verify "Score saved" toast appears immediately
   - [ ] Verify scores save immediately (no debounce delay)
   - [ ] Navigate away and return to float
   - [ ] Verify scores are still saved and displayed correctly
   - [ ] Verify float card turns green on `/floats` page when complete
   - [ ] Verify QuickJumpBar number turns green when complete

4. **Music Scoring (N/A)**
   - [ ] Select a float with `hasMusic = false`
   - [ ] Verify music slider is disabled
   - [ ] Verify music score shows as "N/A"
   - [ ] Verify total score excludes music
   - [ ] Verify float can be marked complete without music score

5. **None Button (N/A)**
   - [ ] Click "(None)" button for any category
   - [ ] Verify score is set to 0
   - [ ] Verify "(None)" button has red-yellow-orange background
   - [ ] Verify score saves immediately
   - [ ] Verify 0 scores are displayed as "0 (N/A)" in review

6. **Navigation**
   - [ ] Use Previous/Next buttons to navigate
   - [ ] Verify navigation waits for pending saves to complete
   - [ ] Use QuickJumpBar to jump to specific floats
   - [ ] Verify scored floats stay green when navigating
   - [ ] Verify sliders show saved values when returning to scored floats
   - [ ] Verify null scores show dashed border on sliders

7. **Score Review**
   - [ ] Navigate to `/review`
   - [ ] Verify all scored floats show correct scores
   - [ ] Verify null scores are displayed as "—"
   - [ ] Verify 0 (N/A) scores are displayed as "0 (N/A)"
   - [ ] Verify unscored floats are greyed out
   - [ ] Click "Continue Scoring" to return to float list
   - [ ] Click "Change Judge" to return to judge selection

8. **Score Submission**
   - [ ] Click "Submit Scores" button
   - [ ] Verify scores can be submitted even if not all floats are complete
   - [ ] Verify scores are locked (cannot edit after submission)
   - [ ] Verify redirect to confirmation page

### Admin Flow Testing

1. **Admin Login**
   - [ ] Navigate to `/admin`
   - [ ] Enter admin password
   - [ ] Verify access to dashboard

2. **Event Management**
   - [ ] Click "Manage Events" button
   - [ ] Verify events list is displayed
   - [ ] Click "Create New Event"
   - [ ] Enter event name (e.g., "2025 Comfort Xmas Parade")
   - [ ] Enter city (e.g., "Comfort")
   - [ ] Select event date (optional)
   - [ ] Toggle "Active" status
   - [ ] Click "Create Event"
   - [ ] Verify event appears in list
   - [ ] Click "Edit" on an event
   - [ ] Modify event details
   - [ ] Click "Save"
   - [ ] Verify changes are saved
   - [ ] Click "Delete" on an event
   - [ ] Verify confirmation dialog
   - [ ] Confirm deletion
   - [ ] Verify event is removed

3. **Winner Display**
   - [ ] Verify category winners are displayed correctly
   - [ ] Verify ties are shown (multiple winners)
   - [ ] Verify totals match calculated values
   - [ ] Verify winners are filtered by active event

4. **Judge Status**
   - [ ] Verify judge completion status
   - [ ] Verify submitted judges are marked

5. **CSV Export**
   - [ ] Click "Export CSV"
   - [ ] Verify CSV file downloads
   - [ ] Verify CSV contains all scores

### Coordinator Flow Testing

1. **Coordinator Login**
   - [ ] Navigate to `/coordinator`
   - [ ] Enter coordinator password
   - [ ] Verify access to positions page

2. **Event Selection**
   - [ ] Verify EventSelector dropdown appears
   - [ ] Select an event from dropdown
   - [ ] Verify floats are filtered by selected event
   - [ ] Verify event selection persists across page refreshes

3. **CSV Upload with Mapping**
   - [ ] Navigate to `/coordinator/upload`
   - [ ] Click "Select CSV File" and choose a CSV file
   - [ ] Verify CSV is parsed and columns are detected
   - [ ] Verify "First row is headers" checkbox is checked by default
   - [ ] Toggle "First row is headers" checkbox
   - [ ] Verify columns change to "Column A", "Column B", etc. when unchecked
   - [ ] Verify all CSV columns are shown in database field dropdowns
   - [ ] Map required fields (Organization, Phone, Email, Float Description, Type of Entry)
   - [ ] Map optional fields (First Name, Last Name, Title, Entry Name, etc.)
   - [ ] Verify sample values are shown in dropdown options
   - [ ] Verify mapped fields are highlighted in blue
   - [ ] Verify required unmapped fields are highlighted in red
   - [ ] Click "Verify Mapping" button
   - [ ] Verify mapping summary is displayed
   - [ ] Verify preview table shows first 3 rows with mapped columns
   - [ ] Click "Go Back" to return to mapping
   - [ ] Click "Verify Mapping" again
   - [ ] Click "Upload" to submit entries
   - [ ] Verify success message shows number of entries uploaded
   - [ ] Verify redirect to positions page after upload

4. **CSV Upload - Edge Cases**
   - [ ] Upload CSV without headers (uncheck "First row is headers")
   - [ ] Verify columns are labeled as "Column A", "Column B", etc.
   - [ ] Upload CSV with quoted fields containing commas
   - [ ] Upload CSV with missing required fields
   - [ ] Verify error message appears for missing required fields
   - [ ] Upload CSV with duplicate column mappings
   - [ ] Verify warning appears for multiple columns mapped to same field

5. **Position Editing**
   - [ ] Click "Edit Position" on a float
   - [ ] Enter new position number
   - [ ] Click "Save"
   - [ ] Verify position updates immediately
   - [ ] Verify list re-sorts automatically
   - [ ] Test inserting at position (e.g., type "5" to insert at position 5)
   - [ ] Verify other floats shift down
   - [ ] Test position 999 (multiple floats can have position 999)
   - [ ] Verify position 999 allows duplicates

6. **Position Swapping**
   - [ ] Click ↑ on a float
   - [ ] Verify it moves up one position
   - [ ] Click ↓ on a float
   - [ ] Verify it moves down one position
   - [ ] Verify positions are saved to database

7. **Float Management**
   - [ ] Click "Delete" on a float
   - [ ] Verify confirmation dialog appears
   - [ ] Confirm deletion
   - [ ] Verify float is removed from list
   - [ ] Click "Add New Entry"
   - [ ] Verify redirect to public signup form

8. **Participant Lookup**
   - [ ] Use ParticipantLookup component
   - [ ] Search for existing participant by name or organization
   - [ ] Verify search results appear
   - [ ] Click "Quick Add" on a participant
   - [ ] Verify participant is added as new float to current event

9. **Public Signup Lock**
   - [ ] Verify "Public Sign-Ups" toggle is visible
   - [ ] Click "Lock" button
   - [ ] Verify toggle shows "Locked" status
   - [ ] Navigate to home page
   - [ ] Verify "Sign Up to Participate" button is disabled/hidden
   - [ ] Return to coordinator page
   - [ ] Click "Unlock" button
   - [ ] Verify toggle shows "Open" status
   - [ ] Verify "Sign Up to Participate" button is available on home page

10. **Error Handling**
    - [ ] Try to set duplicate position (except 999)
    - [ ] Verify error message appears
    - [ ] Verify position doesn't change
    - [ ] Try to upload CSV with invalid data
    - [ ] Verify error messages are displayed

## Automated Test Results

### Scoring System Test
```bash
npm run test:scoring
```
**Expected**: 7/7 tests passed
- Judges fetched
- Floats fetched
- Scores seeded (60 total)
- Winners calculated correctly
- All validations passed

### Coordinator Test
```bash
npm run test:coordinator
```
**Expected**: 4/4 tests passed
- Positions fetched
- Swap successful
- Positions unique
- Positions sequential

## Test Data

After running `npm run test:scoring`:
- **3 judges** with scores
- **20 floats** with scores from all judges
- **60 total scores** in database
- **Winners calculated** for all categories

## CSV Upload Testing Scenarios

### Scenario 1: Standard CSV with Headers
1. Create a CSV file with headers in first row:
   ```
   Organization,First Name,Last Name,Phone,Email,Entry Name,Float Description,Type of Entry,Has Music
   Test Org,John,Doe,555-1234,john@test.com,Test Entry,Beautiful float,Float,Yes
   ```
2. Upload CSV
3. Verify "First row is headers" is checked
4. Verify auto-mapping detects field names
5. Map all required fields
6. Verify and upload

### Scenario 2: CSV without Headers
1. Create a CSV file without headers:
   ```
   Test Org,John,Doe,555-1234,john@test.com,Test Entry,Beautiful float,Float,Yes
   ```
2. Upload CSV
3. Uncheck "First row is headers"
4. Verify columns are labeled "Column A", "Column B", etc.
5. Manually map all fields
6. Verify and upload

### Scenario 3: CSV with Quoted Fields
1. Create a CSV with quoted fields containing commas:
   ```
   Organization,Description
   "Test Org, Inc.","Beautiful float, with decorations"
   ```
2. Upload CSV
3. Verify fields are parsed correctly
4. Verify quotes are removed from values

### Scenario 4: CSV with Missing Required Fields
1. Create a CSV missing required fields
2. Try to verify mapping
3. Verify error message appears
4. Add missing field mappings
5. Verify and upload successfully

## Verification Steps

1. **Verify Winners in Admin Dashboard**:
   - Login to `/admin`
   - Check category winners match test results
   - Verify totals are correct
   - Verify winners are filtered by active event

2. **Verify Positions**:
   - Login to `/coordinator`
   - Select an event
   - Check float order matches database
   - Test moving a float
   - Verify order updates
   - Verify floats are filtered by selected event

3. **Verify Scores**:
   - Login as Judge 1
   - Check that all floats show scores
   - Verify scores match test data
   - Verify scores persist after navigation
   - Verify null vs 0 distinction is correct

4. **Verify CSV Upload**:
   - Check uploaded entries in positions page
   - Verify all mapped fields are populated correctly
   - Verify entries are assigned to correct event
   - Verify entries are auto-approved

5. **Verify Event System**:
   - Create multiple events
   - Verify floats are filtered by event
   - Verify judges only see floats from active event
   - Verify participants can select event during signup

---

*For detailed test results, see TEST_REPORT.md*

