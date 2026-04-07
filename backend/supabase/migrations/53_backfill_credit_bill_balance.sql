-- Ensure paid_amount column exists before backfilling
ALTER TABLE staff_credit_bills
    ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12, 2) DEFAULT 0;

-- Backfill balance for pending/partial bills where balance was never set correctly
UPDATE staff_credit_bills
SET
    paid_amount = COALESCE(paid_amount, 0),
    balance = amount - COALESCE(paid_amount, 0)
WHERE
    status IN ('pending', 'accountant_confirmed', 'auditor_confirmed', 'partial')
    AND (balance IS NULL OR balance = 0)
    AND amount > 0;
