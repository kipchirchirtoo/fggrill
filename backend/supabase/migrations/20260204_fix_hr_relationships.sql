-- =====================================================
-- FIX HR MODULE RELATIONSHIPS AND MISSING TABLES
-- =====================================================
-- This migration fixes schema cache issues for HR module

-- 1. Create payroll_records as a view of staff_payroll
-- (Many systems reference payroll_records instead of staff_payroll)
CREATE OR REPLACE VIEW payroll_records AS
SELECT 
  id,
  staff_id,
  month,
  year,
  base_salary,
  overtime_hours,
  overtime_rate,
  bonuses,
  deductions,
  net_salary,
  status,
  notes,
  processed_by,
  processed_at,
  created_at,
  updated_at
FROM staff_payroll;

-- 2. Ensure staff_attendance table exists with proper structure
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL,
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_status CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave'))
);

-- 3. Add missing foreign key constraints with proper names
-- Drop existing constraints if they exist (to recreate them properly)
DO $$ 
BEGIN
  -- staff_attendance -> staff_profiles
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name = 'staff_attendance_staff_id_fkey' 
             AND table_name = 'staff_attendance') THEN
    ALTER TABLE staff_attendance DROP CONSTRAINT staff_attendance_staff_id_fkey;
  END IF;
  
  ALTER TABLE staff_attendance 
    ADD CONSTRAINT staff_attendance_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES staff_profiles(id) ON DELETE CASCADE;

  -- staff_leave -> users (approved_by)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name = 'staff_leave_approved_by_fkey' 
             AND table_name = 'staff_leave') THEN
    ALTER TABLE staff_leave DROP CONSTRAINT staff_leave_approved_by_fkey;
  END IF;
  
  ALTER TABLE staff_leave
    ADD CONSTRAINT staff_leave_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding foreign keys: %', SQLERRM;
END $$;

-- 4. Create essential indexes for performance and relationship recognition
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_id ON staff_attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_leave_staff_id ON staff_leave(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_leave_approved_by ON staff_leave(approved_by);
CREATE INDEX IF NOT EXISTS idx_staff_leave_status ON staff_leave(status);
CREATE INDEX IF NOT EXISTS idx_staff_payroll_staff_id ON staff_payroll(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON staff_profiles(user_id);

-- 5. Enable RLS on staff_attendance if not already enabled
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for staff_attendance
DROP POLICY IF EXISTS "Staff can view their own attendance" ON staff_attendance;
CREATE POLICY "Staff can view their own attendance"
  ON staff_attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_attendance.staff_id 
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Management can view all attendance" ON staff_attendance;
CREATE POLICY "Management can view all attendance"
  ON staff_attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'hr_manager', 'manager')
    )
  );

DROP POLICY IF EXISTS "Management can manage attendance" ON staff_attendance;
CREATE POLICY "Management can manage attendance"
  ON staff_attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'hr_manager', 'manager')
    )
  );

-- 7. Create departments table if it doesn't exist
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Ensure columns exist if table was created without them
DO $$ 
BEGIN
  -- Add description if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'departments' 
                 AND column_name = 'description') THEN
    ALTER TABLE departments ADD COLUMN description TEXT;
  END IF;
  
  -- Add manager_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'departments' 
                 AND column_name = 'manager_id') THEN
    ALTER TABLE departments ADD COLUMN manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Add updated_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'departments' 
                 AND column_name = 'updated_at') THEN
    ALTER TABLE departments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add UNIQUE constraint to name if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE table_name = 'departments' 
                 AND constraint_type = 'UNIQUE'
                 AND constraint_name = 'departments_name_key') THEN
    ALTER TABLE departments ADD CONSTRAINT departments_name_key UNIQUE (name);
  END IF;
END $$;

-- 8. Add index for departments -> users relationship
CREATE INDEX IF NOT EXISTS idx_departments_manager_id ON departments(manager_id);

-- 9. Seed default departments if table is empty
INSERT INTO departments (name, description) VALUES
  ('Management', 'Executive and management team'),
  ('Finance', 'Accounting and financial operations'),
  ('Restaurant', 'Restaurant and food service'),
  ('Housekeeping', 'Cleaning and maintenance'),
  ('Reception', 'Front desk and customer service'),
  ('Maintenance', 'Facility maintenance and repairs'),
  ('Kitchen', 'Food preparation and cooking'),
  ('Bar', 'Bar and beverage service')
ON CONFLICT (name) DO NOTHING;

-- 10. Enable RLS on departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view departments" ON departments;
CREATE POLICY "Everyone can view departments"
  ON departments
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Management can manage departments" ON departments;
CREATE POLICY "Management can manage departments"
  ON departments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'hr_manager')
    )
  );

-- 11. Refresh schema cache (force Supabase to recognize relationships)
NOTIFY pgrst, 'reload schema';
