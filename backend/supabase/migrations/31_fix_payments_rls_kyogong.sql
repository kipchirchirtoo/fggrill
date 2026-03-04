-- ============================================
-- FIX PAYMENTS TABLE RLS AND ADD KYOGONG SUPPORT
-- Migration: 31_fix_payments_rls_kyogong.sql
-- Purpose: Add RLS policies to payments table and kyogong_transaction_id column
-- ============================================

-- ============================================
-- 1. ADD KYOGONG_TRANSACTION_ID COLUMN
-- ============================================

-- Add column to link payments to Kyogong shift transactions
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS kyogong_transaction_id UUID REFERENCES shift_transactions(id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_kyogong_transaction 
ON payments(kyogong_transaction_id);

-- Add additional foreign key columns for other bill types if not exists
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS restaurant_order_id UUID REFERENCES restaurant_orders(id);

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS bar_order_id UUID REFERENCES bar_orders(id);

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES accounting_ar_invoices(id);

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS bill_id UUID; -- For finance_invoices and unpaid_bills

-- Add indexes for these columns
CREATE INDEX IF NOT EXISTS idx_payments_restaurant_order 
ON payments(restaurant_order_id);

CREATE INDEX IF NOT EXISTS idx_payments_bar_order 
ON payments(bar_order_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice 
ON payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_bill 
ON payments(bill_id);

-- ============================================
-- 2. ENABLE RLS ON PAYMENTS TABLE
-- ============================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CREATE RLS POLICIES FOR PAYMENTS TABLE
-- ============================================

-- Policy 1: Authenticated users can insert payments
-- This allows cashiers, receptionists, and other staff to record payments
CREATE POLICY "Authenticated users can create payments"
ON payments FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 2: Users can view all payments (for reporting and verification)
-- In production, you may want to restrict this based on branch or role
CREATE POLICY "Users can view payments"
ON payments FOR SELECT
TO authenticated
USING (true);

-- Policy 3: Staff can update payment status
-- Only specific roles can update payments (for status changes, verification, etc.)
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

-- Policy 4: Only admins can delete payments (for corrections/voids)
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

-- ============================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN payments.kyogong_transaction_id IS 'Links payment to Kyogong shift transaction';
COMMENT ON COLUMN payments.restaurant_order_id IS 'Links payment to restaurant order';
COMMENT ON COLUMN payments.bar_order_id IS 'Links payment to bar order';
COMMENT ON COLUMN payments.invoice_id IS 'Links payment to accounting AR invoice';
COMMENT ON COLUMN payments.bill_id IS 'Links payment to finance invoice or unpaid bill';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
