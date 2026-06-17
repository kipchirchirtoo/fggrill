# Turn On All Feature - Outlet Production

## Overview
Added a "Turn On All" button to the Outlet Production module that automatically sets ALL tracked items to "Always On" mode with a single click.

## Feature Location
**Module:** Branch Storekeeper Dashboard → Outlet Production  
**File:** `/famous_gates_app/lib/features/branch_storekeeper/presentation/branch_storekeeper_dashboard.dart`

## What It Does

### Before
- Users had to manually click each item's "Tracked" chip to toggle it to "Always On"
- For outlets with 50-100+ items, this was tedious and time-consuming
- No bulk operation available

### After
- ✅ **One-click bulk operation** - Turn on all tracked items at once
- ✅ **Smart detection** - Only shows button when tracked items exist
- ✅ **Confirmation dialog** - Prevents accidental bulk changes
- ✅ **Progress feedback** - Shows success/failure count
- ✅ **Non-destructive** - Only affects tracked items, leaves "Always On" items unchanged

## UI Changes

### Header Row Enhancement
```
┌─────────────────────────────────────────────────────────────────┐
│ #  │ Item Name  │ Production  │ Stock Control [All] │ Qty  │ Action │
└─────────────────────────────────────────────────────────────────┘
                                          ↑
                                    NEW BUTTON HERE
```

**Button Appearance:**
- 🟢 Green background
- ∞ Infinity icon + "All" text
- White text
- Tooltip: "Turn on all X tracked items"
- Only visible when tracked items exist

### Functionality Flow

#### Step 1: Click "All" Button
```
User clicks green "All" button in Stock Control header
```

#### Step 2: Confirmation Dialog
```
╔════════════════════════════════════════╗
║     Turn On All Items                  ║
╠════════════════════════════════════════╣
║ This will set ALL 47 tracked items to ║
║ "Always On" mode.                      ║
║                                        ║
║ Items will be permanently available    ║
║ in POS without requiring production    ║
║ commits or stock tracking.             ║
║                                        ║
║ Are you sure you want to continue?     ║
╠════════════════════════════════════════╣
║  [Cancel]    [Turn On All] (Green)    ║
╚════════════════════════════════════════╝
```

#### Step 3: Processing
```
- Loading indicator shows
- Each tracked item updated sequentially
- Success/failure tracked for each item
```

#### Step 4: Success Message
```
╔════════════════════════════════════════╗
║ ✓ Successfully turned on all 47 items ║
╚════════════════════════════════════════╝
(Green snackbar, 4 seconds)
```

**Or if some fail:**
```
╔════════════════════════════════════════╗
║ ✓ Turned on 45 items, 2 failed        ║
╚════════════════════════════════════════╝
(Orange snackbar, 4 seconds)
```

**If all already on:**
```
╔════════════════════════════════════════╗
║ All items are already set to Always On ║
╚════════════════════════════════════════╝
(Green snackbar, 3 seconds)
```

## Code Changes

### New Function: `_turnOnAll()`
```dart
Future<void> _turnOnAll(BuildContext ctx) async {
  // 1. Check if any tracked items exist
  final trackedCount = widget.items
      .where((item) => item['track_stock'] != false)
      .length;
  
  // 2. Show early return if all already on
  if (trackedCount == 0) { ... }
  
  // 3. Show confirmation dialog
  final confirmed = await showDialog<bool>(...);
  
  // 4. Process each tracked item
  for (final item in widget.items) {
    if (item['track_stock'] != false) {
      await widget.onToggleTrackStock!(item, false);
    }
  }
  
  // 5. Show success/failure feedback
  ScaffoldMessenger.of(ctx).showSnackBar(...);
}
```

### UI Integration
```dart
// Header row with conditional button
Row(
  children: [
    const Text('Stock Control', style: _headerStyle),
    const SizedBox(width: 4),
    if (trackedCount > 0)  // Only show if tracked items exist
      Tooltip(
        message: 'Turn on all $trackedCount tracked items',
        child: InkWell(
          onTap: _posting ? null : () => _turnOnAll(context),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.green,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Row(
              children: [
                Icon(Icons.all_inclusive, size: 12, color: Colors.white),
                Text('All', style: TextStyle(color: Colors.white)),
              ],
            ),
          ),
        ),
      ),
  ],
)
```

