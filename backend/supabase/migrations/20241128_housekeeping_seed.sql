-- =====================================================
-- HOUSEKEEPING SEED DATA
-- Sample rooms, staff, tasks for testing
-- =====================================================

-- Get first branch ID for reference
DO $$
DECLARE
  v_branch_id INTEGER;
  v_room_type_id UUID;
  v_user_id UUID;
  v_staff_id UUID;
  v_room_id UUID;
BEGIN
  -- Get first branch
  SELECT id INTO v_branch_id FROM branches LIMIT 1;
  
  IF v_branch_id IS NULL THEN
    RAISE NOTICE 'No branch found, using NULL for branch_id';
  END IF;
  
  RAISE NOTICE 'Using branch_id: %', v_branch_id;
END $$;

-- =====================================================
-- 1. CREATE ROOM TYPES IF NOT EXISTS
-- =====================================================

INSERT INTO room_types (id, name, description, base_price, max_occupancy)
VALUES 
  (gen_random_uuid(), 'Standard', 'Comfortable standard room', 3500, 2),
  (gen_random_uuid(), 'Deluxe', 'Premium room with extra space', 7500, 2),
  (gen_random_uuid(), 'Suite', 'Luxury suite with living area', 12000, 4)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. CREATE SAMPLE ROOMS (60 rooms across 5 floors)
-- =====================================================

-- Floor 1 (Rooms 101-112)
INSERT INTO rooms (room_number, type_id, floor, status, hk_status, cleaning_priority, cleaning_credits, branch_id)
SELECT 
  '1' || LPAD(n::TEXT, 2, '0') AS room_number,
  (SELECT id FROM room_types ORDER BY random() LIMIT 1) AS type_id,
  1 AS floor,
  CASE WHEN random() < 0.7 THEN 'available' ELSE 'occupied' END::room_status AS status,
  CASE 
    WHEN random() < 0.3 THEN 'vacant_clean'
    WHEN random() < 0.5 THEN 'vacant_dirty'
    WHEN random() < 0.7 THEN 'occupied_clean'
    WHEN random() < 0.85 THEN 'checkout'
    ELSE 'stay_over'
  END::hk_room_status AS hk_status,
  CASE WHEN random() < 0.1 THEN 'urgent' WHEN random() < 0.3 THEN 'high' ELSE 'normal' END::hk_priority AS cleaning_priority,
  CASE WHEN random() < 0.3 THEN 1.5 ELSE 1.0 END AS cleaning_credits,
  (SELECT id FROM branches LIMIT 1) AS branch_id
FROM generate_series(1, 12) AS n
ON CONFLICT (room_number) DO NOTHING;

-- Floor 2 (Rooms 201-212)
INSERT INTO rooms (room_number, type_id, floor, status, hk_status, cleaning_priority, cleaning_credits, branch_id)
SELECT 
  '2' || LPAD(n::TEXT, 2, '0') AS room_number,
  (SELECT id FROM room_types ORDER BY random() LIMIT 1) AS type_id,
  2 AS floor,
  CASE WHEN random() < 0.7 THEN 'available' ELSE 'occupied' END::room_status AS status,
  CASE 
    WHEN random() < 0.3 THEN 'vacant_clean'
    WHEN random() < 0.5 THEN 'vacant_dirty'
    WHEN random() < 0.7 THEN 'occupied_clean'
    WHEN random() < 0.85 THEN 'checkout'
    ELSE 'stay_over'
  END::hk_room_status AS hk_status,
  CASE WHEN random() < 0.1 THEN 'urgent' WHEN random() < 0.3 THEN 'high' ELSE 'normal' END::hk_priority AS cleaning_priority,
  CASE WHEN random() < 0.3 THEN 1.5 ELSE 1.0 END AS cleaning_credits,
  (SELECT id FROM branches LIMIT 1) AS branch_id
FROM generate_series(1, 12) AS n
ON CONFLICT (room_number) DO NOTHING;

