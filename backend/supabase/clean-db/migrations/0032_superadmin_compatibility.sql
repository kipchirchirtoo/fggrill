-- SuperAdmin compatibility layer for the clean database.
-- Backend source of truth:
--   - public.users are login/RBAC accounts.
--   - public.staff_profiles are HR/personnel records and remain separate.
--   - SuperAdmin/security/document-template screens read/write these tables
--     through backend controllers, so this migration fills the clean DB gaps
--     without creating duplicate business domains.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.fg_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Login user compatibility used by SuperAdmin user/security controls
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_photo text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS force_logout_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id text;

CREATE INDEX IF NOT EXISTS idx_users_branch_id ON public.users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_force_logout_at ON public.users(force_logout_at);

-- ---------------------------------------------------------------------------
-- Org/RBAC compatibility used by /api/system and SuperAdmin management screens
-- ---------------------------------------------------------------------------

ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS budget_allocated numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

UPDATE public.departments
SET status = CASE WHEN COALESCE(is_active, true) THEN 'active' ELSE 'inactive' END
WHERE status IS NULL OR status = '';

ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS role_name text;
UPDATE public.roles SET role_name = name WHERE role_name IS NULL;

ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS role_id integer;

CREATE INDEX IF NOT EXISTS idx_departments_branch_status ON public.departments(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_permissions_role_id ON public.permissions(role_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_role_name_unique
  ON public.roles(role_name)
  WHERE role_name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- SuperAdmin audit, feature flags, announcements, impersonation
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.superadmin_audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  target_type text,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  justification text NOT NULL DEFAULT 'SuperAdmin system action',
  description text,
  ip_address inet,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_audit_actor ON public.superadmin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_action ON public.superadmin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_created ON public.superadmin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_target ON public.superadmin_audit_log(target_type, target_id);

ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS flag_name text;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS is_global boolean DEFAULT true;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT false;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE public.feature_flags
SET
  flag_name = COALESCE(flag_name, initcap(replace(flag_key, '_', ' '))),
  is_enabled = COALESCE(is_enabled, enabled, false),
  is_global = COALESCE(is_global, branch_id IS NULL)
WHERE flag_name IS NULL OR is_enabled IS NULL OR is_global IS NULL;

CREATE OR REPLACE FUNCTION public.sync_feature_flags_compat()
RETURNS trigger AS $$
BEGIN
  IF NEW.flag_name IS NULL THEN
    NEW.flag_name := initcap(replace(COALESCE(NEW.flag_key, ''), '_', ' '));
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_enabled IS DISTINCT FROM OLD.is_enabled
       AND NEW.enabled IS NOT DISTINCT FROM OLD.enabled THEN
      NEW.enabled := COALESCE(NEW.is_enabled, false);
    ELSIF NEW.enabled IS DISTINCT FROM OLD.enabled
       AND NEW.is_enabled IS NOT DISTINCT FROM OLD.is_enabled THEN
      NEW.is_enabled := COALESCE(NEW.enabled, false);
    ELSE
      NEW.is_enabled := COALESCE(NEW.is_enabled, NEW.enabled, false);
      NEW.enabled := COALESCE(NEW.enabled, NEW.is_enabled, false);
    END IF;
  ELSE
    NEW.is_enabled := COALESCE(NEW.is_enabled, NEW.enabled, false);
    NEW.enabled := COALESCE(NEW.enabled, NEW.is_enabled, false);
  END IF;

  NEW.is_global := COALESCE(NEW.is_global, NEW.branch_id IS NULL);
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.created_at := COALESCE(NEW.created_at, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_feature_flags_compat ON public.feature_flags;
CREATE TRIGGER trg_sync_feature_flags_compat
BEFORE INSERT OR UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.sync_feature_flags_compat();

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_key_branch_uidx
  ON public.feature_flags(flag_key, COALESCE(branch_id, -1));
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(is_enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_branch ON public.feature_flags(branch_id);

INSERT INTO public.feature_flags (flag_key, flag_name, description, is_global, is_enabled, enabled)
VALUES
  ('maintenance_mode', 'Maintenance Mode', 'Restrict non-admin access while the system is under maintenance.', true, false, false),
  ('god_mode_emergency_controls', 'God Mode Emergency Controls', 'Enable SuperAdmin emergency controls.', true, true, true),
  ('god_mode_data_overrides', 'God Mode Data Overrides', 'Enable audited SuperAdmin data override actions.', true, true, true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'all';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS target_value text;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.announcements
SET created_by = COALESCE(created_by, posted_by)
WHERE created_by IS NULL;

CREATE OR REPLACE FUNCTION public.sync_announcements_compat()
RETURNS trigger AS $$
BEGIN
  NEW.created_by := COALESCE(NEW.created_by, NEW.posted_by);
  NEW.posted_by := COALESCE(NEW.posted_by, NEW.created_by);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_announcements_compat ON public.announcements;
CREATE TRIGGER trg_sync_announcements_compat
BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.sync_announcements_compat();

CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_target ON public.announcements(target_type, target_value);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON public.announcements(expires_at);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON public.announcement_reads(user_id, read_at DESC);

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  impersonated_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  justification text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_superadmin ON public.impersonation_sessions(superadmin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_target ON public.impersonation_sessions(impersonated_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_open ON public.impersonation_sessions(ended_at) WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- System/security config
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  id_type text;
BEGIN
  SELECT udt_name INTO id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'security_config'
    AND column_name = 'id';

  IF id_type IS NOT NULL AND id_type <> 'int4' THEN
    IF to_regclass('public.security_config_legacy_kv') IS NULL THEN
      ALTER TABLE public.security_config RENAME TO security_config_legacy_kv;
    ELSE
      DROP TABLE public.security_config;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.security_config (
  id integer PRIMARY KEY DEFAULT 1,
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'System under maintenance',
  jwt_expiry_minutes integer NOT NULL DEFAULT 60,
  refresh_token_rotation boolean NOT NULL DEFAULT true,
  session_timeout_minutes integer NOT NULL DEFAULT 120,
  max_failed_attempts integer NOT NULL DEFAULT 5,
  lockout_duration_minutes integer NOT NULL DEFAULT 15,
  auth_rate_limit integer NOT NULL DEFAULT 20,
  financial_rate_limit integer NOT NULL DEFAULT 30,
  general_rate_limit integer NOT NULL DEFAULT 100,
  require_2fa_for_admin boolean NOT NULL DEFAULT false,
  require_2fa_for_financial boolean NOT NULL DEFAULT false,
  ip_whitelist_enabled boolean NOT NULL DEFAULT false,
  geo_blocking_enabled boolean NOT NULL DEFAULT false,
  vpn_detection_enabled boolean NOT NULL DEFAULT true,
  log_all_api_calls boolean NOT NULL DEFAULT true,
  alert_on_suspicious_activity boolean NOT NULL DEFAULT true,
  alert_on_failed_logins integer NOT NULL DEFAULT 3,
  alert_on_role_changes boolean NOT NULL DEFAULT true,
  rls_enabled boolean NOT NULL DEFAULT true,
  backup_frequency_hours integer NOT NULL DEFAULT 24,
  encryption_at_rest boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_config_single_row CHECK (id = 1)
);

ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS maintenance_message text NOT NULL DEFAULT 'System under maintenance';
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS jwt_expiry_minutes integer NOT NULL DEFAULT 60;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS refresh_token_rotation boolean NOT NULL DEFAULT true;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS session_timeout_minutes integer NOT NULL DEFAULT 120;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS max_failed_attempts integer NOT NULL DEFAULT 5;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS lockout_duration_minutes integer NOT NULL DEFAULT 15;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS auth_rate_limit integer NOT NULL DEFAULT 20;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS financial_rate_limit integer NOT NULL DEFAULT 30;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS general_rate_limit integer NOT NULL DEFAULT 100;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS require_2fa_for_admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS require_2fa_for_financial boolean NOT NULL DEFAULT false;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS ip_whitelist_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS geo_blocking_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS vpn_detection_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS log_all_api_calls boolean NOT NULL DEFAULT true;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS alert_on_suspicious_activity boolean NOT NULL DEFAULT true;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS alert_on_failed_logins integer NOT NULL DEFAULT 3;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS alert_on_role_changes boolean NOT NULL DEFAULT true;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS rls_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS backup_frequency_hours integer NOT NULL DEFAULT 24;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS encryption_at_rest boolean NOT NULL DEFAULT true;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.security_config ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO public.security_config(id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_security_config_updated_at ON public.security_config;
CREATE TRIGGER trg_security_config_updated_at
BEFORE UPDATE ON public.security_config
FOR EACH ROW EXECUTE FUNCTION public.fg_touch_updated_at();

ALTER TABLE public.system_config_values ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.system_config_values ADD COLUMN IF NOT EXISTS description text;

DO $$
DECLARE
  value_type text;
BEGIN
  SELECT data_type INTO value_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'system_config_values'
    AND column_name = 'value';

  IF value_type IS NOT NULL AND value_type <> 'jsonb' THEN
    ALTER TABLE public.system_config_values
      ALTER COLUMN value TYPE jsonb
      USING CASE WHEN value IS NULL THEN NULL ELSE to_jsonb(value) END;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS system_config_values_key_uidx
  ON public.system_config_values(key);
CREATE INDEX IF NOT EXISTS idx_system_config_values_updated_at
  ON public.system_config_values(updated_at DESC);

ALTER TABLE public.system_config_history ADD COLUMN IF NOT EXISTS field_path text;
ALTER TABLE public.system_config_history ADD COLUMN IF NOT EXISTS justification text;

DO $$
DECLARE
  old_type text;
  new_type text;
BEGIN
  SELECT data_type INTO old_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'system_config_history'
    AND column_name = 'old_value';

  SELECT data_type INTO new_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'system_config_history'
    AND column_name = 'new_value';

  IF old_type IS NOT NULL AND old_type <> 'jsonb' THEN
    ALTER TABLE public.system_config_history
      ALTER COLUMN old_value TYPE jsonb
      USING CASE WHEN old_value IS NULL THEN NULL ELSE to_jsonb(old_value) END;
  END IF;

  IF new_type IS NOT NULL AND new_type <> 'jsonb' THEN
    ALTER TABLE public.system_config_history
      ALTER COLUMN new_value TYPE jsonb
      USING CASE WHEN new_value IS NULL THEN NULL ELSE to_jsonb(new_value) END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_config_history_field
  ON public.system_config_history(field_path, created_at DESC);

INSERT INTO public.system_config_values(key, value)
VALUES
  ('maintenanceMode', 'false'::jsonb),
  ('maintenanceMessage', 'null'::jsonb),
  ('sessionTimeoutMinutes', '60'::jsonb),
  ('maxFailedLoginAttempts', '5'::jsonb),
  ('twoFactorRequired', 'false'::jsonb),
  ('passwordExpiryDays', '90'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Security dashboard logs
-- ---------------------------------------------------------------------------

ALTER TABLE public.blocked_ips ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource_id text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON public.audit_logs(action, created_at DESC);

ALTER TABLE public.auth_logs ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
CREATE INDEX IF NOT EXISTS idx_auth_logs_status_created ON public.auth_logs(status, created_at DESC);

ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'security_events' AND column_name = 'actor_id'
  ) THEN
    UPDATE public.security_events
    SET user_id = COALESCE(user_id, actor_id)
    WHERE user_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'security_events' AND column_name = 'event_type'
  ) THEN
    UPDATE public.security_events
    SET description = COALESCE(description, event_type)
    WHERE description IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_security_events_user_created ON public.security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_created ON public.security_events(event_type, created_at DESC);

ALTER TABLE public.rls_audit_log ADD COLUMN IF NOT EXISTS operation text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rls_audit_log' AND column_name = 'action'
  ) THEN
    UPDATE public.rls_audit_log
    SET operation = COALESCE(operation, action)
    WHERE operation IS NULL;
  END IF;
END $$;

-- Keep the backend RPC available for the RLS dashboard.
DROP FUNCTION IF EXISTS public.get_rls_policies(text);

CREATE OR REPLACE FUNCTION public.get_rls_policies()
RETURNS TABLE (
  table_name text,
  policy_name text,
  policy_type text,
  enabled boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (p.schemaname || '.' || p.tablename)::text AS table_name,
    p.policyname::text AS policy_name,
    p.cmd::text AS policy_type,
    true AS enabled
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  ORDER BY p.tablename, p.policyname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Menu/POS/document-template configuration used by SuperAdmin screens
-- ---------------------------------------------------------------------------

ALTER TABLE public.dynamic_services ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'fixed';
ALTER TABLE public.dynamic_services ADD COLUMN IF NOT EXISTS base_price numeric(14,2);
ALTER TABLE public.dynamic_services ADD COLUMN IF NOT EXISTS price_per_hour numeric(14,2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dynamic_services' AND column_name = 'price'
  ) THEN
    UPDATE public.dynamic_services
    SET base_price = COALESCE(base_price, price)
    WHERE base_price IS NULL;
  END IF;
END $$;

ALTER TABLE public.pos_outlets ADD COLUMN IF NOT EXISTS till_number text;
ALTER TABLE public.pos_outlet_items
  ADD COLUMN IF NOT EXISTS branch_id integer REFERENCES public.branches(id),
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

UPDATE public.pos_outlet_items poi
SET branch_id = po.branch_id
FROM public.pos_outlets po
WHERE poi.outlet_id = po.id
  AND poi.branch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_pos_outlet_items_branch_id ON public.pos_outlet_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlet_items_branch_outlet ON public.pos_outlet_items(branch_id, outlet_id);

CREATE OR REPLACE FUNCTION public.sync_pos_outlet_items_branch()
RETURNS trigger AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.outlet_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id
    FROM public.pos_outlets
    WHERE id = NEW.outlet_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pos_outlet_items_branch ON public.pos_outlet_items;
CREATE TRIGGER trg_sync_pos_outlet_items_branch
BEFORE INSERT OR UPDATE OF outlet_id, branch_id ON public.pos_outlet_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_pos_outlet_items_branch();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pos_outlet_items' AND column_name = 'is_active'
  ) THEN
    UPDATE public.pos_outlet_items
    SET is_available = COALESCE(is_available, is_active)
    WHERE is_available IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.menu_item_branch_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('restaurant', 'bar')),
  item_id text NOT NULL,
  branch_id integer NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  selling_price numeric(14,2),
  is_available boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_type, item_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_item_branch_pricing_branch
  ON public.menu_item_branch_pricing(branch_id, item_type);

DROP TRIGGER IF EXISTS trg_menu_item_branch_pricing_updated_at ON public.menu_item_branch_pricing;
CREATE TRIGGER trg_menu_item_branch_pricing_updated_at
BEFORE UPDATE ON public.menu_item_branch_pricing
FOR EACH ROW EXECUTE FUNCTION public.fg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  branch_id integer REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  document_type text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, branch_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS document_templates_global_key_uidx
  ON public.document_templates(template_key)
  WHERE branch_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_document_templates_branch
  ON public.document_templates(branch_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER trg_document_templates_updated_at
BEFORE UPDATE ON public.document_templates
FOR EACH ROW EXECUTE FUNCTION public.fg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  type varchar(100) NOT NULL,
  category varchar(100) NOT NULL,
  description text,
  query_template text,
  parameters_schema jsonb,
  output_format varchar(50) NOT NULL DEFAULT 'pdf',
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_type ON public.report_templates(type);
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON public.report_templates(category);

DROP TRIGGER IF EXISTS trg_report_templates_updated_at ON public.report_templates;
CREATE TRIGGER trg_report_templates_updated_at
BEFORE UPDATE ON public.report_templates
FOR EACH ROW EXECUTE FUNCTION public.fg_touch_updated_at();

INSERT INTO public.report_templates (name, type, category, description, is_system)
VALUES
  ('Occupancy Report', 'occupancy', 'operations', 'Room occupancy rates and trends', true),
  ('Revenue Report', 'revenue', 'financial', 'Income by source and period', true),
  ('Stock Levels', 'stock_levels', 'inventory', 'Current inventory status', true),
  ('Purchase Orders', 'purchase_orders', 'inventory', 'Order history and status', true),
  ('Security Report', 'security', 'security', 'Security events and access control review', true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Payroll policy compatibility for SuperAdmin payroll setup screens
-- ---------------------------------------------------------------------------

ALTER TABLE public.payroll_policies ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.payroll_policies ADD COLUMN IF NOT EXISTS formula_type text;
ALTER TABLE public.payroll_policies ADD COLUMN IF NOT EXISTS rate numeric(14,4);
ALTER TABLE public.payroll_policies ADD COLUMN IF NOT EXISTS min_limit numeric(14,2);
ALTER TABLE public.payroll_policies ADD COLUMN IF NOT EXISTS max_limit numeric(14,2);

UPDATE public.payroll_policies
SET
  category = COALESCE(category, policy_type),
  formula_type = COALESCE(formula_type, rule_data->>'formula_type'),
  rate = COALESCE(rate, NULLIF(rule_data->>'rate', '')::numeric),
  min_limit = COALESCE(min_limit, NULLIF(rule_data->>'min_limit', '')::numeric),
  max_limit = COALESCE(max_limit, NULLIF(rule_data->>'max_limit', '')::numeric)
WHERE rule_data IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS hardening for backend-managed SuperAdmin support tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.superadmin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_branch_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superadmin_audit_log_service_role ON public.superadmin_audit_log;
CREATE POLICY superadmin_audit_log_service_role ON public.superadmin_audit_log
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS feature_flags_service_role ON public.feature_flags;
CREATE POLICY feature_flags_service_role ON public.feature_flags
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS announcements_service_role ON public.announcements;
CREATE POLICY announcements_service_role ON public.announcements
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS announcement_reads_service_role ON public.announcement_reads;
CREATE POLICY announcement_reads_service_role ON public.announcement_reads
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS impersonation_sessions_service_role ON public.impersonation_sessions;
CREATE POLICY impersonation_sessions_service_role ON public.impersonation_sessions
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS security_config_service_role ON public.security_config;
CREATE POLICY security_config_service_role ON public.security_config
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS system_config_values_service_role ON public.system_config_values;
CREATE POLICY system_config_values_service_role ON public.system_config_values
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS system_config_history_service_role ON public.system_config_history;
CREATE POLICY system_config_history_service_role ON public.system_config_history
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS menu_item_branch_pricing_service_role ON public.menu_item_branch_pricing;
CREATE POLICY menu_item_branch_pricing_service_role ON public.menu_item_branch_pricing
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS document_templates_service_role ON public.document_templates;
CREATE POLICY document_templates_service_role ON public.document_templates
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS report_templates_service_role ON public.report_templates;
CREATE POLICY report_templates_service_role ON public.report_templates
FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
