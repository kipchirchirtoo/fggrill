-- Migration: 20260901_fix_staff_credit_bill_payments_cols.sql
-- Purpose: Support all backend payment insertion columns and sync aliases for staff_credit_bill_payments

ALTER TABLE staff_credit_bill_payments 
  ADD COLUMN IF NOT EXISTS credit_bill_id UUID,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS recorded_by UUID,
  ADD COLUMN IF NOT EXISTS shift_id UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE OR REPLACE FUNCTION sync_staff_credit_bill_payments_cols()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.credit_bill_id IS NULL AND NEW.bill_id IS NOT NULL THEN
    NEW.credit_bill_id := NEW.bill_id;
  ELSIF NEW.bill_id IS NULL AND NEW.credit_bill_id IS NOT NULL THEN
    NEW.bill_id := NEW.credit_bill_id;
  END IF;

  IF NEW.payment_method IS NULL AND NEW.method IS NOT NULL THEN
    NEW.payment_method := NEW.method;
  ELSIF NEW.method IS NULL AND NEW.payment_method IS NOT NULL THEN
    NEW.method := NEW.payment_method;
  END IF;

  IF NEW.payment_date IS NULL AND NEW.paid_on IS NOT NULL THEN
    NEW.payment_date := NEW.paid_on;
  ELSIF NEW.paid_on IS NULL AND NEW.payment_date IS NOT NULL THEN
    NEW.paid_on := NEW.payment_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_staff_credit_bill_payments_cols ON staff_credit_bill_payments;
CREATE TRIGGER trg_sync_staff_credit_bill_payments_cols
BEFORE INSERT OR UPDATE ON staff_credit_bill_payments
FOR EACH ROW EXECUTE FUNCTION sync_staff_credit_bill_payments_cols();
