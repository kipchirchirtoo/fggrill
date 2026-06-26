-- ============================================================
-- FIX: Central store dispatch always returns "Available: 0"
--
-- Root cause: resolveBranchStockSource() checks inventory_balances
-- (via inventory_items + inventory_locations) FIRST for the central
-- store. The prior migration only updated simple_items.quantity = 1000
-- but never populated inventory_balances, so every dispatch preflight
-- returned available: 0 and blocked all dispatches.
--
-- Fix layers (belt and suspenders):
--   1. Ensure inventory_locations has a central_store row for branch 1
--   2. Upsert simple_items SKUs into inventory_items (what the service
--      uses to look up item.id by SKU)
--   3. Upsert inventory_balances at that location → current_quantity 1000
--   4. Upsert branch_stock for branch 1 → quantity 1000 (fallback layer)
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Ensure inventory_locations has a central_store row for branch 1
--    The service queries: branch_id = 1 AND location_type = 'central_store'
-- ─────────────────────────────────────────────────────────────

-- Try the UNIQUE (branch_id, location_code) constraint first (clean schema).
-- If that constraint doesn't exist, fall back to the location_code UNIQUE
-- constraint from the foundation schema. ON CONFLICT DO NOTHING is safe either way.
INSERT INTO inventory_locations (
    branch_id,
    location_code,
    name,
    location_type,
    is_active
)
VALUES (
    1,
    'CENTRAL-1-STORE',
    'Central Store Branch 1',
    'central_store',
    TRUE
)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. Upsert simple_items SKUs into inventory_items
--    Uses only columns guaranteed to exist across both schema variants.
--    ON CONFLICT (sku) → just refresh the name in case it changed.
-- ─────────────────────────────────────────────────────────────
INSERT INTO inventory_items (
    sku,
    item_name,
    description,
    category,
    unit,
    default_unit_cost,
    reorder_level,
    is_active,
    updated_at
)
SELECT
    si.sku,
    COALESCE(NULLIF(TRIM(si.item_name), ''), si.description, si.sku)        AS item_name,
    COALESCE(si.description, si.item_name, si.sku)                          AS description,
    COALESCE(NULLIF(TRIM(si.category), ''), 'GENERAL')                      AS category,
    COALESCE(NULLIF(TRIM(si.unit_of_measure), ''), 'units')                 AS unit,
    COALESCE(si.cost_price, 0)                                              AS default_unit_cost,
    COALESCE(si.reorder_level, 10)                                          AS reorder_level,
    TRUE                                                                     AS is_active,
    NOW()                                                                    AS updated_at
FROM simple_items si
ON CONFLICT (sku) DO UPDATE SET
    item_name  = EXCLUDED.item_name,
    updated_at = NOW();

-- ─────────────────────────────────────────────────────────────
-- 3. Upsert inventory_balances — 1000 units per item at the
--    central store location for branch 1.
--
--    The unique constraint varies by schema version:
--      - Foundation schema: UNIQUE INDEX on (item_id, location_id, COALESCE(batch_id, '00000000...'))
--      - Clean schema: UNIQUE (item_id, location_id, batch_id)
--
--    We handle both by first deleting the null-batch row if it exists
--    (safe because batch_id IS NULL means no batch tracking), then inserting fresh.
--    This avoids the ON CONFLICT ambiguity with NULLs in unique indexes.
-- ─────────────────────────────────────────────────────────────

-- Delete existing null-batch balance rows for these items at the central store
-- so we can INSERT fresh with quantity 1000. Using DELETE + INSERT instead of
-- upsert because NULL equality in unique indexes is unreliable across PG versions.
DELETE FROM inventory_balances ib
USING inventory_items ii,
      (
          SELECT id
          FROM inventory_locations
          WHERE branch_id = 1
            AND location_type = 'central_store'
          ORDER BY created_at
          LIMIT 1
      ) loc
WHERE ib.item_id    = ii.id
  AND ib.location_id = loc.id
  AND ib.batch_id   IS NULL
  AND EXISTS (SELECT 1 FROM simple_items si WHERE si.sku = ii.sku);

INSERT INTO inventory_balances (
    item_id,
    location_id,
    batch_id,
    current_quantity,
    reserved_quantity,
    damaged_quantity,
    expired_quantity,
    unit_cost
)
SELECT
    ii.id                               AS item_id,
    loc.id                              AS location_id,
    NULL                                AS batch_id,
    1000                                AS current_quantity,
    0                                   AS reserved_quantity,
    0                                   AS damaged_quantity,
    0                                   AS expired_quantity,
    COALESCE(ii.default_unit_cost, 0)   AS unit_cost
FROM inventory_items ii
CROSS JOIN (
    SELECT id
    FROM inventory_locations
    WHERE branch_id = 1
      AND location_type = 'central_store'
    ORDER BY created_at
    LIMIT 1
) loc
WHERE EXISTS (
    SELECT 1 FROM simple_items si WHERE si.sku = ii.sku
);

-- ─────────────────────────────────────────────────────────────
-- 4. Upsert branch_stock for branch 1 (fallback when inventory_balances
--    lookup misses — e.g. if inventory_locations has no row yet)
-- ─────────────────────────────────────────────────────────────
INSERT INTO branch_stock (
    branch_id,
    item_sku,
    quantity,
    reorder_level,
    max_stock_level,
    updated_at
)
SELECT
    1                   AS branch_id,
    si.sku              AS item_sku,
    1000                AS quantity,
    10                  AS reorder_level,
    5000                AS max_stock_level,
    NOW()               AS updated_at
FROM simple_items si
ON CONFLICT (branch_id, item_sku) DO UPDATE SET
    quantity   = 1000,
    updated_at = NOW();

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- Verification query — run after COMMIT to confirm all 3 layers
-- ─────────────────────────────────────────────────────────────
SELECT
    ii.sku,
    ii.item_name,
    ib.current_quantity     AS inventory_balance_qty,
    bs.quantity             AS branch_stock_qty,
    si.quantity             AS simple_items_qty
FROM inventory_items ii
JOIN inventory_balances ib
    ON ib.item_id = ii.id
   AND ib.batch_id IS NULL
JOIN inventory_locations loc
    ON loc.id = ib.location_id
   AND loc.branch_id = 1
   AND loc.location_type = 'central_store'
LEFT JOIN branch_stock bs
    ON bs.item_sku = ii.sku
   AND bs.branch_id = 1
LEFT JOIN simple_items si
    ON si.sku = ii.sku
ORDER BY ii.sku
LIMIT 100;
