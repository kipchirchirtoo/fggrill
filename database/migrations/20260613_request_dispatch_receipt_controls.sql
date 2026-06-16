-- Controlled request, approval, packing, dispatch, receipt, and department issue workflow.
-- This migration extends the active storekeeping tables instead of creating duplicate
-- requisition/dispatch flows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Missing dependency for get_next_stock_request_number().
CREATE TABLE IF NOT EXISTS stock_request_sequences (
  branch_code TEXT NOT NULL,
  request_date DATE NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch_code, request_date)
);

DROP TRIGGER IF EXISTS set_updated_at_stock_request_sequences ON stock_request_sequences;
CREATE TRIGGER set_updated_at_stock_request_sequences
BEFORE UPDATE ON stock_request_sequences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Header workflow state for existing branch stock requests.
ALTER TABLE stock_requests
  ADD COLUMN IF NOT EXISTS workflow_status TEXT,
  ADD COLUMN IF NOT EXISTS submitted_to_auditor_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auditor_decision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_central_store_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS document_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS document_regenerated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS barcode_value TEXT,
  ADD COLUMN IF NOT EXISTS workflow_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE stock_requests
SET workflow_status = CASE
    WHEN status IN ('PENDING_AUDIT', 'UNDER_REVIEW', 'PENDING') THEN 'submitted_to_auditor'
    WHEN status IN ('APPROVED', 'PARTIALLY_APPROVED') THEN 'auditor_approved'
    WHEN status = 'REJECTED' THEN 'auditor_rejected'
    WHEN status = 'DISPATCHED' THEN 'dispatched'
    WHEN status = 'DELIVERED' THEN 'received'
    WHEN status = 'CANCELLED' THEN 'closed'
    ELSE COALESCE(workflow_status, 'submitted_to_auditor')
  END,
  document_number = COALESCE(document_number, request_number),
  barcode_value = COALESCE(barcode_value, request_number)
