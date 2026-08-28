-- =====================================================
-- FIX CORPORATE CREDIT BILLS POS BILL FOREIGN KEY
-- Migration: 20260829_fix_corporate_credit_bills_pos_bill_fk.sql
-- Description:
--   Drop the restrictive FK constraint corporate_credit_bills_pos_bill_id_fkey
--   which references pos_master_bills(id).
--   In the FamousGate POS architecture, chargeable POS bills can be either
--   a pos_master_bills record or a standalone pos_shift_orders record.
--   Enforcing an FK exclusively to pos_master_bills causes Postgres FK violations
--   when cashiers settle pos_shift_orders via Corporate Credit.
-- =====================================================

ALTER TABLE public.corporate_credit_bills
  DROP CONSTRAINT IF EXISTS corporate_credit_bills_pos_bill_id_fkey;

CREATE INDEX IF NOT EXISTS idx_corporate_credit_bills_pos_bill_id
  ON public.corporate_credit_bills(pos_bill_id);

CREATE INDEX IF NOT EXISTS idx_corporate_credit_bills_reference
  ON public.corporate_credit_bills(reference_type, reference_id);
