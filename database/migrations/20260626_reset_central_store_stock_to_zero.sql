-- ============================================================
-- RESET: Zero out all central store stock quantities
-- 
-- This sets simple_items.quantity = 0 for ALL items in the
-- central store catalogue so you can start from a clean baseline.
--
-- ⚠️  IMPORTANT: Run this ONLY in Supabase SQL Editor.
--     This is a destructive, irreversible operation.
--     Consider exporting current stock first if needed.
-- ============================================================

BEGIN;

-- Count before so you can verify
SELECT COUNT(*) AS items_with_stock_before
FROM simple_items
WHERE quantity > 0;

-- Zero out all central store item quantities
UPDATE simple_items
SET
    quantity     = 0,
    last_updated = NOW()
WHERE quantity != 0;  -- only touch rows that actually need changing

-- Also zero out branch_stock for all branches if you want a full reset
-- (comment this block out if you only want to reset central store):
-- UPDATE branch_stock
-- SET
--     quantity   = 0,
--     updated_at = NOW()
-- WHERE quantity != 0;

-- Verify the result
SELECT COUNT(*) AS items_still_with_nonzero_stock
FROM simple_items
WHERE quantity > 0;

COMMIT;
