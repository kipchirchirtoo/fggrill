-- =====================================================
-- HOUSEKEEPING MODULE FIX MIGRATION
-- Fixes schema issues and creates missing tables
-- =====================================================

-- =====================================================
-- ADD MISSING COLUMNS TO ROOMS TABLE
-- =====================================================

-- Add branch_id to rooms if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'branch_id') THEN
    ALTER TABLE rooms ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    -- Set default branch for existing rooms
    UPDATE rooms SET branch_id = 1 WHERE branch_id IS NULL;
  END IF;
END $$;

-- Add room_type derived column (join with room_types)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'room_type') THEN
    ALTER TABLE rooms ADD COLUMN room_type TEXT;
  END IF;
END $$;

-- =====================================================
-- CREATE MISSING TABLES
-- =====================================================

-- Checklist Templates
CREATE TABLE IF NOT EXISTS hk_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  task_type hk_task_type NOT NULL,
  room_type TEXT,
  sections JSONB NOT NULL DEFAULT '[]',
  total_estimated_time INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  branch_id INTEGER REFERENCES branches(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Checklists
CREATE TABLE IF NOT EXISTS hk_task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES hk_tasks(id) ON DELETE CASCADE,
  template_id UUID REFERENCES hk_checklist_templates(id),
  completed_items JSONB NOT NULL DEFAULT '[]',
  completion_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Linen Inventory
CREATE TABLE IF NOT EXISTS hk_linen_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linen_type_id UUID REFERENCES hk_linen_types(id),
  batch_code TEXT,
  purchase_date DATE,
  location_type TEXT DEFAULT 'central_store',
  location_id TEXT,
  branch_id INTEGER REFERENCES branches(id),
  status hk_linen_status DEFAULT 'clean_available',
  condition TEXT DEFAULT 'good',
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  last_washed_at TIMESTAMPTZ,
  current_room_id UUID REFERENCES rooms(id),
  assigned_to_cart TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lost and Found
CREATE TABLE IF NOT EXISTS hk_lost_found (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_number TEXT UNIQUE,
  item_description TEXT NOT NULL,
  item_category TEXT NOT NULL,
  estimated_value NUMERIC(10,2),
  is_valuable BOOLEAN DEFAULT FALSE,
  found_location TEXT NOT NULL,
  room_id UUID REFERENCES rooms(id),
  floor_number INTEGER,
  photos TEXT[] DEFAULT '{}',
  found_by UUID REFERENCES hk_staff_profiles(id),
  found_at TIMESTAMPTZ DEFAULT NOW(),
  status hk_lost_found_status DEFAULT 'found',
  storage_location TEXT,
  storage_bin TEXT,
  potential_guest_id UUID,
  guest_name TEXT,
  guest_contact TEXT,
  contact_attempts JSONB DEFAULT '[]',
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  claimed_signature TEXT,
  returned_by UUID REFERENCES users(id),
  disposal_date DATE,
  disposal_method TEXT,
  disposal_notes TEXT,
  retention_days INTEGER DEFAULT 90,
  retention_end_date DATE,
  branch_id INTEGER REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance Requests
CREATE TABLE IF NOT EXISTS hk_maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,
  room_id UUID REFERENCES rooms(id),
  room_number TEXT,
  location_description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT NOT NULL,
  priority hk_priority DEFAULT 'normal',
  is_safety_issue BOOLEAN DEFAULT FALSE,
  impacts_room_availability BOOLEAN DEFAULT FALSE,
  photos TEXT[] DEFAULT '{}',
  reported_by UUID REFERENCES hk_staff_profiles(id),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  status hk_maintenance_status DEFAULT 'submitted',
  assigned_to UUID,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  resolution_notes TEXT,
  resolution_photos TEXT[] DEFAULT '{}',
  verified_by UUID REFERENCES hk_staff_profiles(id),
  verified_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT FALSE,
  branch_id INTEGER REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guest Requests
CREATE TABLE IF NOT EXISTS hk_guest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,
  room_id UUID REFERENCES rooms(id),
  room_number TEXT,
  guest_name TEXT,
  booking_id UUID,
  request_type TEXT NOT NULL,
  description TEXT NOT NULL,
  items_requested JSONB DEFAULT '[]',
  preferred_time TEXT,
  preferred_date DATE,
  priority hk_priority DEFAULT 'normal',
  is_vip BOOLEAN DEFAULT FALSE,
  source TEXT DEFAULT 'front_desk',
  received_by UUID REFERENCES users(id),
  status hk_task_status DEFAULT 'pending',
  assigned_to UUID REFERENCES hk_staff_profiles(id),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES hk_staff_profiles(id),
  completion_notes TEXT,
  guest_satisfied BOOLEAN,
  guest_feedback TEXT,
  branch_id INTEGER REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift Definitions
CREATE TABLE IF NOT EXISTS hk_shift_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  shift_type hk_shift_type NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration_minutes INTEGER DEFAULT 30,
  monday BOOLEAN DEFAULT TRUE,
  tuesday BOOLEAN DEFAULT TRUE,
  wednesday BOOLEAN DEFAULT TRUE,
  thursday BOOLEAN DEFAULT TRUE,
  friday BOOLEAN DEFAULT TRUE,
  saturday BOOLEAN DEFAULT TRUE,
  sunday BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  branch_id INTEGER REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Schedules
CREATE TABLE IF NOT EXISTS hk_staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES hk_staff_profiles(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES hk_shift_definitions(id),
  schedule_date DATE NOT NULL,
  actual_start_time TIME,
  actual_end_time TIME,
  assigned_floors INTEGER[] DEFAULT '{}',
  assigned_sections TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'scheduled',
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  break_start_time TIMESTAMPTZ,
  break_end_time TIMESTAMPTZ,
  is_overtime BOOLEAN DEFAULT FALSE,
  overtime_hours NUMERIC(4,2) DEFAULT 0,
  overtime_approved_by UUID REFERENCES users(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, schedule_date, shift_id)
);

-- Shift Swaps
CREATE TABLE IF NOT EXISTS hk_shift_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES hk_staff_profiles(id),
  requester_schedule_id UUID REFERENCES hk_staff_schedules(id),
  target_id UUID REFERENCES hk_staff_profiles(id),
  target_schedule_id UUID REFERENCES hk_staff_schedules(id),
  reason TEXT,
  status TEXT DEFAULT 'pending',
  accepted_by_target BOOLEAN,
  target_response_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Metrics
CREATE TABLE IF NOT EXISTS hk_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  total_tasks_created INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  total_tasks_pending INTEGER DEFAULT 0,
  total_rooms INTEGER DEFAULT 0,
  rooms_cleaned INTEGER DEFAULT 0,
  rooms_inspected INTEGER DEFAULT 0,
  rooms_out_of_order INTEGER DEFAULT 0,
  inspections_passed INTEGER DEFAULT 0,
  inspections_failed INTEGER DEFAULT 0,
  avg_quality_score NUMERIC(3,2),
  avg_checkout_clean_time INTEGER,
  avg_stayover_clean_time INTEGER,
  staff_scheduled INTEGER DEFAULT 0,
  staff_present INTEGER DEFAULT 0,
  guest_complaints INTEGER DEFAULT 0,
  guest_compliments INTEGER DEFAULT 0,
  low_stock_items INTEGER DEFAULT 0,
  critical_stock_items INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date, branch_id)
);

