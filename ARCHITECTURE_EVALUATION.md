# Architecture Evaluation & Plan Verification
## Parade Management System - Dynamic Event Configuration

**Date:** 2025-01-XX  
**Evaluator:** IT Architect Review  
**Purpose:** Evaluate current system configuration and verify plan accuracy for event-specific scoring categories and dynamic judge management

---

## 1. CURRENT SYSTEM CONFIGURATION

### 1.1 Database Schema Analysis

#### Current Tables:
1. **`judges`** (Static)
   - `id` (serial, PK)
   - `name` (text, unique, not null) - **Currently hardcoded: "Judge 1", "Judge 2", "Judge 3"**
   - `submitted` (boolean, default false)
   - **Issue:** No `eventId` relationship - judges are global, not event-specific

2. **`events`** (Implemented)
   - `id` (serial, PK)
   - `name` (text, not null)
   - `city` (text, not null)
   - `eventDate` (timestamp, nullable)
   - `active` (boolean, default true)
   - `createdAt`, `updatedAt` (timestamps)
   - **Missing:** No `scoringCategories` JSONB column
   - **Missing:** No `judgeNames` JSONB or related table

3. **`floats`** (Event-aware)
   - `id` (serial, PK)
   - `eventId` (integer, FK to events, nullable) ✅
   - All float fields...
   - **Status:** Already supports event filtering

4. **`scores`** (Static Categories)
   - `id` (serial, PK)
   - `judgeId` (integer, FK to judges)
   - `floatId` (integer, FK to floats)
   - `lighting` (integer, nullable) - **Hardcoded category**
   - `theme` (integer, nullable) - **Hardcoded category**
   - `traditions` (integer, nullable) - **Hardcoded category**
   - `spirit` (integer, nullable) - **Hardcoded category**
   - `music` (integer, nullable) - **Hardcoded category**
   - `total` (integer, generated column)
   - **Issue:** Categories are hardcoded columns, not dynamic

5. **`participants`** (Historical data)
   - Used for quick re-entry
   - Not event-specific (could be improved)

6. **`settings`** (Application-wide)
   - Key-value store for global settings

#### Current Relationships:
- ✅ `floats.eventId` → `events.id` (with cascade delete)
- ✅ `scores.judgeId` → `judges.id` (with cascade delete)
- ✅ `scores.floatId` → `floats.id` (with cascade delete)
- ❌ **Missing:** `judges.eventId` relationship
- ❌ **Missing:** `scores.eventId` for direct event filtering

### 1.2 Application Architecture

#### Technology Stack:
- **Framework:** Next.js 14.2.33 (App Router)
- **Database:** Neon PostgreSQL (serverless)
- **ORM:** Drizzle ORM 0.33.0
- **Language:** TypeScript 5.4.0
- **UI:** React 18.3.0, TailwindCSS, shadcn/ui

#### Current Scoring Implementation:
- **Hardcoded Categories:** Lighting, Theme, Traditions, Spirit, Music
- **Storage:** Fixed columns in `scores` table
- **UI:** `ScoringSliders.tsx` has hardcoded category names
- **API:** `/api/scores` expects fixed field names
- **Aggregation:** `lib/scores.ts` has hardcoded category queries

#### Current Judge Management:
- **Creation:** Static seed script creates "Judge 1", "Judge 2", "Judge 3"
- **Selection:** `JudgeSelector.tsx` shows hardcoded list
- **Authentication:** Cookie-based (judgeId stored in httpOnly cookie)
- **No Event Association:** Judges are global, not per-event

### 1.3 API Endpoints Analysis

#### Current Endpoints:
- ✅ `/api/scores` - POST/PATCH with hardcoded categories
- ✅ `/api/admin/judges` - GET with optional eventId filtering (filters scores, not judges)
- ✅ `/api/admin/winners` - GET with eventId filtering
- ✅ `/api/admin/scores` - GET CSV export with eventId filtering
- ✅ `/api/admin/events` - GET/POST for event management
- ✅ `/api/judge/submit` - POST to lock judge submissions

#### Issues Identified:
1. **Judge filtering is indirect:** `/api/admin/judges` filters by eventId through scores, not direct judge-event relationship
2. **No judge creation API:** Judges are only created via seed script
3. **No event-specific judge management:** Cannot create judges per event

---

## 2. PROPOSED PLAN EVALUATION

### 2.1 Plan Components (from Summary)

Based on the conversation summary, the plan includes:

