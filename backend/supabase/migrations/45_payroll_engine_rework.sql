-- 1. Create payroll_policies table
CREATE TABLE IF NOT EXISTS payroll_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('shif', 'nssf', 'housing_levy', 'absenteeism', 'uniform', 'other')),
    formula_type TEXT NOT NULL CHECK (formula_type IN ('percentage', 'flat', 'range', 'attendance_based')),
    rate DECIMAL(10, 4) DEFAULT 0,
    max_limit DECIMAL(10, 2),
    min_limit DECIMAL(10, 2),
    branch_id INTEGER REFERENCES branches(id),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enhance staff_loans with full audit trail
ALTER TABLE staff_loans 
    ADD COLUMN IF NOT EXISTS accountant_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS accountant_confirmed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS auditor_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Update loans status constraint to include accountant/auditor confirmation
DO $$
BEGIN
    ALTER TABLE staff_loans DROP CONSTRAINT IF EXISTS staff_loans_status_check;
    ALTER TABLE staff_loans ADD CONSTRAINT staff_loans_status_check 
        CHECK (status IN ('pending_approval', 'accountant_confirmed', 'auditor_confirmed', 'active', 'paid', 'cancelled'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Enhance staff_advances with full audit trail
ALTER TABLE staff_advances 
    ADD COLUMN IF NOT EXISTS accountant_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS accountant_confirmed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS auditor_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Update advances status constraint
DO $$
BEGIN
    ALTER TABLE staff_advances DROP CONSTRAINT IF EXISTS staff_advances_status_check;
    ALTER TABLE staff_advances ADD CONSTRAINT staff_advances_status_check 
        CHECK (status IN ('pending', 'accountant_confirmed', 'auditor_confirmed', 'approved', 'deducted', 'cancelled'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. Ensure staff_credit_bills has correct status and audit fields (already mostly there, but for safety)
DO $$
BEGIN
    ALTER TABLE staff_credit_bills DROP CONSTRAINT IF EXISTS staff_credit_bills_status_check;
    ALTER TABLE staff_credit_bills ADD CONSTRAINT staff_credit_bills_status_check 
      CHECK (status IN ('pending', 'accountant_confirmed', 'auditor_confirmed', 'deducted', 'cancelled', 'paid_cash'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5. Create staff_payroll_items for full traceability
CREATE TABLE IF NOT EXISTS staff_payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id UUID REFERENCES staff_payroll(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    source_table TEXT,
    source_id UUID,
    policy_id UUID REFERENCES payroll_policies(id),
    approval_status TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for traceability lookups
CREATE INDEX IF NOT EXISTS idx_payroll_items_source ON staff_payroll_items(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payroll_id ON staff_payroll_items(payroll_id);

-- Enable RLS
ALTER TABLE payroll_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payroll_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Management manage payroll policies" ON payroll_policies FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant', 'auditor', 'branch_accountant')));

CREATE POLICY "Management view payroll items" ON staff_payroll_items FOR SELECT
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant', 'auditor', 'branch_accountant')));

-- Seed standard policies if not exist
INSERT INTO payroll_policies (name, category, formula_type, rate, is_active)
VALUES 
('NSSF Standard', 'nssf', 'percentage', 0.06, true),
('SHIF Standard', 'shif', 'percentage', 0.0275, true),
('Housing Levy Standard', 'housing_levy', 'percentage', 0.015, true),
('Absenteeism Daily', 'absenteeism', 'attendance_based', 1.0, true)
ON CONFLICT DO NOTHING;
