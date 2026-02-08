-- Add missing columns to staff_payroll table
ALTER TABLE staff_payroll 
ADD COLUMN IF NOT EXISTS total_deductions DECIMAL(10, 2) DEFAULT 0;

-- Ensure net_pay exists (just in case)
ALTER TABLE staff_payroll 
ADD COLUMN IF NOT EXISTS net_pay DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Ensure all other columns from the simple controller exist
ALTER TABLE staff_payroll 
ADD COLUMN IF NOT EXISTS total_credit_bills DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_advances DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS loan_deduction DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS nssf DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS nhif DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS paye DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS housing_levy DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(10, 2) DEFAULT 0;

-- Add unique constraint for upsert to work
ALTER TABLE staff_payroll 
DROP CONSTRAINT IF EXISTS staff_payroll_staff_id_month_year_key;

ALTER TABLE staff_payroll 
ADD CONSTRAINT staff_payroll_staff_id_month_year_key UNIQUE (staff_id, month, year);
