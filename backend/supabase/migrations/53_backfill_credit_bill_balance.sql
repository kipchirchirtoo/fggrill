-- Backfill balance for pending/partial bills where balance was never set correctly
-- These are bills created before balance was properly initialized on insert

UPDATE staff_credit_bills
SET
    balance = amount - COALESCE(paid_amount, 0),
    paid_amount = COALESCE(paid_amount, 0)
WHERE
    status IN ('pending', 'accountant_confirmed', 'auditor_confirmed', 'partial')
    AND (balance IS NULL OR balance = 0)
    AND amount > 0;
