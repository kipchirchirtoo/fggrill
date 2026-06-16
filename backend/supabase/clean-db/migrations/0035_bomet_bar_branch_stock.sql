-- ============================================================
-- 0035_bomet_bar_branch_stock.sql
-- Register all bar_store inventory items into branch_stock
-- for Bomet Town (branch_id=2) with quantity=0.
-- Storekeeper will enter actual quantities during stock-take.
-- Idempotent: ON CONFLICT (branch_id, item_sku) DO NOTHING.
-- ============================================================

INSERT INTO public.branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, updated_at)
SELECT
  2,
  ii.sku,
  0,   -- quantity to be set by storekeeper
  10,  -- default reorder level
  100, -- default max
  NOW()
FROM public.inventory_items ii
WHERE ii.store_type = 'bar_store'
  AND ii.is_active  = true
  AND ii.sku        IS NOT NULL
ON CONFLICT (branch_id, item_sku) DO NOTHING;
