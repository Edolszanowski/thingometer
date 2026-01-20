# Parade Coordinator Complete Instruction Guide

## Overview
This guide covers all coordinator functions for managing parade floats, including loading floats, adjusting positions, handling last-minute changes, and editing float information.

---

## Table of Contents
1. [Accessing Coordinator Functions](#accessing-coordinator-functions)
2. [Loading Parade Floats](#loading-parade-floats)
3. [Adjusting Float Positions](#adjusting-float-positions)
4. [Adding Last-Minute Floats](#adding-last-minute-floats)
5. [Removing/Cancelling Floats](#removingcancelling-floats)
6. [Editing Float Entry Information](#editing-float-entry-information)
7. [Approving Pending Entries](#approving-pending-entries)
8. [Troubleshooting](#troubleshooting)

---

## Accessing Coordinator Functions

### Step 1: Navigate to Coordinator Login
1. Go to: `https://Xmas.ithriveai.com/coordinator` (or your site URL)
2. Enter the coordinator password (same as admin password)
3. Click "Access Float Positions"

### Step 2: Available Coordinator Pages
After logging in, you'll have access to:
- **Float Positions** (`/coordinator/positions`) - Manage float order
- **Approve Entries** (`/coordinator/approve`) - Review and approve participant submissions
- **Upload CSV** (`/coordinator/upload`) - Bulk import floats from CSV file

---

## 1. Loading Parade Floats

### Method A: Upload CSV File (Bulk Import)

**Best for**: Loading many floats at once from a spreadsheet

1. **Navigate to Upload Page**
   - Click "Upload CSV" button from coordinator dashboard
   - Or go directly to `/coordinator/upload`

2. **Prepare Your CSV File**
   - Ensure your CSV has these columns (at minimum):
     - Organization Name (required)
     - Phone (required)
     - Email (required)
     - Float Description (required)
     - Type of Entry (required)
   - Optional columns: First Name, Last Name, Title, Entry Name, Entry Length, Music (Yes/No), Comments

3. **Select and Upload**
   - Click "Select CSV File" button
   - Choose your CSV file
   - The system will automatically parse and display column headers

4. **Map CSV Columns to Database Fields**
   - For each CSV column, select the corresponding database field from the dropdown
   - Required fields must be mapped:
     - Organization Name → `Organization Name`
     - Phone → `Phone`
     - Email → `Email`
     - Float Description → `Float Description`
     - Type of Entry → `Type of Entry`
   - Optional fields can be mapped or skipped
   - **Music Field**: Map to `Has Music` - accepts: "Yes", "true", "1", or "No", "false", "0"

5. **Review Preview**
   - Check the preview table showing first 3 rows
   - Verify data looks correct

6. **Upload**
   - Click "Upload [X] Entries" button
   - All uploaded floats are **automatically approved** and ready for judging
   - You'll be redirected to the positions page

**Note**: CSV uploads automatically assign `approved = true`, so floats are immediately available to judges.

### Method B: Approve Individual Submissions

**Best for**: Reviewing and approving participant sign-ups

1. **Navigate to Approve Page**
   - Click "Approve Entries" button
   - Or go to `/coordinator/approve`

2. **Review Pending Entries**
   - See list of all unapproved entries
   - Click "View Details" to see full information

3. **Approve Entry**
   - Optionally enter a float number (or leave blank to assign later)
   - Click "Approve" button
   - Entry becomes available to judges immediately

4. **Reject Entry**
   - Click "Reject" button
   - Confirm deletion
   - Entry is permanently removed

---

## 2. Adjusting Float Positions

### Method A: Quick Reorder (Arrow Buttons)

**Best for**: Small position adjustments

1. **Navigate to Positions Page**
   - Go to `/coordinator/positions`
   - You'll see all approved floats in current order

2. **Move Float Up**
   - Click the ↑ (up arrow) button above the float number
   - Float moves up one position
   - Position numbers automatically update

3. **Move Float Down**
   - Click the ↓ (down arrow) button below the float number
   - Float moves down one position
   - Position numbers automatically update

**Example**:
- Current: Float 1, Float 2, Float 3
- Click ↑ on Float 3 → New: Float 1, Float 3, Float 2
- Click ↓ on Float 1 → New: Float 2, Float 1, Float 3

### Method B: Direct Position Edit

**Best for**: Large position changes or specific number assignment

1. **Click "Edit Position"**
   - Find the float you want to move
   - Click "Edit Position" button

2. **Enter New Position Number**
   - Type the desired position number (must be positive integer)
   - Click "Save"
   - Click "Cancel" to discard changes

3. **Verify Change**
   - Float list automatically refreshes
   - Float appears in new position

**Important Notes**:
- Position numbers must be unique
- If position is already taken, you'll see an error
- Use arrow buttons to swap positions safely

### Tips for Position Management
- **Plan ahead**: Review current order before making changes
- **Test changes**: Make small adjustments and verify
- **Refresh**: Click "Refresh" button to reload latest data
- **Sequential numbering**: System doesn't require sequential numbers (1, 2, 3...), but it's recommended

---

## 3. Adding Last-Minute Floats

### Option A: Quick Add via Approval Page (Recommended)

**Best for**: Adding floats during the parade when you have basic information

1. **Go to Approve Entries Page**
   - Navigate to `/coordinator/approve`

2. **Use Public Sign-Up Form**
   - Have the participant go to `/signup`
   - Fill out the form with required information
   - Submit entry

3. **Immediately Approve**
   - Entry appears in your approval queue
   - Click "View Details"
   - Enter float number (or leave blank)
   - Click "Approve"
   - Float is immediately available to judges

**Time**: ~2-3 minutes total

### Option B: Manual Database Entry (Advanced)

**Note**: This requires direct database access. Contact system administrator.

### Option C: CSV Upload (If Multiple Floats)

1. **Prepare CSV**
   - Create CSV with new float(s)
   - Include all required fields

2. **Upload via Upload Page**
   - Follow CSV upload instructions above
   - New floats are automatically approved

---

## 4. Removing/Cancelling Floats

### Current Method: Delete from Approval Queue

**If float hasn't been approved yet:**
1. Go to `/coordinator/approve`
2. Find the entry
3. Click "Reject" button
4. Confirm deletion

### For Approved Floats (No-Show Handling)

**Current Limitation**: The system doesn't have a "Mark as No-Show" feature yet. Use one of these workarounds:

#### Workaround 1: Remove Float Number (Recommended)
1. Go to `/coordinator/positions`
2. Find the no-show float
3. Click "Edit Position"
4. Set position to a very high number (e.g., 999)
5. This effectively removes it from the parade order
6. Judges won't see it in normal sequence

#### Workaround 2: Contact Admin
- Contact system administrator to mark float as inactive in database
- Or wait for "Mark as No-Show" feature to be added

**Future Feature**: System will include "Mark as No-Show" button that:
- Hides float from judge view
- Keeps it in database for records
- Shows in coordinator view with "No-Show" indicator

---

## 5. Editing Float Entry Information

### Current Limitation
The system doesn't have a built-in "Edit Float" interface yet. Use one of these methods:

### Method A: Database Direct Edit (Advanced)
**Requires**: Database access or administrator help

### Method B: Delete and Re-add
1. **Delete Entry**
   - Go to `/coordinator/approve`
   - Find the float (if unapproved) and click "Reject"
   - Or contact admin to delete approved float

2. **Re-add with Correct Information**
   - Use sign-up form or CSV upload
   - Approve entry
   - Assign float number

### Method C: Contact System Administrator
- Provide float ID and changes needed
- Admin can update directly in database

### Editing Music Status (Important!)

**Scenario**: Float originally marked "No Music" but adds music at last minute

**Current Process**:
1. Contact system administrator
2. Provide float number/ID
3. Admin updates `hasMusic` field in database from `false` to `true`
4. Judges will immediately see music slider enabled

**Future Feature**: System will include "Edit Float" button allowing:
- Update organization name
- Update contact information
- Change music status (Yes/No)
- Update float description
- Modify type of entry

### What Can Be Edited (Future):
- Organization Name
- Contact Information (Phone, Email)
- Entry Name
- Float Description
- Entry Length
- Type of Entry
- **Music Status** (Yes/No) - Critical for last-minute changes
- Comments

---

## 6. Approving Pending Entries

### Step-by-Step Process

1. **Access Approval Page**
   - Navigate to `/coordinator/approve`
   - See all unapproved entries listed

2. **Review Entry Details**
   - Click "View Details" button
   - Review all submitted information:
     - Contact information
     - Organization
     - Float description
     - Type of entry
     - Music status
     - Comments

3. **Assign Float Number (Optional)**
   - Enter desired float number in the input field
   - Or leave blank to assign later via positions page
   - Float number must be unique

4. **Approve or Reject**
   - **Approve**: Click "Approve" button
     - Entry becomes available to judges immediately
     - Appears in positions page
   - **Reject**: Click "Reject" button
     - Confirm deletion
     - Entry is permanently removed

5. **Verify Approval**
   - Go to positions page
   - Verify float appears in list
   - Adjust position if needed

### Approval Tips
- **Batch Approval**: Review multiple entries, then approve in sequence
- **Float Number Strategy**: 
  - Assign numbers during approval for organized parade
  - Or approve without numbers and assign later
- **Music Check**: Verify music status is correct before approving

---

## 7. Troubleshooting

### Issue: "Float number is already assigned"
**Solution**: 
- Check positions page for existing float with that number
- Use a different number
- Or move the existing float first

### Issue: "Failed to update float position"
**Solution**:
- Click "Refresh" button
- Try again
- Check if another coordinator is editing simultaneously

### Issue: Float doesn't appear in judge view
**Solution**:
- Verify float is approved (check approval page)
- Check that float has a float number assigned
- Refresh judge's browser

### Issue: Can't approve entry
**Solution**:
- Verify all required fields are present
- Check email format is valid
- Ensure organization name is not empty

### Issue: CSV upload fails
**Solution**:
- Verify CSV format is correct
- Check that required fields are mapped
- Ensure no duplicate email addresses
- Check for special characters in data

### Issue: Music slider disabled for float
**Solution**:
- Float was marked "No Music" during sign-up
- Contact admin to update `hasMusic` to `true` in database
- Or delete and re-add entry with correct music status

---

## Quick Reference: Coordinator Workflows

### Pre-Parade Setup
1. Upload CSV or approve entries → `/coordinator/upload` or `/coordinator/approve`
2. Assign float numbers → `/coordinator/positions`
3. Adjust order → `/coordinator/positions`
4. Verify all floats approved → `/coordinator/approve`

### During Parade (Last-Minute Changes)
1. **Add Float**: Participant signs up → Approve immediately → Assign number
2. **Remove Float**: Edit position to 999 (workaround) or contact admin
3. **Change Music**: Contact admin to update database
4. **Reorder**: Use arrow buttons or edit position

### Post-Parade
1. Review final positions → `/coordinator/positions`
2. Export data → Admin dashboard → Export CSV

---

## Feature Roadmap (Coming Soon)

The following features are planned but not yet available:

- ✅ **Mark as No-Show**: One-click button to mark floats as no-show
- ✅ **Edit Float Information**: In-app editing of float details
- ✅ **Quick Add Float**: Fast entry form for last-minute additions
- ✅ **Bulk Position Update**: Update multiple positions at once
- ✅ **Float Status Indicators**: Visual indicators for no-shows, pending, etc.

---

## Support

For issues or questions:
1. Check this guide first
2. Review troubleshooting section
3. Contact system administrator
4. Check admin dashboard for system status

---

## Security Notes

- Coordinator password is the same as admin password
- Keep password secure
- Don't share coordinator access
- Log out when finished (clear browser cookies)

---

**Last Updated**: Based on current system version
**Version**: 1.0

