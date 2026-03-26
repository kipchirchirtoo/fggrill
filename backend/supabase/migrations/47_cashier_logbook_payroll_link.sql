-- 1. Add staff_id to cashier_logbook_lines for accurate payroll linking
ALTER TABLE cashier_logbook_lines 
    ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES users(id);

-- 2. Add source_logbook_id to staff_credit_bills to track origin
ALTER TABLE staff_credit_bills 
    ADD COLUMN IF NOT EXISTS source_logbook_id UUID REFERENCES cashier_logbooks(id);

-- 3. Add indices for faster lookup
CREATE INDEX IF NOT EXISTS idx_logbook_lines_staff ON cashier_logbook_lines(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_logbook ON staff_credit_bills(source_logbook_id);
