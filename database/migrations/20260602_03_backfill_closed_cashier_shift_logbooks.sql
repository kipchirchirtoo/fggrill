-- Backfill accountant-review logbooks for cashier shifts that were closed
-- before the cashier_shift_logs close route generated cashier_logbooks.

ALTER TABLE IF EXISTS public.cashier_logbooks
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accountant_reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accountant_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accountant_notes TEXT;

ALTER TABLE IF EXISTS public.cashier_logbooks
  DROP CONSTRAINT IF EXISTS cashier_logbooks_status_check;

ALTER TABLE IF EXISTS public.cashier_logbooks
  ADD CONSTRAINT cashier_logbooks_status_check CHECK (status IN (
    'open',
    'closed',
    'pending_accountant_review',
    'pending_audit',
    'approved',
    'rejected'
  ));

ALTER TABLE IF EXISTS public.cashier_logbooks
  DROP CONSTRAINT IF EXISTS cashier_logbooks_type_check;

ALTER TABLE IF EXISTS public.cashier_logbooks
  ADD CONSTRAINT cashier_logbooks_type_check CHECK (type IN (
    'reception',
    'bar',
    'restaurant',
    'main_bar',
    'executive_bar',
    'non_consumables',
    'cashier',
    'kyogong_reception',
    'kyogong_spa',
    'kyogong_executive_bar',
    'kyogong_sports_bar',
    'unified_pos'
  ));

ALTER TABLE IF EXISTS public.cashier_logbooks
  DROP CONSTRAINT IF EXISTS cashier_logbooks_branch_id_type_log_date_key;

INSERT INTO public.cashier_logbooks (
  branch_id,
  cashier_id,
  type,
  log_date,
  opening_float,
  closing_float,
  sales_breakdown,
  total_mpesa,
  total_swipe,
  notes,
  status,
  source,
  cashier_shift_id,
  submitted_at,
  updated_at
)
SELECT
  csl.branch_id,
  csl.cashier_id,
  'cashier',
  COALESCE(csl.shift_start::date, CURRENT_DATE),
  COALESCE(csl.opening_float, 0),
  COALESCE(csl.closing_float, csl.cash_at_hand, 0),
  jsonb_build_object(
    'source', 'cashier_shift_logs_backfill',
    'shift_id', csl.id,
    'shift_number', csl.shift_number,
    'cashier_name', csl.cashier_name,
    'total_cash', COALESCE(csl.total_cash_sales, 0),
    'total_mpesa', COALESCE(csl.total_mpesa_sales, 0),
    'total_card', COALESCE(csl.total_card_sales, 0),
    'total_sales', COALESCE(csl.total_sales, 0),
    'expected_closing_float', COALESCE(csl.expected_closing_float, 0),
    'variance', COALESCE(csl.variance, 0),
    'transaction_count', COALESCE(csl.transaction_count, 0),
    'restaurant_revenue', COALESCE(csl.restaurant_revenue, 0),
    'bar_revenue', COALESCE(csl.bar_revenue, 0),
    'room_booking_revenue', COALESCE(csl.room_booking_revenue, 0),
    'conference_revenue', COALESCE(csl.conference_revenue, 0),
    'swimming_pool_revenue', COALESCE(csl.swimming_pool_revenue, 0),
    'other_revenue', COALESCE(csl.other_revenue, 0),
    'unpaid_bills_value', COALESCE(csl.unpaid_bills_value, 0),
    'unpaid_bills_count', COALESCE(csl.unpaid_bills_count, 0),
    'paid_bills_value', COALESCE(csl.paid_bills_value, 0),
    'paid_bills_count', COALESCE(csl.paid_bills_count, 0)
  ),
  COALESCE(csl.total_mpesa_sales, 0),
  COALESCE(csl.total_card_sales, 0),
  COALESCE(csl.notes, 'Generated automatically from a previously closed cashier shift.'),
  'pending_accountant_review',
  'cashier_shift_close_backfill',
  csl.id,
  COALESCE(csl.shift_end, NOW()),
  NOW()
FROM public.cashier_shift_logs csl
WHERE csl.status = 'closed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.cashier_logbooks cl
    WHERE cl.cashier_shift_id = csl.id
  )
ON CONFLICT (cashier_shift_id) WHERE cashier_shift_id IS NOT NULL
DO UPDATE SET
  opening_float = EXCLUDED.opening_float,
  closing_float = EXCLUDED.closing_float,
  sales_breakdown = EXCLUDED.sales_breakdown,
  total_mpesa = EXCLUDED.total_mpesa,
  total_swipe = EXCLUDED.total_swipe,
  updated_at = NOW();
