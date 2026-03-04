# 🚨 DEPLOY THIS NOW TO FIX THE ISSUE

## The Problem
Your Kyogong bill payments are failing because the `payments` table has no RLS policies. The backend can't insert payment records.

## The Fix (2 Minutes)

### Step 1: Copy This SQL

```sql
-- Add kyogong_transaction_id column
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS kyogong_transaction_id UUID REFERENCES shift_transactions(id);

CREATE INDEX IF NOT EXISTS idx_payments_kyogong_transaction 
ON payments(kyogong_transaction_id);

-- Add other foreign key columns
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS restaurant_order_id UUID REFERENCES restaurant_orders(id);

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS bar_order_id UUID REFERENCES bar_orders(id);

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES accounting_ar_invoices(id);

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS bill_id UUID;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payments_restaurant_order ON payments(restaurant_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_bar_order ON payments(bar_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can create payments"
ON payments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can view payments"
ON payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can update payments"
ON payments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('SUPER_ADMIN', 'CASHIER', 'KYOGONG_CASHIER', 'RECEPTIONIST', 'BRANCH_ACCOUNTANT', 'ACCOUNTANT', 'AUDITOR')
  )
);

CREATE POLICY "Admins can delete payments"
ON payments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('SUPER_ADMIN', 'ACCOUNTANT')
  )
);
```

### Step 2: Run It in Supabase

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Paste the SQL above
5. Click "Run"

### Step 3: Test It

Try processing a Kyogong bill payment again. The error should be gone and the bill should disappear from the unpaid list.

## What This Does

- ✅ Adds `kyogong_transaction_id` column to link payments to shift transactions
- ✅ Enables RLS on payments table
- ✅ Creates policies to allow authenticated users to insert/view/update payments
- ✅ Fixes the "row violates row-level security policy" error

## After Deployment

The verification errors will stop and bills will disappear from the unpaid list after payment.

---

**This is the complete fix. Just run that SQL in Supabase SQL Editor.**
