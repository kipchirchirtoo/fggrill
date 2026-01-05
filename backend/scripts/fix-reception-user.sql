-- Fix reception@famousgate.com user role
-- This script checks and fixes the user role for reception@famousgate.com

-- First, check the current user details
SELECT 
    id, 
    email, 
    role, 
    branch_id,
    first_name,
    last_name,
    status
FROM users 
WHERE email = 'reception@famousgate.com';

-- If the user exists but has wrong role, update it
UPDATE users 
SET 
    role = 'receptionist',
    branch_id = COALESCE(branch_id, 1), -- Assign to branch 1 if no branch assigned
    status = 'active'
WHERE email = 'reception@famousgate.com'
AND role != 'receptionist';

-- Verify the update
SELECT 
    id, 
    email, 
    role, 
    branch_id,
    first_name,
    last_name,
    status
FROM users 
WHERE email = 'reception@famousgate.com';

-- If user doesn't exist, you need to create it in Supabase Auth first
-- Then run this insert:
/*
INSERT INTO users (id, email, first_name, last_name, role, branch_id, status)
VALUES (
    'YOUR_SUPABASE_AUTH_UUID_HERE',
    'reception@famousgate.com',
    'Reception',
    'Staff',
    'receptionist',
    1, -- Assign to appropriate branch
    'active'
)
ON CONFLICT (email) DO UPDATE SET
    role = 'receptionist',
    branch_id = 1,
    status = 'active';
*/