1. **Scoring Categories Storage:** JSONB column in `events` table
2. **Dynamic Score Storage:** Separate `score_items` table with `categoryName` and `value`
3. **Migration Strategy:** Delete and start fresh with test data
4. **Judge Defaults:** Allow entry of names during event creation
5. **Score Submission:** Separate `judge_submissions` table for audit trail

### 2.2 Plan Accuracy Assessment

#### ✅ ACCURATE COMPONENTS:

1. **JSONB for Scoring Categories**
   - **Rationale:** Flexible, allows different categories per event
   - **PostgreSQL Support:** ✅ Native JSONB support
   - **Drizzle Support:** ✅ `pgTable` supports JSONB via `jsonb()` type
   - **Query Performance:** ⚠️ JSONB queries can be slower than columns, but acceptable for read-heavy workload

2. **Separate `score_items` Table**
   - **Rationale:** Normalized, allows dynamic categories
   - **Benefits:** 
     - No schema changes needed for new categories
     - Easy to add/remove categories
     - Supports category metadata (weights, descriptions)
   - **Trade-offs:**
     - More complex queries (JOINs required)
     - Potential performance impact with many categories
     - More complex aggregation logic

3. **Judge Names During Event Creation**
   - **Rationale:** Event-specific judge management
   - **Implementation:** Can use JSONB array or separate `event_judges` table
   - **Recommendation:** ⚠️ See alternative approach below

4. **`judge_submissions` Table**
   - **Rationale:** Audit trail, timestamp tracking
   - **Benefits:** Clear submission history, supports multiple submissions per event
   - **Implementation:** Straightforward, low risk

#### ⚠️ RISKS IDENTIFIED:

### 2.3 Critical Risks

#### **RISK 1: Breaking Change to Existing Data Structure**
- **Severity:** 🔴 HIGH
- **Impact:** 
  - Current `scores` table has fixed columns (lighting, theme, etc.)
  - Moving to `score_items` requires data migration
  - All existing scores become invalid
- **Mitigation:**
  - Plan states "delete and start fresh" - acceptable for test data
  - **⚠️ CRITICAL:** Must ensure production data is backed up if this is ever used in production
  - Consider dual-write period for gradual migration

#### **RISK 2: Query Performance Degradation**
- **Severity:** 🟡 MEDIUM
- **Impact:**
  - Current: Simple `SUM(lighting)` queries
  - Proposed: `JOIN score_items` with `GROUP BY` and `PIVOT` or multiple queries
  - Aggregation becomes more complex
- **Mitigation:**
  - Add database indexes on `score_items.categoryName`, `score_items.scoreId`
  - Consider materialized views for winner calculations
  - Benchmark with realistic data volumes (70+ floats, 3 judges, 5 categories = 1050+ score_items)

#### **RISK 3: Judge-Event Relationship Complexity**
- **Severity:** 🟡 MEDIUM
- **Impact:**
  - Current: Judges are global (Judge 1, 2, 3)
  - Proposed: Judges per event
  - **Question:** Can same judge (by name) judge multiple events?
  - **Question:** Should judges have unique IDs across events or per event?
- **Mitigation:**
  - Clarify business requirements
  - Consider `event_judges` junction table vs. `judges.eventId` FK

#### **RISK 4: UI Complexity Increase**
- **Severity:** 🟡 MEDIUM
- **Impact:**
  - `ScoringSliders.tsx` currently hardcoded
  - Must become dynamic based on event categories
  - API responses change structure
  - More complex state management
- **Mitigation:**
  - Refactor `ScoringSliders` to accept categories as props
  - Update all score-related components
  - Comprehensive testing required

#### **RISK 5: Type Safety Loss**
- **Severity:** 🟡 MEDIUM
- **Impact:**
  - Current: TypeScript knows exact score fields
  - Proposed: Dynamic categories = `Record<string, number>` types
  - Less compile-time safety
- **Mitigation:**
  - Use TypeScript discriminated unions
  - Runtime validation of category names
  - Consider Zod schemas for validation

#### **RISK 6: Migration Complexity**
- **Severity:** 🟡 MEDIUM
- **Impact:**
  - Multiple schema changes required
  - Data migration from columns to rows
  - Potential downtime
- **Mitigation:**
  - Plan states "delete and start fresh" - acceptable
  - Document rollback procedure
  - Test migration script thoroughly

---

## 3. ALTERNATIVE APPROACHES & RECOMMENDATIONS

### 3.1 Scoring Categories Storage

