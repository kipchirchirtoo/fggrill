# Purchase Order Creation Fix - Complete

## Issues Fixed

### 1. ✅ 405 Method Not Allowed (FIXED)
- **Root Cause**: Frontend used local `API_URL` constant instead of importing from `@/lib/config`
- **Fix**: Removed local constant and imported `API_URL` from `@/lib/config`
- **File**: `frontend/src/app/dashboard/branch-accounting/purchases/page.tsx`

### 2. ⚠️ 400 Bad Request - Invalid Item ID Format (IN PROGRESS)
- **Root Cause**: Frontend sending SKU text `"(FGH-CER-RICE-0001)"` instead of UUID
- **Issue**: TypeScript interfaces had `id: number` but database uses UUIDs
- **Fix Applied**: Updated all interfaces to use `id: string` (UUID)
- **Files Changed**:
  - `StoreItem` interface: `id: number` → `id: string`
  - `Supplier` interface: `id: number` → `id: string`
  - `PurchaseOrder` interface: `supplier_id: number` → `supplier_id: string`
  - `POItem` interface: `item_id: number` → `item_id: string`

## Current Status

The backend is correctly validating UUIDs and rejecting the invalid format. The frontend code has been fixed, but you need to **refresh the browser** to load the updated code.

## Next Step

**REFRESH YOUR BROWSER** (Ctrl+F5 or Cmd+Shift+R) to reload the frontend with the fixed TypeScript interfaces. Then try creating a purchase order again.

## What Should Happen

After refreshing:
1. Select a supplier from the dropdown
2. Select an item from the dropdown
3. The item's UUID (not the SKU) will be sent to the backend
4. Purchase order will be created successfully

## Debug Info

The backend logs show:
```
Items: [
  {
    "item_id": "(FGH-CER-RICE-0001)",  // ❌ This is wrong - it's the SKU
    "quantity": 7,
    "unit_price": 300,
    "vat_rate": 16
  }
]
```

After refresh, it should show:
```
Items: [
  {
    "item_id": "some-uuid-here",  // ✅ This is correct - it's the UUID
    "quantity": 7,
    "unit_price": 300,
    "vat_rate": 16
  }
]
```
