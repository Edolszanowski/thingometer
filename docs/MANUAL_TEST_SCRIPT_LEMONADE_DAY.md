# Lemonade Day 2026 - Manual Test Script

**Event:** Lemonade Day 2026 - Boerne, Texas  
**Event ID:** 4  
**Date:** May 2, 2026 (9:00 AM - 4:00 PM)  
**Total Points:** 100

---

## Pre-Test Setup

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   Note the port (e.g., `http://localhost:3000` or `http://localhost:3003`)

2. **Environment variables** (verify `.env.local`):
   - `ADMIN_PASSWORD=admin123`
   - `NEXT_PUBLIC_THINGOMETER_EVENT_ID=4`
   - `USE_SUPABASE=true`

3. **Run setup script** (if not already done):
   ```bash
   npx tsx scripts/setup-lemonade-day.ts
   ```

---

## Test 1: Admin Portal

### 1.1 Admin Login
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:3000/admin` | See login form |
| 2 | Enter password: `admin123` | Password field accepts input |
| 3 | Click "Login" | Redirect to Admin Dashboard |

### 1.2 View Admin Dashboard
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check header | "Admin Dashboard" title visible |
| 2 | Check event selector | Should show "Lemonade Day 2026" or be selectable |
| 3 | Select "Lemonade Day 2026" from dropdown | Dashboard updates to show Lemonade Day data |

### 1.3 Manage Events
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Manage Events" button | Navigate to `/admin/events` |
| 2 | Find "Lemonade Day 2026" in list | Event shows: Name, City (Boerne), Status (Active) |
| 3 | Click Edit (pencil icon) | Expand edit form |

### 1.4 Verify/Edit Scoring Categories
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | In edit mode, scroll to "Scoring Categories" | See 7 categories listed |
| 2 | Verify categories: | |
| | - Taste | ✓ Present |
| | - Stand Appearance | ✓ Present |
| | - Customer Service | ✓ Present |
| | - Business Knowledge | ✓ Present |
| | - Marketing & Salesmanship | ✓ Present |
| | - Spirit & Enthusiasm | ✓ Present |
| | - Overall Experience | ✓ Present |
| 3 | Click "Add Category" | Prompt for category name |
| 4 | Enter "Test Category" | New category appears in list |
| 5 | Click trash icon on "Test Category" | Category is deleted |

### 1.5 Verify/Edit Judges
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Scroll to "Judges" section | See 6 judges listed |
| 2 | Verify judges: | |
| | - Kimberley Blohm | ✓ Present |
| | - Holly Rodriguez | ✓ Present |
| | - Melissa Hinton | ✓ Present |
| | - Steely Lott | ✓ Present |
| | - Kylee Schuette | ✓ Present |
| | - Cassie Diamond | ✓ Present |
| 3 | Click "Add Judge" | Prompt for judge name |
| 4 | Enter "Test Judge" | New judge appears in list |
| 5 | Edit the judge name to "Test Judge Updated" | Name updates |
| 6 | Click trash icon on "Test Judge Updated" | Judge is deleted |

---

## Test 2: Coordinator Portal

### 2.1 Access Coordinator
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:3000/coordinator` | Redirect to positions page (if authenticated) or admin login |
| 2 | If redirected to admin, login with `admin123` | |
| 3 | Navigate to `/coordinator/positions` | See Coordinator Positions page |

### 2.2 View Entries
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "Lemonade Day 2026" from event dropdown | Event selected |
| 2 | Check entry list | Shows any existing entries (may be empty) |
| 3 | Check "Add Entry" button | Button is visible |

### 2.3 Manage Entries
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | If entries exist, check entry details | Shows organization, approval status |
| 2 | Approve/unapprove an entry | Status changes, toast notification |
| 3 | Reorder entries (drag and drop) | Order updates |

---

## Test 3: Participant Registration

