-- ============================================================
-- Migration 0005e: Accounting, LINA, Payment systems, Budgets,
--                  Guest messages, Misc tables
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ACCOUNTING MODULE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounting_chart_of_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  account_code  TEXT NOT NULL,
  account_name  TEXT NOT NULL,
  account_type  TEXT NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  parent_id     UUID REFERENCES public.accounting_chart_of_accounts(id),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, account_code)
);

CREATE TABLE IF NOT EXISTS public.accounting_journal_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  entry_number    TEXT UNIQUE NOT NULL,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  description     TEXT,
  reference       TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  total_debit     NUMERIC(14,2) DEFAULT 0,
  total_credit    NUMERIC(14,2) DEFAULT 0,
  created_by      UUID REFERENCES public.users(id),
  posted_by       UUID REFERENCES public.users(id),
  posted_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounting_journal_lines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id       UUID NOT NULL REFERENCES public.accounting_journal_entries(id) ON DELETE CASCADE,
  account_id     UUID NOT NULL REFERENCES public.accounting_chart_of_accounts(id),
  description    TEXT,
  debit          NUMERIC(14,2) DEFAULT 0,
  credit         NUMERIC(14,2) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounting_customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      INTEGER REFERENCES public.branches(id),
  name           TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  address        TEXT,
  tax_number     TEXT,
  credit_limit   NUMERIC(14,2) DEFAULT 0,
  balance        NUMERIC(14,2) DEFAULT 0,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounting_vendors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      INTEGER REFERENCES public.branches(id),
  name           TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  address        TEXT,
  tax_number     TEXT,
  payment_terms  TEXT,
  balance        NUMERIC(14,2) DEFAULT 0,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounting_ar_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  invoice_number  TEXT UNIQUE NOT NULL,
  customer_id     UUID REFERENCES public.accounting_customers(id),
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  subtotal        NUMERIC(14,2) DEFAULT 0,
  tax_amount      NUMERIC(14,2) DEFAULT 0,
  total           NUMERIC(14,2) DEFAULT 0,
  amount_paid     NUMERIC(14,2) DEFAULT 0,
  balance         NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'open' CHECK (status IN ('draft','open','partial','paid','overdue','voided')),
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounting_ap_bills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  bill_number     TEXT UNIQUE NOT NULL,
  vendor_id       UUID REFERENCES public.accounting_vendors(id),
  bill_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  total           NUMERIC(14,2) DEFAULT 0,
  amount_paid     NUMERIC(14,2) DEFAULT 0,
  balance         NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'open' CHECK (status IN ('draft','open','partial','paid','voided')),
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounting_bank_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  txn_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  description     TEXT,
  amount          NUMERIC(14,2) NOT NULL,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('debit','credit')),
  reference       TEXT,
  reconciled      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounting_budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  period_from     DATE NOT NULL,
  period_to       DATE NOT NULL,
  account_id      UUID REFERENCES public.accounting_chart_of_accounts(id),
  budgeted_amount NUMERIC(14,2) DEFAULT 0,
  actual_amount   NUMERIC(14,2) DEFAULT 0,
  variance        NUMERIC(14,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- budgets & revenue targets (also referenced directly)
CREATE TABLE IF NOT EXISTS public.budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER NOT NULL REFERENCES public.branches(id),
  budget_year   INTEGER NOT NULL,
  budget_month  INTEGER,
  category      TEXT DEFAULT 'overall',
  budgeted_amount NUMERIC(14,2) DEFAULT 0,
  actual_amount NUMERIC(14,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, budget_year, budget_month, category)
);

