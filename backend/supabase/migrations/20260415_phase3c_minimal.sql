-- PHASE 3C: MINIMAL VERSION - Just create tables and add columns

-- FIRST: Disable the problematic trigger
DROP TRIGGER IF EXISTS set_booking_branch_id_trigger ON bookings;

-- Add branch_id to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id INTEGER;

-- Recreate the trigger
CREATE TRIGGER set_booking_branch_id_trigger
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION set_booking_branch_id();

-- Create staff_payroll_adjustments
CREATE TABLE IF NOT EXISTS staff_payroll_adjustments (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    payroll_run_id INTEGER,
    adjustment_type VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    effective_date DATE NOT NULL,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create staff_loans
CREATE TABLE IF NOT EXISTS staff_loans (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL,
    branch_id INTEGER NOT NULL,
    loan_number VARCHAR(50) UNIQUE NOT NULL,
    loan_type VARCHAR(50) NOT NULL,
    principal_amount NUMERIC(12, 2) NOT NULL,
    interest_rate NUMERIC(5, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL,
    balance NUMERIC(12, 2) NOT NULL,
    disbursement_date DATE,
    repayment_start_date DATE,
    repayment_end_date DATE,
    monthly_installment NUMERIC(12, 2),
    installments_paid INTEGER DEFAULT 0,
    total_installments INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    requested_by UUID,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    disbursed_by UUID,
    disbursed_at TIMESTAMP WITH TIME ZONE,
    guarantor_name VARCHAR(255),
    guarantor_phone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns
ALTER TABLE staff_advances ADD COLUMN IF NOT EXISTS deducted_in_payroll_id INTEGER;
ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS bill_date DATE;
ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS staff_id INTEGER;
ALTER TABLE folio_transactions ADD COLUMN IF NOT EXISTS type VARCHAR(50);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_staff_id ON staff_payroll_adjustments(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_branch_id ON staff_payroll_adjustments(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_loans_staff_id ON staff_loans(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_loans_branch_id ON staff_loans(branch_id);

-- Enable RLS
ALTER TABLE staff_payroll_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_loans ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "staff_payroll_adjustments_select_policy" ON staff_payroll_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_loans_select_policy" ON staff_loans FOR SELECT TO authenticated USING (true);
