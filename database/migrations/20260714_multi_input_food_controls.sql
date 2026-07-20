CREATE TABLE IF NOT EXISTS kitchen_production_recipe_inputs (
    id SERIAL PRIMARY KEY,
    recipe_id UUID REFERENCES kitchen_production_recipes(id) ON DELETE CASCADE,
    raw_item_sku VARCHAR(50) NOT NULL,
    raw_item_name VARCHAR(100) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate existing single inputs to the new table
INSERT INTO kitchen_production_recipe_inputs (recipe_id, raw_item_sku, raw_item_name, quantity, unit)
SELECT id, raw_item_sku, raw_item_name, raw_quantity, raw_unit 
FROM kitchen_production_recipes
WHERE raw_item_sku IS NOT NULL;
