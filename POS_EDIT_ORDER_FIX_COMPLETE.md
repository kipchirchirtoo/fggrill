# POS Edit Order - FIXED

## Problem
When clicking "Edit / Copy" on an order in POS:
- It was creating a NEW order instead of editing the existing one
- Table number was not being populated
- Room number and customer name were not being populated

## Root Cause
The `handleEditOrder` function was only copying items to cart without:
1. Storing the order ID for later reference
2. Populating order metadata (table number, room number, customer name, order type)
3. Using the backend's "add items to order" endpoint

## Solution Applied

### 1. Added API Function (api.ts)
Added `addItemsToOrder` function to `restaurantAPI`:
```typescript
addItemsToOrder: async (id: string, items: any[]) => {
  // Supports both online and offline modes
  return fetchAPI<any>(`/restaurant/orders/${id}/items`, { 
    method: 'POST', 
    body: JSON.stringify({ items }) 
  });
}
```

### 2. Updated handleEditOrder (UnifiedPOS.tsx)
Modified to:
- Load existing order items into cart
- Populate table number if exists
- Populate room number if exists (and set order type to room_service)
- Populate customer name if exists
- Store order ID in sessionStorage for later use
- Show clear message: "Order loaded for editing. Add/remove items and submit to update the order."

### 3. Updated handleCreateOrder (UnifiedPOS.tsx)
Modified to:
- Check if we're editing an existing order (via sessionStorage)
- If editing: Use `addItemsToOrder` API to add items to existing order
- If editing: Show "Order updated successfully!" message
- If editing: Clear the editing flag after successful update
- If not editing: Continue with normal order creation flow

## How It Works Now

1. User clicks "Edit / Copy" on an order
2. Order items are loaded into cart
3. Table number, room number, and customer name are populated
4. Order ID is stored in sessionStorage
5. User can add/remove items from cart
6. When user clicks "Place Order":
   - System detects we're editing (checks sessionStorage)
   - Calls `addItemsToOrder` API with the order ID
   - Items are added to the EXISTING order (not a new one)
   - Order total is recalculated automatically by backend
   - Success message shown and cart cleared

## Backend Endpoint Used
`POST /api/restaurant/orders/:id/items`
- Adds new items to existing order
- Recalculates order total
- Updates order status if needed (e.g., from 'ready' back to 'preparing')
- Prevents adding to completed/cancelled/paid orders

## Files Modified
- `frontend/src/lib/api.ts` - Added addItemsToOrder function
- `frontend/src/components/pos/UnifiedPOS.tsx` - Updated handleEditOrder and handleCreateOrder

## Testing
After deployment:
1. Create an order with Table 55
2. Click "Edit / Copy" on the order
3. Verify table number is populated
4. Add more items to cart
5. Click "Place Order"
6. Verify items are added to EXISTING order (not new order)
7. Verify order total is updated correctly

## Status
✅ Code fixed and ready for deployment
⏳ Awaiting frontend rebuild/deployment
