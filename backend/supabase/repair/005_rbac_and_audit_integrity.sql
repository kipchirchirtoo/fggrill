-- 005 RBAC and audit integrity
-- Do not merge public.users and public.staff_profiles.
-- public.users = login/auth records.
-- public.staff_profiles = HR/personnel records.

CREATE TABLE IF NOT EXISTS public.user_branch_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  branch_id INTEGER REFERENCES public.branches(id),
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id, role)
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  actor_user_id UUID,
  actor_staff_id UUID,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  source_document TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_branch_created ON public.audit_events (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_branch_roles_user_branch ON public.user_branch_roles (user_id, branch_id);
