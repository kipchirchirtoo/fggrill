-- ============================================================
-- 0029_cashier_shift_logs_approval_cols.sql
-- cashier-shifts.controller uses these columns for the
-- pending_open → open approval workflow but they were not
-- present in the clean-db schema.
-- ============================================================

ALTER TABLE public.cashier_shift_logs
  ADD COLUMN IF NOT EXISTS requested_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opening_requested_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS opening_approved_by  UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS opening_approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opening_rejected_by  UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS opening_rejected_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opening_review_notes TEXT;
