-- 20260703: Columns the central-store issue workflow writes but which were
-- never migrated. Their absence made PostgREST throw 42703 on:
--   * GET  /api/storekeeping/backorders            (Pending Backorders screen)
--   * PATCH /stock-requests/:id/items/:itemId/issue (per-line issue qty)
--   * POST /stock-requests/:id/confirm-dispatch     (backorder marking + dispatched_at)
--   * POST /direct-issues                           (issued_qty/issue_status/unit_cost on lines)
--
-- NOTE: stock_request_items and stock_requests are VIEWS over
-- branch_requisition_lines / branch_requisitions. Columns are added to the
-- BASE tables and the views are recreated with the new columns appended
-- (simple single-table views stay auto-updatable, so PostgREST writes
-- through them reach the base table).

ALTER TABLE public.branch_requisition_lines
    ADD COLUMN IF NOT EXISTS issued_qty  numeric(12,4),
    ADD COLUMN IF NOT EXISTS issue_status text,
    ADD COLUMN IF NOT EXISTS issue_notes text,
    ADD COLUMN IF NOT EXISTS unit_cost   numeric(12,4),
    ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

ALTER TABLE public.branch_requisitions
    ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

-- Recreate the views with the new columns appended (CREATE OR REPLACE VIEW
-- only permits appending columns, which is exactly what we do here).
CREATE OR REPLACE VIEW public.stock_request_items AS
 SELECT id,
    branch_requisition_id,
    item_id,
    requested_quantity,
    approved_quantity,
    packed_quantity,
    received_quantity,
    unit,
    line_status,
    reason,
    created_at,
    item_sku,
    current_branch_stock,
    workflow_status,
    request_id,
    status,
    unavailable_quantity,
    rejection_reason,
    requested_quantity AS quantity_requested,
    requested_quantity AS quantity,
    approved_quantity AS quantity_approved,
    issued_qty,
    issue_status,
    issue_notes,
    unit_cost,
    updated_at
   FROM branch_requisition_lines;

CREATE OR REPLACE VIEW public.stock_requests AS
 SELECT id,
    branch_id,
    request_number,
    requested_by,
    status,
    priority,
    reason,
    requested_at,
    auditor_id,
    auditor_decided_at,
    metadata,
    created_at,
    updated_at,
    request_type,
    workflow_status,
    submitted_to_auditor_at,
    document_number,
    reviewed_by,
    reviewed_at,
    review_notes,
    needed_by_date,
    requesting_branch_id,
    barcode_value,
    auditor_decision_at,
    sent_to_central_store_at,
    requested_by AS created_by,
    reviewed_by AS approved_by,
    reviewed_at AS approved_at,
    dispatched_at
   FROM branch_requisitions;

-- The backorders screen filters on issue_status='backordered'.
CREATE INDEX IF NOT EXISTS idx_branch_requisition_lines_issue_status
    ON public.branch_requisition_lines (issue_status)
    WHERE issue_status IS NOT NULL;

COMMENT ON COLUMN public.branch_requisition_lines.issue_status IS
    'issued | partially_issued | backordered — set by central store during issue';
