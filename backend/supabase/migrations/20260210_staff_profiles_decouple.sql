-- Migration: Decouple staff_profiles from users table
-- Staff profiles are for payroll/ID/management, NOT user accounts.
-- Staff can exist WITHOUT a system user account.

-- 1. Make user_id nullable (staff don't need user accounts)
ALTER TABLE staff_profiles ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add contact/identity fields directly on staff_profiles
ALTER TABLE staff_profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS position TEXT;

-- 3. Expand department constraint to include more departments
ALTER TABLE staff_profiles DROP CONSTRAINT IF EXISTS valid_department;
ALTER TABLE staff_profiles ADD CONSTRAINT valid_department CHECK (department IN (
  'housekeeping',
  'restaurant',
  'reception',
  'maintenance',
  'finance',
  'management',
  'security',
  'bar_lounge',
  'administration',
  'general'
));

-- 4. Expand status constraint to include 'archived'
ALTER TABLE staff_profiles DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE staff_profiles ADD CONSTRAINT valid_status CHECK (status IN ('active', 'on_leave', 'terminated', 'archived'));

-- 5. Backfill first_name/last_name from linked users where available
UPDATE staff_profiles sp
SET first_name = u.first_name,
    last_name = u.last_name,
    email = u.email,
    phone = u.phone_number
FROM users u
WHERE sp.user_id = u.id
  AND sp.first_name IS NULL;

-- 6. Drop the auto-create trigger (staff profiles are explicit, not auto-created from users)
DROP TRIGGER IF EXISTS on_staff_user_created ON users;
DROP FUNCTION IF EXISTS create_staff_profile();

-- 7. Index for national_id lookups
CREATE INDEX IF NOT EXISTS idx_staff_profiles_national_id ON staff_profiles(national_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_email ON staff_profiles(email);
