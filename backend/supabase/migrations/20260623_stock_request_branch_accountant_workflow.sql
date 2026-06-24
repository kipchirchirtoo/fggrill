-- Transition branch requisitions to the branch-accountant-first workflow.
-- stock_requests is a view over branch_requisitions, so no CHECK constraint is altered here;
-- the existing workflow_status CHECK constraint on the view was never applied. We only backfill
-- existing rows so pending requests route to the branch accountant instead of the auditor.

-- Backfill the underlying table (branch_requisitions) so existing pending requests
-- are presented to the branch accountant.
UPDATE branch_requisitions
SET workflow_status = CASE
    WHEN status IN ('PENDING_AUDIT', 'UNDER_REVIEW', 'PENDING') THEN 'submitted_to_branch_accountant'
    WHEN status IN ('APPROVED', 'PARTIALLY_APPROVED') THEN 'branch_accountant_approved'
    WHEN status = 'REJECTED' THEN 'branch_accountant_rejected'
    WHEN status = 'DISPATCHED' THEN 'dispatched'
    WHEN status = 'DELIVERED' THEN 'received'
    WHEN status = 'CANCELLED' THEN 'closed'
    ELSE COALESCE(workflow_status, 'submitted_to_branch_accountant')
  END,
  status = CASE
    WHEN status IN ('PENDING_AUDIT', 'UNDER_REVIEW', 'PENDING') THEN 'PENDING_BRANCH_ACCOUNTANT_APPROVAL'
    ELSE status
  END
WHERE workflow_status IS NULL
   OR workflow_status IN (
        'submitted_to_auditor',
        'auditor_approved',
        'auditor_rejected'
      )
   OR status IN ('PENDING_AUDIT', 'UNDER_REVIEW', 'PENDING');

-- Also keep the line items consistent with the new workflow.
UPDATE stock_request_items
SET workflow_status = CASE
    WHEN status IN ('PENDING_AUDIT', 'PENDING') THEN 'submitted_to_branch_accountant'
    WHEN status IN ('APPROVED', 'approved', 'PARTIAL', 'PARTIALLY_APPROVED') THEN 'branch_accountant_approved'
    WHEN status = 'REJECTED' THEN 'branch_accountant_rejected'
    WHEN status = 'DELIVERED' THEN 'received'
    ELSE COALESCE(workflow_status, 'submitted_to_branch_accountant')
  END
WHERE workflow_status IS NULL
   OR workflow_status IN (
        'submitted_to_auditor',
        'auditor_approved',
        'auditor_rejected'
      )
   OR status IN ('PENDING_AUDIT', 'PENDING');