CREATE TABLE IF NOT EXISTS public.budget_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id    UUID REFERENCES public.budgets(id),
  adjustment   NUMERIC(14,2) NOT NULL,
  reason       TEXT,
  approved_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- PAYMENT SYSTEMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  payment_ref     TEXT NOT NULL,
  payment_method  TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','verified','rejected','expired')),
  verified_by     UUID REFERENCES public.users(id),
  verified_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.banking_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  txn_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  description     TEXT,
  amount          NUMERIC(14,2) NOT NULL,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('debit','credit')),
  bank_name       TEXT,
  account_number  TEXT,
  reference       TEXT,
  reconciled      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.banking_reconciliations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  period_from     DATE NOT NULL,
  period_to       DATE NOT NULL,
  opening_balance NUMERIC(14,2) DEFAULT 0,
  closing_balance NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved')),
  prepared_by     UUID REFERENCES public.users(id),
  approved_by     UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  txn_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  reference       TEXT,
  description     TEXT,
  debit           NUMERIC(14,2) DEFAULT 0,
  credit          NUMERIC(14,2) DEFAULT 0,
  balance         NUMERIC(14,2) DEFAULT 0,
  reconciled      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- LINA AI MODULE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lina_agent_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      INTEGER REFERENCES public.branches(id),
  session_id     TEXT NOT NULL,
  message_role   TEXT NOT NULL CHECK (message_role IN ('user','assistant','system','tool')),
  content        TEXT,
  tool_name      TEXT,
  tool_input     JSONB,
  tool_result    JSONB,
  tokens_used    INTEGER DEFAULT 0,
  model          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lina_logs_session ON public.lina_agent_logs(session_id, created_at);

CREATE TABLE IF NOT EXISTS public.lina_remediation_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  event_type    TEXT NOT NULL,
  severity      TEXT DEFAULT 'info',
  description   TEXT,
  metadata      JSONB DEFAULT '{}',
  detected_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lina_remediation_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES public.lina_remediation_events(id),
  branch_id     INTEGER REFERENCES public.branches(id),
  proposal_type TEXT NOT NULL,
  description   TEXT,
  sql_query     TEXT,
  estimated_impact TEXT,
  status        TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','executed')),
  approved_by   UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lina_remediation_executions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   UUID REFERENCES public.lina_remediation_proposals(id),
  branch_id     INTEGER REFERENCES public.branches(id),
  status        TEXT DEFAULT 'running'
    CHECK (status IN ('running','completed','failed','rolled_back')),
  result        JSONB DEFAULT '{}',
  error_message TEXT,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.lina_system_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INTEGER REFERENCES public.branches(id),
  snapshot_type TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- GUEST MESSAGES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guest_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  guest_id    UUID REFERENCES public.guests(id),
  channel     TEXT DEFAULT 'sms' CHECK (channel IN ('sms','email','whatsapp','in_app')),
  subject     TEXT,
  body        TEXT NOT NULL,
  status      TEXT DEFAULT 'sent' CHECK (status IN ('pending','sent','delivered','failed')),
  sent_by     UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- MISC TABLES REFERENCED BY CONTROLLERS
-- ─────────────────────────────────────────────────────────────

