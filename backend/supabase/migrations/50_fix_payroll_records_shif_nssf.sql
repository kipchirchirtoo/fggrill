-- Add shif and nssf columns to payroll_records
-- These are needed by the payroll controller when upserting records
ALTER TABLE payroll_records
ADD COLUMN IF NOT EXISTS shif DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS nssf DECIMAL(10, 2) DEFAULT 0;
