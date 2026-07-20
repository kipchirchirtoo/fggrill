-- Enforce outlet-scoped bar stock for the branch-storekeeper push model.
-- Goal:
--   1. Supplier / central-store receiving increases branch store only.
--   2. Bar outlet stock lives per outlet (Main Bar / Executive Bar / Sports Bar).
--   3. Bar stock rows must be unique per branch + outlet + drink, not per branch + drink.
--   4. Legacy helper get_bar_stock() must not silently pool multiple outlets together.

BEGIN;

-- 1) Backfill outlet_id onto legacy bar_stock rows for branches that have
-- exactly one bar outlet configured. This covers the common single-bar branch
-- case safely without guessing across multi-bar branches.
WITH single_bar_outlets AS (
  SELECT
    po.branch_id,
    MIN(po.id::text)::uuid AS outlet_id
  FROM public.pos_outlets po
  WHERE po.outlet_type IN (
    'main_bar',
    'executive_bar',
    'sports_bar',
    'kyogong_executive_bar',
    'kyogong_sports_bar'
  )
  GROUP BY po.branch_id
  HAVING COUNT(*) = 1
)
UPDATE public.bar_stock bs
SET
  outlet_id = sbo.outlet_id,
  updated_at = NOW()
FROM single_bar_outlets sbo
WHERE bs.branch_id = sbo.branch_id
  AND bs.outlet_id IS NULL;

-- 2) Replace the old branch-level uniqueness with outlet-level uniqueness.
ALTER TABLE public.bar_stock
  DROP CONSTRAINT IF EXISTS bar_stock_branch_id_drink_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bar_stock_branch_outlet_drink_unique
  ON public.bar_stock(branch_id, outlet_id, drink_id)
  WHERE outlet_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bar_stock_branch_outlet
  ON public.bar_stock(branch_id, outlet_id);

-- 3) Update the SQL helper used by older screens / reports.
-- Behaviour:
--   - if p_outlet_id is supplied: read ONLY that outlet
--   - if p_outlet_id is omitted and the branch has exactly one bar outlet:
--       auto-resolve to that outlet
--   - otherwise: do not pool multiple outlets together; return zero balances
CREATE OR REPLACE FUNCTION public.get_bar_stock(
  p_branch_id INTEGER,
  p_outlet_id UUID DEFAULT NULL
)
RETURNS TABLE (
  drink_id UUID,
  sku TEXT,
  name TEXT,
  category TEXT,
  unit TEXT,
  cost_price NUMERIC,
  selling_price NUMERIC,
  current_stock NUMERIC,
  min_stock NUMERIC,
  last_restocked TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
  WITH resolved_outlet AS (
    SELECT po.id, po.inventory_location_id
    FROM public.pos_outlets po
    WHERE po.branch_id = p_branch_id
      AND po.outlet_type IN (
        'main_bar',
        'executive_bar',
        'sports_bar',
        'kyogong_executive_bar',
        'kyogong_sports_bar'
      )
      AND (
        (p_outlet_id IS NOT NULL AND po.id = p_outlet_id)
        OR (
          p_outlet_id IS NULL
          AND 1 = (
            SELECT COUNT(*)
            FROM public.pos_outlets po2
            WHERE po2.branch_id = p_branch_id
              AND po2.outlet_type IN (
                'main_bar',
                'executive_bar',
                'sports_bar',
                'kyogong_executive_bar',
                'kyogong_sports_bar'
              )
          )
        )
      )
    ORDER BY po.created_at
    LIMIT 1
  )
  SELECT
    bd.id AS drink_id,
    ii.sku,
    bd.name,
    COALESCE(c.name, bd.category::text, '') AS category,
    COALESCE(bd.unit, 'bottle') AS unit,
    COALESCE(ii.default_unit_cost, bd.cost_price, 0) AS cost_price,
    COALESCE(bd.price, bd.selling_price, ii.default_selling_price, 0) AS selling_price,
    COALESCE(ib.current_quantity, bs.current_stock, 0) AS current_stock,
    COALESCE(bs.par_level, 5) AS min_stock,
    bs.last_updated AS last_restocked
  FROM public.bar_drinks bd
  LEFT JOIN public.bar_drink_categories c
    ON c.id = bd.category_id
  LEFT JOIN public.inventory_items ii
    ON ii.sku = COALESCE(NULLIF(bd.sku::text, ''), 'BAR-' || bd.id::text)
  LEFT JOIN resolved_outlet ro
    ON TRUE
  LEFT JOIN public.bar_stock bs
    ON bs.drink_id = bd.id
   AND bs.branch_id = p_branch_id
   AND ro.id IS NOT NULL
   AND bs.outlet_id = ro.id
  LEFT JOIN public.inventory_balances ib
    ON ib.item_id = ii.id
   AND ro.inventory_location_id IS NOT NULL
   AND ib.location_id = ro.inventory_location_id
  WHERE bd.is_available IS NOT FALSE
    AND (bd.branch_id IS NULL OR bd.branch_id = p_branch_id)
  ORDER BY bd.name;
$$;

COMMIT;
