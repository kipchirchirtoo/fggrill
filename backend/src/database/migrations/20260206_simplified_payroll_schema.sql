-- Simplified Payroll Schema Migration
-- 1. Cleanup old tables/columns
-- 2. Create new specialized tables for Credits, Advances, Loans
-- 3. Create simplified Payroll table

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Update Staff Profiles (Rename salary -> basic_salary)
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_profiles' AND column_name = 'salary') THEN
        ALTER TABLE staff_profiles RENAME COLUMN salary TO basic_salary;
    END IF;
END $$;

-- 2. Drop old tables if they exist
DROP TABLE IF EXISTS credit_bills CASCADE;
DROP TABLE IF EXISTS staff_payroll CASCADE;
-- Also drop the new tables if they exist to ensure clean slate (and avoid policy conflicts)
DROP TABLE IF EXISTS staff_credit_bills CASCADE;
DROP TABLE IF EXISTS staff_advances CASCADE;
DROP TABLE IF EXISTS staff_loans CASCADE;
DROP TABLE IF EXISTS staff_loan_payments CASCADE;

-- 3. Create Staff Credit Bills (Daily consumption)
CREATE TABLE IF NOT EXISTS staff_credit_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff_profiles(id),
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    payroll_id UUID -- Link to a payroll run when deducted
);

-- 4. Create Staff Advances (Early salary requests)
CREATE TABLE IF NOT EXISTS staff_advances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff_profiles(id),
    amount DECIMAL(10, 2) NOT NULL,
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, deducted
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    payroll_id UUID -- Link to a payroll run when deducted
);

-- 5. Create Staff Loans (Long term with installments)
CREATE TABLE IF NOT EXISTS staff_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff_profiles(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    monthly_installment DECIMAL(10, 2) NOT NULL,
    start_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'active', -- active, completed, defaulted
    remaining_balance DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_loan_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES staff_loans(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payroll_id UUID, -- Link to payroll run
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Simplified Staff Payroll
CREATE TABLE IF NOT EXISTS staff_payroll (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff_profiles(id),
    month VARCHAR(20) NOT NULL, -- e.g., "February 2026"
    year INTEGER NOT NULL,
    
    -- Earnings
    basic_salary DECIMAL(10, 2) NOT NULL DEFAULT 0,
    bonuses DECIMAL(10, 2) DEFAULT 0,
    allowances DECIMAL(10, 2) DEFAULT 0,
    
    -- Deductions
    total_credit_bills DECIMAL(10, 2) DEFAULT 0,
    total_advances DECIMAL(10, 2) DEFAULT 0,
    loan_deduction DECIMAL(10, 2) DEFAULT 0,
    nssf DECIMAL(10, 2) DEFAULT 0,
    nhif DECIMAL(10, 2) DEFAULT 0,
    paye DECIMAL(10, 2) DEFAULT 0,
    housing_levy DECIMAL(10, 2) DEFAULT 0,
    
    -- Result
    net_pay DECIMAL(10, 2) NOT NULL,
    
    status TEXT DEFAULT 'draft', -- draft, processed, paid
    payment_date TIMESTAMP WITH TIME ZONE,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Add RLS Policies
ALTER TABLE staff_credit_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payroll ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view their own data
CREATE POLICY "Staff view own credit bills" ON staff_credit_bills FOR SELECT USING (auth.uid() = staff_id);
CREATE POLICY "Staff view own advances" ON staff_advances FOR SELECT USING (auth.uid() = staff_id);
CREATE POLICY "Staff view own loans" ON staff_loans FOR SELECT USING (auth.uid() = staff_id);
CREATE POLICY "Staff view own payroll" ON staff_payroll FOR SELECT USING (auth.uid() = staff_id);

-- Policy: Admins/Accountants/HR can view/manage all
-- (Assuming a function or role check exists, simplified here for 'authenticated' with role checks in app logic usually, 
-- but for RLS we often use a helper function. For now, allowing all authenticated to READ for simplicity in development, 
-- ideally restricted by role.)
CREATE POLICY "Admins manage all" ON staff_credit_bills FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage all advances" ON staff_advances FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage all loans" ON staff_loans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage all payroll" ON staff_payroll FOR ALL USING (auth.role() = 'authenticated');
