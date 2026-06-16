-- Inventory governance, exception review, and control-tower reporting.
-- Additive only: keeps operational review state separate from source ledgers.

CREATE TABLE IF NOT EXISTS public.inventory_governance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  exception_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'acknowledged',
    'in_review',
    'resolved',
    'dismissed',
    'escalated'
  )),
  assigned_role TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_governance_reviews_branch_status
  ON public.inventory_governance_reviews(branch_id, status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_governance_reviews_source
  ON public.inventory_governance_reviews(source_table, source_id);

DROP TRIGGER IF EXISTS set_updated_at_inventory_governance_reviews ON public.inventory_governance_reviews;
CREATE TRIGGER set_updated_at_inventory_governance_reviews
BEFORE UPDATE ON public.inventory_governance_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_governance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  applies_to TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_inventory_governance_rules ON public.inventory_governance_rules;
CREATE TRIGGER set_updated_at_inventory_governance_rules
BEFORE UPDATE ON public.inventory_governance_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.inventory_governance_rules (rule_key, title, description, severity, applies_to)
VALUES
  ('no_silent_partial_posting', 'No silent partial posting', 'Any partial receipt, dispatch, issue, or production posting must be visible and reviewable.', 'critical', ARRAY['dispatch', 'receipt', 'department_issue', 'production']),
  ('no_zero_stock_delivery', 'No zero-stock delivery', 'Zero-stock lines cannot be dispatched or issued as if stock exists.', 'critical', ARRAY['dispatch', 'department_issue', 'pos_issue']),
  ('document_reference_required', 'Document reference required', 'Every stock movement must carry a source document reference.', 'critical', ARRAY['inventory_movement']),
  ('audit_trail_required', 'Audit trail required', 'Every controlled inventory action must write an audit record.', 'critical', ARRAY['inventory_movement', 'stock_take', 'adjustment']),
  ('production_requires_source_stock', 'Production requires source stock', 'Production cannot consume raw stock that is unavailable.', 'critical', ARRAY['production']),
  ('approval_sequence_enforced', 'Approval sequence enforced', 'Requests cannot skip auditor or required approval states.', 'critical', ARRAY['branch_request', 'department_request']),
  ('no_direct_quantity_editing', 'No direct quantity editing', 'Quantities are changed only through movement journals, stock take postings, or approved adjustments.', 'critical', ARRAY['inventory_balance'])
ON CONFLICT (rule_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  severity = EXCLUDED.severity,
  applies_to = EXCLUDED.applies_to,
  updated_at = NOW();

DO $$
BEGIN
  IF to_regclass('public.inventory_documents') IS NOT NULL THEN
    ALTER TABLE public.inventory_documents
      DROP CONSTRAINT IF EXISTS inventory_documents_document_type_check;
    ALTER TABLE public.inventory_documents
      ADD CONSTRAINT inventory_documents_document_type_check
      CHECK (document_type IN (
        'branch_request',
        'auditor_approval',
        'packing_list',
        'dispatch_document',
        'receipt_verification',
        'department_request_log',
        'material_issue_note',
        'supplier_payment_receipt',
        'production_run',
        'shift_closing',
        'stock_take',
        'stock_take_variance',
        'stock_adjustment',
        'audit_exception_report',
        'governance_dashboard_export',
        'inventory_alert_report'
      ));
  END IF;
END $$;

ALTER TABLE public.inventory_governance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_governance_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_governance_reviews'
      AND policyname = 'inventory_governance_reviews_service_role'
  ) THEN
    CREATE POLICY inventory_governance_reviews_service_role
      ON public.inventory_governance_reviews
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_governance_rules'
      AND policyname = 'inventory_governance_rules_service_role'
  ) THEN
    CREATE POLICY inventory_governance_rules_service_role
      ON public.inventory_governance_rules
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
