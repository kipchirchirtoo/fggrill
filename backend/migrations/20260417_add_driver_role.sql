-- Migration: Add Driver Role
-- Description: Creates driver role for mobile app access with GPS tracking
-- Date: 2026-04-17

-- =====================================================
-- 1. ADD DRIVER ROLE TO ROLES TABLE
-- =====================================================

-- Insert driver role if it doesn't exist
INSERT INTO roles (name, description, created_at, updated_at)
SELECT 
  'driver',
  'Driver - Delivery personnel with GPS tracking',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'driver'
);

-- =====================================================
-- 2. ADD DRIVER ROLE PERMISSIONS
-- =====================================================

-- Get the driver role id
DO $$
DECLARE
  v_driver_role_id UUID;
BEGIN
  SELECT id INTO v_driver_role_id FROM roles WHERE name = 'driver';
  
  IF v_driver_role_id IS NOT NULL THEN
    -- Grant basic permissions for drivers
    INSERT INTO role_permissions (role_id, permission, created_at)
    SELECT v_driver_role_id, permission, NOW()
    FROM (VALUES
      ('view_dispatches'),
      ('update_dispatch_location'),
      ('verify_driver_otp'),
      ('view_own_deliveries'),
      ('update_delivery_status')
    ) AS perms(permission)
    WHERE NOT EXISTS (
      SELECT 1 FROM role_permissions 
      WHERE role_id = v_driver_role_id 
      AND permission = perms.permission
    );
  END IF;
END $$;

-- =====================================================
-- 3. CREATE SAMPLE DRIVER USER (OPTIONAL)
-- =====================================================

-- Create a sample driver user for testing
-- Password: Driver@123 (hashed with bcrypt)
INSERT INTO users (
  id,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  phone,
  is_active,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  'driver@famousgate.com',
  '$2b$10$YourHashedPasswordHere', -- Replace with actual hashed password
  'John',
  'Driver',
  'driver',
  '+254700000001',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'driver@famousgate.com'
);

-- =====================================================
-- 4. UPDATE EXISTING DRIVERS TABLE
-- =====================================================

-- Add user_id column to drivers table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE drivers 
    ADD COLUMN user_id UUID REFERENCES users(id);
    
    CREATE INDEX idx_drivers_user_id ON drivers(user_id);
  END IF;
END $$;

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON COLUMN drivers.user_id IS 'Link to user account for mobile app access';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- To create a driver user manually, use:
-- INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active)
-- VALUES ('driver@example.com', 'hashed_password', 'Driver', 'Name', 'driver', '+254700000000', true);
