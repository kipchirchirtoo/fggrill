-- Run this in Supabase SQL Editor → paste → Run
-- Sets EVERY item in the central store to 1000 units

UPDATE simple_items
SET
    quantity     = 1000,
    last_updated = NOW();

-- Confirm result (should show all rows with 1000)
SELECT sku, name, quantity
FROM simple_items
ORDER BY name
LIMIT 50;
