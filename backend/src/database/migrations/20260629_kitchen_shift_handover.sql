-- =====================================================
-- KITCHEN SHIFT HANDOVER — DIGITAL KITCHEN LEDGER (Phase 4)
-- Migration: 20260629_kitchen_shift_handover.sql
-- Description:
--  Replaces the physical kitchen handover ledger. When a Shift A/B kitchen
--  shift (one with sub_shift_type set — see 20260629_kitchen_shift_cashier_link.sql)
--  is closed, the storekeeper must name both the outgoing and incoming shift
--  teams as witnesses to the physical closing counts. That witnessed
--  snapshot is this table's one row per outgoing shift — the same physical
--  counts already computed into kitchen_shift_stock_take at close time, just
--  carried forward with witnesses attached.
--
--  Shift B cannot open until this row exists for the matching Shift A
--  (enforced in openKitchenShift via error code SHIFT_A_NOT_HANDED_OVER),
--  and once it opens, its kitchen_shift_items.opening_stock is seeded
--  directly from closing_counts here rather than re-entered by hand.
--
--  Legacy/ad-hoc kitchen_shifts rows with no sub_shift_type are untouched —
--  this table and its requirements only apply to the new Shift A/B flow.
-- =====================================================

CREATE TABLE IF NOT EXISTS kitchen_shift_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outgoing_shift_id UUID NOT NULL REFERENCES kitchen_shifts(id),
  incoming_shift_id UUID REFERENCES kitchen_shifts(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  cashier_shift_id UUID REFERENCES cashier_shift_logs(id),
  department TEXT NOT NULL CHECK (department IN ('KITCHEN', 'PASTRY')),
  outgoing_witness_ids UUID[] NOT NULL,
  incoming_witness_ids UUID[] NOT NULL,
  closing_counts JSONB NOT NULL,
  notes TEXT,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Africa/Nairobi'), -- KENYA TIME
  seeded_at TIMESTAMPTZ,
  CONSTRAINT require_outgoing_witnesses CHECK (array_length(outgoing_witness_ids, 1) > 0),
  CONSTRAINT require_incoming_witnesses CHECK (array_length(incoming_witness_ids, 1) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_handover_per_outgoing_shift ON kitchen_shift_handovers(outgoing_shift_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_shift_handovers_incoming ON kitchen_shift_handovers(incoming_shift_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_shift_handovers_branch ON kitchen_shift_handovers(branch_id);

ALTER TABLE kitchen_shift_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users"
ON kitchen_shift_handovers FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users"
ON kitchen_shift_handovers FOR ALL
USING (auth.role() = 'authenticated');

COMMENT ON TABLE kitchen_shift_handovers IS 'Digital kitchen ledger: one witnessed handover document per outgoing Shift A/B kitchen shift, replacing the physical handover ledger. closing_counts is the same physical-count snapshot written to kitchen_shift_stock_take at close time; Shift B opening_stock is seeded from it.';
COMMENT ON COLUMN kitchen_shift_handovers.outgoing_witness_ids IS 'Outgoing shift team members who witnessed and agree with the closing physical counts.';
COMMENT ON COLUMN kitchen_shift_handovers.incoming_witness_ids IS 'Incoming shift team members who witnessed and accept the handed-over stock.';
COMMENT ON COLUMN kitchen_shift_handovers.seeded_at IS 'Set once the incoming shift actually opens and draws its opening_stock from closing_counts here.';
