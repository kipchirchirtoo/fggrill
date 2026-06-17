-- ============================================================
-- Migration: Add missing columns to payroll_batches and
-- payroll_batch_lines to match the branch-payroll controller.
-- Created: 2026-06-17
-- ============================================================

-- ── payroll_batches ──────────────────────────────────────────
ALTER TABLE public.payroll_batches
  ADD COLUMN IF NOT EXISTS branch_id        INTEGER REFERENCES public.branches(id),
  ADD COLUMN IF NOT EXISTS period_month     INTEGER,
  ADD COLUMN IF NOT EXISTS period_year      INTEGER,
  ADD COLUMN IF NOT EXISTS period_label     TEXT,
  ADD COLUMN IF NOT EXISTS total_gross      NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paye       NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sha        NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_nssf       NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_housing_fund NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_loans      NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_advances   NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credit_bills NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_net        NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS headcount        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_period_net  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS variance_vs_prev NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS variance_vs_prev_pct NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS has_ghost_flag   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_spike_flag   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_duplicate_flag BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flags_json       JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auditor_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS director_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

-- ── payroll_batch_lines ───────────────────────────────────────
ALTER TABLE public.payroll_batch_lines
  ADD COLUMN IF NOT EXISTS branch_id          INTEGER REFERENCES public.branches(id),
  ADD COLUMN IF NOT EXISTS staff_name         TEXT,
  ADD COLUMN IF NOT EXISTS staff_number       TEXT,
  ADD COLUMN IF NOT EXISTS department         TEXT,
  ADD COLUMN IF NOT EXISTS designation        TEXT,
  ADD COLUMN IF NOT EXISTS working_days       INTEGER DEFAULT 26,
  ADD COLUMN IF NOT EXISTS days_present       INTEGER DEFAULT 26,
  ADD COLUMN IF NOT EXISTS days_absent        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_hours     NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS basic_salary       NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS house_allowance    NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowances   NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_pay       NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_salary       NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paye               NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sha                NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nssf               NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deduction     NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_deduction  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_bill_deduction NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS housing_fund_deduction NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absent_deduction   NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uniform_deduction  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deductions   NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_deductions   NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prev_net_pay       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS net_variance       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS is_flagged         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_type          TEXT,
  ADD COLUMN IF NOT EXISTS flag_detail        TEXT;

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_payroll_batches_branch_period
  ON public.payroll_batches(branch_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_payroll_batch_lines_staff
  ON public.payroll_batch_lines(staff_id);

CREATE INDEX IF NOT EXISTS idx_payroll_batch_lines_name
  ON public.payroll_batch_lines(staff_name);