WHERE workflow_status IS NULL
   OR document_number IS NULL
   OR barcode_value IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_requests_workflow_status_check'
  ) THEN
    ALTER TABLE stock_requests
      ADD CONSTRAINT stock_requests_workflow_status_check
      CHECK (
        workflow_status IS NULL OR workflow_status IN (
          'draft',
          'submitted_to_auditor',
          'auditor_approved',
          'auditor_rejected',
          'returned_for_correction',
          'sent_to_central_store',
          'packing',
          'dispatched',
          'in_transit',
          'received',
          'verified',
          'closed'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_requests_workflow_status
  ON stock_requests(workflow_status);
CREATE INDEX IF NOT EXISTS idx_stock_requests_document_number
  ON stock_requests(document_number);

-- Line-level quantities and statuses for partial approval/packing/receipt.
ALTER TABLE stock_request_items
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS packed_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unavailable_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS workflow_status TEXT,
  ADD COLUMN IF NOT EXISTS line_notes TEXT;

UPDATE stock_request_items
SET workflow_status = CASE
    WHEN status IN ('PENDING_AUDIT', 'PENDING') THEN 'submitted_to_auditor'
    WHEN status IN ('APPROVED', 'approved', 'PARTIAL') THEN 'auditor_approved'
    WHEN status = 'REJECTED' THEN 'auditor_rejected'
    WHEN status = 'DELIVERED' THEN 'received'
    ELSE COALESCE(workflow_status, 'submitted_to_auditor')
  END,
  packed_quantity = COALESCE(NULLIF(packed_quantity, 0), 0),
  unavailable_quantity = COALESCE(unavailable_quantity, 0),
  received_quantity = COALESCE(received_quantity, 0)
WHERE workflow_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_request_items_quantities_nonnegative'
  ) THEN
    ALTER TABLE stock_request_items
      ADD CONSTRAINT stock_request_items_quantities_nonnegative
      CHECK (
        requested_quantity >= 0
        AND COALESCE(approved_quantity, 0) >= 0
        AND packed_quantity >= 0
        AND unavailable_quantity >= 0
        AND received_quantity >= 0
      );
  END IF;
END $$;

-- Dispatch header workflow and document metadata.
ALTER TABLE dispatch_notes
  ADD COLUMN IF NOT EXISTS workflow_status TEXT,
  ADD COLUMN IF NOT EXISTS packing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_document_number TEXT,
  ADD COLUMN IF NOT EXISTS receipt_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_status TEXT,
  ADD COLUMN IF NOT EXISTS receipt_notes TEXT,
  ADD COLUMN IF NOT EXISTS document_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS barcode_value TEXT;

UPDATE dispatch_notes
SET workflow_status = CASE
    WHEN status IN ('DRAFT', 'PICKING', 'PACKING', 'READY') THEN 'packing'
    WHEN status = 'IN_TRANSIT' THEN 'in_transit'
    WHEN status IN ('DELIVERED', 'CONFIRMED') THEN 'received'
    WHEN status = 'DISPUTED' THEN 'verified'
    ELSE COALESCE(workflow_status, 'packing')
  END,
  packing_started_at = COALESCE(packing_started_at, packed_at, created_at),
  dispatch_document_number = COALESCE(dispatch_document_number, dispatch_number),
  barcode_value = COALESCE(barcode_value, dispatch_number)
WHERE workflow_status IS NULL
   OR dispatch_document_number IS NULL
   OR barcode_value IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_notes_workflow_status_check'
  ) THEN
    ALTER TABLE dispatch_notes
      ADD CONSTRAINT dispatch_notes_workflow_status_check
      CHECK (
        workflow_status IS NULL OR workflow_status IN (
          'packing',
          'packed',
          'dispatched',
          'in_transit',
          'received',
          'verified',
          'closed'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_notes_receipt_status_check'
  ) THEN
    ALTER TABLE dispatch_notes
      ADD CONSTRAINT dispatch_notes_receipt_status_check
      CHECK (
        receipt_status IS NULL OR receipt_status IN (
          'matched',
          'partially_matched',
          'damaged',
          'missing',
          'extra',
          'rejected'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dispatch_notes_workflow_status
  ON dispatch_notes(workflow_status);
CREATE INDEX IF NOT EXISTS idx_dispatch_notes_dispatch_document_number
  ON dispatch_notes(dispatch_document_number);

-- Dispatch line details for picking/packing variances and branch receipt comparison.
ALTER TABLE dispatch_items
  ADD COLUMN IF NOT EXISTS approved_quantity NUMERIC(12, 3),
  ADD COLUMN IF NOT EXISTS picked_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packed_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unavailable_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_status TEXT,
  ADD COLUMN IF NOT EXISTS line_notes TEXT;

UPDATE dispatch_items
SET approved_quantity = COALESCE(approved_quantity, dispatched_quantity),
    picked_quantity = COALESCE(NULLIF(picked_quantity, 0), dispatched_quantity),
    packed_quantity = COALESCE(NULLIF(packed_quantity, 0), dispatched_quantity),
    accepted_quantity = COALESCE(NULLIF(accepted_quantity, 0), received_quantity, 0),
    unavailable_quantity = COALESCE(unavailable_quantity, 0),
    extra_quantity = COALESCE(extra_quantity, 0),
    receipt_status = COALESCE(
      receipt_status,
      CASE
        WHEN COALESCE(damaged_quantity, 0) > 0 THEN 'damaged'
        WHEN COALESCE(missing_quantity, 0) > 0 THEN 'missing'
        WHEN COALESCE(received_quantity, 0) = COALESCE(dispatched_quantity, 0)
          AND COALESCE(dispatched_quantity, 0) > 0 THEN 'matched'
        WHEN COALESCE(received_quantity, 0) > 0 THEN 'partially_matched'
        ELSE NULL
      END
    );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_items_quantities_nonnegative'
  ) THEN
    ALTER TABLE dispatch_items
      ADD CONSTRAINT dispatch_items_quantities_nonnegative
      CHECK (
        dispatched_quantity >= 0
        AND received_quantity >= 0
        AND damaged_quantity >= 0
        AND missing_quantity >= 0
        AND COALESCE(approved_quantity, 0) >= 0
        AND picked_quantity >= 0
        AND packed_quantity >= 0
        AND unavailable_quantity >= 0
        AND accepted_quantity >= 0
        AND extra_quantity >= 0
      );
  END IF;
END $$;

-- Immutable document archive/index for request, approval, packing, dispatch, receipt, and MIN PDFs.
CREATE TABLE IF NOT EXISTS inventory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'branch_request',
      'auditor_approval',
      'packing_list',
      'dispatch_document',
      'receipt_verification',
      'department_request_log',
      'material_issue_note',
      'supplier_payment_receipt'
    )
  ),
  document_number TEXT NOT NULL UNIQUE,
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'archived', 'void', 'regenerated')),
  version INTEGER NOT NULL DEFAULT 1,
  generated_by UUID,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  file_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_inventory_documents ON inventory_documents;
