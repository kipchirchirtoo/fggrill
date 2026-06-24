-- Store Stocktake: physical count vs system quantity for general store
-- items (everything that isn't bar stock — foodstuffs, stationery,
-- non_consumables). Mirrors bar_stocktake_records exactly.

CREATE TABLE IF NOT EXISTS store_stocktake_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL,
  stocktake_date DATE NOT NULL,
  shift_id UUID,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  system_quantity NUMERIC NOT NULL DEFAULT 0,
  physical_quantity NUMERIC NOT NULL DEFAULT 0,
  variance NUMERIC GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, stocktake_date, item_id)
);

CREATE INDEX IF NOT EXISTS idx_store_stocktake_records_branch_date
  ON store_stocktake_records(branch_id, stocktake_date);
