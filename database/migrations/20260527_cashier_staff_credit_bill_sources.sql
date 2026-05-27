-- Link cashier shift/POS credit bills to payroll staff credit bills.

ALTER TABLE IF EXISTS staff_credit_bills
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES cashier_shift_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_in_shift_id UUID REFERENCES cashier_shift_logs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_cashier_credit_bill_id UUID REFERENCES credit_bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_cashier_shift
  ON staff_credit_bills(shift_id);

CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_paid_cashier_shift
  ON staff_credit_bills(paid_in_shift_id);

CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_cashier_credit_bill
  ON staff_credit_bills(source_cashier_credit_bill_id);