-- Floor Pantry Inventory
CREATE TABLE IF NOT EXISTS hk_floor_pantry_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_number INTEGER NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  supply_id UUID REFERENCES housekeeping_supplies(id),
  current_quantity INTEGER DEFAULT 0,
  par_level INTEGER DEFAULT 10,
  last_restocked_at TIMESTAMPTZ,
  last_restocked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(floor_number, branch_id, supply_id)
);

-- Cart Inventory
CREATE TABLE IF NOT EXISTS hk_cart_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_code TEXT UNIQUE NOT NULL,
  assigned_to UUID REFERENCES hk_staff_profiles(id),
  inventory_items JSONB DEFAULT '[]',
  last_loaded_at TIMESTAMPTZ,
  last_loaded_by UUID REFERENCES users(id),
  branch_id INTEGER REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUTO-NUMBER FUNCTIONS
-- =====================================================

-- Lost & Found number generator
CREATE OR REPLACE FUNCTION generate_lost_found_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_number IS NULL THEN
    NEW.item_number := 'LF-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || 
      LPAD(NEXTVAL('lost_found_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequence for lost & found
CREATE SEQUENCE IF NOT EXISTS lost_found_seq;

DROP TRIGGER IF EXISTS set_lost_found_number ON hk_lost_found;
CREATE TRIGGER set_lost_found_number
  BEFORE INSERT ON hk_lost_found
  FOR EACH ROW EXECUTE FUNCTION generate_lost_found_number();

-- Maintenance request number generator
CREATE OR REPLACE FUNCTION generate_maintenance_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'MR-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || 
      LPAD(NEXTVAL('maintenance_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS maintenance_seq;

DROP TRIGGER IF EXISTS set_maintenance_number ON hk_maintenance_requests;
CREATE TRIGGER set_maintenance_number
  BEFORE INSERT ON hk_maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION generate_maintenance_number();

-- Guest request number generator
CREATE OR REPLACE FUNCTION generate_guest_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'GR-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || 
      LPAD(NEXTVAL('guest_request_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS guest_request_seq;

DROP TRIGGER IF EXISTS set_guest_request_number ON hk_guest_requests;
CREATE TRIGGER set_guest_request_number
  BEFORE INSERT ON hk_guest_requests
  FOR EACH ROW EXECUTE FUNCTION generate_guest_request_number();

-- =====================================================
-- ENABLE RLS ON NEW TABLES
-- =====================================================

ALTER TABLE hk_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_linen_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_lost_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_guest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_shift_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_floor_pantry_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_cart_inventory ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES (Using existing role names)
-- =====================================================

-- Generic housekeeping access policy for all tables
CREATE POLICY "hk_checklist_templates_policy" ON hk_checklist_templates FOR ALL
  USING (true);

CREATE POLICY "hk_task_checklists_policy" ON hk_task_checklists FOR ALL
  USING (true);

CREATE POLICY "hk_linen_inventory_policy" ON hk_linen_inventory FOR ALL
  USING (true);

CREATE POLICY "hk_lost_found_policy" ON hk_lost_found FOR ALL
  USING (true);

CREATE POLICY "hk_maintenance_requests_policy" ON hk_maintenance_requests FOR ALL
  USING (true);

CREATE POLICY "hk_guest_requests_policy" ON hk_guest_requests FOR ALL
  USING (true);

CREATE POLICY "hk_shift_definitions_policy" ON hk_shift_definitions FOR ALL
  USING (true);

CREATE POLICY "hk_staff_schedules_policy" ON hk_staff_schedules FOR ALL
  USING (true);

CREATE POLICY "hk_shift_swaps_policy" ON hk_shift_swaps FOR ALL
  USING (true);

CREATE POLICY "hk_daily_metrics_policy" ON hk_daily_metrics FOR ALL
  USING (true);

CREATE POLICY "hk_floor_pantry_policy" ON hk_floor_pantry_inventory FOR ALL
  USING (true);

CREATE POLICY "hk_cart_inventory_policy" ON hk_cart_inventory FOR ALL
  USING (true);

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Default Shift Definitions
INSERT INTO hk_shift_definitions (name, shift_type, start_time, end_time, break_duration_minutes)
VALUES 
  ('Morning Shift', 'morning', '06:00', '14:00', 30),
  ('Afternoon Shift', 'afternoon', '14:00', '22:00', 30),
  ('Night Shift', 'night', '22:00', '06:00', 30),
  ('Split Shift', 'split', '07:00', '11:00', 0)
ON CONFLICT DO NOTHING;

-- Default Checklist Templates
INSERT INTO hk_checklist_templates (name, task_type, sections, total_estimated_time)
VALUES 
(
  'Standard Checkout Clean',
  'checkout_full_clean',
  '[
    {"section": "Entrance & Closet", "items": [
      {"item": "Vacuum carpet", "required": true, "timeEstimate": 3},
      {"item": "Wipe door and handles", "required": true, "timeEstimate": 1},
      {"item": "Clean closet and hangers", "required": true, "timeEstimate": 2}
    ]},
    {"section": "Bedroom", "items": [
      {"item": "Strip and remake bed", "required": true, "timeEstimate": 8},
      {"item": "Dust all surfaces", "required": true, "timeEstimate": 3},
      {"item": "Clean mirrors", "required": true, "timeEstimate": 2}
    ]},
    {"section": "Bathroom", "items": [
      {"item": "Clean toilet", "required": true, "timeEstimate": 3},
      {"item": "Clean shower/tub", "required": true, "timeEstimate": 5},
      {"item": "Clean sink and vanity", "required": true, "timeEstimate": 3},
      {"item": "Replace towels", "required": true, "timeEstimate": 2},
      {"item": "Restock amenities", "required": true, "timeEstimate": 2}
    ]}
  ]'::jsonb,
  45
),
(
  'Stay Over Service',
  'stay_over_service',
  '[
    {"section": "Bedroom", "items": [
      {"item": "Make bed", "required": true, "timeEstimate": 5},
      {"item": "Empty trash", "required": true, "timeEstimate": 1},
      {"item": "Tidy surfaces", "required": true, "timeEstimate": 2}
    ]},
    {"section": "Bathroom", "items": [
      {"item": "Clean toilet", "required": true, "timeEstimate": 2},
      {"item": "Wipe sink", "required": true, "timeEstimate": 1},
      {"item": "Replace used towels", "required": true, "timeEstimate": 2}
    ]}
  ]'::jsonb,
  20
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- CREATE VIEWS
-- =====================================================

-- Staff Workload View
CREATE OR REPLACE VIEW vw_hk_staff_workload AS
SELECT 
  s.id,
  u.first_name || ' ' || u.last_name AS staff_name,
  s.staff_code,
  s.is_available,
  s.current_room_number,
  s.max_credits_per_shift,
  s.quality_score,
  COALESCE(active.count, 0) AS active_tasks,
  COALESCE(completed.count, 0) AS completed_today,
  COALESCE(completed.total_credits, 0) AS current_credits
FROM hk_staff_profiles s
JOIN users u ON s.user_id = u.id
LEFT JOIN (
  SELECT assigned_to, COUNT(*) as count
  FROM hk_tasks
  WHERE status IN ('assigned', 'in_progress')
  GROUP BY assigned_to
) active ON active.assigned_to = s.id
LEFT JOIN (
  SELECT completed_by, COUNT(*) as count, SUM(credit_value) as total_credits
  FROM hk_tasks
  WHERE status IN ('completed', 'inspection_passed')
    AND DATE(completed_at) = CURRENT_DATE
  GROUP BY completed_by
) completed ON completed.completed_by = s.id;

-- Daily Summary View
CREATE OR REPLACE VIEW vw_hk_daily_summary AS
SELECT 
  r.branch_id,
  COUNT(*) AS total_rooms,
  COUNT(*) FILTER (WHERE r.hk_status = 'vacant_clean') AS vacant_clean,
  COUNT(*) FILTER (WHERE r.hk_status = 'vacant_dirty') AS vacant_dirty,
  COUNT(*) FILTER (WHERE r.hk_status = 'checkout') AS checkouts,
  COUNT(*) FILTER (WHERE r.hk_status = 'cleaning_in_progress') AS cleaning_in_progress,
  COUNT(*) FILTER (WHERE r.hk_status = 'out_of_order') AS out_of_order,
  (SELECT COUNT(*) FROM hk_tasks WHERE status = 'pending' AND DATE(created_at) = CURRENT_DATE) AS pending_tasks,
  (SELECT COUNT(*) FROM hk_tasks WHERE status IN ('assigned', 'in_progress')) AS active_tasks,
  (SELECT COUNT(*) FROM hk_tasks WHERE status IN ('completed', 'inspection_passed') AND DATE(completed_at) = CURRENT_DATE) AS completed_tasks,
  (SELECT COUNT(*) FROM hk_tasks WHERE priority IN ('critical', 'urgent') AND status NOT IN ('completed', 'cancelled', 'inspection_passed')) AS urgent_pending
FROM rooms r
WHERE r.branch_id IS NOT NULL
GROUP BY r.branch_id;

COMMENT ON VIEW vw_hk_staff_workload IS 'Real-time staff workload for task assignment';
COMMENT ON VIEW vw_hk_daily_summary IS 'Daily housekeeping dashboard summary';

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE hk_checklist_templates IS 'Checklist templates for different task types';
COMMENT ON TABLE hk_lost_found IS 'Lost and found items tracking';
COMMENT ON TABLE hk_maintenance_requests IS 'Maintenance requests from housekeeping';
COMMENT ON TABLE hk_guest_requests IS 'Guest special requests';
COMMENT ON TABLE hk_shift_definitions IS 'Shift definitions for scheduling';
COMMENT ON TABLE hk_staff_schedules IS 'Staff work schedules';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Housekeeping fix migration completed successfully!';
END $$;
