# Root Cause Analysis: QuickJumpBar Color Coding Issue

## Problem Statement
The grey number buttons in QuickJumpBar were not changing colors (grey → red → green) when floats were scored.

## Root Cause Analysis

### Issue 1: Score Status Logic
**Problem**: The API was marking all scores as "complete" as soon as a score record existed, even if all values were 0.

**Root Cause**: 
- When a score is saved, the API always saves all 5 fields together (even if they're all 0)
- The logic only checked if fields existed, not if they had meaningful values
- This meant a float with all 0s was marked as "complete" (green) instead of "incomplete" (red)

**Fix**: Updated logic to check if at least one category has a non-zero value:
- `not_started`: No score record exists
- `incomplete`: Score record exists but all values are 0 (user hasn't actually scored)
- `complete`: Score record exists and at least one category has a non-zero value

### Issue 2: Event Listener Registration
**Problem**: Event listener might not be catching the `scoreSaved` event.

**Root Cause**: No visibility into whether events were being dispatched or received.

**Fix**: Added comprehensive console logging to track:
- When `scoreSaved` event is dispatched from ScoringSliders
- When `scoreSaved` event is received by QuickJumpBar
- When `fetchFloats()` is called
- What status values are returned from the API
- What button classes are being applied

### Issue 3: State Update Timing
**Problem**: State might not be updating immediately after fetch.

**Root Cause**: React state updates are asynchronous, and the component might not re-render immediately.

**Fix**: 
- Added logging to track state updates
- Ensured `setFloatData` is called after API response
- Event listener properly triggers `fetchFloats()` on score save

## Expected Behavior After Fix

1. **Grey (not_started)**: No score record exists
2. **Red (incomplete)**: Score record exists but all 5 categories are 0
3. **Green (complete)**: Score record exists and at least one category has a non-zero value

## Testing Steps

1. Open browser console (F12)
2. Select a judge
3. Click on a float number (should be grey)
4. Move any slider - should see:
   - Console log: `[ScoringSliders] Score saved...`
   - Console log: `[QuickJumpBar] Received scoreSaved event...`
   - Button should turn RED (incomplete - all 0s)
5. Set at least one slider to a non-zero value - button should turn GREEN (complete)

## Debug Logs to Watch For

```
[QuickJumpBar] Event listener registered for scoreSaved
[ScoringSliders] Score saved for float X, dispatching scoreSaved event
[QuickJumpBar] Received scoreSaved event for floatId: X
[QuickJumpBar] Fetching floats for judge Y
[QuickJumpBar] Received Z floats from API
[QuickJumpBar] Float N (ID: M): status = "complete" | "incomplete" | "not_started"
[QuickJumpBar] Button N: status="...", color="GREEN|RED|GREY", isCurrent=false
```

## Files Modified

1. `app/api/floats/route.ts` - Fixed scoreStatus logic to check for non-zero values
2. `components/QuickJumpBar.tsx` - Added comprehensive debugging
3. `components/ScoringSliders.tsx` - Added event dispatch logging

