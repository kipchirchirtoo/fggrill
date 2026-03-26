-- 44_draft_payroll_system.sql
-- Rebuilds payroll system to be draft-based with JSONB dynamic adjustments and strict month-cycle locking.

-- 1. Create payroll_runs (Month-cycle aggregate tracking)
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2024),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'downloaded')),
    
    -- Cached Cross-branch Totals (Updated on approval)
    total_basic_salary DECIMAL(12, 2) DEFAULT 0,
    total_gross_pay DECIMAL(12, 2) DEFAULT 0,
    total_deductions DECIMAL(12, 2) DEFAULT 0,
    total_net_pay DECIMAL(12, 2) DEFAULT 0,
    
    -- Audit trail
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(month, year)
);

-- 2. Create payroll_records (Individual immutable snapshots)
CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE NOT NULL,
    staff_id UUID REFERENCES users(id) NOT NULL,
    branch_id INTEGER REFERENCES branches(id),
    
    -- Frozen identity snapshots (in case they change later)
    employee_name TEXT NOT NULL,
    employee_code TEXT,
    national_id TEXT,
    
    -- Base calculation
    basic_salary DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    
    -- JSON Arrays tracking explicit components: [{ type: 'commission', amount: 5000, source: 'system', timestamp: '...' }]
    additions JSONB DEFAULT '[]'::jsonb NOT NULL,
    deductions JSONB DEFAULT '[]'::jsonb NOT NULL,
    
    -- Aggregates
    total_additions DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    total_deductions DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    gross_pay DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    net_pay DECIMAL(10, 2) DEFAULT 0 NOT NULL,
    
    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(payroll_run_id, staff_id)
);

-- 3. Enhance staff_credit_bills to track settlement via payroll
ALTER TABLE staff_credit_bills 
ADD COLUMN IF NOT EXISTS paid_via_payroll_run_id UUID REFERENCES payroll_runs(id);

-- 4. Triggers to maintain updated_at
CREATE OR REPLACE FUNCTION update_payroll_runs_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payroll_runs_modtime
    BEFORE UPDATE ON payroll_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_payroll_runs_modtime();

CREATE OR REPLACE FUNCTION update_payroll_records_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payroll_records_modtime
    BEFORE UPDATE ON payroll_records
    FOR EACH ROW
    EXECUTE FUNCTION update_payroll_records_modtime();

-- 5. RLS Policies
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Admins and Accountants can access payroll runs
CREATE POLICY "Enable read access for permitted roles" ON payroll_runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'manager', 'accountant', 'auditor')
        )
    );

CREATE POLICY "Enable all access for admins/accountants" ON payroll_runs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'manager', 'accountant')
        )
    );

-- Same for records, plus staff viewing own records
CREATE POLICY "Enable read access for permitted roles and own records" ON payroll_records
    FOR SELECT USING (
        auth.uid() = staff_id OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'manager', 'accountant', 'auditor')
        )
    );

CREATE POLICY "Enable all access for admins/accountants on records" ON payroll_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'manager', 'accountant')
        )
    );
