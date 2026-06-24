-- Branch Spoilage Log: storekeeper records spoiled/damaged/expired stock for
-- any of the three branch stocktake areas (bar, kitchen, store). Entries sit
-- 'pending' until a branch accountant approves or rejects them — approval is
-- what applies the stock effect (bar_stock_ledger entry / branch_stock
-- deduction), not the initial submission. See branch-spoilage.controller.ts.

CREATE TABLE IF NOT EXISTS branch_spoilage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL,
  area TEXT NOT NULL CHECK (area IN ('bar', 'kitchen', 'store')),
  bar_location TEXT,
  shift TEXT,
  item_id UUID,
  item_sku TEXT,
  item_name TEXT NOT NULL,
  unit TEXT DEFAULT 'unit',
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC DEFAULT 0,
  total_loss NUMERIC DEFAULT 0,
  reason TEXT NOT NULL CHECK (reason IN ('EXPIRED', 'DAMAGED', 'BREAKAGE', 'CONTAMINATION', 'THEFT', 'QUALITY_ISSUE', 'OTHER')),
  notes TEXT,
  spoilage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branch_spoilage_log_branch_date
  ON branch_spoilage_log(branch_id, spoilage_date DESC);
CREATE INDEX IF NOT EXISTS idx_branch_spoilage_log_status
  ON branch_spoilage_log(branch_id, status);
