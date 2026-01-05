-- Housekeeping Module Schema

-- DROP existing tables to ensure clean state (since schema was mismatched)
-- DROP existing tables to ensure clean state (since schema was mismatched)
DROP VIEW IF EXISTS vw_hk_daily_summary;
DROP VIEW IF EXISTS vw_hk_staff_workload;
DROP TABLE IF EXISTS hk_shift_swaps CASCADE;
DROP TABLE IF EXISTS hk_leave_requests CASCADE;
DROP TABLE IF EXISTS hk_schedules CASCADE;
DROP TABLE IF EXISTS hk_lost_found CASCADE;
DROP TABLE IF EXISTS hk_maintenance_requests CASCADE;
DROP TABLE IF EXISTS hk_guest_requests CASCADE;
DROP TABLE IF EXISTS housekeeping_supply_transactions CASCADE;
DROP TABLE IF EXISTS housekeeping_supply_requests CASCADE;
DROP TABLE IF EXISTS hk_floor_pantry_inventory CASCADE;
DROP TABLE IF EXISTS hk_supply_predictions CASCADE;
DROP TABLE IF EXISTS housekeeping_supplies CASCADE;
DROP TABLE IF EXISTS hk_room_status_history CASCADE;
DROP TABLE IF EXISTS hk_inspections CASCADE;
DROP TABLE IF EXISTS hk_task_checklists CASCADE;
DROP TABLE IF EXISTS hk_tasks CASCADE;
DROP TABLE IF EXISTS hk_checklist_templates CASCADE;
DROP TABLE IF EXISTS hk_staff_profiles CASCADE;

-- 1. Housekeeping Staff Profiles (Extends staff_profiles/users)
CREATE TABLE IF NOT EXISTS hk_staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  staff_code VARCHAR(20) UNIQUE NOT NULL,
  designation VARCHAR(50), -- e.g., 'Attendant', 'Supervisor', 'Manager'
  floor_assignment INTEGER[], -- Array of floor numbers
  max_credits_per_shift DECIMAL(4,1) DEFAULT 14.0,
  current_credits DECIMAL(4,1) DEFAULT 0.0,
  current_task_id UUID, -- Will reference hk_tasks(id)
  current_room_number VARCHAR(20),
  is_available BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 2. Checklist Templates
CREATE TABLE IF NOT EXISTS hk_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  task_type VARCHAR(50) NOT NULL, -- 'checkout_full', 'stay_over', etc.
  items JSONB NOT NULL, -- Array of checklist items
  estimated_minutes INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 3. Housekeeping Tasks
CREATE TABLE IF NOT EXISTS hk_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number SERIAL, -- For friendly ID
  room_id UUID REFERENCES rooms(id),
  room_number VARCHAR(20),
  floor_number INTEGER,
  task_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal', -- 'normal', 'high', 'urgent', 'critical'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'assigned', 'in_progress', 'completed', 'verified', 'cancelled'
  
  assigned_to UUID REFERENCES hk_staff_profiles(id),
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES users(id),
  
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES hk_staff_profiles(id),
  
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  
  credit_value DECIMAL(3,1) DEFAULT 1.0,
  
  scheduled_start TIMESTAMPTZ,
  due_by TIMESTAMPTZ,
  
  is_vip BOOLEAN DEFAULT FALSE,
  guest_preferences JSONB,
  special_instructions TEXT,
  
  requires_inspection BOOLEAN DEFAULT TRUE,
  inspection_status VARCHAR(20), -- 'pending', 'passed', 'failed'
  
  supplies_used JSONB,
  completion_notes TEXT,
  completion_photos TEXT[], -- Array of URLs
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Add circular reference for current_task_id in staff profiles
ALTER TABLE hk_staff_profiles 
ADD CONSTRAINT fk_current_task 
FOREIGN KEY (current_task_id) REFERENCES hk_tasks(id);

-- 4. Task Checklists (Instances)
CREATE TABLE IF NOT EXISTS hk_task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES hk_tasks(id) ON DELETE CASCADE,
  template_id UUID REFERENCES hk_checklist_templates(id),
  completed_items JSONB, -- Array of items with checked status
  completion_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 5. Inspections
CREATE TABLE IF NOT EXISTS hk_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES hk_tasks(id),
  room_id UUID REFERENCES rooms(id),
  inspector_id UUID REFERENCES users(id),
  inspected_at TIMESTAMPTZ DEFAULT NOW(),
  
  status VARCHAR(20), -- 'passed', 'failed', 'passed_with_comments'
  overall_score DECIMAL(4,2), -- 0-100
  
  checklist_results JSONB, -- Detailed results
  photos TEXT[],
  comments TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 6. Room Status History (Audit Log)
CREATE TABLE IF NOT EXISTS hk_room_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  changed_by UUID REFERENCES users(id),
  reason VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Housekeeping Supplies
