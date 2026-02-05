-- Migration to enhance attendance and payroll for enterprise HR

-- 1. Enhance staff_attendance
ALTER TABLE staff_attendance 
ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_early_exit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS clock_in_lateness_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clock_out_early_minutes INTEGER DEFAULT 0;

-- 2. Enhance staff_payroll
-- Add statutory fields and approval workflow
ALTER TABLE staff_payroll
ADD COLUMN IF NOT EXISTS housing_levy_deduction DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shif_deduction DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS nssf_deduction DECIMAL(12, 2) DEFAULT 0, -- Separating employer/employee if needed in future
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft' CHECK (approval_status IN ('draft', 'reviewed', 'approved', 'paid')),
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id), -- Renaming locally to avoid conflict with existing 'approved_by' if any
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Note: 'approved_by' might already exist as 'processed_by', we'll maintain consistency with the guide's 4-step workflow
-- Current staff_payroll has 'processed_by' and 'processed_at'
-- We will treat 'processed' as 'Paid' or 'Approved' depending on usage. 
-- For the enterprise workflow, we'll explicitly use approval_status.

-- Add indexes for filters
CREATE INDEX IF NOT EXISTS idx_staff_payroll_status ON staff_payroll(approval_status);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_late ON staff_attendance(is_late);
