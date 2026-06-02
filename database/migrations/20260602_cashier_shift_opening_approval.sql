-- Cashier shift opening now requires branch accountant approval.
-- Existing closed/reconciled shift behavior is preserved.

ALTER TABLE IF EXISTS public.cashier_shift_logs
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS opening_requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opening_approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opening_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opening_rejected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opening_rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opening_review_notes TEXT;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT c.conname
    INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'cashier_shift_logs'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.cashier_shift_logs DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE IF EXISTS public.cashier_shift_logs
  ADD CONSTRAINT cashier_shift_logs_status_check
  CHECK (
    status IN (
      'pending_open',
      'open',
      'closed',
      'reconciled',
      'verified',
      'rejected',
      'cancelled'
    )
  );

CREATE INDEX IF NOT EXISTS idx_cashier_shift_logs_opening_queue
  ON public.cashier_shift_logs(branch_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_cashier_shift_logs_cashier_active
  ON public.cashier_shift_logs(cashier_id, status)
  WHERE status IN ('pending_open', 'open');
