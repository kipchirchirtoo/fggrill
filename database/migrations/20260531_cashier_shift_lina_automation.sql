-- Lina cashier shift automation.
-- Generated POS shift logbooks move cashier close-out work from manual entry
-- to an accountant-first, auditor-final approval workflow.

CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL,
  source_table TEXT,
  source_id UUID,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
    'running',
    'completed',
    'completed_with_warnings',
    'failed'
  )),
  started_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  summary JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS cashier_logbooks
  ADD COLUMN IF NOT EXISTS outlet_shift_id UUID REFERENCES pos_outlet_shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cashier_shift_id UUID REFERENCES cashier_shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS automation_run_id UUID REFERENCES automation_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accountant_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accountant_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accountant_notes TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS cashier_logbooks
  DROP CONSTRAINT IF EXISTS cashier_logbooks_status_check;

ALTER TABLE IF EXISTS cashier_logbooks
  ADD CONSTRAINT cashier_logbooks_status_check CHECK (status IN (
    'open',
    'closed',
    'pending_accountant_review',
    'pending_audit',
    'approved',
    'rejected'
  ));

ALTER TABLE IF EXISTS cashier_logbooks
  DROP CONSTRAINT IF EXISTS cashier_logbooks_type_check;

ALTER TABLE IF EXISTS cashier_logbooks
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

ALTER TABLE IF EXISTS cashier_logbooks
  DROP CONSTRAINT IF EXISTS cashier_logbooks_branch_id_type_log_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cashier_logbooks_outlet_shift
  ON cashier_logbooks(outlet_shift_id)
  WHERE outlet_shift_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cashier_logbooks_cashier_shift
  ON cashier_logbooks(cashier_shift_id)
  WHERE cashier_shift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashier_logbooks_accountant_queue
  ON cashier_logbooks(status, branch_id, log_date DESC);

ALTER TABLE IF EXISTS cashier_logbook_lines
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_table TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS outlet_shift_id UUID REFERENCES pos_outlet_shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS automation_run_id UUID REFERENCES automation_runs(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cashier_logbook_lines_generated_source
  ON cashier_logbook_lines(logbook_id, source_table, source_id, section)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashier_logbook_lines_staff_source
  ON cashier_logbook_lines(staff_id, source_table, source_id);

ALTER TABLE IF EXISTS staff_credit_bills
  ADD COLUMN IF NOT EXISTS source_pos_shift_id UUID REFERENCES pos_outlet_shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_pos_order_id UUID REFERENCES pos_shift_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_pos_payment_id UUID REFERENCES pos_shift_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_credit_bills_source_pos_shift
  ON staff_credit_bills(source_pos_shift_id, source_pos_order_id);
