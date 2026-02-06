# 🍋 Lemonade Day Setup & Demo Guide

This guide will help you set up and demonstrate the Lemonade Day judging system for the Boerne Chamber of Commerce.

## 🎯 Overview

The Lemonade Day judging system is built on the same platform as the parade judging system, with customizations for:
- **5 Business Rubric Categories** (0-10 points each)
- **GPS Location Tracking** for each stand
- **Custom Terminology** ("Stands" instead of "Floats")
- **Real-time Scoring** with auto-save
- **Automatic Winner Calculation**

## 📋 Quick Setup (20 minutes)

### Step 1: Run the Setup Script

```bash
npx tsx scripts/setup-lemonade-day.ts
```

This script will:
- ✅ Create the Lemonade Day event type (if not exists)
- ✅ Configure 0-10 scoring scale
- ✅ Create "Lemonade Day 2026" event
- ✅ Set up 5 rubric categories:
  - Business Planning
  - Financial Understanding
  - Stand Design & Creativity
  - Customer Experience
  - Narrative / Story
- ✅ Configure GPS location fields
- ✅ Create 3 test judges (Judge Sarah, Judge Mike, Judge Lisa)
- ✅ Create 5 test stands with realistic data

### Step 2: Update Environment Variable

After the setup script completes, it will show you the Event ID. Update your `.env.local`:

```bash
NEXT_PUBLIC_THINGOMETER_EVENT_ID=<EVENT_ID>
```

### Step 3: Run the Test Script

```bash
npx tsx scripts/test-lemonade-day.ts
```

This script will:
- ✅ Verify the event setup
- ✅ Create realistic test scores for all judges
- ✅ Calculate results and rankings
- ✅ Display category winners
- ✅ Generate a test report

### Step 4: Start the Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## 🎬 Demo Script for Chamber of Commerce

### Introduction (2 minutes)

**"Today I'll show you how our judging system can handle Lemonade Day with zero code changes - just configuration."**

### Part 1: Show the Parade System (5 minutes)

1. **Navigate to http://localhost:3000/admin**
   - Login with admin password
   - Show the results dashboard
   - Point out: "This is our parade judging system in action"

2. **Show Judge Scoring**
   - Navigate to http://localhost:3000/judge/login
   - Select a judge
   - Show the float grid with color-coded status
   - Click on a float and demonstrate scoring sliders
   - Emphasize: "Real-time auto-save, no data loss"

3. **Show Coordinator Features**
   - Navigate to http://localhost:3000/coordinator/approve
   - Show entry approval workflow
   - Navigate to http://localhost:3000/coordinator/positions
   - Show position management

### Part 2: Demonstrate Lemonade Day (8 minutes)

1. **Switch to Lemonade Day Event**
   - In admin panel, use event selector dropdown
   - Select "Lemonade Day 2026"
   - Show the results dashboard with test data

2. **Highlight Key Differences**
   - **Terminology**: "Notice it says 'Stands' not 'Floats'"
   - **Scoring Scale**: "0-10 points per category instead of 0-20"
   - **Categories**: "5 business rubric categories instead of parade categories"
   - **GPS Tracking**: Show a stand's location data

3. **Show Judge Experience**
   - Navigate to judge login
   - Select "Judge Sarah"
   - Show the stand grid
   - Click on a stand to score
   - Point out: "Same intuitive interface, different categories"
   - Show the 0-10 sliders
   - Demonstrate auto-save

4. **Show Results**
   - Navigate back to admin results
   - Show overall rankings
   - Show category winners
   - Export CSV

### Part 3: Configuration Walkthrough (3 minutes)

**"Here's what makes this powerful - it's all configuration, no coding:"**

1. **Show Event Configuration**
   - Navigate to http://localhost:3000/admin/events
   - Click on "Lemonade Day 2026"
   - Show the scoring categories
   - Show the entry attributes (GPS fields)

2. **Explain the Setup**
   - "We created an event"
   - "Configured 5 categories"
   - "Set scoring scale to 0-10"
   - "Added GPS location fields"
   - "Total setup time: 20 minutes"

