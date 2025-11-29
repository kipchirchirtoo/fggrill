-- Add Bartender Demo Users
-- Famous Gate Hotel

-- Insert bartender users into custom users table
INSERT INTO users (id, email, first_name, last_name, role, department, branch_id, created_at)
VALUES 
  (gen_random_uuid(), 'bartender@famousgate.com', 'Kevin', 'Omondi', 'bartender', 'Bar', 1, NOW()),
  (gen_random_uuid(), 'bar.kericho@famousgate.com', 'Brian', 'Kiprop', 'bartender', 'Bar', 3, NOW()),
  (gen_random_uuid(), 'bar.litein@famousgate.com', 'Joyce', 'Cherop', 'bartender', 'Bar', 6, NOW())
ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  role = EXCLUDED.role,
  department = EXCLUDED.department,
  branch_id = EXCLUDED.branch_id;

SELECT 'Bartender users added successfully' AS status;
