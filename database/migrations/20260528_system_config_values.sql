-- System-wide key/value configuration used by the admin and mobile dashboards.
-- The existing system_config_history table records changes; this table stores
-- the current value for each field.

CREATE TABLE IF NOT EXISTS system_config_values (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_config_values_updated_at
  ON system_config_values(updated_at DESC);

ALTER TABLE system_config_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_config_values_superadmin_only" ON system_config_values;
CREATE POLICY "system_config_values_superadmin_only" ON system_config_values
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

INSERT INTO system_config_values (key, value)
VALUES
  ('vatRate', '16'::jsonb),
  ('currency', '"KES"'::jsonb),
  ('timezone', '"Africa/Nairobi"'::jsonb),
  ('hotelName', '"Famous Gates Hotels"'::jsonb),
  ('isLicenseValid', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
