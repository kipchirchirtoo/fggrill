-- ============================================================
-- 20260704_mogogoshiek_deduct_sales.sql
-- Deduct bar sales since the July 3rd stocktake approval from
-- bar_stock.current_stock for Mogogoshiek (branch_id=5).
--
-- Stocktake approved at: 2026-07-03T09:35:59.652Z (UTC) / 12:35 EAT
-- Sales since then: 255 units across 34 drinks (from pos_shift_orders)
--
-- Uses active_qty when present (respects voided items), falls back to
-- quantity - voided_qty.
-- ============================================================

DO $$
DECLARE
  v_branch     INT  := 5;   -- MOGOGOSHIEK
  v_outlet     UUID := 'be5564a1-35e7-4e25-9d1b-cd201383a522'; -- MOGOGOSHIEK Main Bar POS
  v_since      TIMESTAMPTZ := '2026-07-03T09:35:59.652Z';
  v_updated    INT;
BEGIN
  UPDATE public.bar_stock bs
  SET    current_stock = GREATEST(0, bs.current_stock - sales.qty_sold),
         last_updated  = NOW(),
         updated_at    = NOW()
  FROM   public.bar_drinks bd
  JOIN   (
           SELECT
             poi.source_item_id::uuid AS drink_id,
             SUM(
               COALESCE(
                 (item->>'active_qty')::numeric,
                 (item->>'quantity')::numeric
                   - COALESCE((item->>'voided_qty')::numeric, 0)
               )
             ) AS qty_sold
           FROM   public.pos_shift_orders pso,
                  jsonb_array_elements(pso.items) AS item
           JOIN   public.pos_outlet_items poi
                    ON poi.id = (item->>'outlet_item_id')::uuid
           WHERE  pso.outlet_id   = v_outlet
             AND  pso.status      IN ('paid', 'credit_bill')
             AND  pso.created_at  > v_since
             AND  poi.source_table = 'bar_drinks'
           GROUP  BY poi.source_item_id
         ) sales ON sales.drink_id = bd.id
  WHERE  bs.branch_id = v_branch
    AND  bs.drink_id  = bd.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Deducted sales from % bar_stock rows (branch %)', v_updated, v_branch;

  RAISE NOTICE 'Mogogoshiek bar_stock after deduction: % total units',
    (SELECT SUM(current_stock) FROM public.bar_stock WHERE branch_id = v_branch);
END $$;
