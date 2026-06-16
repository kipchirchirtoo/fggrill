-- ================================================================
-- Migration 0008: Branch Master, Cashier Module, and POS Outlet Fixes
--
-- Purpose:
--   1. Seed clean-db branches with old live DB numeric ids 1-10.
--   2. Ensure Kyogong-only outlets exist only under branch 1.
--   3. Expand cashier/logbook/payment/receipt tables to match backend
--      runtime code instead of the earlier placeholder schema.
--
-- Notes:
--   - public.users and public.staff_profiles remain separate.
--   - Backend REST/RBAC remains the write boundary for these objects.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- Branch master compatibility
-- ----------------------------------------------------------------
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

INSERT INTO public.branches (
  id, branch_code, code, name, legal_name, city, location,
  address, phone, email, is_active, created_at, updated_at, metadata
) VALUES
  (1, 'KYO', 'KYO', 'Kyogong', 'Kyogong', 'BOMET', 'BOMET', NULL, NULL, NULL, true, '2025-11-26T20:19:29.631Z', '2026-03-02T11:57:58.685Z', '{"legacy_branch_id":1}'::jsonb),
  (2, 'BTN', 'BTN', 'BOMET TOWN', 'BOMET TOWN', 'BOMET', 'BOMET', NULL, NULL, NULL, true, '2025-11-26T20:19:29.631Z', '2025-11-26T20:19:29.631Z', '{"legacy_branch_id":2}'::jsonb),
  (3, 'KPL', 'KPL', 'KAPLONG', 'KAPLONG', 'BOMET', 'BOMET', NULL, NULL, NULL, true, '2025-11-26T20:19:29.631Z', '2025-11-26T20:19:29.631Z', '{"legacy_branch_id":3}'::jsonb),
  (4, 'STK', 'STK', 'SOTIK', 'SOTIK', 'BOMET', 'BOMET', NULL, NULL, NULL, true, '2025-11-26T20:19:29.631Z', '2025-11-26T20:19:29.631Z', '{"legacy_branch_id":4}'::jsonb),
  (5, 'MOG', 'MOG', 'MOGOGOSHIEK', 'MOGOGOSHIEK', 'BOMET', 'BOMET', NULL, NULL, NULL, true, '2025-11-26T20:19:29.631Z', '2025-11-26T20:19:29.631Z', '{"legacy_branch_id":5}'::jsonb),
  (6, 'KPT', 'KPT', 'KAPTOTE', 'KAPTOTE', 'KERICHO', 'KERICHO', NULL, NULL, NULL, true, '2025-11-26T20:19:29.631Z', '2025-11-26T20:19:29.631Z', '{"legacy_branch_id":6}'::jsonb),
  (7, 'LIT', 'LIT', 'LITEIN', 'LITEIN', 'KERICHO', 'KERICHO', NULL, NULL, NULL, true, '2025-11-28T13:49:42.520Z', '2025-11-28T13:49:42.520Z', '{"legacy_branch_id":7}'::jsonb),
  (8, 'KST', 'KST', 'KAPSOIT', 'KAPSOIT', 'KERICHO', 'KERICHO', NULL, NULL, NULL, true, '2026-02-02T09:05:27.114Z', '2026-02-02T09:05:27.114Z', '{"legacy_branch_id":8}'::jsonb),
  (9, 'GRL', 'GRL', 'GRILL', 'GRILL', 'KERICHO', 'KERICHO', NULL, NULL, NULL, true, '2025-12-26T06:41:13.789Z', '2025-12-26T06:41:13.789Z', '{"legacy_branch_id":9}'::jsonb),
  (10, 'GHS', 'GHS', 'GUESTHOUSE', 'GUESTHOUSE', 'KERICHO', 'KERICHO', NULL, NULL, NULL, true, '2025-12-26T06:41:13.789Z', '2025-12-26T06:41:13.789Z', '{"legacy_branch_id":10}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  branch_code = EXCLUDED.branch_code,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  legal_name = EXCLUDED.legal_name,
  city = EXCLUDED.city,
  location = EXCLUDED.location,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active,
  updated_at = COALESCE(EXCLUDED.updated_at, public.branches.updated_at),
  metadata = COALESCE(public.branches.metadata, '{}'::jsonb) || EXCLUDED.metadata;

DO $$
DECLARE
  seq_name TEXT;
BEGIN
  seq_name := pg_get_serial_sequence('public.branches', 'id');
  IF seq_name IS NOT NULL THEN
    EXECUTE format(
      'SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.branches), 10), true)',
      seq_name
    );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS branches_branch_code_uidx
  ON public.branches(branch_code) WHERE branch_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS branches_code_uidx
  ON public.branches(code) WHERE code IS NOT NULL;

-- ----------------------------------------------------------------
-- POS outlet seed and Kyogong branch isolation
-- ----------------------------------------------------------------
ALTER TABLE public.pos_outlets ADD COLUMN IF NOT EXISTS pin_prefix TEXT;
ALTER TABLE public.pos_outlets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Remove bad Kyogong-labeled outlets from non-Kyogong branches when they
-- have no dependent records. If dependent records exist, deactivate them.
DELETE FROM public.pos_outlets po
WHERE po.branch_id <> 1
  AND (lower(po.name) LIKE '%kyogong%' OR lower(po.outlet_code) LIKE '%kyogong%')
  AND NOT EXISTS (SELECT 1 FROM public.pos_outlet_items i WHERE i.outlet_id = po.id)
  AND NOT EXISTS (SELECT 1 FROM public.pos_outlet_shifts s WHERE s.outlet_id = po.id)
  AND NOT EXISTS (SELECT 1 FROM public.pos_shift_orders o WHERE o.outlet_id = po.id);

UPDATE public.pos_outlets
SET is_active = false,
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"deactivated_reason":"Kyogong outlet belongs only to branch 1"}'::jsonb
WHERE branch_id <> 1
  AND (lower(name) LIKE '%kyogong%' OR lower(outlet_code) LIKE '%kyogong%');