-- Floor 3 (Rooms 301-312)
INSERT INTO rooms (room_number, type_id, floor, status, hk_status, cleaning_priority, cleaning_credits, branch_id)
SELECT 
  '3' || LPAD(n::TEXT, 2, '0') AS room_number,
  (SELECT id FROM room_types ORDER BY random() LIMIT 1) AS type_id,
  3 AS floor,
  CASE WHEN random() < 0.7 THEN 'available' ELSE 'occupied' END::room_status AS status,
  CASE 
    WHEN random() < 0.3 THEN 'vacant_clean'
    WHEN random() < 0.5 THEN 'vacant_dirty'
    WHEN random() < 0.7 THEN 'occupied_clean'
    WHEN random() < 0.85 THEN 'checkout'
    ELSE 'stay_over'
  END::hk_room_status AS hk_status,
  CASE WHEN random() < 0.1 THEN 'urgent' WHEN random() < 0.3 THEN 'high' ELSE 'normal' END::hk_priority AS cleaning_priority,
  CASE WHEN random() < 0.3 THEN 1.5 ELSE 1.0 END AS cleaning_credits,
  (SELECT id FROM branches LIMIT 1) AS branch_id
FROM generate_series(1, 12) AS n
ON CONFLICT (room_number) DO NOTHING;

-- Floor 4 (Rooms 401-412) - Executive floor
INSERT INTO rooms (room_number, type_id, floor, status, hk_status, cleaning_priority, is_vip, cleaning_credits, branch_id)
SELECT 
  '4' || LPAD(n::TEXT, 2, '0') AS room_number,
  (SELECT id FROM room_types WHERE name::text LIKE '%Suite%' OR name::text LIKE '%Deluxe%' ORDER BY random() LIMIT 1) AS type_id,
  4 AS floor,
  CASE WHEN random() < 0.6 THEN 'available' ELSE 'occupied' END::room_status AS status,
  CASE 
    WHEN random() < 0.4 THEN 'vacant_clean'
    WHEN random() < 0.6 THEN 'vacant_dirty'
    ELSE 'occupied_clean'
  END::hk_room_status AS hk_status,
  CASE WHEN random() < 0.3 THEN 'high' ELSE 'normal' END::hk_priority AS cleaning_priority,
  TRUE AS is_vip,
  2.0 AS cleaning_credits,
  (SELECT id FROM branches LIMIT 1) AS branch_id
FROM generate_series(1, 12) AS n
ON CONFLICT (room_number) DO NOTHING;

-- Floor 5 (Rooms 501-512)
INSERT INTO rooms (room_number, type_id, floor, status, hk_status, cleaning_priority, cleaning_credits, branch_id)
SELECT 
  '5' || LPAD(n::TEXT, 2, '0') AS room_number,
  (SELECT id FROM room_types ORDER BY random() LIMIT 1) AS type_id,
  5 AS floor,
  CASE WHEN random() < 0.7 THEN 'available' ELSE 'occupied' END::room_status AS status,
  CASE 
    WHEN random() < 0.3 THEN 'vacant_clean'
    WHEN random() < 0.5 THEN 'vacant_dirty'
    WHEN random() < 0.7 THEN 'occupied_clean'
    WHEN random() < 0.85 THEN 'checkout'
    ELSE 'stay_over'
  END::hk_room_status AS hk_status,
  CASE WHEN random() < 0.1 THEN 'urgent' WHEN random() < 0.3 THEN 'high' ELSE 'normal' END::hk_priority AS cleaning_priority,
  CASE WHEN random() < 0.3 THEN 1.5 ELSE 1.0 END AS cleaning_credits,
  (SELECT id FROM branches LIMIT 1) AS branch_id
FROM generate_series(1, 12) AS n
ON CONFLICT (room_number) DO NOTHING;

-- =====================================================
-- 3. CREATE HOUSEKEEPING USERS
-- =====================================================

-- Create housekeeping supervisor user
INSERT INTO users (id, email, first_name, last_name, role, status, branch_id)
VALUES 
  (gen_random_uuid(), 'hk.supervisor@fghotel.com', 'Sarah', 'Kimani', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1)),
  (gen_random_uuid(), 'hk.supervisor2@fghotel.com', 'James', 'Ochieng', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1))
ON CONFLICT (email) DO NOTHING;

