-- 1. Add audit columns to staff_credit_bills for strict payroll verification
ALTER TABLE staff_credit_bills 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS accountant_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS accountant_confirmed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS auditor_confirmed_at TIMESTAMP WITH TIME ZONE;

-- 2. Add indices for faster payroll and audit lookups
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_staff_id ON staff_credit_bills(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_status ON staff_credit_bills(status);
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_auditor ON staff_credit_bills(auditor_id);
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_date ON staff_credit_bills(bill_date);

-- 3. Ensure unpaid_bills indices for payroll lookups
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_waiter_id ON unpaid_bills(waiter_id);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_customer_id ON unpaid_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_status ON unpaid_bills(status);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_audit ON unpaid_bills(auditor_id, accountant_id);
