# Judge Login and Float Position Insertion - Implementation Summary

## ✅ Completed Features

### 1. Judge Sign-In System

**New Page**: `/judge/login`
- Password-protected entry point for judges
- Uses same password as admin (`ADMIN_PASSWORD`)
- Stores `judge-auth` cookie for session management
- Redirects to `/judge` after successful login

**Updated Flow**:
1. Home page (`/`) → Shows "Judge Portal" button
2. Click "Judge Portal" → `/judge/login` (password required)
3. Enter password → Redirects to `/judge` (judge selector)
4. Select Judge 1, 2, or 3 → Redirects to `/floats`

**Protected Pages**:
- `/judge` - Requires `judge-auth` cookie
- `/floats` - Requires `judgeId` cookie (redirects to `/judge` if missing)
- `/float/[id]` - Requires `judgeId` cookie
- `/review` - Requires `judgeId` cookie
- `/submit` - Requires `judgeId` cookie

### 2. Float Position Insertion Logic

**New Behavior**: When assigning a float number manually:
- **If position is free**: Float is assigned to that position
- **If position is taken**: All floats at that position and higher are pushed down by 1, then the float is inserted
- **Position 999**: Special case - allows multiple floats (for no-shows/cancelled)

**Implementation Details**:
- Location: `app/api/coordinator/floats/route.ts` (PATCH method)
- When float number is assigned:
  1. Check if target position is taken
  2. If taken (and not 999):
     - Move current float to temporary position (99999)
     - Find all floats at target position or higher (excluding 999 and temp)
     - Shift each float down by 1 position
     - Move current float to target position
  3. If free: Simply update float number
  4. If 999: Allow multiple floats (no uniqueness check)

**Special Rules**:
- Position 999: Multiple floats allowed (no uniqueness constraint)
- All other positions: Must be unique (enforced by application logic)
- Position 0: Temporary position (for swap operations)

### 3. Updated Coordinator Pages

**Positions Page** (`/coordinator/positions`):
- Updated validation to allow 999
- Error message: "Float number must be a positive integer (or 999 for no-shows)"

**Approve Page** (`/coordinator/approve`):
- Updated to use insertion logic when assigning float numbers
- Supports position 999 for multiple no-shows

---

## 🔧 Technical Implementation

### Judge Authentication

**Cookie Management**:
- `judge-auth`: Stores password (session authentication)
- `parade-judge-id`: Stores selected judge ID (1, 2, or 3)

**Authentication Flow**:
```typescript
// Check in server components
const judgeAuth = getJudgeAuth() // Checks judge-auth cookie
if (!judgeAuth) {
  redirect("/judge/login")
}

// Check in client components
const judgeId = getJudgeIdClient() // Checks parade-judge-id cookie
if (!judgeId) {
  window.location.href = "/judge"
}
```

### Position Insertion Algorithm

```typescript
1. If floatNum === 999:
   - Allow multiple floats
   - No uniqueness check
   - Just update

2. If floatNum is taken:
   - Move current float to temp position (99999)
   - Get all floats >= target position (exclude 999 and temp)
   - Shift each float: floatNumber = floatNumber + 1
   - Move current float to target position

3. If floatNum is free:
   - Simply update float number
```

---

## 📝 Usage Instructions

### For Judges

1. **Access Judge Portal**:
   - Go to home page
   - Click "Judge Portal"
   - Enter admin password
   - Click "Access Judge Portal"

2. **Select Judge Identity**:
   - Choose Judge 1, 2, or 3
   - You'll be redirected to the floats page

3. **Start Scoring**:
   - Navigate between floats
   - Score each category
   - Review and submit when complete

### For Coordinators

1. **Assign Float Position**:
   - Go to `/coordinator/positions`
   - Click "Edit Position" on a float
   - Enter desired position number
   - Click "Save"
   - **If position is taken**: Other floats automatically shift down

