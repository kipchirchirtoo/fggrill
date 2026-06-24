-- =====================================================================
-- BAR STOCKTAKE ENHANCED COLUMNS
-- Adds opening_stock, additions, sales, and reason_for_variance to
-- bar_stocktake_records so the branch storekeeper can record the full
-- stock equation: system = opening + additions - sales, and provide a
-- reason whenever the physical count differs from the system quantity.
-- =====================================================================

ALTER TABLE bar_stocktake_records
  ADD COLUMN IF NOT EXISTS opening_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additions NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reason_for_variance TEXT;

-- Update existing rows: treat the old system_quantity as opening stock
-- and zero additions/sales so the variance stays the same.
UPDATE bar_stocktake_records
SET opening_stock = COALESCE(system_quantity, 0),
    additions = 0,
    sales = 0
WHERE opening_stock = 0 AND additions = 0 AND sales = 0;
