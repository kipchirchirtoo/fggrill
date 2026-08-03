CREATE TABLE IF NOT EXISTS public.inventory_document_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.inventory_documents(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_id UUID NOT NULL REFERENCES public.inventory_item_catalog(id) ON DELETE RESTRICT,
  source_location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  destination_location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_document_lines_unique_line UNIQUE (document_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_inventory_document_lines_document
  ON public.inventory_document_lines(document_id, line_number);

CREATE TABLE IF NOT EXISTS public.inventory_governance_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  exception_code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved', 'waived')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_governance_exceptions_branch_status
  ON public.inventory_governance_exceptions(branch_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_period_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  lock_scope TEXT NOT NULL CHECK (lock_scope IN ('business_date', 'shift', 'accounting_period')),
  business_date DATE,
  shift_code TEXT,
  period_start DATE,
  period_end DATE,
  reason TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  unlocked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_period_locks_lookup
  ON public.inventory_period_locks(branch_id, lock_scope, is_active);

CREATE TABLE IF NOT EXISTS public.inventory_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_key TEXT NOT NULL,
  sequence_year INTEGER NOT NULL,
  last_number BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_number_sequences_unique UNIQUE (sequence_key, sequence_year)
);

CREATE TABLE IF NOT EXISTS public.inventory_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  branch_id INTEGER REFERENCES public.branches(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  response_payload JSONB,
  document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_idempotency_keys_unique UNIQUE (scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_inventory_idempotency_keys_status
  ON public.inventory_idempotency_keys(scope, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_document_id UUID NOT NULL REFERENCES public.inventory_documents(id) ON DELETE CASCADE,
  child_document_id UUID NOT NULL REFERENCES public.inventory_documents(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_document_links_unique UNIQUE (parent_document_id, child_document_id, relationship_type)
);

ALTER TABLE public.inventory_documents
  ADD COLUMN IF NOT EXISTS posting_status TEXT NOT NULL DEFAULT 'posted' CHECK (posting_status IN ('draft', 'posted', 'reversed', 'void')),
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS reversal_of_document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS posting_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_immutable BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_documents_document_type_check'
      AND conrelid = 'public.inventory_documents'::regclass
  ) THEN
    ALTER TABLE public.inventory_documents DROP CONSTRAINT inventory_documents_document_type_check;
  END IF;
END $$;

ALTER TABLE public.inventory_documents
  ADD CONSTRAINT inventory_documents_document_type_check
  CHECK (
    document_type IN (
      'branch_request',
      'auditor_approval',
      'packing_list',
      'dispatch_document',
      'receipt_verification',
      'department_request_log',
      'material_issue_note',
      'supplier_payment_receipt',
      'GRN',
      'MIN',
      'TRF',
      'STK',
      'SPL',
      'REQ',
      'ADJ',
      'REV'
    )
  );

CREATE INDEX IF NOT EXISTS idx_inventory_documents_posting
  ON public.inventory_documents(branch_id, document_type, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_documents_idempotency
  ON public.inventory_documents(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