WITH branch_rows AS (
  SELECT id AS branch_id, name
  FROM public.branches
  WHERE id BETWEEN 1 AND 10
),
base_outlets AS (
  SELECT branch_id, name || ' Cashier POS' AS outlet_name, 'CASHIER' AS outlet_code, 'cashier' AS outlet_type, 'CH' AS pin_prefix FROM branch_rows
  UNION ALL
  SELECT branch_id, name || ' Restaurant POS', 'RESTAURANT', 'restaurant', 'RT' FROM branch_rows
  UNION ALL
  SELECT branch_id, name || ' Main Bar POS', 'MAIN_BAR', 'main_bar', 'MB' FROM branch_rows
  UNION ALL
  SELECT branch_id, name || ' Non-consumables POS', 'NON_CONSUMABLES', 'other', 'NC' FROM branch_rows
),
kyogong_outlets AS (
  SELECT 1 AS branch_id, 'Kyogong Reception POS' AS outlet_name, 'KYOGONG_RECEPTION' AS outlet_code, 'cashier' AS outlet_type, 'KR' AS pin_prefix
  UNION ALL SELECT 1, 'Kyogong Spa POS', 'KYOGONG_SPA', 'spa', 'KS'
  UNION ALL SELECT 1, 'Kyogong Sports Bar POS', 'KYOGONG_SPORTS_BAR', 'sports_bar', 'SB'
  UNION ALL SELECT 1, 'Kyogong Executive Bar POS', 'KYOGONG_EXECUTIVE_BAR', 'executive_bar', 'EB'
),
seed_outlets AS (
  SELECT * FROM base_outlets
  UNION ALL
  SELECT * FROM kyogong_outlets
)
INSERT INTO public.pos_outlets (
  branch_id, outlet_code, name, outlet_type, pin_prefix, is_active, created_at, updated_at
)
SELECT branch_id, outlet_code, outlet_name, outlet_type, pin_prefix, true, now(), now()
FROM seed_outlets
ON CONFLICT (branch_id, outlet_code) DO UPDATE SET
  name = EXCLUDED.name,
  outlet_type = EXCLUDED.outlet_type,
  pin_prefix = EXCLUDED.pin_prefix,
  is_active = true,
  updated_at = now();

CREATE INDEX IF NOT EXISTS pos_outlets_branch_active_idx
  ON public.pos_outlets(branch_id, is_active);
CREATE INDEX IF NOT EXISTS pos_outlets_branch_type_idx
  ON public.pos_outlets(branch_id, outlet_type);