CREATE TRIGGER set_updated_at_inventory_documents
BEFORE UPDATE ON inventory_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_inventory_documents_source
  ON inventory_documents(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_inventory_documents_branch_type
  ON inventory_documents(branch_id, document_type);

-- Department request logging before issue/MIN posting.
CREATE TABLE IF NOT EXISTS department_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  department_account_id UUID REFERENCES department_inventory_accounts(id),
  department_code TEXT NOT NULL,
  department_name TEXT NOT NULL,
  requestor_name TEXT NOT NULL,
  requestor_contact TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shift_code TEXT,
  event_name TEXT,
  event_date DATE,
  pax_count INTEGER,
  purpose TEXT,
  remarks TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_audit' CHECK (
    status IN (
      'logged',
      'pending_audit',
      'audited',
      'approved',
      'rejected',
      'issued',
      'partially_issued',
      'closed'
    )
  ),
  audit_status TEXT NOT NULL DEFAULT 'pending_audit',
  logged_by UUID,
  audited_by UUID,
  audited_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  issue_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_department_request_logs ON department_request_logs;
CREATE TRIGGER set_updated_at_department_request_logs
BEFORE UPDATE ON department_request_logs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_department_request_logs_branch_status
  ON department_request_logs(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_department_request_logs_department
  ON department_request_logs(branch_id, department_code);

CREATE TABLE IF NOT EXISTS department_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES department_request_logs(id) ON DELETE CASCADE,
  item_sku TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'units',
  purpose TEXT,
  issued_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (issued_quantity >= 0),
  pending_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (pending_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'logged' CHECK (
    status IN ('logged', 'approved', 'rejected', 'issued', 'partially_issued', 'pending_stock', 'closed')
  ),
  issue_journal_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_department_request_items ON department_request_items;
CREATE TRIGGER set_updated_at_department_request_items
BEFORE UPDATE ON department_request_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_department_request_items_request
  ON department_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_department_request_items_sku
  ON department_request_items(item_sku);

ALTER TABLE department_inventory_ledger
  ADD COLUMN IF NOT EXISTS department_request_id UUID REFERENCES department_request_logs(id),
  ADD COLUMN IF NOT EXISTS inventory_movement_id UUID REFERENCES inventory_movements(id),
  ADD COLUMN IF NOT EXISTS document_number TEXT;

CREATE INDEX IF NOT EXISTS idx_department_inventory_ledger_request
  ON department_inventory_ledger(department_request_id);

ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_request_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_documents' AND policyname = 'inventory_documents_service_role'
  ) THEN
    CREATE POLICY inventory_documents_service_role
      ON inventory_documents
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'department_request_logs' AND policyname = 'department_request_logs_service_role'
  ) THEN
    CREATE POLICY department_request_logs_service_role
      ON department_request_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'department_request_items' AND policyname = 'department_request_items_service_role'
  ) THEN
    CREATE POLICY department_request_items_service_role
      ON department_request_items
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