-- Create room attendant users
INSERT INTO users (id, email, first_name, last_name, role, status, branch_id)
VALUES 
  (gen_random_uuid(), 'attendant.mary@fghotel.com', 'Mary', 'Wanjiku', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1)),
  (gen_random_uuid(), 'attendant.peter@fghotel.com', 'Peter', 'Mwangi', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1)),
  (gen_random_uuid(), 'attendant.grace@fghotel.com', 'Grace', 'Akinyi', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1)),
  (gen_random_uuid(), 'attendant.john@fghotel.com', 'John', 'Kamau', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1)),
  (gen_random_uuid(), 'attendant.faith@fghotel.com', 'Faith', 'Njeri', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1)),
  (gen_random_uuid(), 'attendant.daniel@fghotel.com', 'Daniel', 'Kiprop', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1)),
  (gen_random_uuid(), 'attendant.lucy@fghotel.com', 'Lucy', 'Chebet', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1)),
  (gen_random_uuid(), 'attendant.brian@fghotel.com', 'Brian', 'Otieno', 'housekeeping', 'active', (SELECT id FROM branches LIMIT 1))
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 4. CREATE STAFF PROFILES
-- =====================================================

-- Supervisors
INSERT INTO hk_staff_profiles (user_id, staff_code, designation, assigned_floors, max_rooms_per_shift, max_credits_per_shift, quality_score, is_available)
SELECT 
  id,
  'HK-SUP-' || ROW_NUMBER() OVER () AS staff_code,
  'Floor Supervisor' AS designation,
  ARRAY[1,2,3,4,5] AS assigned_floors,
  0 AS max_rooms_per_shift,
  0 AS max_credits_per_shift,
  4.5 + (random() * 0.5) AS quality_score,
  TRUE AS is_available
FROM users 
WHERE email LIKE 'hk.supervisor%'
ON CONFLICT (user_id) DO NOTHING;

-- Room Attendants
INSERT INTO hk_staff_profiles (user_id, staff_code, designation, assigned_floors, max_rooms_per_shift, max_credits_per_shift, quality_score, is_available)
SELECT 
  id,
  'HK-RA-' || LPAD(ROW_NUMBER() OVER ()::TEXT, 3, '0') AS staff_code,
  'Room Attendant' AS designation,
  CASE 
    WHEN ROW_NUMBER() OVER () <= 2 THEN ARRAY[1,2]
    WHEN ROW_NUMBER() OVER () <= 4 THEN ARRAY[2,3]
    WHEN ROW_NUMBER() OVER () <= 6 THEN ARRAY[3,4]
    ELSE ARRAY[4,5]
  END AS assigned_floors,
  14 AS max_rooms_per_shift,
  14.0 AS max_credits_per_shift,
  3.5 + (random() * 1.5) AS quality_score,
  CASE WHEN random() < 0.8 THEN TRUE ELSE FALSE END AS is_available
FROM users 
WHERE email LIKE 'attendant.%'
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- 5. CREATE SAMPLE TASKS
-- =====================================================

-- Generate checkout clean tasks for rooms marked as checkout
INSERT INTO hk_tasks (room_id, room_number, task_type, priority, status, credit_value, estimated_duration_minutes, branch_id)
SELECT 
  r.id AS room_id,
  r.room_number,
  'checkout_full_clean'::hk_task_type AS task_type,
  CASE 
    WHEN r.is_vip THEN 'high'
    WHEN r.cleaning_priority = 'urgent' THEN 'urgent'
    ELSE 'normal'
  END::hk_priority AS priority,
  'pending'::hk_task_status AS status,
  r.cleaning_credits AS credit_value,
  CASE WHEN r.is_vip THEN 60 ELSE 45 END AS estimated_duration_minutes,
  r.branch_id
FROM rooms r
WHERE r.hk_status = 'checkout'
ON CONFLICT DO NOTHING;

-- Generate stay-over tasks
INSERT INTO hk_tasks (room_id, room_number, task_type, priority, status, credit_value, estimated_duration_minutes, branch_id)
SELECT 
  r.id AS room_id,
  r.room_number,
  'stay_over_service'::hk_task_type AS task_type,
  'normal'::hk_priority AS priority,
  'pending'::hk_task_status AS status,
  0.5 AS credit_value,
  20 AS estimated_duration_minutes,
  r.branch_id
