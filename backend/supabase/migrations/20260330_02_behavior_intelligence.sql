-- =====================================================
-- BEHAVIOR INTELLIGENCE SCHEMA
-- Creates the baseline profile and anomaly tracking tables
-- =====================================================

-- 1. Baseline Profiles for Users
CREATE TABLE IF NOT EXISTS user_behavior_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avg_login_hour DECIMAL(5, 2) DEFAULT 0,
  login_hour_std DECIMAL(5, 2) DEFAULT 0,
  avg_actions_per_day DECIMAL(10, 2) DEFAULT 0,
  common_modules JSONB DEFAULT '{}'::jsonb,
  avg_transactions DECIMAL(15, 2) DEFAULT 0,
  usual_locations JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Anomaly Events Log
CREATE TABLE IF NOT EXISTS anomaly_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,       -- e.g., 'LOGIN_ANOMALY', 'FINANCIAL_ANOMALY', 'SYSTEM_ANOMALY'
  severity TEXT NOT NULL,   -- e.g., 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  score DECIMAL(7, 4) DEFAULT 0,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Indexes for Analytics
CREATE INDEX IF NOT EXISTS idx_anomaly_events_user_id ON anomaly_events(user_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_type ON anomaly_events(type);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_severity ON anomaly_events(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_detected_at ON anomaly_events(detected_at DESC);

-- 4. Enable RLS
ALTER TABLE user_behavior_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_events ENABLE ROW LEVEL SECURITY;

-- 5. Data Access Policies
CREATE POLICY "Superadmins can read behavior profiles" ON user_behavior_profiles
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager')));

CREATE POLICY "Superadmins can read anomaly events" ON anomaly_events
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager')));
