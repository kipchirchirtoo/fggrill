-- ============================================================
-- Kyogong - DEMO USERS
-- Run this in Supabase SQL Editor to create demo accounts
-- ============================================================

-- NOTE: Passwords are hashed using bcrypt
-- All demo passwords follow the pattern: [role]123
-- e.g., admin123, manager123, central123, store123

-- First, ensure we have the branches set up
INSERT INTO branches (name, code, location, is_main_branch, is_central_warehouse, can_create_items, can_dispatch, status)
VALUES 
  ('Kyogong Kericho (Central)', 'KER', 'Kericho Town', TRUE, TRUE, TRUE, TRUE, 'active'),
  ('Kyogong Bomet', 'BOM', 'Bomet Town', FALSE, FALSE, FALSE, FALSE, 'active'),
  ('Kyogong Narok', 'NAR', 'Narok Town', FALSE, FALSE, FALSE, FALSE, 'active')
ON CONFLICT DO NOTHING;

-- Demo Users
-- Note: You need to create these users in Supabase Auth first, then insert here
-- The password hash below is for 'admin123' - you should use Supabase Auth UI to create users

-- To create users properly:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" for each demo account
-- 3. Use the emails and passwords listed below
-- 4. Then run the INSERT statements to add user metadata

/*
DEMO ACCOUNTS TO CREATE IN SUPABASE AUTH:

1. Super Admin
   Email: admin@kyogong.com
   Password: admin123
   
2. Manager  
   Email: manager@kyogong.com
   Password: manager123
   
3. Central Storekeeper
   Email: central@kyogong.com
   Password: central123
   
4. Branch Storekeeper
   Email: storekeeper@kyogong.com
   Password: store123
   
5. Receptionist
   Email: reception@kyogong.com
   Password: reception123
   
6. Housekeeping
   Email: housekeeping@kyogong.com
   Password: house123
   
7. Restaurant
   Email: restaurant@kyogong.com
   Password: rest123
   
8. Accountant
   Email: accountant@kyogong.com
   Password: account123
*/

-- After creating users in Supabase Auth, get their UUIDs and insert metadata:
-- Replace 'YOUR_USER_UUID' with actual UUIDs from Supabase Auth

-- Example user metadata inserts (uncomment and modify after creating users):
/*
INSERT INTO users (id, email, full_name, role, branch_id, status, created_at)
SELECT 
  auth.uid() as id,
  'admin@kyogong.com' as email,
  'System Administrator' as full_name,
  'super_admin' as role,
  NULL as branch_id,
  'active' as status,
  NOW() as created_at
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@kyogong.com');
*/

-- ============================================================
-- QUICK SETUP: Create users table extension if needed
-- ============================================================

-- Ensure users table has branch_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES branches(id);

-- ============================================================
-- ROLE DEFINITIONS
-- ============================================================

/*
ROLE PERMISSIONS:

super_admin:
  - Full system access
  - All modules enabled
  - Can manage all branches

manager:
  - Central warehouse access
  - Can create/edit items
  - Can approve requests
  - Can dispatch to branches

storekeeper (Central):
  - Assigned to central warehouse (is_central_warehouse = true)
  - Can create/edit master catalog
  - Can approve stock requests
  - Can create dispatch notes

storekeeper (Branch):
  - Assigned to specific branch
  - Can view master catalog (read-only)
  - Can create stock requests
  - Can receive dispatches
  - Can manage branch stock

receptionist:
  - Front desk operations
  - Room bookings
  - Guest check-in/out

housekeeping:
  - Room status management
  - Can request supplies (via stock request)

restaurant:
  - POS operations
  - Can request supplies (via stock request)

accountant:
  - Financial reports
  - View-only for most modules
*/

-- ============================================================
-- DONE!
-- ============================================================
