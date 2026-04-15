-- =====================================================
-- PHASE 2 FIX #3: Add branch_id to staff_profiles
-- Date: 2026-04-15
-- Purpose: Enable branch isolation for staff records
-- =====================================================

-- Add branch_id column to staff_profiles
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_staff_profiles_branch_id ON staff_profiles(branch_id);

-- Add comment for documentation
COMMENT ON COLUMN staff_profiles.branch_id IS 'Branch assignment for staff member - enables multi-branch isolation';

-- Update RLS policies to include branch isolation
-- Drop existing policies that don't consider branch_id
DROP POLICY IF EXISTS "Staff can view their own profile" ON staff_profiles;
DROP POLICY IF EXISTS "Management can view all staff profiles" ON staff_profiles;
DROP POLICY IF EXISTS "Management can manage staff profiles" ON staff_profiles;

-- Recreate policies with branch isolation
CREATE POLICY "Staff can view their own profile"
  ON staff_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Management can view staff in their branch"
  ON staff_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_profiles.branch_id
        OR staff_profiles.branch_id IS NULL
      )
    )
  );

CREATE POLICY "Management can manage staff in their branch"
  ON staff_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_profiles.branch_id
        OR staff_profiles.branch_id IS NULL
      )
    )
  );

-- Add branch_id to related tables for consistency
ALTER TABLE staff_schedules 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

ALTER TABLE staff_leave 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

ALTER TABLE staff_payroll 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

ALTER TABLE staff_performance 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

-- Add indexes for related tables
CREATE INDEX IF NOT EXISTS idx_staff_schedules_branch_id ON staff_schedules(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_leave_branch_id ON staff_leave(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_payroll_branch_id ON staff_payroll(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_performance_branch_id ON staff_performance(branch_id);

-- Add comments
COMMENT ON COLUMN staff_schedules.branch_id IS 'Branch where schedule applies';
COMMENT ON COLUMN staff_leave.branch_id IS 'Branch where leave is recorded';
COMMENT ON COLUMN staff_payroll.branch_id IS 'Branch for payroll processing';
COMMENT ON COLUMN staff_performance.branch_id IS 'Branch where performance review conducted';

-- Update RLS policies for related tables to include branch isolation
-- Staff Schedules
DROP POLICY IF EXISTS "Staff can view their own schedule" ON staff_schedules;
DROP POLICY IF EXISTS "Management can view all schedules" ON staff_schedules;
DROP POLICY IF EXISTS "Management can manage schedules" ON staff_schedules;

CREATE POLICY "Staff can view their own schedule"
  ON staff_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view schedules in their branch"
  ON staff_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_schedules.branch_id
        OR staff_schedules.branch_id IS NULL
      )
    )
  );

CREATE POLICY "Management can manage schedules in their branch"
  ON staff_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_schedules.branch_id
        OR staff_schedules.branch_id IS NULL
      )
    )
  );

-- Staff Leave
DROP POLICY IF EXISTS "Staff can view their own leave" ON staff_leave;
DROP POLICY IF EXISTS "Staff can request leave" ON staff_leave;
DROP POLICY IF EXISTS "Management can view all leave" ON staff_leave;
DROP POLICY IF EXISTS "Management can manage leave" ON staff_leave;

CREATE POLICY "Staff can view their own leave"
  ON staff_leave
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can request leave"
  ON staff_leave
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view leave in their branch"
  ON staff_leave
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_leave.branch_id
        OR staff_leave.branch_id IS NULL
      )
    )
  );

CREATE POLICY "Management can manage leave in their branch"
  ON staff_leave
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_leave.branch_id
        OR staff_leave.branch_id IS NULL
      )
    )
  );

-- Staff Payroll
DROP POLICY IF EXISTS "Staff can view their own payroll" ON staff_payroll;
DROP POLICY IF EXISTS "Management can view all payroll" ON staff_payroll;
DROP POLICY IF EXISTS "Management can manage payroll" ON staff_payroll;

CREATE POLICY "Staff can view their own payroll"
  ON staff_payroll
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view payroll in their branch"
  ON staff_payroll
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager', 'accountant')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_payroll.branch_id
        OR staff_payroll.branch_id IS NULL
      )
    )
  );

CREATE POLICY "Management can manage payroll in their branch"
  ON staff_payroll
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager', 'accountant')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_payroll.branch_id
        OR staff_payroll.branch_id IS NULL
      )
    )
  );

-- Staff Performance
DROP POLICY IF EXISTS "Staff can view their own performance" ON staff_performance;
DROP POLICY IF EXISTS "Management can view all performance" ON staff_performance;
DROP POLICY IF EXISTS "Management can manage performance" ON staff_performance;

CREATE POLICY "Staff can view their own performance"
  ON staff_performance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view performance in their branch"
  ON staff_performance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_performance.branch_id
        OR staff_performance.branch_id IS NULL
      )
    )
  );

CREATE POLICY "Management can manage performance in their branch"
  ON staff_performance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'branch_manager')
      AND (
        role = 'super_admin' 
        OR branch_id = staff_performance.branch_id
        OR staff_performance.branch_id IS NULL
      )
    )
  );

-- Create trigger to auto-populate branch_id from staff_profiles
CREATE OR REPLACE FUNCTION populate_staff_related_branch_id()
RETURNS TRIGGER AS $
BEGIN
  -- Auto-populate branch_id from staff_profiles if not provided
  IF NEW.branch_id IS NULL AND NEW.staff_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id
    FROM staff_profiles
    WHERE id = NEW.staff_id;
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply trigger to related tables
DROP TRIGGER IF EXISTS populate_staff_schedule_branch_id ON staff_schedules;
CREATE TRIGGER populate_staff_schedule_branch_id
  BEFORE INSERT OR UPDATE ON staff_schedules
  FOR EACH ROW
  EXECUTE FUNCTION populate_staff_related_branch_id();

DROP TRIGGER IF EXISTS populate_staff_leave_branch_id ON staff_leave;
CREATE TRIGGER populate_staff_leave_branch_id
  BEFORE INSERT OR UPDATE ON staff_leave
  FOR EACH ROW
  EXECUTE FUNCTION populate_staff_related_branch_id();

DROP TRIGGER IF EXISTS populate_staff_payroll_branch_id ON staff_payroll;
CREATE TRIGGER populate_staff_payroll_branch_id
  BEFORE INSERT OR UPDATE ON staff_payroll
  FOR EACH ROW
  EXECUTE FUNCTION populate_staff_related_branch_id();

DROP TRIGGER IF EXISTS populate_staff_performance_branch_id ON staff_performance;
CREATE TRIGGER populate_staff_performance_branch_id
  BEFORE INSERT OR UPDATE ON staff_performance
  FOR EACH ROW
  EXECUTE FUNCTION populate_staff_related_branch_id();

-- Log migration completion
DO $
BEGIN
  RAISE NOTICE 'Migration 20260415_add_branch_id_to_staff_profiles completed successfully';
  RAISE NOTICE 'Added branch_id to: staff_profiles, staff_schedules, staff_leave, staff_payroll, staff_performance';
  RAISE NOTICE 'Updated RLS policies for branch isolation';
  RAISE NOTICE 'Created auto-population triggers for related tables';
  RAISE NOTICE 'NEXT STEP: Run backfill script to populate NULL branch_id values';
END $;
