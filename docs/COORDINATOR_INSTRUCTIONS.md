# Parade Coordinator Instructions

## Managing Float Positions

The coordinator page allows you to organize and reorder floats in the parade lineup. All position changes are saved immediately to the Neon database and are immediately visible to all judges and admin users.

### Accessing the Coordinator Page

1. Navigate to: `http://localhost:3000/coordinator` (or `https://Xmas.ithriveai.com/coordinator` in production)
2. Enter the coordinator password (same as admin password)
3. Click "Access Float Positions"

### What You'll See

- **Float List**: All floats displayed in current parade order
- **Position Numbers**: Each float shows its current position (#1, #2, #3, etc.)
- **Organization Names**: The organization name for each float
- **Entry Names**: The entry name (if provided)

### Managing Float Positions

#### Method 1: Quick Reorder (Arrow Buttons)

1. **Move Float Up**: Click the ↑ (up arrow) button above the float number
   - Moves the float to the position above it
   - Automatically swaps positions with the float above

2. **Move Float Down**: Click the ↓ (down arrow) button below the float number
   - Moves the float to the position below it
   - Automatically swaps positions with the float below

**Example:**
- Current order: Float 1, Float 2, Float 3
- Click ↑ on Float 3 → New order: Float 1, Float 3, Float 2
- Click ↓ on Float 1 → New order: Float 2, Float 1, Float 3

#### Method 2: Direct Position Edit

1. Click the **"Edit Position"** button next to any float
2. Enter the new position number (must be a positive integer)
3. Click **"Save"** to apply the change
4. Click **"Cancel"** to discard changes

**Important Notes:**
- Position numbers must be unique
- If you try to set a position that's already taken, you'll see an error
- The system will automatically prevent duplicate positions

### How Position Changes Work

1. **Immediate Save**: All position changes are saved to the Neon database immediately
2. **Automatic Refresh**: The float list refreshes automatically after each change
3. **Real-time Updates**: All judges and admin users will see the new order immediately
4. **Database Persistence**: Positions are stored in the `floats` table's `float_number` column
5. **No Conflicts**: The system uses a 3-step swap process to prevent duplicate positions

### Position Display & Sorting

- Floats are **automatically sorted** by position number (1, 2, 3, ...)
- After any change, the list **immediately re-sorts** to show the new order
- Position numbers are **unique** - no two floats can have the same position
- The order you see is the **exact order** that will appear to judges

### Best Practices

1. **Plan Ahead**: Review the current order before making changes
2. **Test Changes**: Make small changes and verify they work as expected
3. **Coordinate**: Communicate position changes to judges if needed
4. **Backup**: The system maintains the order in the database, but consider noting the original order

### Troubleshooting

**Issue: "Float number is already assigned"**
- **Solution**: Another float already has that position. Use a different number or move the other float first.

**Issue: Position doesn't update**
- **Solution**: Click the "Refresh" button in the top right to reload the list

**Issue: Can't move float up/down**
- **Solution**: The float is already at the top (can't move up) or bottom (can't move down)

### Technical Details

- **Database Table**: `floats`
- **Column**: `float_number` (unique, integer)
- **API Endpoint**: `PATCH /api/coordinator/floats`
- **Authentication**: Coordinator password (same as admin)

### Example Workflow

1. **Initial Setup**: All floats are in positions 1-20
2. **Float 5 needs to be first**: 
   - Click "Edit Position" on Float 5
   - Enter position: 1
   - Click "Save"
   - Float 5 moves to position 1, original Float 1 moves to position 5
3. **Float 10 needs to move up one spot**:
   - Click ↑ on Float 10
   - Float 10 and Float 9 swap positions automatically

### Position Display

- Floats are displayed in order by `float_number`
- The position number is shown as **#X** next to each float
- The list updates immediately after any change
- All changes are visible to all users instantly

---

*For technical support, contact the development team.*

