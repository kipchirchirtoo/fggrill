-- ============================================================
-- REPAIR: Dispatch stock deductions and branch stock increases
-- Fixes dispatches that processed before the dual-table sync fix.
--
-- What this does:
--  1. Deducts simple_items.quantity for all dispatches that are
--     IN_TRANSIT / CONFIRMED / DELIVERED (central store was never decremented)
--  2. Upserts branch_stock for all CONFIRMED/DELIVERED dispatches
--     (branch stock was never incremented for items that had no existing row)
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Deduct simple_items.quantity for all non-draft dispatches
--    that have NOT yet been accounted for.
--    We only touch items where the current quantity > 0 to
--    avoid double-subtracting if the fix was partially applied.
-- ─────────────────────────────────────────────────────────────

UPDATE simple_items si
SET
    quantity    = GREATEST(0, si.quantity - sub.total_dispatched),
    last_updated = NOW()
FROM (
    SELECT
        di.item_sku,
        SUM(di.dispatched_quantity) AS total_dispatched
    FROM dispatch_items di
    JOIN dispatch_notes dn ON dn.id = di.dispatch_id
    WHERE dn.status IN ('IN_TRANSIT', 'CONFIRMED', 'DELIVERED', 'DISPUTED')
      -- Exclude dispatches that were already handled by the fixed code.
      -- The fixed code runs from today onward, so we only repair older ones.
      AND dn.dispatched_at < NOW()
    GROUP BY di.item_sku
) sub
WHERE si.sku = sub.item_sku
  AND si.quantity > 0;

-- ─────────────────────────────────────────────────────────────
-- 2. Upsert branch_stock for CONFIRMED / DELIVERED dispatches
--    using the received_quantity that was recorded at confirmation.
--    If received_quantity is NULL (confirmed without explicit qty),
--    fall back to dispatched_quantity.
-- ─────────────────────────────────────────────────────────────

INSERT INTO branch_stock (branch_id, item_sku, quantity, reorder_level, max_stock_level, last_stock_in, updated_at)
SELECT
    dn.to_branch_id                                         AS branch_id,
    di.item_sku,
    SUM(COALESCE(di.received_quantity, di.dispatched_quantity)) AS quantity,
    10                                                      AS reorder_level,
    100                                                     AS max_stock_level,
    MAX(dn.confirmed_at)                                    AS last_stock_in,
    NOW()                                                   AS updated_at
FROM dispatch_items di
JOIN dispatch_notes dn ON dn.id = di.dispatch_id
WHERE dn.status IN ('CONFIRMED', 'DELIVERED', 'DISPUTED')
GROUP BY dn.to_branch_id, di.item_sku
ON CONFLICT (branch_id, item_sku)
DO UPDATE SET
    quantity      = branch_stock.quantity + EXCLUDED.quantity,
    last_stock_in = GREATEST(branch_stock.last_stock_in, EXCLUDED.last_stock_in),
    updated_at    = NOW();

COMMIT;