FROM rooms r
WHERE r.hk_status = 'stay_over'
ON CONFLICT DO NOTHING;

-- Generate dirty room tasks
INSERT INTO hk_tasks (room_id, room_number, task_type, priority, status, credit_value, estimated_duration_minutes, branch_id)
SELECT 
  r.id AS room_id,
  r.room_number,
  'checkout_full_clean'::hk_task_type AS task_type,
  r.cleaning_priority AS priority,
  'pending'::hk_task_status AS status,
  r.cleaning_credits AS credit_value,
  45 AS estimated_duration_minutes,
  r.branch_id
FROM rooms r
WHERE r.hk_status = 'vacant_dirty'
ON CONFLICT DO NOTHING;

-- Assign some tasks to staff
UPDATE hk_tasks 
SET 
  assigned_to = (SELECT id FROM hk_staff_profiles WHERE designation = 'Room Attendant' AND is_available = TRUE ORDER BY random() LIMIT 1),
  assigned_at = NOW() - INTERVAL '4 hours',
  status = 'assigned'
WHERE status = 'pending' 
  AND random() < 0.7;

-- Set some tasks as in progress
UPDATE hk_tasks
SET 
  status = 'in_progress',
  started_at = NOW() - INTERVAL '2 hours'
WHERE status = 'assigned'
  AND random() < 0.6;

-- Set some tasks as completed
UPDATE hk_tasks
SET 
  status = 'completed',
  completed_at = NOW() - INTERVAL '1 hour',
  completed_by = assigned_to,
  actual_duration_minutes = 30 + (random() * 20)::INTEGER
WHERE status = 'in_progress'
  AND random() < 0.5;

-- =====================================================
-- 6. ADD SAMPLE INSPECTION DATA
-- =====================================================

-- Create some completed inspections
INSERT INTO hk_inspections (room_id, task_id, inspector_id, overall_score, result, checklist_results, branch_id)
SELECT 
  t.room_id,
  t.id AS task_id,
  (SELECT id FROM hk_staff_profiles WHERE designation = 'Floor Supervisor' LIMIT 1) AS inspector_id,
  CASE WHEN random() < 0.85 THEN 4.0 + random() ELSE 2.5 + random() * 1.5 END AS overall_score,
  CASE WHEN random() < 0.85 THEN 'passed' ELSE 'failed' END::hk_inspection_result AS result,
  jsonb_build_object(
    'bedroom', 3.5 + random() * 1.5,
    'bathroom', 3.5 + random() * 1.5,
    'entrance', 4.0 + random(),
    'amenities', 4.0 + random(),
    'overall_presentation', 3.5 + random() * 1.5
  ) AS checklist_results,
  t.branch_id
FROM hk_tasks t
WHERE t.status IN ('completed', 'inspection_passed')
LIMIT 20;

-- =====================================================
-- 7. ADD SAMPLE LOST & FOUND ITEMS
-- =====================================================

INSERT INTO hk_lost_found (item_name, description, category, found_location, room_id, status, storage_location, branch_id, found_by)
SELECT 
  item_desc,
  item_desc,
  category,
  'Room ' || room_num,
  (SELECT id FROM rooms WHERE room_number = room_num LIMIT 1),
  CASE WHEN random() < 0.7 THEN 'stored' ELSE 'found' END,
  'Lost & Found Cabinet',
  (SELECT id FROM branches LIMIT 1),
  (SELECT id FROM hk_staff_profiles LIMIT 1)
FROM (VALUES 
  ('Black leather wallet', 'valuables', '201'),
  ('iPhone charger cable', 'electronics', '305'),
  ('Silver earrings', 'jewelry', '402'),
  ('Blue umbrella', 'personal_items', '108'),
  ('Reading glasses', 'personal_items', '312'),
  ('Children''s toy car', 'personal_items', '503'),
  ('Gold watch', 'valuables', '401'),
  ('Laptop sleeve', 'electronics', '205')
) AS items(item_desc, category, room_num);

-- =====================================================
-- 8. ADD SAMPLE GUEST SERVICE REQUESTS
-- =====================================================

