-- SuperAdmin God Mode: 5 new tables + 2 column additions
-- Migration: 20260528_superadmin_god_mode.sql

-- ─── 1. Superadmin Override Audit Log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type   TEXT NOT NULL,    -- 'impersonation','data_override','emergency','config_change','feature_flag','announcement'
  target_type   TEXT,             -- 'user','bill','payment','branch','shift','approval'
  target_id     TEXT,
  before_state  JSONB,
  after_state   JSONB,
  justification TEXT NOT NULL,
  ip_address    INET,
  session_id    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_log_actor ON superadmin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_log_action ON superadmin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_log_created ON superadmin_audit_log(created_at DESC);

ALTER TABLE superadmin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin_audit_log_superadmin_only" ON superadmin_audit_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ─── 2. Feature Flags ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id          SERIAL PRIMARY KEY,
  flag_key    TEXT NOT NULL,
  flag_name   TEXT NOT NULL,
  description TEXT,
  is_global   BOOLEAN DEFAULT true,
  branch_id   INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  is_enabled  BOOLEAN DEFAULT false,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (flag_key, COALESCE(branch_id, -1))
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_superadmin_write" ON feature_flags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );
CREATE POLICY "feature_flags_all_read" ON feature_flags
  FOR SELECT USING (true);

-- Seed default flags
INSERT INTO feature_flags (flag_key, flag_name, description, is_global, is_enabled)
VALUES
  ('kyogong_module',        'Kyogong Spa Module',        'Enable/disable Kyogong Spa across all branches', true, true),
  ('credit_bills',          'Credit Bills System',        'Allow credit bill creation and management', true, true),
  ('analytics_dashboard',   'Analytics Dashboard',        'Show analytics section in dashboards', true, true),
  ('guest_portal',          'Guest Portal',               'Enable self-service guest portal', true, false),
  ('buffet_module',         'Buffet Module',              'Enable buffet management features', true, true),
  ('maintenance_mode',      'Maintenance Mode',           'When enabled, non-superadmin users get 503', true, false),
  ('ml_anomaly_detection',  'ML Anomaly Detection',       'Enable Gemini AI behavioral anomaly detection', true, true),
  ('two_factor_required',   '2FA Required for Finance',   'Force 2FA for finance and cashier roles', true, false)
ON CONFLICT DO NOTHING;

-- ─── 3. Announcements ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  target_type  TEXT NOT NULL DEFAULT 'all',  -- 'all','role','branch','user'
  target_value TEXT,
  priority     TEXT DEFAULT 'normal',        -- 'low','normal','high','critical'
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target_type, target_value);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_superadmin_write" ON announcements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );
CREATE POLICY "announcements_all_read" ON announcements
  FOR SELECT USING (true);

ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcement_reads_own" ON announcement_reads
  FOR ALL USING (user_id = auth.uid());

-- ─── 4. System Config Version History ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config_history (
  id          BIGSERIAL PRIMARY KEY,
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  field_path  TEXT NOT NULL,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_config_history_field ON system_config_history(field_path);
CREATE INDEX IF NOT EXISTS idx_system_config_history_created ON system_config_history(created_at DESC);

ALTER TABLE system_config_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_config_history_superadmin_only" ON system_config_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ─── 5. Impersonation Sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  impersonated_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  justification        TEXT NOT NULL,
  started_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  ended_at             TIMESTAMPTZ,
  actions_count        INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_impersonation_superadmin ON impersonation_sessions(superadmin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_target ON impersonation_sessions(impersonated_user_id);

ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impersonation_sessions_superadmin_only" ON impersonation_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ─── 6. Column additions ──────────────────────────────────────────────────────

-- Maintenance mode on security_config (if table exists)
ALTER TABLE security_config
  ADD COLUMN IF NOT EXISTS maintenance_mode    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT 'System under maintenance. Please check back later.';

-- Force-logout: JWTs issued before this timestamp are invalid for this user
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ;
