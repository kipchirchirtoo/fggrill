-- =====================================================
-- KITCHEN SHIFT / CASHIER SHIFT LINK + ISSUANCE LEDGER (Phase 2)
-- Migration: 20260629_kitchen_shift_cashier_link.sql
-- Description:
--  1. Links kitchen_shifts to the commercial day (cashier_shift_logs) and
--     enforces "one shift of each sub-type per commercial day per branch"
--     at the DB level, on a NEW sub_shift_type column — the existing
--     shift_type column is left untouched because it already feeds
--     stock_counts.location (kitchen_${shift_type}) elsewhere and must not
--     change meaning.
--  2. Adds a department tag so Pastry Production can be absorbed into
--     Kitchen Sessions as a department rather than a separate screen.
--  3. Adds kitchen_shift_additions: a proper type-tagged, recipe-linked,
--     staff-tagged, timestamped ledger for mid-shift stock additions.
--     kitchen_shift_items.additions (a running total) is still updated
--     alongside it so the existing close/reconciliation/stock_counts sync
--     logic keeps working unchanged — this table is the missing audit
--     trail behind that number, not a replacement for it.
-- =====================================================

ALTER TABLE kitchen_shifts
  ADD COLUMN IF NOT EXISTS sub_shift_type TEXT CHECK (sub_shift_type IN ('A', 'B')),
  ADD COLUMN IF NOT EXISTS cashier_shift_id UUID REFERENCES cashier_shift_logs(id),
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'KITCHEN' CHECK (department IN ('KITCHEN', 'PASTRY'));

CREATE INDEX IF NOT EXISTS idx_kitchen_shifts_cashier_shift ON kitchen_shifts(cashier_shift_id);

-- Partial unique index: only enforced once a shift actually declares both
-- a cashier_shift_id and a sub_shift_type. Existing/legacy rows (NULL in
-- either column) are unaffected — Postgres never treats NULLs as duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_subshift_per_cashier_shift
  ON kitchen_shifts (branch_id, cashier_shift_id, sub_shift_type, department)
  WHERE cashier_shift_id IS NOT NULL AND sub_shift_type IS NOT NULL;

CREATE TABLE IF NOT EXISTS kitchen_shift_additions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES kitchen_shifts(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255),
  quantity NUMERIC(10,3) NOT NULL,
  unit VARCHAR(50),
  food_control_type TEXT NOT NULL CHECK (food_control_type IN ('A_RECIPE_BOM', 'B_YIELD_POOL', 'C_DIRECT', 'EXEMPT', 'UNREGISTERED')),
  recipe_id UUID REFERENCES kitchen_production_recipes(id),
  responsible_staff_ids UUID[] NOT NULL,
  notes TEXT,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Africa/Nairobi'), -- KENYA TIME
  CONSTRAINT require_responsible_staff CHECK (array_length(responsible_staff_ids, 1) > 0),
  CONSTRAINT require_recipe_for_type_a CHECK (food_control_type != 'A_RECIPE_BOM' OR recipe_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_shift_additions_shift ON kitchen_shift_additions(shift_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_shift_additions_branch ON kitchen_shift_additions(branch_id);

ALTER TABLE kitchen_shift_additions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users"
ON kitchen_shift_additions FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users"
ON kitchen_shift_additions FOR ALL
USING (auth.role() = 'authenticated');

COMMENT ON COLUMN kitchen_shifts.sub_shift_type IS 'A or B — the storekeeper-facing shift slot. Distinct from shift_type, which feeds stock_counts.location and must not change meaning.';
COMMENT ON COLUMN kitchen_shifts.cashier_shift_id IS 'The commercial day (cashier_shift_logs row) this kitchen shift belongs to. Enforces one A and one B per commercial day via uq_one_subshift_per_cashier_shift.';
COMMENT ON TABLE kitchen_shift_additions IS 'Audit trail for every mid-shift stock addition: type, recipe (if applicable), responsible staff, and timestamp. kitchen_shift_items.additions remains the running total used by existing reconciliation; this table is the detail behind it.';
