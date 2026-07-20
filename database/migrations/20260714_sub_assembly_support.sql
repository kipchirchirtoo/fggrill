-- Add sub-assembly support to kitchen_production_recipes
ALTER TABLE kitchen_production_recipes 
    ADD COLUMN IF NOT EXISTS produced_inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS produced_inventory_item_sku VARCHAR(100);

-- Make pos_outlet_item_id nullable (it already is, but just in case)
ALTER TABLE kitchen_production_recipes 
    ALTER COLUMN pos_outlet_item_id DROP NOT NULL;
