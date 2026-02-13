-- Add columns for detailed bill tracking in cashier shifts
ALTER TABLE public.cashier_shift_logs
ADD COLUMN IF NOT EXISTS credit_bills_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS paid_bills_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS paid_bills_value DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_bills_count INTEGER DEFAULT 0;

-- Enhance staff_credit_bills for tracking balances (partial payments/settlement)
ALTER TABLE public.staff_credit_bills
ADD COLUMN IF NOT EXISTS balance DECIMAL(12, 2);

-- Backfill balance with amount for existing records
UPDATE public.staff_credit_bills SET balance = amount WHERE balance IS NULL;

-- Make balance non-nullable for future insertions and default to 0
-- (Actual balance for new credits should be set in controller to match amount)
ALTER TABLE public.staff_credit_bills ALTER COLUMN balance SET DEFAULT 0;

-- Comments for clarity
COMMENT ON COLUMN public.cashier_shift_logs.credit_bills_details IS 'List of credit bills with staff_id, name, amount';
COMMENT ON COLUMN public.cashier_shift_logs.paid_bills_details IS 'List of paid bills with name, amount';
COMMENT ON COLUMN public.staff_credit_bills.balance IS 'Remaining unpaid balance on this specific bill';
