-- Shift reconciliation module on top of the live cashier_shift_logs workflow.
-- Extends the existing close-shift process with blind cashier entries for
-- cash, M-Pesa, and card, and structured branch-accountant hard-close data.

ALTER TABLE IF EXISTS public.cashier_shift_logs
  ADD COLUMN IF NOT EXISTS actual_cash_counted NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_mpesa_logged NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_card_logged NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mpesa_summary_ref TEXT,
  ADD COLUMN IF NOT EXISTS card_batch_ref TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS hard_closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hard_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS variance_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS variance_comment TEXT;

ALTER TABLE IF EXISTS public.cashier_shift_logs
  DROP CONSTRAINT IF EXISTS cashier_shift_logs_reconciliation_status_check;

ALTER TABLE IF EXISTS public.cashier_shift_logs
  ADD CONSTRAINT cashier_shift_logs_reconciliation_status_check
  CHECK (
    reconciliation_status IN (
      'not_started',
      'pending_reconciliation',
      'reconciled',
      'hard_closed',
      'flagged'
    )
  );

CREATE INDEX IF NOT EXISTS idx_cashier_shift_logs_reconciliation_queue
  ON public.cashier_shift_logs(branch_id, reconciliation_status, shift_end DESC);

ALTER TABLE IF EXISTS public.shift_actual_collections
  ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entry_reference TEXT,
  ADD COLUMN IF NOT EXISTS entry_source TEXT DEFAULT 'blind_shift_close';

ALTER TABLE IF EXISTS public.shift_actual_collections
  DROP CONSTRAINT IF EXISTS shift_actual_collections_payment_method_check;

ALTER TABLE IF EXISTS public.shift_actual_collections
  ADD CONSTRAINT shift_actual_collections_payment_method_check
  CHECK (payment_method IN ('cash', 'mpesa', 'card', 'credit'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_actual_collections_shift_method
  ON public.shift_actual_collections(shift_id, payment_method);
