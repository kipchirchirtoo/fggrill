-- =====================================================
-- HOUSEKEEPING ENHANCEMENTS MIGRATION
-- Gamification, Analytics, Guest Portal, Sustainability
-- =====================================================

-- =====================================================
-- 1. GAMIFICATION TABLES
-- =====================================================

-- Achievement/Badge Definitions
CREATE TABLE IF NOT EXISTS hk_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- icon name or URL
  category TEXT NOT NULL, -- 'speed', 'quality', 'attendance', 'special'
  points_value INTEGER DEFAULT 10,
  criteria JSONB NOT NULL, -- conditions to earn
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Earned Achievements
CREATE TABLE IF NOT EXISTS hk_staff_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES hk_staff_profiles(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES hk_achievements(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  task_id UUID REFERENCES hk_tasks(id), -- related task if applicable
  notes TEXT,
  UNIQUE(staff_id, achievement_id)
);

-- Points & Leaderboard
CREATE TABLE IF NOT EXISTS hk_staff_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES hk_staff_profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  source TEXT NOT NULL, -- 'task_completion', 'inspection_pass', 'achievement', 'bonus'
  source_id UUID, -- reference to task, inspection, etc.
  description TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  period_week INTEGER, -- week number
  period_month INTEGER,
  period_year INTEGER
);

-- Team Challenges
CREATE TABLE IF NOT EXISTS hk_team_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL, -- 'speed', 'quality', 'volume', 'special'
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reward_points INTEGER DEFAULT 100,
  reward_description TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'failed', 'cancelled'
  winner_id UUID REFERENCES hk_staff_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. GUEST PORTAL TABLES
-- =====================================================

-- Guest Service Requests
CREATE TABLE IF NOT EXISTS hk_guest_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE,
  booking_id UUID,
  room_id UUID REFERENCES rooms(id),
  room_number TEXT,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  request_type TEXT NOT NULL, -- 'clean_now', 'extra_amenities', 'dnd_schedule', 'timing_preference'
  details JSONB NOT NULL DEFAULT '{}',
  preferred_time_start TIME,
  preferred_time_end TIME,
  preferred_date DATE,
  priority hk_priority DEFAULT 'normal',
  status TEXT DEFAULT 'pending', -- 'pending', 'acknowledged', 'in_progress', 'completed', 'cancelled'
  assigned_to UUID REFERENCES hk_staff_profiles(id),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  guest_notified BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  guest_rating INTEGER, -- 1-5
  guest_feedback TEXT,
  branch_id INTEGER REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guest Preferences (synced from booking/profile)
CREATE TABLE IF NOT EXISTS hk_guest_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID,
  booking_id UUID,
  room_id UUID REFERENCES rooms(id),
  pillow_type TEXT, -- 'soft', 'firm', 'hypoallergenic'
  bed_firmness TEXT,
  room_temperature INTEGER,
  preferred_cleaning_time TEXT, -- 'morning', 'afternoon', 'evening'
  extra_towels BOOLEAN DEFAULT FALSE,
  extra_pillows INTEGER DEFAULT 0,
  no_feather BOOLEAN DEFAULT FALSE,
  allergy_info TEXT,
  minibar_preferences JSONB DEFAULT '[]',
  newspaper_preference TEXT,
  turndown_service BOOLEAN DEFAULT TRUE,
  dnd_default_hours TEXT, -- e.g., '22:00-08:00'
  special_notes TEXT,
  is_vip BOOLEAN DEFAULT FALSE,
  vip_level TEXT, -- 'silver', 'gold', 'platinum'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. SUSTAINABILITY TRACKING
-- =====================================================

-- Sustainability Metrics per Room Clean
CREATE TABLE IF NOT EXISTS hk_sustainability_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES hk_tasks(id),
  room_id UUID REFERENCES rooms(id),
  staff_id UUID REFERENCES hk_staff_profiles(id),
  metric_date DATE DEFAULT CURRENT_DATE,
  -- Water usage (liters)
  water_used_liters NUMERIC(6,2),
  water_saved_liters NUMERIC(6,2) DEFAULT 0,
  -- Linen
  linen_reuse_opted BOOLEAN DEFAULT FALSE,
  towels_replaced INTEGER DEFAULT 0,
  sheets_replaced INTEGER DEFAULT 0,
  -- Chemicals
  chemical_units_used NUMERIC(6,2),
  eco_products_used BOOLEAN DEFAULT FALSE,
  -- Energy
  lights_off_checked BOOLEAN DEFAULT FALSE,
  ac_adjusted BOOLEAN DEFAULT FALSE,
  -- Waste
  recyclables_separated BOOLEAN DEFAULT FALSE,
  waste_kg NUMERIC(6,2),
  -- Scores
  eco_score INTEGER, -- 0-100
  carbon_footprint_kg NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Sustainability Summary