### 3.1 Navigate to Signup
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:3000/signup?eventId=4` | See signup form |
| 2 | Check page title | Should show event name |

### 3.2 Fill Out Form
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | First Name: `John` | Field accepts input |
| 2 | Last Name: `Smith` | Field accepts input |
| 3 | Organization Name: `Sweet Lemonade Co.` | **Required** - Field accepts input |
| 4 | Phone: `(830) 555-1234` | **Required** - Field accepts input |
| 5 | Email: `john@sweetlemonade.com` | **Required** - Field accepts input |
| 6 | Driver First Name: `Jane` | **Required** - Field accepts input |
| 7 | Driver Last Name: `Smith` | **Required** - Field accepts input |
| 8 | Driver Phone: `(830) 555-5678` | **Required** - Field accepts input |
| 9 | Driver Email: `jane@sweetlemonade.com` | **Required** - Field accepts input |
| 10 | Entry Name: `Sunny Side Stand` | Optional |
| 11 | Entry Description: `Fresh squeezed lemonade with local honey` | **Required** |
| 12 | Type of Entry: Select "Other" | **Required** |
| 13 | Other Type: `Lemonade Stand` | Field appears for custom type |
| 14 | Has Music: Select "No" | |

### 3.3 Submit Entry
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Submit Entry" | Form validates |
| 2 | Wait for response | Success toast: "Entry submitted successfully!" |
| 3 | Redirect | Redirect to home page after ~2 seconds |

### 3.4 Verify Entry in Coordinator
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to `/coordinator/positions` | |
| 2 | Select "Lemonade Day 2026" | |
| 3 | Find "Sweet Lemonade Co." | Entry appears in list (unapproved) |
| 4 | Approve the entry | Entry gets a stand number |

---

## Test 4: Judge Portal

### 4.1 Judge Login
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `http://localhost:3000/judge/login` | See judge login page |
| 2 | Select event: "Lemonade Day 2026" | Event dropdown or auto-selected |
| 3 | Select judge: "Kimberley Blohm" | Judge appears in list |
| 4 | Click "Login" or "Start Judging" | Redirect to judge scoring page |

### 4.2 View Entries to Score
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check entry list | Shows approved entries for this event |
| 2 | Select an entry | Entry details shown with scoring sliders |

### 4.3 Score an Entry
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find scoring categories | See 7 categories with sliders/inputs |
| 2 | Set scores: | |
| | - Taste: 22 (out of 25) | Slider/input accepts value |
| | - Stand Appearance: 13 (out of 15) | |
| | - Customer Service: 14 (out of 15) | |
| | - Business Knowledge: 18 (out of 20) | |
| | - Marketing & Salesmanship: 8 (out of 10) | |
| | - Spirit & Enthusiasm: 9 (out of 10) | |
| | - Overall Experience: 4 (out of 5) | |
| 3 | Total should show: 88/100 | Auto-calculated |
| 4 | Click "Save" or scores auto-save | Toast: "Scores saved" |

### 4.4 Change Judge
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Change Judge" button | Returns to judge selection |
| 2 | Select different judge (e.g., "Holly Rodriguez") | |
| 3 | Login as new judge | See fresh scoring interface |

### 4.5 Submit Final Scores
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Score all entries for this judge | All entries have scores |
| 2 | Click "Submit All Scores" | Confirmation dialog |
| 3 | Confirm submission | Toast: "Scores submitted successfully" |
| 4 | Judge marked as "Submitted" | Cannot edit scores further |

---

## Test 5: Admin Results Review

### 5.1 View Results
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to `http://localhost:3000/admin/results` | Admin Dashboard |
| 2 | Select "Lemonade Day 2026" | |
| 3 | Check "Judge Completion Status" | Shows which judges have submitted |
| 4 | Check "Category Winners" | Shows winners for each category |

### 5.2 Export Data
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Export CSV" | CSV file downloads |
| 2 | Open CSV | Contains scores for all entries |

---

## Scoring Categories Reference

| Category | Max Points | Judge Question |
|----------|------------|----------------|
| Taste | 25 | How good does the lemonade taste? |
| Stand Appearance | 15 | How appealing and organized is the stand? |
| Customer Service | 15 | How well did the team interact with customers? |
| Business Knowledge | 20 | How well does the team understand pricing, costs, and profit? |
| Marketing & Salesmanship | 10 | How effectively did the team attract customers? |
| Spirit & Enthusiasm | 10 | How much energy and excitement did the team show? |
| Overall Experience | 5 | Overall impression of the stand. |
| **TOTAL** | **100** | |

---

## Judges List

1. Kimberley Blohm
2. Holly Rodriguez
3. Melissa Hinton
4. Steely Lott
5. Kylee Schuette
6. Cassie Diamond

---

## Troubleshooting

### "No events available"
- Check that you're authenticated (logged in as admin)
- Verify event exists in database: `npx tsx scripts/setup-lemonade-day.ts`

### Signup page CSS/JS errors
- Restart the dev server: `npm run dev`
- Clear browser cache
- Try a different port if 3000 is in use

### Scores not saving
- Check browser console for errors
- Verify judge is authenticated (has judgeId cookie)
- Check that entry is approved

### Cannot edit categories
- Ensure you're in edit mode (clicked pencil icon)
- Check the category name input field is not disabled
- Try refreshing the page

---

## URLs Quick Reference

| Role | URL |
|------|-----|
| Home | `http://localhost:3000/` |
| Signup (Lemonade Day) | `http://localhost:3000/signup?eventId=4` |
| Judge Login | `http://localhost:3000/judge/login` |
| Coordinator | `http://localhost:3000/coordinator/positions` |
| Admin Login | `http://localhost:3000/admin` |
| Admin Dashboard | `http://localhost:3000/admin/results` |
| Manage Events | `http://localhost:3000/admin/events` |
