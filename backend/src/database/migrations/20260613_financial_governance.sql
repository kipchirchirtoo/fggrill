-- ============================================================
-- FINANCIAL GOVERNANCE v1 — 2026-06-13
-- Branch Accountant financial close, variance engine, payroll workspace
-- ============================================================

-- ── 1. FINANCIAL WORKSPACE SUBMISSIONS ─────────────────────────────────────
-- Tracks the formal close process for each branch/day

CREATE TABLE IF NOT EXISTS financial_workspace_submissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id               INTEGER NOT NULL,
  record_date             DATE NOT NULL,

  -- Submitted figures (snapshot at submission time)
  submitted_revenue       NUMERIC(15,2) NOT NULL DEFAULT 0,
  submitted_cogs          NUMERIC(15,2) NOT NULL DEFAULT 0,
  submitted_expenses      NUMERIC(15,2) NOT NULL DEFAULT 0,
  submitted_net_profit    NUMERIC(15,2) NOT NULL DEFAULT 0,
  submitted_cash          NUMERIC(15,2) NOT NULL DEFAULT 0,
  submitted_banked        NUMERIC(15,2) NOT NULL DEFAULT 0,
  submitted_unbanked      NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- System expected figures (7-day rolling avg baseline)
  expected_revenue        NUMERIC(15,2),
  expected_net_profit     NUMERIC(15,2),

  -- Variance computed fields
  revenue_variance        NUMERIC(15,2),     -- submitted - expected
  cash_variance           NUMERIC(15,2),
  banking_variance        NUMERIC(15,2),
  pos_variance            NUMERIC(15,2),
  payroll_variance        NUMERIC(15,2),
  supplier_variance       NUMERIC(15,2),
  overall_variance        NUMERIC(15,2),
  variance_pct            NUMERIC(8,4),

  -- Smart variance analysis (JSON array of {component, variance, possible_causes:[{cause, confidence}]})
  variance_analysis       JSONB DEFAULT '[]'::jsonb,

  -- Explanation (required when overall_variance < 0)
  requires_explanation    BOOLEAN NOT NULL DEFAULT FALSE,
  explanation_reason      TEXT,              -- enum: cash_shortage, banking_delay, inventory_loss, etc.
  explanation_notes       TEXT,
  explanation_documents   JSONB DEFAULT '[]'::jsonb,  -- [{name, url, uploaded_at}]
  explanation_submitted_at TIMESTAMPTZ,

  -- Status flow: draft → submitted → auditor_review → approved / returned
  status                  TEXT NOT NULL DEFAULT 'submitted'
                          CHECK (status IN ('submitted','auditor_review','approved','returned','locked')),

  -- Auditor review
  auditor_notes           TEXT,
  auditor_id              UUID,
  auditor_reviewed_at     TIMESTAMPTZ,

  -- Actors
  submitted_by            UUID NOT NULL,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (branch_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_fws_branch_date ON financial_workspace_submissions (branch_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_fws_status ON financial_workspace_submissions (status);

-- ── 2. PAYROLL BATCHES ──────────────────────────────────────────────────────
-- One batch per branch per payroll period

CREATE TABLE IF NOT EXISTS payroll_batches (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number            TEXT UNIQUE NOT NULL,
  branch_id               INTEGER NOT NULL,
  period_month            INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year             INTEGER NOT NULL,
  period_label            TEXT NOT NULL,  -- e.g. 'June 2026'

  -- Totals
  total_gross             NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_paye              NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_sha               NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_nssf              NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_loans             NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_advances          NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_other_deductions  NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net               NUMERIC(15,2) NOT NULL DEFAULT 0,
  headcount               INTEGER NOT NULL DEFAULT 0,

  -- Variance vs previous period
  prev_period_net         NUMERIC(15,2),
  variance_vs_prev        NUMERIC(15,2),
  variance_vs_prev_pct    NUMERIC(8,4),
  budget_net              NUMERIC(15,2),
  variance_vs_budget      NUMERIC(15,2),

  -- Flags
  has_ghost_flag          BOOLEAN NOT NULL DEFAULT FALSE,
  has_spike_flag          BOOLEAN NOT NULL DEFAULT FALSE,
  has_duplicate_flag      BOOLEAN NOT NULL DEFAULT FALSE,
  flags_json              JSONB DEFAULT '[]'::jsonb,  -- [{type, staff_id, detail}]

  -- Status: draft → submitted → auditor_review → director_visible → approved → locked
  status                  TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','submitted','auditor_review','director_visible','approved','returned','locked')),

  -- Review actors
  submitted_by            UUID,
  submitted_at            TIMESTAMPTZ,
  auditor_id              UUID,
  auditor_notes           TEXT,
  auditor_reviewed_at     TIMESTAMPTZ,
  director_approved_by    UUID,
  director_approved_at    TIMESTAMPTZ,
  locked_at               TIMESTAMPTZ,

  created_by              UUID NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (branch_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_pb_branch_period ON payroll_batches (branch_id, period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_pb_status ON payroll_batches (status);

-- ── 3. PAYROLL BATCH LINES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payroll_batch_lines (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                UUID NOT NULL REFERENCES payroll_batches(id) ON DELETE CASCADE,
  branch_id               INTEGER NOT NULL,

  -- Staff reference
  staff_id                TEXT NOT NULL,
  staff_name              TEXT NOT NULL,
  staff_number            TEXT,
  department              TEXT,
  designation             TEXT,

  -- Attendance
  working_days            INTEGER NOT NULL DEFAULT 26,
  days_present            INTEGER NOT NULL DEFAULT 26,
  days_absent             INTEGER NOT NULL DEFAULT 0,
  overtime_hours          NUMERIC(8,2) NOT NULL DEFAULT 0,

  -- Earnings
  basic_salary            NUMERIC(15,2) NOT NULL DEFAULT 0,
  house_allowance         NUMERIC(15,2) NOT NULL DEFAULT 0,
  transport_allowance     NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_allowances        NUMERIC(15,2) NOT NULL DEFAULT 0,
  overtime_pay            NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross_salary            NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Statutory deductions
  paye                    NUMERIC(15,2) NOT NULL DEFAULT 0,
  sha                     NUMERIC(15,2) NOT NULL DEFAULT 0,
  nssf                    NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Other deductions
  loan_deduction          NUMERIC(15,2) NOT NULL DEFAULT 0,
  advance_deduction       NUMERIC(15,2) NOT NULL DEFAULT 0,
  absent_deduction        NUMERIC(15,2) NOT NULL DEFAULT 0,
  uniform_deduction       NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_deductions        NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_deductions        NUMERIC(15,2) NOT NULL DEFAULT 0,

  net_pay                 NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Variance vs previous payroll
  prev_net_pay            NUMERIC(15,2),
  net_variance            NUMERIC(15,2),

  -- Flags
  is_flagged              BOOLEAN NOT NULL DEFAULT FALSE,
  flag_type               TEXT,   -- ghost, duplicate, spike, large_overtime, abnormal_allowance
  flag_detail             TEXT,

  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pbl_batch ON payroll_batch_lines (batch_id);
CREATE INDEX IF NOT EXISTS idx_pbl_staff ON payroll_batch_lines (staff_id);

-- ── 4. DAILY FINANCIAL SNAPSHOTS (auto-generated at midnight) ──────────────
-- System-generated baseline — separate from accountant's daily_financial_records
-- The accountant's workspace compares against this baseline

CREATE TABLE IF NOT EXISTS financial_daily_snapshots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id               INTEGER NOT NULL,
  snapshot_date           DATE NOT NULL,
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Revenue from operational systems
  pos_revenue             NUMERIC(15,2) NOT NULL DEFAULT 0,
  restaurant_revenue      NUMERIC(15,2) NOT NULL DEFAULT 0,
  bar_revenue             NUMERIC(15,2) NOT NULL DEFAULT 0,
  rooms_revenue           NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_revenue           NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_system_revenue    NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- COGS from inventory
  inventory_cogs          NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Expenses
  supplier_expenses       NUMERIC(15,2) NOT NULL DEFAULT 0,
  payroll_expense         NUMERIC(15,2) NOT NULL DEFAULT 0,
  petty_cash_expenses     NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_expenses          NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_system_expenses   NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Banking
  system_banked           NUMERIC(15,2) NOT NULL DEFAULT 0,
  system_cash_collected   NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Computed
  system_net_profit       NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Raw data payload
  raw_data                JSONB DEFAULT '{}'::jsonb,

  UNIQUE (branch_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_fds_branch_date ON financial_daily_snapshots (branch_id, snapshot_date DESC);

-- ── 5. Branch profitability view ────────────────────────────────────────────
CREATE OR REPLACE VIEW branch_profitability_summary AS
SELECT
  dfr.branch_id,
  dfr.record_date,
  COALESCE((dfr.revenue_data->>'restaurant')::numeric, 0) AS restaurant_revenue,
  COALESCE((dfr.revenue_data->>'bar')::numeric, 0) AS bar_revenue,
  COALESCE((dfr.revenue_data->>'executive_bar')::numeric, 0) AS executive_bar_revenue,
  COALESCE((dfr.revenue_data->>'sports_bar')::numeric, 0) AS sports_bar_revenue,
  COALESCE((dfr.revenue_data->>'rooms')::numeric, 0) AS rooms_revenue,
  COALESCE((dfr.revenue_data->>'conferences')::numeric, 0) AS conference_revenue,
  COALESCE((dfr.revenue_data->>'outside_catering')::numeric, 0) AS catering_revenue,
  dfr.total_revenue,
  dfr.total_cogs,
  dfr.total_expenses,
  dfr.net_profit,
  dfr.status
FROM daily_financial_records dfr;

COMMENT ON TABLE financial_workspace_submissions IS 'Formal daily financial close record. Created when branch accountant submits workspace. Variance engine runs on submit.';
COMMENT ON TABLE payroll_batches IS 'Monthly payroll batch per branch. Flows: draft→submitted→auditor_review→director_visible→approved→locked.';
COMMENT ON TABLE payroll_batch_lines IS 'Individual staff payroll lines within a batch. Includes attendance-based deductions.';
COMMENT ON TABLE financial_daily_snapshots IS 'System-auto-generated daily financial baseline. Generated at midnight from all operational sources.';
