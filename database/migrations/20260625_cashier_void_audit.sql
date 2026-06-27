-- Cashier Void Management — Branch Accountant audit support.
-- Additive only. Run manually in the Supabase SQL Editor (not auto-applied).
-- Inspected against the live DB on 2026-06-25:
--   - pos_void_requests has no reason_category column today (item-level voids do).
--   - pos_item_void_requests.reason_category is CHECK-constrained to 5 legacy values;
--     widening it (not replacing) so existing pending/historical rows stay valid.
--   - shift_void_ledger / branch_accountant_actions do not exist; the real existing
--     ledger is pos_item_void_log (item voids) — no equivalent exists yet for whole-bill
--     voids, so whole-bill detail is captured into the existing void_bills_audit.details
--     jsonb column instead of a new table.

-- 1. Whole-bill void requests need the same structured reason dropdown item voids have.
ALTER TABLE public.pos_void_requests
  ADD COLUMN IF NOT EXISTS reason_category TEXT;

-- 2. Widen the item-void reason categories to the new 9-option dropdown, without
--    dropping the 5 legacy values already in use by historical/pending rows.
ALTER TABLE public.pos_item_void_requests
  DROP CONSTRAINT IF EXISTS pos_item_void_requests_reason_category_check;
ALTER TABLE public.pos_item_void_requests
  ADD CONSTRAINT pos_item_void_requests_reason_category_check
  CHECK (reason_category = ANY (ARRAY[
    -- legacy (kept for existing rows)
    'wrong_order', 'duplicate_entry', 'customer_changed_mind', 'pricing_error',
    -- new cashier void-management dropdown
    'customer_changed_order', 'item_out_of_stock', 'wrong_item_ordered',
    'duplicate_order', 'customer_cancelled', 'quality_issue',
    'manager_instruction', 'billing_error',
    -- shared
    'other'
  ]));

-- Same widened set for whole-bill voids (column is new, so no legacy rows to protect).
ALTER TABLE public.pos_void_requests
  DROP CONSTRAINT IF EXISTS pos_void_requests_reason_category_check;
ALTER TABLE public.pos_void_requests
  ADD CONSTRAINT pos_void_requests_reason_category_check
  CHECK (reason_category IS NULL OR reason_category = ANY (ARRAY[
    'customer_changed_order', 'item_out_of_stock', 'wrong_item_ordered',
    'duplicate_order', 'customer_cancelled', 'quality_issue',
    'manager_instruction', 'billing_error', 'other'
  ]));

-- 3. One row per cashier_shift_logs shift, compiled when that shift closes.
-- shift_id references cashier_shift_logs (the spec's trigger), NOT pos_outlet_shifts —
-- the backend bridges the two by cashier_id + time window at compile time, the same
-- heuristic already used elsewhere in this codebase (see getLastClosedCashierShiftWindow
-- in backend/src/utils/posStationAccess.ts).
CREATE TABLE IF NOT EXISTS public.cashier_shift_void_audits (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id             UUID NOT NULL REFERENCES public.cashier_shift_logs(id) ON DELETE CASCADE,
  branch_id            INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  cashier_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  outlet_shift_ids      UUID[] NOT NULL DEFAULT '{}',  -- pos_outlet_shifts.id values rolled into this summary
  shift_opened_at      TIMESTAMPTZ,
  shift_closed_at      TIMESTAMPTZ,
  total_bills_voided   INTEGER NOT NULL DEFAULT 0,
  total_items_voided   INTEGER NOT NULL DEFAULT 0,
  total_value_voided   NUMERIC NOT NULL DEFAULT 0,
  gross_shift_revenue  NUMERIC NOT NULL DEFAULT 0,
  void_pct_of_revenue  NUMERIC NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMPTZ,
  flagged_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  flagged_at           TIMESTAMPTZ,
  accountant_note      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cashier_shift_void_audits_shift_unique UNIQUE (shift_id),
  CONSTRAINT cashier_shift_void_audits_status_check
    CHECK (status = ANY (ARRAY['pending_review','reviewed','flagged']))
);

CREATE INDEX IF NOT EXISTS idx_cashier_shift_void_audits_branch_status
  ON public.cashier_shift_void_audits(branch_id, status);