INSERT INTO hk_guest_service_requests (room_id, room_number, guest_name, request_type, details, priority, status, branch_id)
SELECT 
  r.id,
  r.room_number,
  'Guest in ' || r.room_number,
  req_type,
  details::jsonb,
  CASE WHEN random() < 0.2 THEN 'high'::hk_priority ELSE 'normal'::hk_priority END,
  CASE WHEN random() < 0.6 THEN 'pending' ELSE 'completed' END,
  r.branch_id
FROM rooms r
CROSS JOIN (VALUES 
  ('extra_amenities', '{"items": ["extra towels", "pillows"]}'),
  ('clean_now', '{"reason": "Spill in room"}'),
  ('timing_preference', '{"preferred_time": "14:00-16:00"}'),
  ('extra_amenities', '{"items": ["iron", "ironing board"]}')
) AS reqs(req_type, details)
WHERE random() < 0.15
LIMIT 10;

-- =====================================================
-- 9. ADD SAMPLE MAINTENANCE REQUESTS
-- =====================================================

INSERT INTO hk_maintenance_requests (room_id, reported_by, issue_type, description, priority, status)
SELECT 
  r.id,
  (SELECT id FROM hk_staff_profiles WHERE designation = 'Room Attendant' ORDER BY random() LIMIT 1),
  category,
  description,
  CASE WHEN random() < 0.3 THEN 'high'::hk_priority ELSE 'normal'::hk_priority END,
  CASE WHEN random() < 0.5 THEN 'submitted' ELSE 'in_progress' END
FROM rooms r
CROSS JOIN (VALUES 
  ('plumbing', 'Slow drain in bathroom sink'),
  ('electrical', 'Bedside lamp not working'),
  ('hvac', 'AC making noise'),
  ('fixtures', 'Loose door handle')
) AS issues(category, description)
WHERE random() < 0.1
LIMIT 8;

-- =====================================================
-- 10. ADD SAMPLE POINTS FOR GAMIFICATION
-- =====================================================

INSERT INTO hk_staff_points (staff_id, points, source, description, period_week, period_month, period_year)
SELECT 
  s.id,
  FLOOR(random() * 50 + 10)::INTEGER AS points,
  CASE WHEN random() < 0.7 THEN 'task_completion' ELSE 'inspection_pass' END AS source,
  'Daily task points' AS description,
  EXTRACT(WEEK FROM CURRENT_DATE)::INTEGER AS period_week,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS period_month,
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS period_year
FROM hk_staff_profiles s
CROSS JOIN generate_series(1, 5)
WHERE s.designation = 'Room Attendant';

-- Award some achievements
INSERT INTO hk_staff_achievements (staff_id, achievement_id, notes)
SELECT 
  s.id AS staff_id,
  a.id AS achievement_id,
  'Earned through excellent performance' AS notes
FROM hk_staff_profiles s
CROSS JOIN hk_achievements a
WHERE s.designation = 'Room Attendant'
  AND random() < 0.15
LIMIT 15;

-- =====================================================
-- 11. UPDATE STAFF SCHEDULES FOR TODAY
-- =====================================================

INSERT INTO hk_staff_schedules (staff_id, shift_id, schedule_date, assigned_floors, status)
SELECT 
  s.id AS staff_id,
  sh.id AS shift_id,
  CURRENT_DATE AS schedule_date,
  s.assigned_floors,
  CASE WHEN random() < 0.9 THEN 'checked_in' ELSE 'scheduled' END AS status
FROM hk_staff_profiles s
CROSS JOIN hk_shift_definitions sh
WHERE s.designation = 'Room Attendant'
  AND sh.name = 'Morning Shift'
ON CONFLICT DO NOTHING;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
DECLARE
  room_count INTEGER;
  staff_count INTEGER;
  task_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO room_count FROM rooms;
  SELECT COUNT(*) INTO staff_count FROM hk_staff_profiles;
  SELECT COUNT(*) INTO task_count FROM hk_tasks;
  
  RAISE NOTICE '=== SEED DATA SUMMARY ===';
  RAISE NOTICE 'Rooms created: %', room_count;
  RAISE NOTICE 'Staff profiles: %', staff_count;
  RAISE NOTICE 'Tasks created: %', task_count;
  RAISE NOTICE '========================';
END $$;
