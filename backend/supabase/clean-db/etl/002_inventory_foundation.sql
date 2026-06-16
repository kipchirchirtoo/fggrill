-- Clean DB ETL: inventory foundation
-- This script consolidates item catalogs and branch stock into canonical tables.

BEGIN;

INSERT INTO public.inventory_items (sku, item_name, description, category, unit, item_type, is_perishable, tracking_mode, default_unit_cost, default_selling_price, reorder_level, metadata, created_at, updated_at)
SELECT DISTINCT ON (sku)
  sku,
  item_name,
  description,
  category,
  unit,
  'stockable',
  is_perishable,
  tracking_mode,
  default_unit_cost,
  default_selling_price,
  reorder_level,
  metadata,
  created_at,
  updated_at
FROM (
  SELECT
    COALESCE(NULLIF(si.sku::text, ''), NULLIF(si.item_id::text, ''), NULLIF(si.id::text, '')) AS sku,
    COALESCE(NULLIF(si.item_name::text, ''), NULLIF(si.description::text, ''), NULLIF(si.name::text, ''), 'Unknown Item') AS item_name,
    NULLIF(si.description::text, '') AS description,
    NULLIF(si.category::text, '') AS category,
    COALESCE(NULLIF(si.unit_of_measure::text, ''), NULLIF(si.unit::text, ''), 'unit') AS unit,
    COALESCE((si.is_perishable)::boolean, false) AS is_perishable,
    'standard' AS tracking_mode,
    COALESCE(NULLIF(si.cost_price::text, '')::numeric, 0) AS default_unit_cost,
    COALESCE(NULLIF(si.retail_price::text, '')::numeric, NULLIF(si.selling_price::text, '')::numeric, 0) AS default_selling_price,
    COALESCE(NULLIF(si.reorder_level::text, '')::numeric, 0) AS reorder_level,
    to_jsonb(si) AS metadata,
    COALESCE(si.created_at::timestamptz, NOW()) AS created_at,
    COALESCE(si.updated_at::timestamptz, NOW()) AS updated_at
  FROM legacy_import.simple_items si
  WHERE COALESCE(NULLIF(si.sku::text, ''), NULLIF(si.item_id::text, ''), NULLIF(si.id::text, '')) IS NOT NULL

  UNION ALL

  SELECT
    COALESCE(NULLIF(iic.sku::text, ''), NULLIF(iic.source_item_key::text, ''), NULLIF(iic.id::text, '')) AS sku,
    COALESCE(NULLIF(iic.item_name::text, ''), NULLIF(iic.name::text, ''), 'Unknown Item') AS item_name,
    NULLIF(iic.description::text, '') AS description,
    NULLIF(iic.category::text, '') AS category,
    COALESCE(NULLIF(iic.unit::text, ''), 'unit') AS unit,
    COALESCE((iic.is_perishable)::boolean, false) AS is_perishable,
    COALESCE(NULLIF(iic.tracking_mode::text, ''), 'standard') AS tracking_mode,
    COALESCE(NULLIF(iic.default_unit_cost::text, '')::numeric, 0) AS default_unit_cost,
    COALESCE(NULLIF(iic.default_selling_price::text, '')::numeric, 0) AS default_selling_price,
    COALESCE(NULLIF(iic.reorder_level::text, '')::numeric, 0) AS reorder_level,
    COALESCE(iic.metadata::jsonb, '{}'::jsonb) AS metadata,
    COALESCE(iic.created_at::timestamptz, NOW()) AS created_at,
    COALESCE(iic.updated_at::timestamptz, NOW()) AS updated_at
  FROM legacy_import.inventory_item_catalog iic
  WHERE COALESCE(NULLIF(iic.sku::text, ''), NULLIF(iic.source_item_key::text, ''), NULLIF(iic.id::text, '')) IS NOT NULL
) items
WHERE sku IS NOT NULL
ORDER BY sku, updated_at DESC
ON CONFLICT (sku) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  description = COALESCE(EXCLUDED.description, public.inventory_items.description),
  category = COALESCE(EXCLUDED.category, public.inventory_items.category),
  unit = EXCLUDED.unit,
  updated_at = NOW();

INSERT INTO public.inventory_locations (branch_id, location_code, name, location_type, metadata)
SELECT DISTINCT
  bs.branch_id::integer,
  'BRANCH_STORE_' || bs.branch_id::text,
  COALESCE(b.name, 'Branch ' || bs.branch_id::text) || ' Branch Store',
  'branch_store',
  jsonb_build_object('source', 'branch_stock')
FROM legacy_import.branch_stock bs
LEFT JOIN public.branches b ON b.id = bs.branch_id::integer
WHERE NULLIF(bs.branch_id::text, '') IS NOT NULL
ON CONFLICT (branch_id, location_code) DO NOTHING;

INSERT INTO public.inventory_balances (item_id, location_id, current_quantity, reserved_quantity, unit_cost, created_at, updated_at)
SELECT
  ii.id,
  il.id,
  GREATEST(COALESCE(NULLIF(bs.quantity::text, '')::numeric, 0), 0),
  GREATEST(COALESCE(NULLIF(bs.reserved_quantity::text, '')::numeric, 0), 0),
  COALESCE(ii.default_unit_cost, 0),
  COALESCE(bs.created_at::timestamptz, NOW()),
  COALESCE(bs.updated_at::timestamptz, NOW())
FROM legacy_import.branch_stock bs
JOIN public.inventory_items ii ON ii.sku = bs.item_sku::text
JOIN public.inventory_locations il
  ON il.branch_id = bs.branch_id::integer
 AND il.location_code = 'BRANCH_STORE_' || bs.branch_id::text
WHERE NULLIF(bs.branch_id::text, '') IS NOT NULL
ON CONFLICT (item_id, location_id, batch_id) DO UPDATE SET
  current_quantity = EXCLUDED.current_quantity,
  reserved_quantity = EXCLUDED.reserved_quantity,
  unit_cost = EXCLUDED.unit_cost,
  updated_at = NOW();

COMMIT;