### Closing (2 minutes)

**"The system is production-ready. Here's what you get:"**

- ✅ Real-time scoring with auto-save
- ✅ Multiple judges scoring simultaneously
- ✅ Mobile-friendly (tablets/phones)
- ✅ GPS location tracking for each stand
- ✅ Automatic winner calculation
- ✅ CSV export for results
- ✅ Admin controls (unlock judges, manage entries)
- ✅ Coordinator tools (approve stands, manage positions)

**"We can have this running for your next Lemonade Day event immediately."**

## 📊 Test Data Overview

### Test Stands

1. **Stand #1: The Citrus Stand** (Lemonade Legends)
   - Location: 123 Main St, Boerne, TX
   - GPS: 29.7949, -98.7319
   - Strong overall performer

2. **Stand #2: Berry Lemonade Co** (Sweet Success)
   - Location: 456 River Rd, Boerne, TX
   - GPS: 29.7955, -98.7325
   - Excellent creativity

3. **Stand #3: Lemon Drop Dreams** (Young Entrepreneurs)
   - Location: 789 Hill Country Dr, Boerne, TX
   - GPS: 29.7960, -98.7330
   - Well-balanced scores

4. **Stand #4: Tropical Twist** (Kids in Business)
   - Location: 321 Oak St, Boerne, TX
   - GPS: 29.7945, -98.7315
   - Creative but developing

5. **Stand #5: Mint Lemonade Magic** (Little CEOs)
   - Location: 654 Cypress Ave, Boerne, TX
   - GPS: 29.7952, -98.7322
   - Strong business planning

### Test Judges

- **Judge Sarah** - Scores with slight positive bias
- **Judge Mike** - Neutral scoring
- **Judge Lisa** - Scores with slight negative bias (tougher grader)

## 🔧 Troubleshooting

### If the event doesn't show up:
1. Make sure `NEXT_PUBLIC_THINGOMETER_EVENT_ID` is set in `.env.local`
2. Restart the dev server
3. Clear browser cache

### If scores aren't saving:
1. Check database connection in `.env.local`
2. Verify `USE_SUPABASE=true` is set
3. Check browser console for errors

### If GPS fields don't appear:
1. Verify the event's `entry_attributes` are configured
2. Check the signup page for the Lemonade Day event

## 📱 Mobile Testing

The system is mobile-first. Test on:
- iPad or Android tablet (recommended for judges)
- iPhone or Android phone
- Desktop browser (for admin/coordinator)

## 🚀 Going Live

When ready to go live:

1. **Clear Test Data**
   ```sql
   -- Delete test scores
   DELETE FROM score_items WHERE score_id IN (
     SELECT id FROM scores WHERE event_id = <LEMONADE_EVENT_ID>
   );
   DELETE FROM scores WHERE event_id = <LEMONADE_EVENT_ID>;
   
   -- Delete test stands
   DELETE FROM floats WHERE event_id = <LEMONADE_EVENT_ID>;
   
   -- Keep judges or delete them
   DELETE FROM judges WHERE event_id = <LEMONADE_EVENT_ID>;
   ```

2. **Create Real Judges**
   - Use admin panel to create judges
   - Or import via coordinator tools

3. **Accept Stand Registrations**
   - Share signup link: `https://yourdomain.com/signup`
   - Coordinators approve entries
   - Assign stand numbers

4. **Judge Training** (30 minutes)
   - Show judges how to login
   - Demonstrate scoring interface
   - Practice on test stands
   - Answer questions

5. **Event Day**
   - Judges login and start scoring
   - Monitor progress in admin dashboard
   - Unlock judges if needed
   - Export results when complete

## 📞 Support

For questions or issues:
- Check the main README.md
- Review TESTING_GUIDE.md
- Contact system administrator

## 🎉 Success Metrics

After testing, you should see:
- ✅ All 5 stands created with GPS locations
- ✅ 3 judges with complete scores
- ✅ Results calculated correctly (max 150 points per stand)
- ✅ Category winners identified
- ✅ CSV export working

---

**Ready to impress the Chamber of Commerce!** 🍋✨
