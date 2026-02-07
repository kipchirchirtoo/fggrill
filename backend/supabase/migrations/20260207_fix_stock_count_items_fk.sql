
-- Migration: Fix stock_count_items Foreign Key Constraint
-- This allows bar items (from restaurant_bar_inventory) to be stored in the shared audit table.

DO $$ 
BEGIN
    -- 1. Drop the strict foreign key to store_items
    -- This allows the table to store item_id references from different inventory tables (Master, Restuarant, Bar)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_count_items_item_id_fkey' 
        AND table_name = 'stock_count_items'
    ) THEN
        ALTER TABLE stock_count_items DROP CONSTRAINT stock_count_items_item_id_fkey;
    END IF;

    -- 2. Optional: Add a check that item_id is NOT NULL (already is from migration 20260107)
    -- 3. Optional: We could add a comment explaining this is a shared items table
    COMMENT ON COLUMN stock_count_items.item_id IS 'UUID from either store_items or restaurant_bar_inventory';
END $$;
