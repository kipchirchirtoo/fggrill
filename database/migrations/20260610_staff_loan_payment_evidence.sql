-- Durable evidence fields for branch accountant staff loan repayments.
-- Keeps the existing staff_loan_payments ledger but makes manual payments
-- auditable by payment method, reference code, notes, recorder, and branch.

CREATE TABLE IF NOT EXISTS staff_loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES staff_loans(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payroll_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE staff_loan_payments
    ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash',
    ADD COLUMN IF NOT EXISTS reference TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_staff_loan_payments_loan_id
    ON staff_loan_payments(loan_id);

CREATE INDEX IF NOT EXISTS idx_staff_loan_payments_branch_date
    ON staff_loan_payments(branch_id, payment_date DESC);