-- kenyan_public_holidays (scheduler.service.ts)
CREATE TABLE IF NOT EXISTS public.kenyan_public_holidays (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- shift_financials (cashier / profit-loss)
CREATE TABLE IF NOT EXISTS public.shift_financials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           INTEGER REFERENCES public.branches(id),
  shift_id            UUID REFERENCES public.pos_shifts(id),
  cashier_id          UUID REFERENCES public.users(id),
  total_sales         NUMERIC(14,2) DEFAULT 0,
  total_cash          NUMERIC(14,2) DEFAULT 0,
  total_mpesa         NUMERIC(14,2) DEFAULT 0,
  total_card          NUMERIC(14,2) DEFAULT 0,
  total_credit        NUMERIC(14,2) DEFAULT 0,
  total_discounts     NUMERIC(14,2) DEFAULT 0,
  total_voids         NUMERIC(14,2) DEFAULT 0,
  net_revenue         NUMERIC(14,2) DEFAULT 0,
  opening_float       NUMERIC(14,2) DEFAULT 0,
  closing_float       NUMERIC(14,2) DEFAULT 0,
  cash_variance       NUMERIC(14,2) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- staff_usage_summary (hr / director analytics)
CREATE TABLE IF NOT EXISTS public.staff_usage_summary (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID REFERENCES public.staff_profiles(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  period_month INTEGER NOT NULL,
  period_year  INTEGER NOT NULL,
  days_present INTEGER DEFAULT 0,
  days_absent  INTEGER DEFAULT 0,
  days_late    INTEGER DEFAULT 0,
  hours_worked NUMERIC(8,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, period_month, period_year)
);

-- ─────────────────────────────────────────────────────────────
-- ADDITIONAL ACCOUNTING / FINANCE RPCs
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_profit_loss_summary(
  p_branch_id  INTEGER,
  p_from       DATE,
  p_to         DATE
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_room_rev    NUMERIC := 0;
  v_fnb_rev     NUMERIC := 0;
  v_conf_rev    NUMERIC := 0;
  v_bar_rev     NUMERIC := 0;
  v_cat_rev     NUMERIC := 0;
  v_other_rev   NUMERIC := 0;
BEGIN
  -- room revenue
  SELECT COALESCE(SUM(total_amount), 0) INTO v_room_rev
  FROM public.folios
  WHERE branch_id = p_branch_id
    AND created_at::DATE BETWEEN p_from AND p_to
    AND status = 'checked_out';

  -- restaurant revenue
  SELECT COALESCE(SUM(total_amount), 0) INTO v_fnb_rev
  FROM public.restaurant_orders
  WHERE branch_id = p_branch_id
    AND created_at::DATE BETWEEN p_from AND p_to
    AND payment_status = 'paid';

  -- bar revenue
  SELECT COALESCE(SUM(total_amount), 0) INTO v_bar_rev
  FROM public.bar_orders
  WHERE branch_id = p_branch_id
    AND created_at::DATE BETWEEN p_from AND p_to
    AND status = 'completed';

  -- conference revenue
  SELECT COALESCE(SUM(total_amount), 0) INTO v_conf_rev
  FROM public.conference_bookings
  WHERE branch_id = p_branch_id
    AND created_at::DATE BETWEEN p_from AND p_to
    AND status = 'confirmed';

  RETURN jsonb_build_object(
    'room_revenue',       v_room_rev,
    'fnb_revenue',        v_fnb_rev,
    'bar_revenue',        v_bar_rev,
    'conference_revenue', v_conf_rev,
    'catering_revenue',   v_cat_rev,
    'other_revenue',      v_other_rev,
    'total_revenue',      v_room_rev + v_fnb_rev + v_bar_rev + v_conf_rev + v_cat_rev + v_other_rev
  );
END;
$$;

-- RPC used by director-enhanced.controller
CREATE OR REPLACE FUNCTION public.get_daily_snapshot(
  p_branch_id INTEGER,
  p_date      DATE DEFAULT CURRENT_DATE
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_row public.financial_daily_snapshots;
BEGIN
  SELECT * INTO v_row
  FROM public.financial_daily_snapshots
  WHERE branch_id = p_branch_id AND snapshot_date = p_date;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('branch_id', p_branch_id, 'snapshot_date', p_date, 'exists', false);
  END IF;

  RETURN to_jsonb(v_row) || jsonb_build_object('exists', true);
END;
$$;

-- RPC used by branch-analytics.controller
CREATE OR REPLACE FUNCTION public.get_branch_analytics(
  p_branch_id INTEGER,
  p_from      DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_to        DATE DEFAULT CURRENT_DATE
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_total_revenue  NUMERIC := 0;
  v_total_bookings INTEGER := 0;
  v_occupancy_rate NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(total_revenue), 0)
  INTO v_total_revenue
  FROM public.financial_daily_snapshots
  WHERE branch_id = p_branch_id AND snapshot_date BETWEEN p_from AND p_to;

  SELECT COUNT(*)
  INTO v_total_bookings
  FROM public.bookings
  WHERE branch_id = p_branch_id
    AND created_at::DATE BETWEEN p_from AND p_to;

  SELECT COALESCE(AVG(occupancy_rate), 0)
  INTO v_occupancy_rate
  FROM public.financial_daily_snapshots
  WHERE branch_id = p_branch_id AND snapshot_date BETWEEN p_from AND p_to;

  RETURN jsonb_build_object(
    'total_revenue',  v_total_revenue,
    'total_bookings', v_total_bookings,
    'occupancy_rate', v_occupancy_rate,
    'period_from',    p_from,
    'period_to',      p_to
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- FOLIO EXTENDED ITEMS (used by cashier folio controller)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.folio_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id     UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  charge_date  DATE DEFAULT CURRENT_DATE,
  department   TEXT,
  amount       NUMERIC(14,2) DEFAULT 0,
  quantity     NUMERIC(14,3) DEFAULT 1,
  unit_price   NUMERIC(14,2) DEFAULT 0,
  voided       BOOLEAN DEFAULT FALSE,
  voided_by    UUID REFERENCES public.users(id),
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.folio_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id       UUID NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reference      TEXT,
  received_by    UUID REFERENCES public.users(id),
  received_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- DISPATCH_OTPS (referenced by dispatch.controller.ts)
-- The generate_dispatch_otp / verify_dispatch_otp functions were
-- created in migration 0002 using the _otps table.
-- Backend code references a `dispatch_otps` table directly in some queries.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dispatch_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES public.dispatches(id),
  driver_id   UUID REFERENCES public.drivers(id),
  otp_code    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  used        BOOLEAN DEFAULT FALSE,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- MISSING COLUMNS ON EXISTING CANONICAL TABLES (catch-all)
-- ─────────────────────────────────────────────────────────────

-- branch_payments: many missing columns (added via ALTER)
ALTER TABLE public.branch_payments
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS payment_date     DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS currency         TEXT DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS requires_director BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manager_id       UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS director_id      UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS director_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_url      TEXT,
  ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- purchase_orders: missing workflow columns
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS po_date          DATE GENERATED ALWAYS AS (order_date::DATE) STORED,
  ADD COLUMN IF NOT EXISTS payment_terms    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_terms   TEXT,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  ADD COLUMN IF NOT EXISTS sent_to_supplier BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_by_id       UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS created_by_id    UUID REFERENCES public.users(id);

-- goods_receipts: missing columns
ALTER TABLE public.goods_receipts
  ADD COLUMN IF NOT EXISTS total_items      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attachments      JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS grn_approved     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS received_by_id   UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_by_id   UUID REFERENCES public.users(id);

-- goods_receipt_lines: missing columns
ALTER TABLE public.goods_receipt_lines
  ADD COLUMN IF NOT EXISTS quantity_damaged NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_number     TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date      DATE;

-- supplier_invoices: missing workflow columns
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS vat_rate_type    TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by_id  UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS submitted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by_id   UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_locked        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supplier_pin     TEXT,
  ADD COLUMN IF NOT EXISTS supplier_vat_registered BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supplier_vat_number TEXT,
  ADD COLUMN IF NOT EXISTS grni_cleared_id  UUID,
  ADD COLUMN IF NOT EXISTS invoice_document_url TEXT,
  ADD COLUMN IF NOT EXISTS created_by_id    UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_by_id   UUID REFERENCES public.users(id);

-- branch_requisitions: missing workflow columns
ALTER TABLE public.branch_requisitions
  ADD COLUMN IF NOT EXISTS request_type     TEXT DEFAULT 'stock',
  ADD COLUMN IF NOT EXISTS document_number  TEXT,
  ADD COLUMN IF NOT EXISTS barcode_value    TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by      UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes     TEXT,
  ADD COLUMN IF NOT EXISTS needed_by_date   DATE,
  ADD COLUMN IF NOT EXISTS submitted_to_auditor_at TIMESTAMPTZ;

-- branch_requisition_lines: missing columns
ALTER TABLE public.branch_requisition_lines
  ADD COLUMN IF NOT EXISTS current_branch_stock NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_sku         TEXT;

-- stock_takes: missing columns
ALTER TABLE public.stock_takes
  ADD COLUMN IF NOT EXISTS count_date       DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS store_type       TEXT DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS outlet_code      TEXT,
  ADD COLUMN IF NOT EXISTS counted_by       UUID REFERENCES public.users(id);

-- stock_take_lines: missing columns
ALTER TABLE public.stock_take_lines
  ADD COLUMN IF NOT EXISTS store_type       TEXT,
  ADD COLUMN IF NOT EXISTS issued_quantity  NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_closing_stock NUMERIC(14,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_cost        NUMERIC(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance_reason  TEXT,
  ADD COLUMN IF NOT EXISTS variance_percentage NUMERIC(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variance_severity TEXT,
  ADD COLUMN IF NOT EXISTS item_sku         TEXT;

-- inventory_items: additional columns referenced by backend
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS store_type       TEXT DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS quantity         NUMERIC(14,3) DEFAULT 0;

-- dispatches: ensure key columns exist
ALTER TABLE public.dispatches
  ADD COLUMN IF NOT EXISTS vehicle_id       UUID REFERENCES public.vehicles(id),
  ADD COLUMN IF NOT EXISTS driver_id        UUID REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS driver_phone     TEXT;

-- ─────────────────────────────────────────────────────────────
-- MISSING VIEWS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_hk_daily_summary AS
SELECT
  hd.branch_id,
  hd.metric_date,
  hd.tasks_completed,
  hd.inspections_passed,
  hd.avg_quality_score,
  hd.occupancy_rate,
  (SELECT COUNT(*) FROM public.hk_tasks ht
   WHERE ht.branch_id = hd.branch_id
     AND ht.created_at::DATE = hd.metric_date) AS total_tasks,
  (SELECT COUNT(*) FROM public.hk_tasks ht
   WHERE ht.branch_id = hd.branch_id
     AND ht.created_at::DATE = hd.metric_date
     AND ht.status = 'completed') AS completed_tasks
FROM public.hk_daily_metrics hd;

CREATE OR REPLACE VIEW public.vw_hk_staff_workload AS
SELECT
  sm.staff_id,
  u.full_name AS staff_name,
  sm.branch_id,
  sm.metric_date,
  sm.tasks_completed,
  sm.avg_quality_score,
  sm.points_earned
FROM public.hk_staff_daily_metrics sm
JOIN public.users u ON u.id = sm.staff_id;

CREATE OR REPLACE VIEW public.v_central_spoilage_log AS
SELECT
  csl.id,
  csl.branch_id,
  csl.spoilage_date,
  csl.item_name,
  csl.quantity,
  csl.unit,
  csl.unit_cost,
  csl.total_value,
  csl.reason,
  csl.status,
  u.full_name AS reported_by_name,
  b.name AS branch_name
FROM public.central_spoilage_log csl
LEFT JOIN public.users u ON u.id = csl.reported_by
LEFT JOIN public.branches b ON b.id = csl.branch_id;

-- ─────────────────────────────────────────────────────────────
-- STORAGE BUCKET SETUP (via SQL seed — actual bucket creation
-- must be done via Supabase dashboard or management API)
-- ─────────────────────────────────────────────────────────────
-- Insert bucket definitions into storage.buckets if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES
      ('menu-items',          'menu-items',          TRUE),
      ('menu-images',         'menu-images',          TRUE),
      ('profile-photos',      'profile-photos',       FALSE),
      ('inventory-photos',    'inventory-photos',     FALSE),
      ('maintenance-photos',  'maintenance-photos',   FALSE),
      ('staff-documents',     'staff-documents',      FALSE)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;