#### **Option A: JSONB in Events Table** (Proposed)
```typescript
events: {
  scoringCategories: jsonb("scoring_categories") // [{name: "Lighting", maxScore: 20}, ...]
}
```
- ✅ Flexible, no schema changes for new categories
- ✅ Easy to query with PostgreSQL JSONB operators
- ⚠️ Less type-safe
- ⚠️ Harder to enforce referential integrity

#### **Option B: Separate `event_categories` Table** (RECOMMENDED)
```typescript
event_categories: {
  id: serial,
  eventId: integer (FK),
  name: text,
  maxScore: integer,
  displayOrder: integer,
  required: boolean
}
```
- ✅ Normalized, better for queries
- ✅ Can add metadata (weights, descriptions)
- ✅ Easier to validate and enforce constraints
- ✅ Better for reporting and analytics
- ⚠️ Requires JOIN for category list

**RECOMMENDATION:** Use Option B (`event_categories` table) for better data integrity and query performance.

### 3.2 Score Storage

#### **Option A: `score_items` Table** (Proposed)
```typescript
score_items: {
  id: serial,
  scoreId: integer (FK to scores),
  categoryName: text,
  value: integer
}
```
- ✅ Fully normalized
- ✅ Supports dynamic categories
- ⚠️ More complex queries
- ⚠️ Performance overhead

#### **Option B: Hybrid Approach** (RECOMMENDED)
```typescript
scores: {
  // Keep existing structure for common categories
  lighting: integer,
  theme: integer,
  // ... other common ones
  
  // Add JSONB for event-specific categories
  customScores: jsonb("custom_scores") // {[categoryName]: value}
}
```
- ✅ Backward compatible
- ✅ Performance for common categories
- ✅ Flexibility for custom categories
- ⚠️ More complex logic

#### **Option C: Full Migration to `score_items`** (Proposed)
- ✅ Clean, normalized
- ✅ Maximum flexibility
- ⚠️ Breaking change
- ⚠️ Performance impact

**RECOMMENDATION:** 
- **Short-term:** Use Option A (`score_items`) if starting fresh
- **Long-term:** Consider Option B if need backward compatibility

### 3.3 Judge Management

#### **Option A: Judges with `eventId` FK** (Simple)
```typescript
judges: {
  id: serial,
  name: text,
  eventId: integer (FK), // One judge per event
  submitted: boolean
}
```
- ✅ Simple relationship
- ⚠️ Cannot reuse judge names across events
- ⚠️ Requires unique constraint on (name, eventId)

#### **Option B: Junction Table `event_judges`** (RECOMMENDED)
```typescript
judges: {
  id: serial,
  name: text, // Can be reused across events
  submitted: boolean // Global submission status?
}

event_judges: {
  id: serial,
  eventId: integer (FK),
  judgeId: integer (FK),
  displayName: text, // "Judge 1" for this event
  submitted: boolean // Event-specific submission
}
```
- ✅ Supports judge reuse across events
- ✅ Event-specific judge names
- ✅ Event-specific submission status
- ✅ More flexible for future features
- ⚠️ More complex queries

#### **Option C: Event-Specific Judge Names Only**
```typescript
event_judges: {
  id: serial,
  eventId: integer (FK),
  name: text, // "Judge 1", "Judge 2", etc. per event
  submitted: boolean
}
// Remove global judges table
```
- ✅ Simplest for event-specific use case
- ✅ No global judge management
- ⚠️ Cannot track judge history across events
- ⚠️ Loses judge identity consistency

**RECOMMENDATION:** Use Option B (`event_judges` junction table) for maximum flexibility while maintaining judge identity.

### 3.4 Migration Strategy

#### **Option A: Delete and Start Fresh** (Proposed)
- ✅ Simplest
- ✅ No data migration complexity
- ⚠️ Loses all historical data
- ⚠️ Cannot test with existing data

#### **Option B: Gradual Migration** (RECOMMENDED for Production)
1. Add new tables (`event_categories`, `score_items`, `event_judges`)
2. Dual-write: Write to both old and new structures
3. Migrate existing data
4. Switch reads to new structure
5. Remove old columns

**RECOMMENDATION:** 
- **For Test/Development:** Option A is acceptable
- **For Production:** Must use Option B with backup

---

## 4. RECOMMENDED IMPLEMENTATION PLAN

### 4.1 Database Schema Changes

#### **Phase 1: Event Categories**
```sql
CREATE TABLE event_categories (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 20,
  display_order INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, name)
);

CREATE INDEX idx_event_categories_event_id ON event_categories(event_id);
```

