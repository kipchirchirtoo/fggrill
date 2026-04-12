-- Migration: Add Report to Duty functionality to staff_leave table
-- Date: 2026-04-11
-- Description: Adds fields to track when employees report back to work after leave

-- Add new columns to staff_leave table
ALTER TABLE staff_leave 
ADD COLUMN IF NOT EXISTS actual_return_date DATE,
ADD COLUMN IF NOT EXISTS reported_to_duty BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reported_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS report_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN staff_leave.actual_return_date IS 'The actual date the employee returned to work';
COMMENT ON COLUMN staff_leave.reported_to_duty IS 'Whether the employee has reported back to duty';
COMMENT ON COLUMN staff_leave.reported_at IS 'Timestamp when the employee reported to duty';
COMMENT ON COLUMN staff_leave.reported_by IS 'User ID who confirmed the report to duty (usually supervisor/manager)';
COMMENT ON COLUMN staff_leave.report_notes IS 'Optional notes about the return to duty';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_staff_leave_reported_to_duty ON staff_leave(reported_to_duty);
CREATE INDEX IF NOT EXISTS idx_staff_leave_actual_return_date ON staff_leave(actual_return_date);

-- Add constraint to ensure actual_return_date is not before start_date
ALTER TABLE staff_leave 
ADD CONSTRAINT check_actual_return_date 
CHECK (actual_return_date IS NULL OR actual_return_date >= start_date);
