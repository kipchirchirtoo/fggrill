-- Migration: Auto-approve all pending HR adjustments
-- Description: Approves all pending adjustments so they are included in payroll calculations
-- Date: 2026-04-15

-- Update all pending adjustments to approved status
UPDATE staff_payroll_adjustments
SET 
    status = 'approved',
    approved_at = NOW(),
    approved_by = created_by  -- Use the creator as approver since these are HR/Auditor adjustments
WHERE 
    status = 'pending'
    AND created_by IS NOT NULL;

-- Log the migration
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM staff_payroll_adjustments
    WHERE status = 'approved' AND approved_at >= NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Auto-approved % pending adjustments', updated_count;
END $$;