CREATE TABLE IF NOT EXISTS hk_sustainability_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date DATE NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  total_rooms_cleaned INTEGER DEFAULT 0,
  linen_reuse_count INTEGER DEFAULT 0,
  linen_reuse_percentage NUMERIC(5,2),
  total_water_liters NUMERIC(10,2),
  water_saved_liters NUMERIC(10,2),
  eco_products_usage_percentage NUMERIC(5,2),
  avg_eco_score NUMERIC(5,2),
  total_carbon_kg NUMERIC(10,2),
  recyclables_kg NUMERIC(10,2),
  landfill_kg NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(summary_date, branch_id)
);

-- Green Guest Tracking
CREATE TABLE IF NOT EXISTS hk_green_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  guest_id UUID,
  room_id UUID REFERENCES rooms(id),
  opted_linen_reuse BOOLEAN DEFAULT FALSE,
  opted_no_daily_clean BOOLEAN DEFAULT FALSE,
  opted_eco_amenities BOOLEAN DEFAULT FALSE,
  days_linen_reused INTEGER DEFAULT 0,
  days_no_clean INTEGER DEFAULT 0,
  water_saved_liters NUMERIC(10,2) DEFAULT 0,
  trees_equivalent NUMERIC(6,4) DEFAULT 0,
  green_points_earned INTEGER DEFAULT 0,
  certificate_issued BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. PREDICTIVE ANALYTICS TABLES
-- =====================================================

-- Demand Forecasts
CREATE TABLE IF NOT EXISTS hk_demand_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date DATE NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  predicted_checkouts INTEGER,
  predicted_arrivals INTEGER,
  predicted_stayovers INTEGER,
  predicted_vip_arrivals INTEGER,
  predicted_tasks_total INTEGER,
  confidence_level NUMERIC(5,2), -- percentage
  actual_checkouts INTEGER,
  actual_arrivals INTEGER,
  forecast_accuracy NUMERIC(5,2),
  weather_factor TEXT,
  event_factor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(forecast_date, branch_id)
);

-- Staff Requirement Predictions
CREATE TABLE IF NOT EXISTS hk_staff_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_date DATE NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  shift_type hk_shift_type,
  predicted_rooms INTEGER,
  predicted_workload_credits NUMERIC(8,2),
  recommended_staff_count INTEGER,
  recommended_supervisors INTEGER,
  actual_staff_count INTEGER,
  workload_accuracy NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supply Consumption Predictions
CREATE TABLE IF NOT EXISTS hk_supply_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_date DATE NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  supply_id UUID REFERENCES housekeeping_supplies(id),
  predicted_usage INTEGER,
  actual_usage INTEGER,
  reorder_recommended BOOLEAN DEFAULT FALSE,
  reorder_quantity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quality Trend Alerts
CREATE TABLE IF NOT EXISTS hk_quality_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'staff_decline', 'room_recurring', 'category_trend'
  severity TEXT DEFAULT 'warning', -- 'info', 'warning', 'critical'
  subject_type TEXT, -- 'staff', 'room', 'category'
  subject_id TEXT,
  subject_name TEXT,
  alert_message TEXT NOT NULL,
  metric_name TEXT,
  current_value NUMERIC,
  threshold_value NUMERIC,
  trend_direction TEXT, -- 'declining', 'improving', 'volatile'
  recommended_action TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  branch_id INTEGER REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. ENHANCED INSPECTION TABLES
-- =====================================================

