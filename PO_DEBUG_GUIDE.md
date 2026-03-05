# Purchase Order 500 Error - Debug Guide

## What I've Done

I've added extensive debug logging to the backend purchase order creation endpoint. This will help us identify the exact cause of the 500 error.

## What You Need to Do

1. **Check your backend terminal** (where you ran `npm run dev` or `node server.js`)

2. **Try creating a purchase order again** from the frontend

3. **Look for this output** in the backend terminal:

```
=== CREATE PURCHASE ORDER DEBUG ===
User ID: <some-uuid>
Supplier ID: <some-uuid> Type: string
Items count: 1
Items: [...]
Generated PO number: PO...
Calculated totals - Subtotal: ... Tax: ... Total: ...
PO Data to insert: {...}
```

4. **If there's an error**, you'll see:
   - `PO Insert error:` - Problem creating the purchase order
   - `PO Items insert error:` - Problem creating the line items
   - `FULL ERROR DETAILS:` - Complete error information

## Common Issues to Look For

### Issue 1: User ID is undefined
```
User ID: undefined
```
**Fix**: Authentication issue - user not properly logged in

### Issue 2: Invalid UUID format
```
Supplier ID: 123 Type: number
```
**Fix**: Frontend sending integer instead of UUID string

### Issue 3: Database constraint violation
```
PO Insert error: { code: '23502', message: 'null value in column...' }
```
**Fix**: Missing required field

### Issue 4: Foreign key violation
```
PO Insert error: { code: '23503', message: 'violates foreign key constraint' }
```
**Fix**: Invalid supplier_id or item_id (doesn't exist in database)

## Next Steps

**Copy the ENTIRE error output from your backend terminal and send it to me.** This will tell us exactly what's wrong.

## Quick Test

If you want to test without the frontend, run:
```bash
node test-po-creation-debug.js
```

This will attempt to create a purchase order directly and show any errors.