-- ----------------------------------------------------------------
-- Helper functions used by cashier and receipt controllers
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_cashier_transaction_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'CT' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 1000000))::int::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_shift_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'SHIFT-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_payment_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'FGP-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 100000))::int::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'RCP-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 100000))::int::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_cashier_logbook_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'CLB-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 100000))::int::text, 5, '0');
END;
$$;

-- ----------------------------------------------------------------
-- Cashier shifts and transaction linkage
-- ----------------------------------------------------------------
ALTER TABLE public.cashier_shift_logs ALTER COLUMN action DROP NOT NULL;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS shift_number TEXT;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES public.branches(id);
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES public.users(id);
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS cashier_name TEXT;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS shift_start TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS shift_end TIMESTAMPTZ;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS opening_float NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS closing_float NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS expected_closing_float NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS variance NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS total_cash_sales NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS total_mpesa_sales NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS total_card_sales NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS total_sales NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS transaction_count INTEGER DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES public.users(id);
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.users(id);
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.users(id);
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id);
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS swimming_pool_revenue NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS pool_token_revenue NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS conference_revenue NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS room_booking_revenue NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS restaurant_revenue NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS bar_revenue NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS other_revenue NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS credit_bills_taken NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS credit_bills_count INTEGER DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS unpaid_bills_value NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS unpaid_bills_count INTEGER DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS paid_bills_value NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS paid_bills_count INTEGER DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS credit_bills_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS paid_bills_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS unpaid_bills_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS cash_at_hand NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS cash_deposited NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS bank_deposit_ref TEXT;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS pool_na BOOLEAN DEFAULT false;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS conference_na BOOLEAN DEFAULT false;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS rooms_na BOOLEAN DEFAULT false;
ALTER TABLE public.cashier_shift_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.cashier_shift_logs
SET shift_number = COALESCE(shift_number, 'SHIFT-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0')),
    shift_start = COALESCE(shift_start, created_at, now()),
    status = COALESCE(status, 'open');

CREATE UNIQUE INDEX IF NOT EXISTS cashier_shift_logs_shift_number_uidx
  ON public.cashier_shift_logs(shift_number) WHERE shift_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS cashier_shift_logs_branch_status_idx
  ON public.cashier_shift_logs(branch_id, status);
CREATE INDEX IF NOT EXISTS cashier_shift_logs_cashier_status_idx
  ON public.cashier_shift_logs(cashier_id, status);

CREATE TABLE IF NOT EXISTS public.cashier_shift_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES public.cashier_shift_logs(id) ON DELETE CASCADE,
  transaction_id UUID,
  transaction_ref TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  transaction_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_table TEXT,
  source_id UUID,
  branch_id INTEGER REFERENCES public.branches(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cashier_shift_transactions_shift_idx
  ON public.cashier_shift_transactions(shift_id);
CREATE INDEX IF NOT EXISTS cashier_shift_transactions_branch_time_idx
  ON public.cashier_shift_transactions(branch_id, transaction_time DESC);

-- Compatibility alias used by getCashierStats.
CREATE TABLE IF NOT EXISTS public.cashier_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_number TEXT DEFAULT ('SHIFT-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0')),
  branch_id INTEGER REFERENCES public.branches(id),
  cashier_id UUID REFERENCES public.users(id),
  cashier_name TEXT,
  opening_float NUMERIC(14,2) DEFAULT 0,
  closing_float NUMERIC(14,2) DEFAULT 0,
  status TEXT DEFAULT 'open',
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cashier_shifts_cashier_status_idx
  ON public.cashier_shifts(cashier_id, status);

-- ----------------------------------------------------------------
-- Cashier transactions
-- ----------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.cashier_transactions'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%transaction_type%'
        OR pg_get_constraintdef(oid) ILIKE '%payment_method%'
        OR pg_get_constraintdef(oid) ILIKE '%status%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.cashier_transactions DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.cashier_transactions ALTER COLUMN transaction_number SET DEFAULT ('CT' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 1000000))::int::text, 6, '0'));
ALTER TABLE public.cashier_transactions ALTER COLUMN transaction_type SET DEFAULT 'payment';
ALTER TABLE public.cashier_transactions ALTER COLUMN status SET DEFAULT 'completed';
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES public.users(id);
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS cashier_name TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS shift_id UUID;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS cashier_shift_log_id UUID REFERENCES public.cashier_shift_logs(id);
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS revenue_type TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS credit_bill_id UUID;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS amount_tendered NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS change_given NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS bill_number TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS confirmation_number TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS booking_date DATE;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS booking_status TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.cashier_transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

