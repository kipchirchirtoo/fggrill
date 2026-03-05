# Branch Accountant Purchase Order Creation Fix

## Problem
Branch accountants are unable to create purchase orders. The issue is that the `generate_po_number()` database function references the wrong table name.

## Root Cause
The function looks for `purchase_orders` table, but the actual table is named `store_purchase_orders`.

## Fix Required
Run this SQL in your Supabase SQL Editor:

```sql
-- Drop old function if exists
DROP FUNCTION IF EXISTS generate_po_number();

-- Create corrected function that references store_purchase_orders table
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
  year TEXT;
  month TEXT;
  counter INT;
  po_number TEXT;
BEGIN
  year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  -- Fixed: Changed from purchase_orders to store_purchase_orders
  SELECT COALESCE(MAX(SUBSTRING(po_number FROM '\d+$')::INT), 0) + 1
  INTO counter
  FROM store_purchase_orders
  WHERE po_number LIKE 'PO-' || year || month || '-%';
  
  po_number := 'PO-' || year || month || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN po_number;
END;
$$ LANGUAGE plpgsql;
```

## Steps to Apply Fix

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the SQL above
4. Click "Run" to execute
5. Test by creating a purchase order in the branch accounting dashboard

## Verification

After applying the fix, branch accountants should be able to:
- Click "New Purchase" button
- Fill in supplier and items
- Successfully create purchase orders
- See generated PO numbers in format: `PO-YYYYMM-0001`

## Files Involved
- **Frontend**: `frontend/src/app/dashboard/branch-accounting/purchases/page.tsx`
- **Backend Controller**: `backend/src/controllers/storekeeping/purchase-orders.controller.ts`
- **Backend Routes**: `backend/src/routes/procurement.routes.ts`
- **Database Function**: `generate_po_number()` (needs fix)

## Permissions
The following roles can create purchase orders:
- SUPER_ADMIN
- GENERAL_MANAGER
- BRANCH_ACCOUNTANT
- PROCUREMENT
- PURCHASING_MANAGER
- CENTRAL_STOREKEEPER
- BRANCH_STOREKEEPER

Branch accountants already have the correct permissions in the backend routes.