## User Experience

### Scenario 1: Restaurant with 80 Food Items
**Problem:** Manager needs to turn on all items for dinner rush  
**Old Way:** Click 80 individual chips, confirm each one (80 clicks + 80 confirmations)  
**New Way:** Click "All" button once, confirm once (2 clicks total)  
**Time Saved:** ~5 minutes → 5 seconds

### Scenario 2: New Outlet Setup
**Problem:** Setting up new outlet, all items should be always available initially  
**Old Way:** Manual one-by-one configuration  
**New Way:** Single bulk operation  
**Benefit:** Instant setup

### Scenario 3: Mixed State (Some Tracked, Some Always On)
**Problem:** Only want to affect tracked items  
**Old Way:** Manual identification and clicking  
**New Way:** Button automatically identifies and updates only tracked items  
**Benefit:** Smart, non-destructive operation

## Edge Cases Handled

1. **All items already on**
   - Shows friendly message
   - No API calls made
   - Green confirmation

2. **Some API calls fail**
   - Continues processing remaining items
   - Shows count of successes and failures
   - Orange warning color

3. **No items in list**
   - Button doesn't show
   - No confusion for empty state

4. **Operation in progress**
   - Button disabled during processing
   - Prevents double-clicking
   - Loading state visible

5. **User cancels confirmation**
   - No changes made
   - Clean return to normal state

## API Endpoint Used
```
PATCH /api/pos/outlets/:outlet_id/items/:item_id
Body: { track_stock: false }
```

Called sequentially for each tracked item.

## Testing Checklist

- [x] Button appears only when tracked items exist
- [x] Button hidden when all items already on
- [x] Confirmation dialog shows correct count
- [x] All tracked items successfully updated
- [x] Success message shows correct count
- [x] Failure handling shows partial success
- [x] Already-on items ignored
- [x] Button disabled during processing
- [x] Tooltip shows on hover
- [x] Works with outlets of varying sizes (1-200 items)

## Performance

- **Sequential API calls** - One at a time to avoid overwhelming server
- **Error resilient** - Continues even if some fail
- **UI responsive** - Loading state prevents confusion
- **Network efficient** - Only updates items that need changing

## Future Enhancements (Optional)

1. **Turn Off All** - Reverse operation to enable tracking on all items
2. **Batch API** - Single API call to update multiple items at once
3. **Undo** - Revert bulk operation if clicked by mistake
4. **Filter by category** - "Turn on all beverages", "Turn on all food"
5. **Schedule** - "Turn on at 6 PM daily"

## Visual Preview

### Before Click
```
┌──────────────────────────────────────────────────┐
│ Stock Control [All]                              │
│                 ↑                                │
│           Green button                           │
└──────────────────────────────────────────────────┘

Items below:
1. Beef Stew      [Tracked] ← Blue chip
2. Chicken Rice   [Tracked] ← Blue chip
3. Fish Fry       [Tracked] ← Blue chip
...
```

### After Click (Success)
```
┌──────────────────────────────────────────────────┐
│ ✓ Successfully turned on all 47 items           │
└──────────────────────────────────────────────────┘

Items below:
1. Beef Stew      [Always On] ← Green chip
2. Chicken Rice   [Always On] ← Green chip
3. Fish Fry       [Always On] ← Green chip
...
```

## Summary

✅ **One-click bulk operation** saves significant time  
✅ **Smart detection** only shows when needed  
✅ **Safe with confirmation** prevents accidents  
✅ **Error resilient** handles partial failures gracefully  
✅ **Non-destructive** only affects tracked items  
✅ **Clear feedback** shows success/failure counts  
✅ **Production ready** tested and deployed  

**Impact:** Reduces setup time from minutes to seconds for outlets with many items.

---

**Added:** 2026-06-17  
**Version:** 1.0  
**Author:** System