UPDATE public.cashier_transactions
SET transaction_date = COALESCE(transaction_date, created_at, now()),
    recorded_at = COALESCE(recorded_at, created_at, now()),
    payment_status = COALESCE(payment_status, status),
    reference_number = COALESCE(reference_number, source_document_number),
    payment_reference = COALESCE(payment_reference, reference_number),
    method = COALESCE(method, payment_method);

CREATE INDEX IF NOT EXISTS cashier_transactions_branch_date_idx
  ON public.cashier_transactions(branch_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS cashier_transactions_cashier_date_idx
  ON public.cashier_transactions(cashier_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS cashier_transactions_reference_idx
  ON public.cashier_transactions(reference_type, reference_id);

-- ----------------------------------------------------------------
-- Cashier logbooks
-- ----------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.cashier_logbooks'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.cashier_logbooks DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.cashier_logbooks ALTER COLUMN logbook_number SET DEFAULT public.generate_cashier_logbook_number();
ALTER TABLE public.cashier_logbooks ALTER COLUMN period_start SET DEFAULT now();
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'cashier';
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS log_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS total_cash NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS total_mpesa NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS total_swipe NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS total_card NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS total_credit_bill NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS sales_breakdown JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS outlet_shift_id UUID;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.pos_outlets(id);
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS automation_run_id UUID;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id);
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES public.users(id);
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ;
ALTER TABLE public.cashier_logbooks ADD COLUMN IF NOT EXISTS audit_notes TEXT;

UPDATE public.cashier_logbooks
SET logbook_number = COALESCE(logbook_number, public.generate_cashier_logbook_number()),
    period_start = COALESCE(period_start, created_at, now()),
    log_date = COALESCE(log_date, (COALESCE(created_at, now()))::date),
    type = COALESCE(type, 'cashier'),
    status = COALESCE(status, 'open');

CREATE INDEX IF NOT EXISTS cashier_logbooks_branch_date_type_idx
  ON public.cashier_logbooks(branch_id, log_date DESC, type);
CREATE INDEX IF NOT EXISTS cashier_logbooks_status_idx
  ON public.cashier_logbooks(status);

ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staff_profiles(id);
ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS order_id UUID;
ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS outlet_shift_id UUID;
ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS automation_run_id UUID;
ALTER TABLE public.cashier_logbook_lines ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS cashier_logbook_lines_logbook_section_idx
  ON public.cashier_logbook_lines(logbook_id, section);
CREATE INDEX IF NOT EXISTS cashier_logbook_lines_source_idx
  ON public.cashier_logbook_lines(source_table, source_id);

-- ----------------------------------------------------------------
-- Payments and receipts expected by the backend controllers
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  booking_id UUID,
  restaurant_order_id UUID,
  bar_order_id UUID,
  pos_transaction_id UUID,
  cashier_shift_id UUID,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  reference TEXT,
  customer_name TEXT,
  recorded_by UUID REFERENCES public.users(id),
  cashier_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'completed',
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_branch_created_idx
  ON public.payments(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_reference_idx
  ON public.payments(reference_number);

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE DEFAULT public.generate_receipt_number(),
  receipt_type TEXT DEFAULT 'sale',
  order_id UUID,
  invoice_id UUID,
  booking_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  table_number TEXT,
  room_number TEXT,
  subtotal NUMERIC(14,2) DEFAULT 0,
  tax_rate NUMERIC(8,4) DEFAULT 0,
  tax_amount NUMERIC(14,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  discount_reason TEXT,
  total_amount NUMERIC(14,2) DEFAULT 0,
  payment_method TEXT,
  payment_reference TEXT,
  amount_paid NUMERIC(14,2) DEFAULT 0,
  change_amount NUMERIC(14,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'paid',
  branch_id INTEGER REFERENCES public.branches(id),
  created_by UUID CONSTRAINT receipts_created_by_fkey REFERENCES public.users(id),
  cashier_name TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receipts_branch_created_idx
  ON public.receipts(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS receipts_order_idx
  ON public.receipts(order_id);

CREATE TABLE IF NOT EXISTS public.receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_sku TEXT,
  description TEXT,
  category TEXT,
  quantity NUMERIC(14,4) DEFAULT 1,
  unit TEXT,
  unit_price NUMERIC(14,2) DEFAULT 0,
  discount_percent NUMERIC(8,4) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  tax_amount NUMERIC(14,2) DEFAULT 0,
  total_amount NUMERIC(14,2) DEFAULT 0,
  menu_item_id UUID,
  inventory_item_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receipt_items_receipt_idx
  ON public.receipt_items(receipt_id);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL,
  source_table TEXT,
  source_id UUID,
  branch_id INTEGER REFERENCES public.branches(id),
  started_by UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'running',
  summary JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS run_type TEXT;
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES public.branches(id);
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS started_by UUID REFERENCES public.users(id);
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS summary JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
UPDATE public.automation_runs
SET run_type = COALESCE(run_type, job_name, 'automation')
WHERE run_type IS NULL;
CREATE INDEX IF NOT EXISTS automation_runs_branch_type_idx
  ON public.automation_runs(branch_id, run_type, created_at DESC);

-- ----------------------------------------------------------------
-- Credit bills and branch payment receipt compatibility
-- ----------------------------------------------------------------
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS credit_number TEXT;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staff_profiles(id);
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS balance NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS bill_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS source_pos_shift_id UUID;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS source_pos_order_id UUID;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS source_pos_payment_id UUID;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS source_logbook_id UUID;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS paid_via_payroll_run_id UUID;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES public.users(id);
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.credit_bills ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

UPDATE public.credit_bills
SET credit_number = COALESCE(credit_number, bill_number),
    amount = COALESCE(NULLIF(amount, 0), total_amount, 0),
    balance = COALESCE(NULLIF(balance, 0), balance_due, total_amount, 0),
    bill_date = COALESCE(bill_date, created_at::date, CURRENT_DATE),
    approval_status = COALESCE(approval_status, status, 'pending');

CREATE INDEX IF NOT EXISTS credit_bills_branch_status_idx
  ON public.credit_bills(branch_id, status);
CREATE INDEX IF NOT EXISTS credit_bills_staff_date_idx
  ON public.credit_bills(staff_id, bill_date DESC);

DO $$
BEGIN
  IF to_regclass('public.branch_payment_receipts') IS NOT NULL THEN
    ALTER TABLE public.branch_payment_receipts ADD COLUMN IF NOT EXISTS document_status TEXT DEFAULT 'generated';
    ALTER TABLE public.branch_payment_receipts ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE public.branch_payment_receipts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
    ALTER TABLE public.branch_payment_receipts ADD COLUMN IF NOT EXISTS auditor_notified_at TIMESTAMPTZ;
    ALTER TABLE public.branch_payment_receipts ADD COLUMN IF NOT EXISTS director_notified_at TIMESTAMPTZ;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- Audit compatibility table for cashier-side sensitive operations
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_branch_action_idx
  ON public.audit_logs(branch_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_record_idx
  ON public.audit_logs(table_name, record_id);

-- ----------------------------------------------------------------
-- Shift summary RPC expected by cashier shift workflows
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_shift_summary(p_shift_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_cash', COALESCE(SUM(CASE WHEN lower(payment_method) = 'cash' THEN amount ELSE 0 END), 0),
    'total_mpesa', COALESCE(SUM(CASE WHEN lower(payment_method) IN ('mpesa', 'm-pesa') THEN amount ELSE 0 END), 0),
    'total_card', COALESCE(SUM(CASE WHEN lower(payment_method) IN ('card', 'swipe') THEN amount ELSE 0 END), 0),
    'total_sales', COALESCE(SUM(amount), 0),
    'transaction_count', COUNT(*)
  )
  FROM public.cashier_shift_transactions
  WHERE shift_id = p_shift_id;
$$;

-- ----------------------------------------------------------------
-- RLS baseline. Backend uses service role and route RBAC; authenticated
-- policies keep direct client reads from failing during transition.
-- ----------------------------------------------------------------
ALTER TABLE public.cashier_shift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_shift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'cashier_shift_logs',
    'cashier_shift_transactions',
    'cashier_shifts',
    'payments',
    'receipts',
    'receipt_items',
    'automation_runs',
    'audit_logs'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = table_name || '_authenticated_transition'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        table_name || '_authenticated_transition',
        table_name
      );
    END IF;
  END LOOP;
END $$;
