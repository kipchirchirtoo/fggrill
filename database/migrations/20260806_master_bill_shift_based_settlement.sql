-- ============================================================================
-- SHIFT-BASED MASTER-BILL CLEARANCE
--
-- When one cashier clears a combined (master) bill they keep the FULL tender in
-- their own cashier shift; every OTHER contributing outlet keeps its own sales +
-- stock but is NOT posted any cash (so its cashier is never short). Each outlet's
-- share becomes a settlement task assigned to the cashier SHIFT currently
-- responsible for that outlet, who must Acknowledge & Print (or Dispute) before
-- closing. Closed outlet shifts are never reopened — their original sales stay
-- put and the acknowledgment is assigned to the next responsible cashier shift.
-- ============================================================================

-- Which cashier shift owns each outlet's share (assigned at clearance to the
-- outlet's currently-open shift, or later when the next shift opens).
ALTER TABLE public.pos_master_bill_settlements
  ADD COLUMN IF NOT EXISTS shift_id               uuid,
  ADD COLUMN IF NOT EXISTS responsible_cashier_id uuid,
  ADD COLUMN IF NOT EXISTS receipt_printed_at     timestamptz;

-- Lets the Cross-Outlet Settlements queue find a cashier's pending/disputed
-- shares by the shift assigned to them, not just by outlet.
CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_shift
  ON public.pos_master_bill_settlements (shift_id)
  WHERE shift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_responsible
  ON public.pos_master_bill_settlements (responsible_cashier_id, status)
  WHERE responsible_cashier_id IS NOT NULL;

-- Marks a member order whose cash was collected by ANOTHER cashier via a master
-- bill. The order stays a full sale for its outlet (revenue + stock), but no
-- pos_shift_payments row is posted to its outlet shift, so that outlet's cash
-- reconciliation does not expect it — "Collected by another cashier".
ALTER TABLE public.pos_shift_orders
  ADD COLUMN IF NOT EXISTS externally_settled     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS externally_settled_by  uuid;
