-- ============================================================
-- 20260704_mogogoshiek_bar_stock_seed_v2.sql
-- Fix bar_stock for Mogogoshiek (branch_id=5) Main Bar.
--
-- Root cause: 99 of 138 bar_drinks have inventory_item_id=NULL,
-- so the approval flow UPDATE bar_stock ... JOIN bar_drinks bd ON
-- bd.inventory_item_id = btr.item_id silently updates 0 rows.
-- Only the 39 drinks that already had inventory_item_id set were
-- getting stock from stocktake approvals.
--
-- Fix:
--   1. Backfill bar_drinks.inventory_item_id via name match against
--      inventory_items rows that are referenced in bar_stocktake_records
--      (all 138 already exist — 100% name match confirmed).
--   2. Update bar_stock.current_stock from the latest approved
--      bar_stocktake_records (July 3rd 2026 EAT, 1108 total units).
-- ============================================================

DO $$
DECLARE
  v_branch   INT  := 5;   -- MOGOGOSHIEK
  v_backfill INT;
  v_updated  INT;
BEGIN
  -- 1. Backfill bar_drinks.inventory_item_id where NULL,
  --    matching on item_name via the stocktake records.
  UPDATE public.bar_drinks bd
  SET    inventory_item_id = ii.id,
         updated_at        = NOW()
  FROM   public.inventory_items ii
  WHERE  bd.branch_id           = v_branch
    AND  bd.inventory_item_id   IS NULL
    AND  lower(trim(bd.name::text)) = lower(trim(ii.item_name::text))
    AND  ii.id IN (
           SELECT DISTINCT item_id
           FROM   public.bar_stocktake_records
           WHERE  branch_id = v_branch
         );

  GET DIAGNOSTICS v_backfill = ROW_COUNT;
  RAISE NOTICE 'Backfilled inventory_item_id for % bar_drinks rows (branch %)', v_backfill, v_branch;

  -- 2. Update bar_stock.current_stock from the latest approved stocktake.
  UPDATE public.bar_stock bs
  SET    current_stock = latest.physical_quantity,
         last_updated  = NOW(),
         updated_at    = NOW()
  FROM   public.bar_drinks bd
  JOIN   (
           SELECT DISTINCT ON (item_id)
                  item_id, physical_quantity
           FROM   public.bar_stocktake_records
           WHERE  branch_id = v_branch
             AND  status    = 'approved'
           ORDER  BY item_id, stocktake_date DESC, created_at DESC
         ) latest ON latest.item_id = bd.inventory_item_id
  WHERE  bs.branch_id = v_branch
    AND  bs.drink_id  = bd.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Updated current_stock for % bar_stock rows (branch %)', v_updated, v_branch;

  RAISE NOTICE 'Done. Total bar_stock for Mogogoshiek: % rows, % total units',
    (SELECT COUNT(*)        FROM public.bar_stock WHERE branch_id = v_branch),
    (SELECT SUM(current_stock) FROM public.bar_stock WHERE branch_id = v_branch);
END $$;