CREATE TABLE IF NOT EXISTS housekeeping_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  current_stock INTEGER DEFAULT 0,
  minimum_stock INTEGER DEFAULT 10,
  unit VARCHAR(20),
  status VARCHAR(20), -- 'ok', 'low', 'critical', 'out_of_stock'
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 8. Guest Requests (Housekeeping specific)
CREATE TABLE IF NOT EXISTS hk_guest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  guest_id UUID, -- Optional link to guest
  request_type VARCHAR(50), -- 'towels', 'toiletries', 'cleaning', 'dnd'
  description TEXT,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'pending',
  assigned_to UUID REFERENCES hk_staff_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 9. Maintenance Requests (Reported by HK)
CREATE TABLE IF NOT EXISTS hk_maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  reported_by UUID REFERENCES users(id),
  issue_type VARCHAR(50),
  description TEXT,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'reported', -- 'reported', 'in_progress', 'resolved'
  photos TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- 10. Lost & Found
CREATE TABLE IF NOT EXISTS hk_lost_found (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  found_location VARCHAR(100), -- Room number or area
  found_by UUID REFERENCES users(id),
  found_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'stored', -- 'stored', 'claimed', 'disposed'
  storage_location VARCHAR(100),
  image_url TEXT,
  claimed_by_name VARCHAR(100),
  claimed_by_phone VARCHAR(20),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 11. Staff Schedules
CREATE TABLE IF NOT EXISTS hk_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES hk_staff_profiles(id),
  shift_date DATE NOT NULL,
  shift_type VARCHAR(20), -- 'morning', 'evening', 'night'
  start_time TIME,
  end_time TIME,
  is_off_day BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 12. Leave Requests
CREATE TABLE IF NOT EXISTS hk_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES hk_staff_profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type VARCHAR(50),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 13. Shift Swaps
CREATE TABLE IF NOT EXISTS hk_shift_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES hk_staff_profiles(id),
  target_staff_id UUID REFERENCES hk_staff_profiles(id),
  shift_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'approved', 'rejected'
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- VIEWS

-- View: Staff Workload
CREATE OR REPLACE VIEW vw_hk_staff_workload AS
SELECT 
  sp.id,
  sp.staff_code,
  u.first_name || ' ' || u.last_name as staff_name,
  sp.is_available,
  sp.current_room_number,
  sp.current_credits,
  sp.max_credits_per_shift,
  (
    SELECT COUNT(*) 
    FROM hk_tasks t 
    WHERE t.assigned_to = sp.id 
    AND t.status IN ('assigned', 'in_progress')
  ) as active_tasks,
  (
    SELECT COUNT(*) 
    FROM hk_tasks t 
    WHERE t.completed_by = sp.id 
    AND t.completed_at >= CURRENT_DATE::timestamp
  ) as completed_today,
  (
    SELECT AVG(overall_score)
    FROM hk_inspections i
    JOIN hk_tasks t ON i.task_id = t.id
    WHERE t.completed_by = sp.id
  ) as quality_score
FROM hk_staff_profiles sp
JOIN users u ON sp.user_id = u.id;

-- View: Daily Summary
CREATE OR REPLACE VIEW vw_hk_daily_summary AS
SELECT
  r.branch_id,
  COUNT(r.id) as total_rooms,
  COUNT(CASE WHEN r.hk_status = 'vacant_clean' THEN 1 END) as vacant_clean,
  COUNT(CASE WHEN r.hk_status = 'vacant_dirty' THEN 1 END) as vacant_dirty,
  COUNT(CASE WHEN r.hk_status = 'checkout' THEN 1 END) as checkouts,
  COUNT(CASE WHEN r.hk_status = 'cleaning_in_progress' THEN 1 END) as cleaning_in_progress,
  COUNT(CASE WHEN r.hk_status = 'out_of_order' THEN 1 END) as out_of_order,
  (
    SELECT COUNT(*) 
    FROM hk_tasks t 
    JOIN rooms rm ON t.room_id = rm.id 
    WHERE rm.branch_id = r.branch_id 
    AND t.status = 'pending'
    AND t.created_at >= CURRENT_DATE::timestamp
  ) as pending_tasks,
  (
    SELECT COUNT(*) 
    FROM hk_tasks t 
    JOIN rooms rm ON t.room_id = rm.id 
    WHERE rm.branch_id = r.branch_id 
    AND t.status IN ('assigned', 'in_progress')
    AND t.created_at >= CURRENT_DATE::timestamp
  ) as active_tasks,
  (
    SELECT COUNT(*) 
    FROM hk_tasks t 
    JOIN rooms rm ON t.room_id = rm.id 
    WHERE rm.branch_id = r.branch_id 
    AND t.status = 'completed'
    AND t.completed_at >= CURRENT_DATE::timestamp
  ) as completed_tasks,
  (
    SELECT COUNT(*) 
    FROM hk_tasks t 
    JOIN rooms rm ON t.room_id = rm.id 
    WHERE rm.branch_id = r.branch_id 
    AND t.priority IN ('urgent', 'critical')
    AND t.status NOT IN ('completed', 'cancelled')
  ) as urgent_pending
FROM rooms r
GROUP BY r.branch_id;
