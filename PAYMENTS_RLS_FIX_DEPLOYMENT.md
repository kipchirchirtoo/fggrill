# Payments RLS Fix - Deployment Guide

## Problem
Backend payment insertion for Kyogong bills is failing with error:
```
new row violates row-level security policy for table "payments" (code: 42501)
```

## Root Cause
The `payments` table:
1. Has no RLS policies defined
2. Missing `kyogong_transaction_id` column to link payments to shift transactions
3. Blocks all authenticated user inserts

## Solution
Apply migration `31_fix_payments_rls_kyogong.sql` to:
1. Add `kyogong_transaction_id` column
2. Enable RLS on payments table
3. Create policies to allow authenticated users to insert/view/update payments

## Deployment Steps

### Option 1: Supabase Dashboard (RECOMMENDED)

1. **Open Supabase SQL Editor**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Click "SQL Editor" in the left sidebar

2. **Copy Migration SQL**
   - Open `backend/supabase/migrations/31_fix_payments_rls_kyogong.sql`
   - Copy the entire contents

3. **Execute Migration**
   - Paste the SQL into the SQL Editor
   - Click "Run" button
   - Wait for confirmation

4. **Verify Success**
   ```bash
   node apply-payments-rls-fix.js
   ```
   - Should show "✓ Payment insertion successful"

### Option 2: PostgreSQL Client

If you have direct database access:

```bash
psql $DATABASE_URL -f backend/supabase/migrations/31_fix_payments_rls_kyogong.sql
```

### Option 3: Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

## Verification

After applying the migration, test the fix:

1. **Run verification script:**
   ```bash
   node apply-payments-rls-fix.js
   ```

2. **Test Kyogong payment in production:**
   - Scan a Kyogong bill (e.g., SPA-20260220-5067)
   - Process payment with CASH/MPESA/CARD
   - Check console logs - should see:
     - ✅ "Payment processed successfully"
     - ✅ "Verification succeeded after N attempts"
     - ✅ Bill disappears from unpaid list

3. **Check database:**
   ```bash
   node diagnose-kyogong-payment.js
   ```
   - Should show payment record in `payments` table
   - Should show `shift_transactions.payment_method` updated to CASH/MPESA/CARD

## What This Fixes

### Before Fix:
- ❌ Backend payment insertion blocked by RLS
- ❌ No payments recorded in database
- ❌ Bills remain in unpaid list forever
- ❌ Frontend verification always fails

### After Fix:
- ✅ Backend can insert payments
- ✅ Payments recorded with `kyogong_transaction_id` link
- ✅ Bills disappear from unpaid list after payment
- ✅ Frontend verification succeeds within 5 attempts

## Rollback (if needed)

If something goes wrong, you can rollback:

```sql
-- Remove RLS policies
DROP POLICY IF EXISTS "Authenticated users can create payments" ON payments;
DROP POLICY IF EXISTS "Users can view payments" ON payments;
DROP POLICY IF EXISTS "Staff can update payments" ON payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON payments;

-- Disable RLS
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- Remove columns (optional - only if causing issues)
ALTER TABLE payments DROP COLUMN IF EXISTS kyogong_transaction_id;
ALTER TABLE payments DROP COLUMN IF EXISTS restaurant_order_id;
ALTER TABLE payments DROP COLUMN IF EXISTS bar_order_id;
ALTER TABLE payments DROP COLUMN IF EXISTS invoice_id;
ALTER TABLE payments DROP COLUMN IF EXISTS bill_id;
```

## Next Steps

After successful deployment:
1. Test Kyogong payment flow in production
2. Monitor for any RLS policy violations in logs
3. Verify bills disappear from unpaid list after payment
4. Mark Task 4 as complete in spec

## Support

If you encounter issues:
1. Check Supabase logs for RLS policy violations
2. Verify service role key is set in `.env`
3. Run diagnostic script: `node diagnose-kyogong-payment.js`
4. Check console logs in browser for verification errors
