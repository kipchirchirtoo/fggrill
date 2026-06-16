-- Lina enterprise intelligence foundation.
-- Stores branch/supplier/staff memory, daily finance snapshots, variance findings,
-- and governed agent findings for director/auditor visibility.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_lina_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.lina_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  memory_type TEXT NOT NULL CHECK (
    memory_type IN (
      'branch',
      'supplier',
      'staff',
      'financial',
      'inventory',
      'procurement',
      'audit',
      'director',
      'revenue',
      'operations'
    )
  ),
  subject_type TEXT NOT NULL DEFAULT 'general',
  subject_id TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  confidence NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'resolved', 'dismissed', 'archived')),
  source_module TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lina_daily_financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  revenue_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  expense_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  cash_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  card_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  mpesa_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  supplier_liability NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payroll_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  inventory_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  pnl JSONB NOT NULL DEFAULT '{}'::jsonb,
  balance_sheet JSONB NOT NULL DEFAULT '{}'::jsonb,
  cash_flow JSONB NOT NULL DEFAULT '{}'::jsonb,
  trial_balance JSONB NOT NULL DEFAULT '{}'::jsonb,
  aging JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lina_daily_financial_snapshots_unique UNIQUE (branch_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS public.lina_variance_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
  finding_date DATE NOT NULL DEFAULT CURRENT_DATE,
  variance_type TEXT NOT NULL CHECK (
    variance_type IN (
      'financial',
      'inventory',
      'revenue',
      'payroll',
      'banking',
      'supplier',
      'stock_take',
      'cashier',
      'procurement'
    )
  ),
  subject_type TEXT NOT NULL DEFAULT 'general',
  subject_id TEXT,
  expected_amount NUMERIC(14, 2),
  actual_amount NUMERIC(14, 2),
  variance_amount NUMERIC(14, 2),
  expected_quantity NUMERIC(14, 3),
  actual_quantity NUMERIC(14, 3),
  variance_quantity NUMERIC(14, 3),
  likely_cause TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'assigned', 'resolved', 'dismissed', 'closed')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lina_agent_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key TEXT NOT NULL CHECK (
    agent_key IN (
      'finance',
      'inventory',
      'procurement',
      'audit',
      'hr',
      'revenue',
      'analytics',
      'executive',
      'operations'
    )
  ),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL DEFAULT 'general',
  subject_id TEXT,
  title TEXT NOT NULL,
  finding TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_action TEXT,
  remediation_level TEXT NOT NULL DEFAULT 'manual_review' CHECK (
    remediation_level IN ('read_only', 'manual_review', 'approval_required', 'safe_auto')
  ),
  confidence NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'approved', 'resolved', 'dismissed', 'closed')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lina_memories_branch_type ON public.lina_memories(branch_id, memory_type, status);
CREATE INDEX IF NOT EXISTS idx_lina_memories_subject ON public.lina_memories(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_lina_daily_financial_snapshots_branch_date ON public.lina_daily_financial_snapshots(branch_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_lina_variance_findings_branch_status ON public.lina_variance_findings(branch_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_lina_agent_findings_branch_agent_status ON public.lina_agent_findings(branch_id, agent_key, status);

DROP TRIGGER IF EXISTS trg_lina_memories_updated_at ON public.lina_memories;
CREATE TRIGGER trg_lina_memories_updated_at
BEFORE UPDATE ON public.lina_memories
FOR EACH ROW EXECUTE FUNCTION public.set_lina_updated_at();

DROP TRIGGER IF EXISTS trg_lina_daily_financial_snapshots_updated_at ON public.lina_daily_financial_snapshots;
CREATE TRIGGER trg_lina_daily_financial_snapshots_updated_at
BEFORE UPDATE ON public.lina_daily_financial_snapshots
FOR EACH ROW EXECUTE FUNCTION public.set_lina_updated_at();

DROP TRIGGER IF EXISTS trg_lina_variance_findings_updated_at ON public.lina_variance_findings;
CREATE TRIGGER trg_lina_variance_findings_updated_at
BEFORE UPDATE ON public.lina_variance_findings
FOR EACH ROW EXECUTE FUNCTION public.set_lina_updated_at();

DROP TRIGGER IF EXISTS trg_lina_agent_findings_updated_at ON public.lina_agent_findings;
CREATE TRIGGER trg_lina_agent_findings_updated_at
BEFORE UPDATE ON public.lina_agent_findings
FOR EACH ROW EXECUTE FUNCTION public.set_lina_updated_at();

ALTER TABLE public.lina_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lina_daily_financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lina_variance_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lina_agent_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lina_memories_authenticated_read ON public.lina_memories;
CREATE POLICY lina_memories_authenticated_read ON public.lina_memories
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS lina_daily_financial_snapshots_authenticated_read ON public.lina_daily_financial_snapshots;
CREATE POLICY lina_daily_financial_snapshots_authenticated_read ON public.lina_daily_financial_snapshots
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS lina_variance_findings_authenticated_read ON public.lina_variance_findings;
CREATE POLICY lina_variance_findings_authenticated_read ON public.lina_variance_findings
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS lina_agent_findings_authenticated_read ON public.lina_agent_findings;
CREATE POLICY lina_agent_findings_authenticated_read ON public.lina_agent_findings
FOR SELECT TO authenticated USING (true);
