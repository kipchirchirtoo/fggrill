-- Clean DB ETL: POS outlets, menu items, outlet stock, stock take.

BEGIN;

INSERT INTO public.inventory_locations (branch_id, location_code, name, location_type, metadata)
SELECT
  po.branch_id::integer,
  'POS_' || po.id::text,
  po.name::text,
  'pos_outlet',
  jsonb_build_object('source', 'pos_outlets', 'source_id', po.id)
FROM legacy_import.pos_outlets po
WHERE po.id IS NOT NULL AND po.branch_id IS NOT NULL
ON CONFLICT (branch_id, location_code) DO NOTHING;

INSERT INTO public.pos_outlets (id, branch_id, outlet_code, name, outlet_type, inventory_location_id, is_active, metadata, created_at, updated_at)
SELECT
  po.id::uuid,
  po.branch_id::integer,
  COALESCE(NULLIF(po.outlet_code::text, ''), 'OUTLET-' || left(po.id::text, 8)),
  po.name::text,
  CASE
    WHEN lower(po.outlet_type::text) IN ('restaurant', 'main_bar', 'executive_bar', 'sports_bar', 'cashier', 'spa', 'kitchen') THEN lower(po.outlet_type::text)
    WHEN lower(po.name::text) LIKE '%restaurant%' THEN 'restaurant'
    WHEN lower(po.name::text) LIKE '%main bar%' THEN 'main_bar'
    WHEN lower(po.name::text) LIKE '%executive%' THEN 'executive_bar'
    WHEN lower(po.name::text) LIKE '%sports%' THEN 'sports_bar'
    WHEN lower(po.name::text) LIKE '%cashier%' THEN 'cashier'
    ELSE 'other'
  END,
  il.id,
  COALESCE((po.is_active)::boolean, true),
  to_jsonb(po),
  COALESCE(po.created_at::timestamptz, NOW()),
  COALESCE(po.updated_at::timestamptz, NOW())
FROM legacy_import.pos_outlets po
LEFT JOIN public.inventory_locations il
  ON il.branch_id = po.branch_id::integer
 AND il.location_code = 'POS_' || po.id::text
WHERE po.id IS NOT NULL AND po.branch_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  inventory_location_id = EXCLUDED.inventory_location_id,
  updated_at = NOW();

INSERT INTO public.menu_items (sku, name, category, unit, selling_price, cost_price, is_stock_tracked, metadata, created_at, updated_at)
SELECT DISTINCT ON (sku)
  sku,
  name,
  category,
  unit,
  selling_price,
  cost_price,
  true,
  metadata,
  created_at,
  updated_at
FROM (
  SELECT
    COALESCE(NULLIF(rmi.sku::text, ''), 'MENU-' || rmi.id::text) AS sku,
    COALESCE(NULLIF(rmi.name::text, ''), NULLIF(rmi.item_name::text, ''), 'Unknown Menu Item') AS name,
    NULLIF(rmi.category::text, '') AS category,
    'unit' AS unit,
    COALESCE(NULLIF(rmi.price::text, '')::numeric, NULLIF(rmi.selling_price::text, '')::numeric, 0) AS selling_price,
    COALESCE(NULLIF(rmi.cost_price::text, '')::numeric, 0) AS cost_price,
    to_jsonb(rmi) AS metadata,
    COALESCE(rmi.created_at::timestamptz, NOW()) AS created_at,
    COALESCE(rmi.updated_at::timestamptz, NOW()) AS updated_at
  FROM legacy_import.restaurant_menu_items rmi
  WHERE rmi.id IS NOT NULL

  UNION ALL

  SELECT
    COALESCE(NULLIF(bd.sku::text, ''), 'BAR-' || bd.id::text) AS sku,
    COALESCE(NULLIF(bd.name::text, ''), NULLIF(bd.drink_name::text, ''), 'Unknown Bar Item') AS name,
    NULLIF(bd.category::text, '') AS category,
    COALESCE(NULLIF(bd.unit::text, ''), 'unit') AS unit,
    COALESCE(NULLIF(bd.price::text, '')::numeric, 0) AS selling_price,
    COALESCE(NULLIF(bd.cost_price::text, '')::numeric, 0) AS cost_price,
    to_jsonb(bd) AS metadata,
    COALESCE(bd.created_at::timestamptz, NOW()) AS created_at,
    COALESCE(bd.updated_at::timestamptz, NOW()) AS updated_at
  FROM legacy_import.bar_drinks bd
  WHERE bd.id IS NOT NULL
) mi
ORDER BY sku, updated_at DESC
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  selling_price = EXCLUDED.selling_price,
  updated_at = NOW();

INSERT INTO public.pos_outlet_items (id, outlet_id, menu_item_id, current_stock, low_stock_level, selling_price, status, created_at, updated_at)
SELECT
  poi.id::uuid,
  poi.outlet_id::uuid,
  mi.id,
  GREATEST(COALESCE(NULLIF(poi.current_stock::text, '')::numeric, NULLIF(poi.quantity::text, '')::numeric, 0), 0),
  COALESCE(NULLIF(poi.low_stock_level::text, '')::numeric, 0),
  COALESCE(NULLIF(poi.selling_price::text, '')::numeric, NULLIF(poi.price::text, '')::numeric, mi.selling_price, 0),
  CASE WHEN COALESCE(poi.is_available::boolean, true) THEN 'active' ELSE 'inactive' END,
  COALESCE(poi.created_at::timestamptz, NOW()),
  COALESCE(poi.updated_at::timestamptz, NOW())
FROM legacy_import.pos_outlet_items poi
JOIN public.menu_items mi
  ON mi.sku = COALESCE(NULLIF(poi.sku::text, ''), NULLIF(poi.item_sku::text, ''), 'MENU-' || poi.menu_item_id::text, 'BAR-' || poi.menu_item_id::text)
WHERE poi.id IS NOT NULL AND poi.outlet_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  current_stock = EXCLUDED.current_stock,
  selling_price = EXCLUDED.selling_price,
  updated_at = NOW();

INSERT INTO public.stock_takes (id, branch_id, stock_take_number, stock_take_type, period_start, period_end, status, metadata, created_at, updated_at)
SELECT
  sc.id::uuid,
  sc.branch_id::integer,
  COALESCE(NULLIF(sc.count_number::text, ''), NULLIF(sc.stock_take_number::text, ''), 'ST-' || left(sc.id::text, 8)),
  CASE WHEN lower(sc.count_type::text) = 'blind' THEN 'blind_count' ELSE 'trading_stock_sheet' END,
  COALESCE(sc.period_start::date, sc.count_date::date),
  COALESCE(sc.period_end::date, sc.count_date::date),
  CASE
    WHEN sc.status::text IN ('draft', 'started', 'counting', 'submitted', 'accountant_review', 'auditor_review', 'approved', 'posted', 'closed', 'cancelled') THEN sc.status::text
    ELSE 'draft'
  END,
  to_jsonb(sc),
  COALESCE(sc.created_at::timestamptz, NOW()),
  COALESCE(sc.updated_at::timestamptz, NOW())
FROM legacy_import.stock_counts sc
WHERE sc.id IS NOT NULL AND sc.branch_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW();

COMMIT;

