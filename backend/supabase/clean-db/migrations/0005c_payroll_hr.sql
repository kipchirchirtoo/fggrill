-- ============================================================
-- Migration 0005c: Payroll / HR extended tables
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PAYROLL MODULE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER REFERENCES public.branches(id),
  name            TEXT NOT NULL,
  policy_type     TEXT NOT NULL, -- deduction | allowance | overtime | tax
  rule_data       JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT TRUE,
  effective_from  DATE DEFAULT CURRENT_DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_deduction_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,     -- NSSF | SHIF | PAYE | housing_levy | uniform
  rate_type   TEXT NOT NULL,     -- fixed | percentage
  rate_value  NUMERIC(14,4) NOT NULL DEFAULT 0,
  min_amount  NUMERIC(14,2),
  max_amount  NUMERIC(14,2),
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to   DATE,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       INTEGER NOT NULL REFERENCES public.branches(id),
  run_number      TEXT UNIQUE NOT NULL,
  pay_period_from DATE NOT NULL,
  pay_period_to   DATE NOT NULL,
  pay_date        DATE,
  status          TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','processing','approved','paid','cancelled')),
  total_gross     NUMERIC(14,2) DEFAULT 0,
  total_deductions NUMERIC(14,2) DEFAULT 0,
  total_net       NUMERIC(14,2) DEFAULT 0,
  staff_count     INTEGER DEFAULT 0,
  prepared_by     UUID REFERENCES public.users(id),
  approved_by     UUID REFERENCES public.users(id),
  approved_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_batches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  status     TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id       INTEGER REFERENCES public.branches(id),
  pay_period_from DATE NOT NULL,
  pay_period_to   DATE NOT NULL,
  basic_salary    NUMERIC(14,2) DEFAULT 0,
  gross_pay       NUMERIC(14,2) DEFAULT 0,
  total_deductions NUMERIC(14,2) DEFAULT 0,
  net_pay         NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','approved','paid','cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID REFERENCES public.staff_profiles(id),
  branch_id       INTEGER REFERENCES public.branches(id),
  month           INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  basic_salary    NUMERIC(14,2) DEFAULT 0,
  gross_pay       NUMERIC(14,2) DEFAULT 0,
  net_pay         NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_batches_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES public.payroll_batches(id) ON DELETE CASCADE,
  payroll_record_id UUID REFERENCES public.payroll_records(id),
  amount          NUMERIC(14,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- alias used by backend
CREATE TABLE IF NOT EXISTS public.payroll_batch_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID REFERENCES public.payroll_batches(id),
  staff_id        UUID REFERENCES public.staff_profiles(id),
  net_pay         NUMERIC(14,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_payroll (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES public.staff_profiles(id),
  run_id          UUID REFERENCES public.payroll_runs(id),
  branch_id       INTEGER REFERENCES public.branches(id),
  pay_period_from DATE,
  pay_period_to   DATE,
  basic_salary    NUMERIC(14,2) DEFAULT 0,
  allowances      NUMERIC(14,2) DEFAULT 0,
  gross_pay       NUMERIC(14,2) DEFAULT 0,
  paye            NUMERIC(14,2) DEFAULT 0,
  nssf            NUMERIC(14,2) DEFAULT 0,
  shif            NUMERIC(14,2) DEFAULT 0,
  housing_levy    NUMERIC(14,2) DEFAULT 0,
  uniform         NUMERIC(14,2) DEFAULT 0,
  other_deductions NUMERIC(14,2) DEFAULT 0,
  total_deductions NUMERIC(14,2) DEFAULT 0,
  net_pay         NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_payroll_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  period_month INTEGER NOT NULL,
  period_year  INTEGER NOT NULL,
  adj_type     TEXT NOT NULL, -- bonus | deduction | advance | loan_repayment | late_penalty
  amount       NUMERIC(14,2) NOT NULL,
  reason       TEXT,
  approved_by  UUID REFERENCES public.users(id),
  status       TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','applied')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_payroll_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id   UUID REFERENCES public.staff_payroll(id) ON DELETE CASCADE,
  item_type    TEXT NOT NULL,
  description  TEXT,
  amount       NUMERIC(14,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_advances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id   INTEGER REFERENCES public.branches(id),
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  purpose     TEXT,
  status      TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','repaid')),
  approved_by UUID REFERENCES public.users(id),
  advance_date DATE DEFAULT CURRENT_DATE,
  repayment_date DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_loans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id      INTEGER REFERENCES public.branches(id),
  loan_amount    NUMERIC(14,2) NOT NULL CHECK (loan_amount > 0),
  balance        NUMERIC(14,2) DEFAULT 0,
  monthly_deduction NUMERIC(14,2) DEFAULT 0,
  status         TEXT DEFAULT 'active'
    CHECK (status IN ('pending','active','fully_paid','written_off')),
  approved_by    UUID REFERENCES public.users(id),
  start_date     DATE DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_loan_payments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id    UUID NOT NULL REFERENCES public.staff_loans(id) ON DELETE CASCADE,
  amount     NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_on    DATE DEFAULT CURRENT_DATE,
  method     TEXT DEFAULT 'payroll_deduction',
  reference  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_credit_bills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  bill_number  TEXT UNIQUE NOT NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  amount_paid  NUMERIC(14,2) DEFAULT 0,
  balance      NUMERIC(14,2) DEFAULT 0,
  status       TEXT DEFAULT 'open'
    CHECK (status IN ('open','partial','paid','written_off')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_credit_bill_payments (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id   UUID NOT NULL REFERENCES public.staff_credit_bills(id),
  amount    NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method    TEXT DEFAULT 'cash',
  paid_on   DATE DEFAULT CURRENT_DATE,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_monthly_statutory_deductions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES public.staff_profiles(id),
  period_month INTEGER NOT NULL,
  period_year  INTEGER NOT NULL,
  nssf         NUMERIC(14,2) DEFAULT 0,
  shif         NUMERIC(14,2) DEFAULT 0,
  paye         NUMERIC(14,2) DEFAULT 0,
  housing_levy NUMERIC(14,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, period_month, period_year)
);

-- ─────────────────────────────────────────────────────────────
-- HR EXTENDED
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  clock_in     TIMESTAMPTZ,
  clock_out    TIMESTAMPTZ,
  status       TEXT DEFAULT 'present'
    CHECK (status IN ('present','absent','late','half_day','on_leave')),
  hours_worked NUMERIC(8,2),
  notes        TEXT,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_staff ON public.staff_attendance(staff_id, attendance_date);

CREATE TABLE IF NOT EXISTS public.staff_leave (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  leave_type   TEXT NOT NULL, -- annual | sick | maternity | paternity | emergency | unpaid
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  days_count   INTEGER,
  reason       TEXT,
  status       TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by  UUID REFERENCES public.users(id),
  reported_to_duty BOOLEAN DEFAULT FALSE,
  employee_id  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id   INTEGER REFERENCES public.branches(id),
  shift_date  DATE NOT NULL,
  shift_type  TEXT DEFAULT 'day',
  start_time  TIME,
  end_time    TIME,
  status      TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','swapped')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_performance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  review_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewer_id  UUID REFERENCES public.users(id),
  score        NUMERIC(5,2),
  rating       TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_employment_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES public.staff_profiles(id),
  event_type   TEXT NOT NULL, -- hired | transferred | promoted | resigned | terminated
  event_date   DATE NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  notes        TEXT,
  recorded_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID NOT NULL REFERENCES public.staff_profiles(id),
  branch_id  INTEGER REFERENCES public.branches(id),
  shift_date DATE NOT NULL,
  check_in   TIMESTAMPTZ,
  check_out  TIMESTAMPTZ,
  status     TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID NOT NULL REFERENCES public.staff_profiles(id),
  document_type TEXT NOT NULL,
  file_name     TEXT,
  file_url      TEXT,
  uploaded_by   UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_training (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID REFERENCES public.staff_profiles(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  title        TEXT NOT NULL,
  provider     TEXT,
  start_date   DATE,
  end_date     DATE,
  status       TEXT DEFAULT 'scheduled',
  certificate_url TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_time_clock (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID REFERENCES public.staff_profiles(id),
  branch_id  INTEGER REFERENCES public.branches(id),
  action     TEXT NOT NULL CHECK (action IN ('clock_in','clock_out','break_start','break_end')),
  clocked_at TIMESTAMPTZ DEFAULT NOW(),
  method     TEXT DEFAULT 'manual', -- manual | rfid | pin | biometric
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID REFERENCES public.staff_profiles(id),
  branch_id    INTEGER REFERENCES public.branches(id),
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     DATE,
  priority     TEXT DEFAULT 'normal',
  status       TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','cancelled')),
  assigned_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   INTEGER REFERENCES public.branches(id),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  audience    TEXT DEFAULT 'all', -- all | department | role
  audience_value TEXT,
  posted_by   UUID REFERENCES public.users(id),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- director_review_tasks (referenced by director-tasks.controller.ts)
CREATE TABLE IF NOT EXISTS public.director_review_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        INTEGER REFERENCES public.branches(id),
  director_id      UUID REFERENCES public.users(id),
  title            TEXT NOT NULL,
  description      TEXT,
  assigned_to_role TEXT,
  assigned_to_user_id UUID REFERENCES public.users(id),
  priority         TEXT DEFAULT 'normal',
  status           TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','cancelled')),
  related_record_date DATE,
  related_stream   TEXT,
  director_notes   TEXT,
  response_notes   TEXT,
  due_date         DATE,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dir_tasks_status ON public.director_review_tasks(branch_id, status);