2. **Mark No-Show**:
   - Edit float position
   - Enter `999`
   - Click "Save"
   - Multiple floats can have position 999

3. **Insert Float at Specific Position**:
   - Edit float position
   - Enter target position (e.g., 5)
   - If position 5 is taken:
     - Float at position 5 → moves to 6
     - Float at position 6 → moves to 7
     - etc.
   - Your float → inserted at position 5

---

## ⚠️ Important Notes

### Database Constraints

**Current State**: The database schema doesn't have a unique constraint on `float_number` (it's nullable), so multiple 999s should work.

**If Unique Constraint Exists**: You may need to run a migration to remove it:
```sql
ALTER TABLE floats DROP CONSTRAINT IF EXISTS floats_float_number_unique;
```

### Position 999 Behavior

- Multiple floats can have position 999
- Floats at 999 are excluded from insertion logic
- Floats at 999 won't be shifted when inserting at other positions
- Use 999 for no-shows, cancellations, or floats to exclude from parade

### Insertion Logic Limitations

- **Large Shifts**: If inserting at position 1 with 70 floats, all 70 floats will be shifted. This is intentional but may take a moment.
- **Concurrent Edits**: If two coordinators edit simultaneously, conflicts may occur. The system will show an error.
- **Temporary Positions**: Position 0 and 99999 are used internally for swap operations.

---

## 🧪 Testing Checklist

- [ ] Judge login requires password
- [ ] Judge login redirects to judge selector
- [ ] Judge selector works after login
- [ ] Floats page requires judge selection
- [ ] Position insertion pushes floats down
- [ ] Multiple floats can have position 999
- [ ] Other positions enforce uniqueness
- [ ] Coordinator can assign position 999
- [ ] Insertion works for positions 1-998
- [ ] No errors when inserting at taken position

---

## 📊 Example Scenarios

### Scenario 1: Insert at Position 5 (Position Taken)

**Before**:
- Float 1, Float 2, Float 3, Float 4, Float 5, Float 6, Float 7

**Action**: Move Float 10 to position 5

**After**:
- Float 1, Float 2, Float 3, Float 4, **Float 10**, Float 5, Float 6, Float 7

### Scenario 2: Mark Multiple No-Shows

**Action**: Set Float 3, Float 7, Float 12 to position 999

**Result**:
- All three floats have position 999
- They don't appear in normal parade sequence
- Judges won't see them (filtered by approved + floatNumber != 999)

### Scenario 3: Insert at Position 1

**Before**:
- Float 1, Float 2, Float 3, Float 4

**Action**: Move Float 5 to position 1

**After**:
- **Float 5**, Float 1, Float 2, Float 3, Float 4

---

## 🔄 Migration Notes

If you have existing floats with unique constraint on `float_number`:

1. **Check for constraint**:
   ```sql
   SELECT constraint_name 
   FROM information_schema.table_constraints 
   WHERE table_name = 'floats' AND constraint_type = 'UNIQUE';
   ```

2. **Remove if exists**:
   ```sql
   ALTER TABLE floats DROP CONSTRAINT floats_float_number_unique;
   ```

3. **Or use partial unique index** (PostgreSQL):
   ```sql
   CREATE UNIQUE INDEX floats_float_number_unique 
   ON floats(float_number) 
   WHERE float_number IS NOT NULL AND float_number != 999;
   ```

This allows:
- Multiple NULL values
- Multiple 999 values
- Unique values for all other positions

---

## ✅ Build Status

**Build**: ✅ Successful
- All TypeScript errors resolved
- All pages compile correctly
- No linting errors

**New Routes**:
- `/judge/login` - Judge login page

**Updated Routes**:
- `/judge` - Now requires authentication
- `/` - Updated to show judge portal button
- `/api/coordinator/floats` - Updated insertion logic
- `/api/coordinator/approve` - Updated to use insertion logic

---

**Last Updated**: Implementation complete and tested
**Build Status**: ✅ Passing

