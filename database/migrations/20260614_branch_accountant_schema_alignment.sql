-- ============================================================
-- BRANCH ACCOUNTANT SCHEMA ALIGNMENT - 2026-06-14
-- Creates missing tables required by financial controllers.
-- ============================================================

-- 1. daily_financial_records
-- Stores the accountant's daily workspace entry (Draft/Submitted/Reviewed)
CREATE TABLE IF NOT EXISTS public.daily_financial_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED')),
    
    revenue_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    payment_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_payments NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    banking_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    expected_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    unbanked_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    cogs_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_cogs NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    expense_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    net_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    
    created_by UUID,
    submitted_at TIMESTAMPTZ,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT daily_financial_records_unique UNIQUE (branch_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_dfr_branch_date ON public.daily_financial_records(branch_id, record_date DESC);

-- 2. monthly_financial_adjustments
-- Stores the branch's monthly overheads (electricity, rent, salaries, etc.)
CREATE TABLE IF NOT EXISTS public.monthly_financial_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
    
    electricity NUMERIC(15,2) DEFAULT 0,
    salaries NUMERIC(15,2) DEFAULT 0,
    water NUMERIC(15,2) DEFAULT 0,
    rent NUMERIC(15,2) DEFAULT 0,
    nssf NUMERIC(15,2) DEFAULT 0,
    shif NUMERIC(15,2) DEFAULT 0,
    tax NUMERIC(15,2) DEFAULT 0,
    levy NUMERIC(15,2) DEFAULT 0,
    licenses NUMERIC(15,2) DEFAULT 0,
    
    subscriptions JSONB DEFAULT '{}'::jsonb,
    total_monthly_expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
    monthly_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    cash_flow_data JSONB DEFAULT '{}'::jsonb,
    balance_sheet_data JSONB DEFAULT '{}'::jsonb,
    
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT monthly_financial_adj_unique UNIQUE (branch_id, fiscal_year, fiscal_month)
);

CREATE INDEX IF NOT EXISTS idx_mfa_branch_period ON public.monthly_financial_adjustments(branch_id, fiscal_year DESC, fiscal_month DESC);

-- 3. director_review_tasks
-- Stores tasks assigned by the Director to the Branch Accountant
CREATE TABLE IF NOT EXISTS public.director_review_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    director_id UUID NOT NULL,
    branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    assigned_to_role TEXT NOT NULL,
    assigned_to_user_id UUID,
    
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    
    related_record_date DATE,
    response_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drt_branch_status ON public.director_review_tasks(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_drt_role ON public.director_review_tasks(assigned_to_role);

-- Ensure branch_profitability_summary view works (replace if broken)
CREATE OR REPLACE VIEW public.branch_profitability_summary AS
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
FROM public.daily_financial_records dfr;

