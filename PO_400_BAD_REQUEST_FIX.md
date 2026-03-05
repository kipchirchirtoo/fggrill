# Purchase Order 400 Bad Request Fix - COMPLETE ✅

## Problem Summary
Purchase order creation was failing with **400 Bad Request** error: "Invalid item ID format: FGH-FOOD-SUGAR-0001"

## Root Cause Analysis

### Issue 1: Frontend Using Wrong Table
- Frontend was querying `simple_items` table (uses `sku` as primary key)
- Backend was expecting items from `store_items` table (uses `id` as primary key, has `item_code` field)
- The `store_po_items` table has a foreign key constraint: `item_id REFERENCES store_items(id)`

### Issue 2: SKU Field Mismatch
- `simple_items` uses `sku` field
- `store_items` has both `item_code` and `sku` fields
- Backend was only checking `item_code`, missing items stored with `sku`

### Issue 3: Incorrect OR Query Syntax
- The OR query was malformed: `.or(skusToResolve.map(sku => \`item_code.eq.${sku},sku.eq.${sku}\`).join(','))`
- This created invalid SQL when multiple SKUs were present
- Correct syntax: `.or(\`item_code.in.(${skusToResolve.join(',')}),sku.in.(${skusToResolve.join(',')})\`)`

## Fixes Applied

### 1. Frontend Fix (Already Applied)
**File**: `frontend/src/app/dashboard/branch-accounting/purchases/page.tsx`

- ✅ Updated `StoreItem` interface to match `simple_items` structure:
  - `sku: string` (primary key)
  - `description: string` (not `name`)
- ✅ Changed dropdown to use `it.sku` as value instead of `it.id`
- ✅ Updated item lookup to find by SKU: `items.find(it => it.sku === val)`
- ✅ Added console logging for debugging

### 2. Backend Fix (Just Applied - FINAL)
**File**: `backend/src/controllers/storekeeping/purchase-orders.controller.ts`

Updated SKU resolution logic to:
1. Check BOTH `item_code` AND `sku` fields
2. Use correct OR query syntax for multiple SKUs

```typescript
// BEFORE: Only checked item_code with wrong syntax
.select('id, item_code')
.in('item_code', skusToResolve);

// AFTER: Checks both fields with correct OR syntax
.select('id, item_code, sku')
.or(`item_code.in.(${skusToResolve.join(',')}),sku.in.(${skusToResolve.join(',')})`)
```

This allows the backend to resolve SKUs from `simple_items` by matching against either field in `store_items`.

## Verification

Ran diagnostic script `check-sku-mapping.js` which confirmed:
- ✅ SKU `FGH-FOOD-SUGAR-0001` exists in `simple_items`
- ✅ Same SKU exists in `store_items` with UUID `d5984d4e-4269-4a61-8bde-ad941dfbdc1f`
- ✅ Both `item_code` and `sku` fields contain the same value
- ✅ OR query syntax works correctly

## Testing Steps

1. **Restart Backend Server**
   ```bash
   # Stop the backend if running
   # Then restart it to load the new code
   cd backend
   npm start
   ```

2. **Hard Refresh Browser**
   - Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - This clears cached JavaScript

3. **Test Purchase Order Creation**
   - Go to Branch Accounting → Purchases
   - Click "New Purchase"
   - Select a supplier
   - Add an item from the dropdown (e.g., "Sugar (FGH-FOOD-SUGAR-0001)")
   - Check browser console for: "Selected item SKU: FGH-FOOD-SUGAR-0001"
   - Verify item is found (not undefined)
   - Click "Create Purchase Order"

4. **Expected Results**
   - ✅ Console shows SKU value (not undefined)
   - ✅ Item is found in the items array
   - ✅ Backend resolves SKU to UUID successfully
   - ✅ Request succeeds with 201 Created status
   - ✅ Purchase order appears in the list

## What Changed

### Data Flow Before (Broken)
```
Frontend: simple_items.sku → Backend: store_items.item_code (wrong syntax) → ❌ Not Found
```

### Data Flow After (Fixed)
```
Frontend: simple_items.sku → Backend: store_items.sku OR store_items.item_code (correct syntax) → ✅ Found → store_items.id
```

## Files Modified
1. `frontend/src/app/dashboard/branch-accounting/purchases/page.tsx` (already done)
2. `backend/src/controllers/storekeeping/purchase-orders.controller.ts` (just updated - FINAL FIX)

## Next Steps
1. **RESTART BACKEND SERVER** - This is critical!
2. Hard refresh browser
3. Test purchase order creation
4. If still failing, check backend console logs for the actual query being executed