#### **Phase 2: Event Judges**
```sql
CREATE TABLE event_judges (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  judge_id INTEGER REFERENCES judges(id) ON DELETE SET NULL, -- Optional, for judge reuse
  name TEXT NOT NULL, -- Display name for this event
  submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, name)
);

CREATE INDEX idx_event_judges_event_id ON event_judges(event_id);
CREATE INDEX idx_event_judges_judge_id ON event_judges(judge_id);
```

#### **Phase 3: Score Items**
```sql
CREATE TABLE score_items (
  id SERIAL PRIMARY KEY,
  score_id INTEGER NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  value INTEGER, -- NULL = not scored, 0 = N/A, >0 = scored
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(score_id, category_name)
);

CREATE INDEX idx_score_items_score_id ON score_items(score_id);
CREATE INDEX idx_score_items_category ON score_items(category_name);
```

#### **Phase 4: Judge Submissions**
```sql
CREATE TABLE judge_submissions (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  judge_id INTEGER NOT NULL, -- References event_judges.id or judges.id
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address TEXT, -- Optional, for audit
  UNIQUE(event_id, judge_id)
);

CREATE INDEX idx_judge_submissions_event_id ON judge_submissions(event_id);
```

### 4.2 Application Code Changes

#### **Priority 1: Core Schema Updates**
1. Update `lib/drizzle/schema.ts` with new tables
2. Create migration scripts
3. Update TypeScript types

#### **Priority 2: API Updates**
1. `/api/admin/events` - Add category and judge management
2. `/api/scores` - Refactor to use `score_items`
3. `/api/admin/judges` - Filter by `event_judges`
4. `/api/admin/winners` - Aggregate from `score_items`

#### **Priority 3: UI Updates**
1. `ScoringSliders.tsx` - Dynamic categories from event
2. `JudgeSelector.tsx` - Show event-specific judges
3. Admin event creation - Add category and judge inputs
4. Admin results - Aggregate dynamic categories

### 4.3 Testing Strategy

1. **Unit Tests:**
   - Score aggregation with dynamic categories
   - Judge filtering by event
   - Category validation

2. **Integration Tests:**
   - End-to-end scoring flow
   - Event creation with categories
   - Judge submission tracking

3. **Performance Tests:**
   - Query performance with 100+ floats
   - Aggregation speed with 5+ categories
   - Concurrent judge submissions

---

## 5. EXECUTION RISKS & MITIGATION

### 5.1 High-Priority Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Data loss during migration | 🔴 HIGH | Backup before migration, test on copy |
| Query performance degradation | 🟡 MEDIUM | Add indexes, benchmark, consider caching |
| Breaking API changes | 🟡 MEDIUM | Version API endpoints, maintain backward compatibility |
| Type safety loss | 🟡 MEDIUM | Use Zod schemas, runtime validation |
| Complex UI refactoring | 🟡 MEDIUM | Incremental updates, feature flags |

### 5.2 Recommended Phased Rollout

1. **Phase 1:** Add new tables, keep old structure (dual-write)
2. **Phase 2:** Update event creation UI to support categories
3. **Phase 3:** Update scoring UI to use dynamic categories
4. **Phase 4:** Migrate existing data (if any)
5. **Phase 5:** Remove old columns and code

---

## 6. CONCLUSION

### 6.1 Plan Accuracy: ✅ MOSTLY ACCURATE

The proposed plan is **technically sound** but has some areas that need refinement:

- ✅ JSONB for categories: **Acceptable**, but `event_categories` table is **recommended**
- ✅ `score_items` table: **Good approach** for dynamic categories
- ⚠️ Judge management: **Needs clarification** - recommend `event_judges` junction table
- ✅ `judge_submissions` table: **Good for audit trail**
- ⚠️ Migration strategy: **Acceptable for test data**, but document production approach

### 6.2 Key Recommendations

1. **Use `event_categories` table instead of JSONB** for better query performance
2. **Use `event_judges` junction table** for flexible judge management
3. **Add comprehensive indexes** for performance
4. **Implement gradual migration** if production data exists
5. **Add runtime validation** for dynamic categories
6. **Benchmark query performance** before and after changes

### 6.3 Next Steps

1. ✅ Review and approve this evaluation
2. ⏳ Clarify judge management requirements (reuse across events?)
3. ⏳ Create detailed implementation plan with phases
4. ⏳ Set up test environment for migration
5. ⏳ Begin Phase 1 implementation

---

**Document Status:** Ready for Review  
**Last Updated:** 2025-01-XX

