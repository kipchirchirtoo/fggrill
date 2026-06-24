-- Kitchen Stocktake: replicates the physical paper logbook used at the
-- kitchen serving counter (OPEN / ADD / CLOSING / VAR per item, per shift A/B).
-- Item list is a fixed catalog (not tied to branch_stock/simple_items, which
-- only carries raw ingredients, not prepared dishes).

CREATE TABLE IF NOT EXISTS kitchen_stocktake_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL,
  stocktake_date DATE NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('A', 'B')),
  dispenser_name TEXT,
  cheps_on_duty JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmation_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_by UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, stocktake_date, shift)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_stocktake_shifts_branch_date
  ON kitchen_stocktake_shifts(branch_id, stocktake_date);

CREATE TABLE IF NOT EXISTS kitchen_stocktake_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES kitchen_stocktake_shifts(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  opening_qty NUMERIC NOT NULL DEFAULT 0,
  added_qty NUMERIC NOT NULL DEFAULT 0,
  closing_qty NUMERIC NOT NULL DEFAULT 0,
  variance NUMERIC GENERATED ALWAYS AS (opening_qty + added_qty - closing_qty) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shift_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_stocktake_items_shift
  ON kitchen_stocktake_items(shift_id);
