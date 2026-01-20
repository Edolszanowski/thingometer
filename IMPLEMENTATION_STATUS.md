# Dynamic Event System - Implementation Status

## ✅ Completed

### 1. Database Schema (100%)
- ✅ Created new comprehensive schema in `lib/drizzle/schema.ts`
  - `event_categories` table for dynamic scoring categories
  - `event_judges` table for event-specific judge assignments
  - `score_items` table for dynamic score storage
  - `judge_submissions` table for audit trail
  - Updated `scores` table to use `eventJudgeId` instead of `judgeId`
  - All relationships and indexes defined

### 2. Migration Script (100%)
- ✅ Created `scripts/migrate-to-dynamic-schema.ts`
  - Drops old tables safely
  - Creates all new tables with proper indexes
  - Creates trigger function for auto-updating score totals
  - Includes comprehensive error handling

### 3. Core Library Updates (50%)
- ✅ Updated `lib/scores.ts` with new functions:
  - `getEventJudgeScores()` - Get scores for event judge
  - `getScoreItems()` - Get score items for a score
  - `getScoreWithItems()` - Get score with all items
  - `checkEventJudgeCompletion()` - Check completion status
  - `aggregateScoresByCategory()` - Dynamic category aggregation
  - Legacy functions for backward compatibility

## 🚧 In Progress

### 4. API Endpoints (0%)
- ⏳ `/api/scores` - Needs complete rewrite for:
  - Using `eventJudgeId` instead of `judgeId`
  - Storing scores in `score_items` table
  - Dynamic category validation
  - Event category lookup
  
- ⏳ `/api/admin/judges` - Update to use `event_judges`
- ⏳ `/api/admin/winners` - Update to use new aggregation
- ⏳ `/api/admin/events` - Add category and judge management
- ⏳ `/api/judge/submit` - Update for event-specific submissions

### 5. Cookie/Authentication System (0%)
- ⏳ Update `lib/cookies.ts` to support `eventJudgeId`
- ⏳ Update judge selection flow to select event first
- ⏳ Update `JudgeSelector` component

### 6. UI Components (0%)
- ⏳ `ScoringSliders.tsx` - Make dynamic based on event categories
- ⏳ `JudgeSelector.tsx` - Show event-specific judges
- ⏳ Admin event creation - Add category and judge inputs
- ⏳ Admin results - Display dynamic categories

## 📋 Next Steps (Priority Order)

### Phase 1: Core API Updates
1. **Update cookie system** to support event judges
   - Add `getEventJudgeId()` function
   - Update `setJudgeId()` to accept `eventJudgeId`
   - Update judge selection to require event selection first

2. **Rewrite `/api/scores` endpoint**
   - Accept dynamic categories in request body
   - Validate categories against `event_categories`
   - Store scores in `score_items` table
   - Update `scores.total` via trigger

3. **Update `/api/admin/events` endpoint**
   - Add POST/PATCH support for categories
   - Add POST/PATCH support for event judges
   - Return categories and judges with event data

### Phase 2: UI Updates
4. **Update judge selection flow**
   - Show event selector first
   - Then show event-specific judges
   - Store `eventJudgeId` in cookie

5. **Update `ScoringSliders` component**
   - Fetch event categories from API
   - Render sliders dynamically
   - Send category scores to API

6. **Update admin event creation**
   - Add category management UI
   - Add judge management UI
   - Default categories/judges on creation

### Phase 3: Testing & Migration
7. **Run migration script**
   - Test on development database
   - Verify all tables created correctly
   - Test trigger functions

8. **Update seed script**
   - Create events with categories
   - Create event judges
   - Create sample scores with score_items

9. **End-to-end testing**
   - Create event → Add categories/judges → Score floats → View results

## 🔧 Technical Decisions Made

1. **Cookie Strategy**: Will store `eventJudgeId` instead of `judgeId`
   - Requires event selection before judge selection
   - More secure (event-specific authentication)

2. **Score Storage**: Using `score_items` table
   - Fully normalized approach
   - Supports unlimited categories per event
   - Trigger updates `scores.total` automatically

3. **Judge Management**: Using `event_judges` junction table
   - Allows judge reuse across events
   - Event-specific judge names
   - Event-specific submission status

4. **Backward Compatibility**: Legacy functions in `lib/scores.ts`
   - Deprecated but functional
   - Allows gradual migration
   - Will be removed in future version

## ⚠️ Breaking Changes

1. **Cookie Format**: `judgeId` → `eventJudgeId`
   - All existing sessions will be invalid
   - Users must re-select judge after migration

2. **Score API**: Request/response format changed
   - Old: `{ floatId, lighting, theme, traditions, spirit, music }`
   - New: `{ floatId, eventJudgeId, scores: { [categoryName]: value } }`

3. **Database Schema**: Old `scores` table dropped
   - All existing score data will be deleted
   - Migration script includes warning

## 📝 Files Modified

- ✅ `lib/drizzle/schema.ts` - Complete rewrite
- ✅ `lib/scores.ts` - Major update with new functions
- ✅ `scripts/migrate-to-dynamic-schema.ts` - New migration script
- ⏳ `lib/cookies.ts` - Needs update for eventJudgeId
- ⏳ `app/api/scores/route.ts` - Needs complete rewrite
- ⏳ `app/api/admin/events/route.ts` - Needs category/judge endpoints
- ⏳ `components/ScoringSliders.tsx` - Needs dynamic rendering
- ⏳ `components/JudgeSelector.tsx` - Needs event selection

## 🎯 Success Criteria

- [ ] Migration script runs successfully
- [ ] Events can be created with custom categories
- [ ] Events can have custom judge names
- [ ] Judges can score floats using dynamic categories
- [ ] Admin can view results by category
- [ ] All existing functionality preserved
- [ ] No data loss (except intentional deletion of old scores)

---

**Last Updated:** 2025-01-XX  
**Status:** Phase 1 in progress (API updates)

