-- Fix staff_payroll_items foreign key to point to payroll_records instead of staff_payroll
ALTER TABLE staff_payroll_items 
    DROP CONSTRAINT IF EXISTS staff_payroll_items_payroll_id_fkey;

ALTER TABLE staff_payroll_items 
    ADD CONSTRAINT staff_payroll_items_payroll_id_fkey 
    FOREIGN KEY (payroll_id) 
    REFERENCES payroll_records(id) 
    ON DELETE CASCADE;

-- Add index for performance if not exists
CREATE INDEX IF NOT EXISTS idx_staff_payroll_items_payroll_id ON staff_payroll_items(payroll_id);
