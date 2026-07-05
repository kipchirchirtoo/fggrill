-- POS login tracking + PIN uniqueness enforcement.
-- 1. Unique partial index ensures no two active users share the same POS PIN.
-- 2. pos_login_logs records every waiter/cashier PIN login attempt for audit.

-- Unique PIN index (NULLs are exempt — multiple staff may have no PIN assigned)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pos_pin_unique
  ON public.users(pos_pin)
  WHERE pos_pin IS NOT NULL;

-- Dedicated POS login log
CREATE TABLE IF NOT EXISTS public.pos_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  outlet_id UUID REFERENCES public.pos_outlets(id) ON DELETE SET NULL,
  outlet_type TEXT,
  pin_prefix CHAR(1),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason TEXT,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_login_logs_user_date
  ON public.pos_login_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_login_logs_branch_date
  ON public.pos_login_logs(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_login_logs_outlet_date
  ON public.pos_login_logs(outlet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_login_logs_created
  ON public.pos_login_logs(created_at DESC);
