-- Add cash audit trail fields to staff_credit_bill_payments table
-- This supports tracking cash rendered to staff and variance for audit purposes

ALTER TABLE staff_credit_bill_payments
    ADD COLUMN IF NOT EXISTS cash_rendered DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS cash_variance DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN staff_credit_bill_payments.cash_rendered IS 'For cash payments: the actual physical cash amount given to staff (to detect shortages/overages)';
COMMENT ON COLUMN staff_credit_bill_payments.cash_variance IS 'For cash payments: variance between cash_rendered and payment amount (should be 0, but tracks errors)';
COMMENT ON COLUMN staff_credit_bill_payments.approved_by IS 'User ID of branch accountant who approved the payment';
COMMENT ON COLUMN staff_credit_bill_payments.approved_at IS 'Timestamp when the payment was approved by accountant';