-- Inspection Photos
CREATE TABLE IF NOT EXISTS hk_inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID REFERENCES hk_inspections(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL, -- 'before', 'after', 'defect'
  category TEXT, -- 'bedroom', 'bathroom', 'entrance', etc.
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT,
  defect_type TEXT,
  defect_severity TEXT, -- 'minor', 'major', 'critical'
  ai_analysis JSONB, -- AI defect detection results
  location_x INTEGER, -- for annotated defects
  location_y INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Defect Types Catalog
CREATE TABLE IF NOT EXISTS hk_defect_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'cleanliness', 'maintenance', 'amenities', 'safety'
  severity_default TEXT DEFAULT 'minor',
  points_deduction INTEGER DEFAULT 5,
  requires_rework BOOLEAN DEFAULT FALSE,
  requires_maintenance BOOLEAN DEFAULT FALSE,
  training_reference TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. SMART ASSIGNMENT TABLES
-- =====================================================

-- Staff Location Tracking
CREATE TABLE IF NOT EXISTS hk_staff_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES hk_staff_profiles(id) ON DELETE CASCADE,
  floor_number INTEGER,
  room_number TEXT,
  area TEXT, -- 'room', 'corridor', 'pantry', 'elevator'
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  accuracy_meters NUMERIC(6,2),
  source TEXT DEFAULT 'manual', -- 'gps', 'wifi', 'manual', 'qr_scan'
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignment History (for ML)
CREATE TABLE IF NOT EXISTS hk_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES hk_tasks(id),
  staff_id UUID REFERENCES hk_staff_profiles(id),
  assignment_method TEXT, -- 'auto', 'manual', 'reassign'
  assignment_score NUMERIC(5,2), -- algorithm score
  factors JSONB, -- {proximity: 0.8, skill_match: 0.9, workload: 0.7}
  was_successful BOOLEAN,
  completion_time_minutes INTEGER,
  quality_score NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room Cleaning Patterns (for prediction)
CREATE TABLE IF NOT EXISTS hk_room_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  room_type TEXT,
  task_type hk_task_type,
  avg_cleaning_minutes INTEGER,
  min_cleaning_minutes INTEGER,
  max_cleaning_minutes INTEGER,
  avg_quality_score NUMERIC(3,2),
  inspection_pass_rate NUMERIC(5,2),
  common_defects JSONB DEFAULT '[]',
  sample_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS hk_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL, -- 'staff', 'supervisor', 'guest', 'system'
  recipient_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  notification_type TEXT NOT NULL, -- 'task_assigned', 'vip_arrival', 'complaint', 'room_ready', etc.
  channel TEXT NOT NULL, -- 'push', 'email', 'sms', 'whatsapp', 'in_app'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. PMS INTEGRATION TABLES
-- =====================================================

-- Booking Sync Log
CREATE TABLE IF NOT EXISTS hk_booking_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  external_booking_ref TEXT,
  sync_type TEXT NOT NULL, -- 'arrival', 'departure', 'modification', 'cancellation'
  room_id UUID REFERENCES rooms(id),
  room_number TEXT,
  guest_name TEXT,
  check_in_date DATE,
  check_out_date DATE,
  is_vip BOOLEAN DEFAULT FALSE,
  special_requests TEXT,
  tasks_generated TEXT[], -- array of task IDs
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE hk_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_staff_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_staff_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_team_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_guest_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_guest_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_sustainability_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_sustainability_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_green_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_staff_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_supply_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_quality_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_defect_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_staff_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_room_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hk_booking_sync ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies (allow all for authenticated users)
CREATE POLICY "hk_achievements_policy" ON hk_achievements FOR ALL USING (true);
CREATE POLICY "hk_staff_achievements_policy" ON hk_staff_achievements FOR ALL USING (true);
CREATE POLICY "hk_staff_points_policy" ON hk_staff_points FOR ALL USING (true);
CREATE POLICY "hk_team_challenges_policy" ON hk_team_challenges FOR ALL USING (true);
CREATE POLICY "hk_guest_service_requests_policy" ON hk_guest_service_requests FOR ALL USING (true);
CREATE POLICY "hk_guest_preferences_policy" ON hk_guest_preferences FOR ALL USING (true);
CREATE POLICY "hk_sustainability_metrics_policy" ON hk_sustainability_metrics FOR ALL USING (true);
CREATE POLICY "hk_sustainability_daily_policy" ON hk_sustainability_daily FOR ALL USING (true);
CREATE POLICY "hk_green_guests_policy" ON hk_green_guests FOR ALL USING (true);
CREATE POLICY "hk_demand_forecasts_policy" ON hk_demand_forecasts FOR ALL USING (true);
CREATE POLICY "hk_staff_predictions_policy" ON hk_staff_predictions FOR ALL USING (true);
CREATE POLICY "hk_supply_predictions_policy" ON hk_supply_predictions FOR ALL USING (true);
CREATE POLICY "hk_quality_alerts_policy" ON hk_quality_alerts FOR ALL USING (true);
CREATE POLICY "hk_inspection_photos_policy" ON hk_inspection_photos FOR ALL USING (true);
CREATE POLICY "hk_defect_types_policy" ON hk_defect_types FOR ALL USING (true);
CREATE POLICY "hk_staff_locations_policy" ON hk_staff_locations FOR ALL USING (true);
CREATE POLICY "hk_assignment_history_policy" ON hk_assignment_history FOR ALL USING (true);
CREATE POLICY "hk_room_patterns_policy" ON hk_room_patterns FOR ALL USING (true);
CREATE POLICY "hk_notifications_policy" ON hk_notifications FOR ALL USING (true);
CREATE POLICY "hk_booking_sync_policy" ON hk_booking_sync FOR ALL USING (true);

-- =====================================================
-- AUTO-NUMBER TRIGGERS
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS guest_request_portal_seq;

CREATE OR REPLACE FUNCTION generate_guest_portal_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'GSR-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || 
      LPAD(NEXTVAL('guest_request_portal_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_guest_portal_request_number ON hk_guest_service_requests;
CREATE TRIGGER set_guest_portal_request_number
  BEFORE INSERT ON hk_guest_service_requests
  FOR EACH ROW EXECUTE FUNCTION generate_guest_portal_request_number();

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Default Achievements
INSERT INTO hk_achievements (code, name, description, category, points_value, criteria) VALUES
('SPEED_DEMON', 'Speed Demon', 'Complete a room 20% faster than average', 'speed', 15, '{"type": "speed", "threshold": 0.8}'),
('QUALITY_STAR', 'Quality Star', 'Achieve 5 consecutive inspection passes', 'quality', 25, '{"type": "consecutive_pass", "count": 5}'),
('PERFECT_WEEK', 'Perfect Week', 'No rework required for an entire week', 'quality', 50, '{"type": "no_rework_days", "count": 7}'),
('EARLY_BIRD', 'Early Bird', 'Check in on time for 30 consecutive days', 'attendance', 30, '{"type": "on_time_days", "count": 30}'),
('VIP_EXPERT', 'VIP Expert', 'Successfully clean 50 VIP rooms', 'special', 40, '{"type": "vip_rooms", "count": 50}'),
('TEAM_PLAYER', 'Team Player', 'Help 10 colleagues complete their tasks', 'special', 20, '{"type": "helped_colleagues", "count": 10}'),
('ECO_WARRIOR', 'Eco Warrior', 'Achieve 90% eco score for a month', 'special', 35, '{"type": "eco_score_avg", "threshold": 90, "period": "month"}'),
('CENTURY', 'Century', 'Complete 100 tasks in a month', 'speed', 100, '{"type": "monthly_tasks", "count": 100}'),
('FIVE_STAR', 'Five Star', 'Receive 5-star rating from guests 10 times', 'quality', 45, '{"type": "guest_rating_5", "count": 10}'),
('MARATHON', 'Marathon', 'Work 100 consecutive days without absence', 'attendance', 75, '{"type": "consecutive_days", "count": 100}')
ON CONFLICT (code) DO NOTHING;

-- Default Defect Types
INSERT INTO hk_defect_types (code, name, category, severity_default, points_deduction, requires_rework) VALUES
('DUST_SURFACE', 'Dust on surfaces', 'cleanliness', 'minor', 3, false),
('STAIN_CARPET', 'Carpet stain', 'cleanliness', 'major', 8, true),
('HAIR_BATHROOM', 'Hair in bathroom', 'cleanliness', 'minor', 5, true),
('STREAK_MIRROR', 'Streaks on mirror', 'cleanliness', 'minor', 3, false),
('SOAP_RESIDUE', 'Soap residue in shower', 'cleanliness', 'minor', 4, true),
('BED_WRINKLE', 'Bed not properly made', 'cleanliness', 'minor', 5, true),
('TRASH_MISSED', 'Trash not emptied', 'cleanliness', 'major', 10, true),
('AMENITY_MISSING', 'Missing amenity', 'amenities', 'major', 8, true),
('TOWEL_WRONG', 'Wrong towel arrangement', 'amenities', 'minor', 3, false),
('BULB_OUT', 'Light bulb out', 'maintenance', 'major', 5, false),
('LEAK_DETECTED', 'Water leak', 'maintenance', 'critical', 15, false),
('SAFETY_HAZARD', 'Safety hazard present', 'safety', 'critical', 20, true),
('SMELL_BAD', 'Unpleasant odor', 'cleanliness', 'major', 10, true),
('FLOOR_DIRTY', 'Floor not clean', 'cleanliness', 'major', 8, true),
('WINDOW_DIRTY', 'Windows not clean', 'cleanliness', 'minor', 4, false)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- VIEWS
-- =====================================================

-- Leaderboard View
CREATE OR REPLACE VIEW vw_hk_leaderboard AS
SELECT 
  s.id AS staff_id,
  u.first_name || ' ' || u.last_name AS staff_name,
  s.staff_code,
  s.quality_score,
  COALESCE(p.total_points, 0) AS total_points,
  COALESCE(p.week_points, 0) AS week_points,
  COALESCE(p.month_points, 0) AS month_points,
  COALESCE(a.badge_count, 0) AS badge_count,
  COALESCE(t.tasks_this_month, 0) AS tasks_this_month,
  RANK() OVER (ORDER BY COALESCE(p.month_points, 0) DESC) AS monthly_rank,
  RANK() OVER (ORDER BY COALESCE(p.total_points, 0) DESC) AS overall_rank
FROM hk_staff_profiles s
JOIN users u ON s.user_id = u.id
LEFT JOIN (
  SELECT staff_id,
    SUM(points) AS total_points,
    SUM(CASE WHEN period_week = EXTRACT(WEEK FROM CURRENT_DATE) 
             AND period_year = EXTRACT(YEAR FROM CURRENT_DATE) THEN points ELSE 0 END) AS week_points,
    SUM(CASE WHEN period_month = EXTRACT(MONTH FROM CURRENT_DATE) 
             AND period_year = EXTRACT(YEAR FROM CURRENT_DATE) THEN points ELSE 0 END) AS month_points
  FROM hk_staff_points
  GROUP BY staff_id
) p ON p.staff_id = s.id
LEFT JOIN (
  SELECT staff_id, COUNT(DISTINCT achievement_id) AS badge_count
  FROM hk_staff_achievements
  GROUP BY staff_id
) a ON a.staff_id = s.id
LEFT JOIN (
  SELECT completed_by, COUNT(*) AS tasks_this_month
  FROM hk_tasks
  WHERE EXTRACT(MONTH FROM completed_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM completed_at) = EXTRACT(YEAR FROM CURRENT_DATE)
  GROUP BY completed_by
) t ON t.completed_by = s.id;

-- Sustainability Summary View
CREATE OR REPLACE VIEW vw_hk_sustainability_summary AS
SELECT 
  branch_id,
  CURRENT_DATE AS report_date,
  COUNT(*) AS rooms_cleaned_today,
  SUM(CASE WHEN linen_reuse_opted THEN 1 ELSE 0 END) AS linen_reuse_count,
  ROUND(AVG(CASE WHEN linen_reuse_opted THEN 100 ELSE 0 END), 1) AS linen_reuse_pct,
  SUM(water_saved_liters) AS total_water_saved,
  ROUND(AVG(eco_score), 1) AS avg_eco_score,
  SUM(carbon_footprint_kg) AS total_carbon_kg
FROM hk_sustainability_metrics
WHERE metric_date = CURRENT_DATE
GROUP BY branch_id;

COMMENT ON TABLE hk_achievements IS 'Gamification badge/achievement definitions';
COMMENT ON TABLE hk_staff_points IS 'Points ledger for gamification';
COMMENT ON TABLE hk_guest_service_requests IS 'Guest portal service requests';
COMMENT ON TABLE hk_sustainability_metrics IS 'Per-task sustainability tracking';
COMMENT ON TABLE hk_demand_forecasts IS 'Predictive demand forecasting';
COMMENT ON TABLE hk_notifications IS 'Multi-channel notification queue';

DO $$ BEGIN RAISE NOTICE 'Housekeeping enhancements migration completed!'; END $$;
