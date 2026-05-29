-- Repair SuperAdmin God Mode schema drift.
-- This migration is intentionally idempotent because some production databases
-- may have a partially-applied 20260528_superadmin_god_mode.sql migration.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.superadmin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES public.users(id),
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before_state JSONB,
  after_state JSONB,
  justification TEXT DEFAULT 'SuperAdmin system action',
  description TEXT,
  ip_address INET,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.superadmin_audit_log ADD COLUMN IF NOT EXISTS before_state JSONB;
ALTER TABLE public.superadmin_audit_log ADD COLUMN IF NOT EXISTS after_state JSONB;
ALTER TABLE public.superadmin_audit_log ADD COLUMN IF NOT EXISTS justification TEXT DEFAULT 'SuperAdmin system action';
ALTER TABLE public.superadmin_audit_log ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.superadmin_audit_log ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE public.superadmin_audit_log ADD COLUMN IF NOT EXISTS session_id TEXT;
UPDATE public.superadmin_audit_log
SET justification = COALESCE(justification, description, 'SuperAdmin system action')
WHERE justification IS NULL;
ALTER TABLE public.superadmin_audit_log ALTER COLUMN justification SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_actor ON public.superadmin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_created ON public.superadmin_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id SERIAL PRIMARY KEY,
  flag_key TEXT NOT NULL,
  flag_name TEXT NOT NULL,
  description TEXT,
  is_global BOOLEAN DEFAULT TRUE,
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT FALSE,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS flag_name TEXT;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT TRUE;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id);
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE public.feature_flags SET flag_name = flag_key WHERE flag_name IS NULL;
ALTER TABLE public.feature_flags ALTER COLUMN flag_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_key_branch_uidx
ON public.feature_flags (flag_key, COALESCE(branch_id, -1));

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT DEFAULT 'all',
  target_value TEXT,
  priority TEXT DEFAULT 'normal',
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.system_config_values (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_config_history (
  id BIGSERIAL PRIMARY KEY,
  field_path TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES public.users(id),
  justification TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  superadmin_id UUID REFERENCES public.users(id),
  impersonated_user_id UUID REFERENCES public.users(id),
  justification TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_superadmin ON public.impersonation_sessions(superadmin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_target ON public.impersonation_sessions(impersonated_user_id);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

INSERT INTO public.feature_flags (flag_key, flag_name, description, is_global, is_enabled)
VALUES
  ('maintenance_mode', 'Maintenance Mode', 'Restrict non-admin access while the system is under maintenance.', TRUE, FALSE),
  ('god_mode_emergency_controls', 'God Mode Emergency Controls', 'Enable SuperAdmin emergency controls.', TRUE, TRUE),
  ('god_mode_data_overrides', 'God Mode Data Overrides', 'Enable audited SuperAdmin data override actions.', TRUE, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO public.system_config_values (key, value)
VALUES
  ('maintenanceMode', 'false'::jsonb),
  ('maintenanceMessage', 'null'::jsonb),
  ('sessionTimeoutMinutes', '60'::jsonb),
  ('maxFailedLoginAttempts', '5'::jsonb),
  ('twoFactorRequired', 'false'::jsonb),
  ('passwordExpiryDays', '90'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.superadmin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superadmin_audit_log_service_role ON public.superadmin_audit_log;
CREATE POLICY superadmin_audit_log_service_role
ON public.superadmin_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS feature_flags_service_role ON public.feature_flags;
CREATE POLICY feature_flags_service_role
ON public.feature_flags
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS announcements_service_role ON public.announcements;
CREATE POLICY announcements_service_role
ON public.announcements
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS announcement_reads_service_role ON public.announcement_reads;
CREATE POLICY announcement_reads_service_role
ON public.announcement_reads
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS system_config_values_service_role ON public.system_config_values;
CREATE POLICY system_config_values_service_role
ON public.system_config_values
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS system_config_history_service_role ON public.system_config_history;
CREATE POLICY system_config_history_service_role
ON public.system_config_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS impersonation_sessions_service_role ON public.impersonation_sessions;
CREATE POLICY impersonation_sessions_service_role
ON public.impersonation_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Restore explicit relationships used by PostgREST embedded selects.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_request_items')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'simple_items')
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'stock_request_items_item_sku_fkey'
     ) THEN
    ALTER TABLE public.stock_request_items
      ADD CONSTRAINT stock_request_items_item_sku_fkey
      FOREIGN KEY (item_sku)
      REFERENCES public.simple_items(sku)
      ON UPDATE CASCADE
      NOT VALID;
  END IF;
EXCEPTION
  WHEN duplicate_object OR invalid_foreign_key OR undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_requests' AND column_name = 'requested_by')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_requests_requested_by_fkey') THEN
    ALTER TABLE public.stock_requests
      ADD CONSTRAINT stock_requests_requested_by_fkey
      FOREIGN KEY (requested_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_requests' AND column_name = 'reviewed_by')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_requests_reviewed_by_fkey') THEN
    ALTER TABLE public.stock_requests
      ADD CONSTRAINT stock_requests_reviewed_by_fkey
      FOREIGN KEY (reviewed_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
EXCEPTION
  WHEN duplicate_object OR invalid_foreign_key OR undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'created_by')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcements_created_by_fkey') THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feature_flags' AND column_name = 'updated_by')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_flags_updated_by_fkey') THEN
    ALTER TABLE public.feature_flags
      ADD CONSTRAINT feature_flags_updated_by_fkey
      FOREIGN KEY (updated_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
EXCEPTION
  WHEN duplicate_object OR invalid_foreign_key OR undefined_table THEN
    NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pos_transactions' AND column_name = 'cashier_id')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pos_transactions_cashier_id_fkey') THEN
    ALTER TABLE public.pos_transactions
      ADD CONSTRAINT pos_transactions_cashier_id_fkey
      FOREIGN KEY (cashier_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
EXCEPTION
  WHEN duplicate_object OR invalid_foreign_key OR undefined_table THEN
    NULL;
END $$;
