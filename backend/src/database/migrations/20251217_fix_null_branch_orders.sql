-- Fix missing branch_id in restaurant_orders
-- Updates any orders with null branch_id to use the first available branch or a specific one
-- This fixes the issue where orders disappear when filtering by branch

DO $$
DECLARE
    default_branch_id INT;
BEGIN
    -- Get a default branch ID (e.g., the first one, or Main Branch)
    SELECT id INTO default_branch_id FROM branches ORDER BY id ASC LIMIT 1;

    -- Update orders with NULL branch_id
    IF default_branch_id IS NOT NULL THEN
        UPDATE restaurant_orders 
        SET branch_id = default_branch_id 
        WHERE branch_id IS NULL;
        
        RAISE NOTICE 'Updated orders with NULL branch_id to %', default_branch_id;
    END IF;
END $$;
