-- =====================================================
-- DAILY CONTROLS SNAPSHOT (Phase 5)
-- Migration: 20260629_daily_control_snapshots.sql
-- Description:
--  Daily Controls (getDailyControlData / buildDailyControlPayload in
--  kitchen-controls.controller.ts) has always computed everything fresh,
--  live, on every request — no persistence, no distinction between a
--  finalized day and the one still in progress. This table is that missing
--  persistence layer: one frozen snapshot per commercial day (= one
--  cashier_shift_logs lifecycle), written once, when that cashier shift has
--  closed and the NEXT cashier shift for the branch opens
--  (snapshotPreviousClosedCommercialDay in cashier-shifts.controller.ts).
--
--  The Daily Controls screen now shows two distinct things, never merged:
--  the latest row here (the previous CLOSED commercial day — finalized,
--  trustworthy) and a live call to buildDailyControlPayload for today's
--  still-open cashier shift (clearly labeled "Live/provisional").
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_control_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  cashier_shift_id UUID NOT NULL REFERENCES cashier_shift_logs(id),
  shift_date DATE NOT NULL,
  shift_number TEXT,
  snapshot_data JSONB NOT NULL,
  total_food_revenue NUMERIC(14,2) DEFAULT 0,
  actual_ingredient_cost NUMERIC(14,2) DEFAULT 0,
  bom_variance_cost NUMERIC(14,2) DEFAULT 0,
  food_cost_percent NUMERIC(6,2),
  computed_trigger TEXT NOT NULL DEFAULT 'cashier_shift_open' CHECK (computed_trigger IN ('cashier_shift_open', 'manual')),
  computed_at TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'Africa/Nairobi') -- KENYA TIME
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_snapshot_per_cashier_shift ON daily_control_snapshots(cashier_shift_id);
CREATE INDEX IF NOT EXISTS idx_daily_control_snapshots_branch_date ON daily_control_snapshots(branch_id, shift_date DESC);

ALTER TABLE daily_control_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users"
ON daily_control_snapshots FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users"
ON daily_control_snapshots FOR ALL
USING (auth.role() = 'authenticated');

COMMENT ON TABLE daily_control_snapshots IS 'One frozen Daily Controls payload per closed commercial day (cashier_shift_logs lifecycle), written when the next cashier shift opens. The previous-day source of truth — never recomputed, never mixed with live/provisional data for the still-open shift.';
COMMENT ON COLUMN daily_control_snapshots.snapshot_data IS 'Full payload shape returned by buildDailyControlPayload — bom_control, no_recipe_items, kitchen_vs_sales, stock_vs_sales, summary, etc — frozen at computed_at.';
COMMENT ON COLUMN daily_control_snapshots.cashier_shift_id IS 'The closed cashier_shift_logs row this snapshot was computed for. One snapshot per shift, enforced by the unique index — re-triggering the open hook will not duplicate it.';
