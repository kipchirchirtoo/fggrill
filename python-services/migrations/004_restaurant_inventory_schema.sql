-- Famous Gate Hotel - Restaurant Inventory & Consumption Tracking
-- Migration script for restaurant inventory management

-- Restaurant Inventory Items
CREATE TABLE IF NOT EXISTS restaurant_inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('produce', 'meat', 'dairy', 'dry_goods', 'beverages', 'spices', 'frozen', 'other')),
    unit VARCHAR(20) NOT NULL,  -- kg, liters, pieces, packets, bottles, etc.
    current_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
    min_stock_level DECIMAL(10,3) NOT NULL DEFAULT 0,
    max_stock_level DECIMAL(10,3) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    supplier VARCHAR(200),
    storage_location VARCHAR(100),
    expiry_date DATE,
    last_received_date DATE,
    branch_id INTEGER REFERENCES branches(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Consumption Records
CREATE TABLE IF NOT EXISTS restaurant_consumption_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumption_date DATE NOT NULL,
    meal_period VARCHAR(20) NOT NULL CHECK (meal_period IN ('breakfast', 'lunch', 'dinner', 'room_service', 'banquet')),
    reference VARCHAR(50) UNIQUE NOT NULL,
    notes TEXT,
    total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    prepared_by UUID REFERENCES users(id),
    branch_id INTEGER REFERENCES branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Consumption Record Items
CREATE TABLE IF NOT EXISTS restaurant_consumption_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumption_record_id UUID NOT NULL REFERENCES restaurant_consumption_records(id) ON DELETE CASCADE,
    item_code VARCHAR(20) NOT NULL REFERENCES restaurant_inventory_items(item_code),
    quantity DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    cost_at_consumption DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wastage Records
CREATE TABLE IF NOT EXISTS restaurant_wastage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wastage_date DATE NOT NULL,
    reference VARCHAR(50) UNIQUE NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('spoilage', 'overproduction', 'preparation_error', 'expired', 'customer_return', 'quality_issue', 'other')),
    department VARCHAR(100),
    notes TEXT,
    preventive_action TEXT,
    total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    reported_by UUID REFERENCES users(id),
    branch_id INTEGER REFERENCES branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wastage Record Items
CREATE TABLE IF NOT EXISTS restaurant_wastage_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wastage_record_id UUID NOT NULL REFERENCES restaurant_wastage_records(id) ON DELETE CASCADE,
    item_code VARCHAR(20) NOT NULL REFERENCES restaurant_inventory_items(item_code),
    quantity DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    cost_at_wastage DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Production Records
CREATE TABLE IF NOT EXISTS restaurant_production_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_date DATE NOT NULL,
    meal_period VARCHAR(20) NOT NULL CHECK (meal_period IN ('breakfast', 'lunch', 'dinner', 'room_service', 'banquet')),
    recipe_id UUID NOT NULL REFERENCES restaurant_recipes(id),
    servings_produced INTEGER NOT NULL DEFAULT 0,
    servings_sold INTEGER NOT NULL DEFAULT 0,
    selling_price_per_serving DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    cost_of_goods DECIMAL(12,2) NOT NULL DEFAULT 0,
    gross_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
    food_cost_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    notes TEXT,
    prepared_by UUID REFERENCES users(id),
    branch_id INTEGER REFERENCES branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Restaurant Recipes
CREATE TABLE IF NOT EXISTS restaurant_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('appetizer', 'soup', 'salad', 'main_course', 'dessert', 'beverage', 'other')),
    description TEXT,
    servings INTEGER NOT NULL DEFAULT 1,
    instructions TEXT,
    selling_price_per_serving DECIMAL(10,2) NOT NULL DEFAULT 0,
    preparation_time INTEGER, -- in minutes
    cooking_time INTEGER, -- in minutes
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    is_active BOOLEAN DEFAULT true,
    branch_id INTEGER REFERENCES branches(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recipe Ingredients
CREATE TABLE IF NOT EXISTS restaurant_recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES restaurant_recipes(id) ON DELETE CASCADE,
    item_code VARCHAR(20) NOT NULL REFERENCES restaurant_inventory_items(item_code),
    quantity DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    preparation_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cost Analysis Views
CREATE OR REPLACE VIEW restaurant_recipe_cost_analysis AS
SELECT 
    r.id as recipe_id,
    r.name as recipe_name,
    r.category as recipe_category,
    r.servings,
    r.selling_price_per_serving,
    COALESCE(SUM(ri.quantity * ii.unit_cost), 0) as total_ingredient_cost,
    COALESCE(SUM(ri.quantity * ii.unit_cost), 0) / r.servings as cost_per_serving,
    r.selling_price_per_serving - (COALESCE(SUM(ri.quantity * ii.unit_cost), 0) / r.servings) as profit_per_serving,
    ((COALESCE(SUM(ri.quantity * ii.unit_cost), 0) / r.servings) / r.selling_price_per_serving * 100) as food_cost_percentage
FROM restaurant_recipes r
LEFT JOIN restaurant_recipe_ingredients ri ON r.id = ri.recipe_id
LEFT JOIN restaurant_inventory_items ii ON ri.item_code = ii.item_code
WHERE r.is_active = true
GROUP BY r.id, r.name, r.category, r.servings, r.selling_price_per_serving;

CREATE OR REPLACE VIEW restaurant_consumption_summary AS
SELECT 
    DATE(consumption_date) as date,
    meal_period,
    COUNT(*) as consumption_records,
    SUM(total_cost) as total_consumption_cost,
    AVG(total_cost) as avg_cost_per_record,
    branch_id
FROM restaurant_consumption_records
GROUP BY DATE(consumption_date), meal_period, branch_id
ORDER BY date DESC, meal_period;

CREATE OR REPLACE VIEW restaurant_wastage_summary AS
SELECT 
    DATE(wastage_date) as date,
    reason,
    COUNT(*) as wastage_incidents,
    SUM(total_cost) as total_wastage_cost,
    AVG(total_cost) as avg_cost_per_incident,
    branch_id
FROM restaurant_wastage_records
GROUP BY DATE(wastage_date), reason, branch_id
ORDER BY date DESC;

CREATE OR REPLACE VIEW restaurant_production_summary AS
SELECT 
    DATE(production_date) as date,
    meal_period,
    COUNT(*) as production_records,
    SUM(servings_produced) as total_servings_produced,
    SUM(servings_sold) as total_servings_sold,
    SUM(total_revenue) as total_revenue,
    SUM(cost_of_goods) as total_cost_of_goods,
    SUM(gross_profit) as total_gross_profit,
    AVG(food_cost_percentage) as avg_food_cost_percentage,
    branch_id
FROM restaurant_production_records
GROUP BY DATE(production_date), meal_period, branch_id
ORDER BY date DESC;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_items_code ON restaurant_inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_items_category ON restaurant_inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_items_branch ON restaurant_inventory_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_inventory_items_stock ON restaurant_inventory_items(current_stock, min_stock_level);

CREATE INDEX IF NOT EXISTS idx_restaurant_consumption_records_date ON restaurant_consumption_records(consumption_date);
CREATE INDEX IF NOT EXISTS idx_restaurant_consumption_records_meal ON restaurant_consumption_records(meal_period);
CREATE INDEX IF NOT EXISTS idx_restaurant_consumption_records_branch ON restaurant_consumption_records(branch_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_wastage_records_date ON restaurant_wastage_records(wastage_date);
CREATE INDEX IF NOT EXISTS idx_restaurant_wastage_records_reason ON restaurant_wastage_records(reason);
CREATE INDEX IF NOT EXISTS idx_restaurant_wastage_records_branch ON restaurant_wastage_records(branch_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_production_records_date ON restaurant_production_records(production_date);
CREATE INDEX IF NOT EXISTS idx_restaurant_production_records_recipe ON restaurant_production_records(recipe_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_production_records_branch ON restaurant_production_records(branch_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_recipes_category ON restaurant_recipes(category);
CREATE INDEX IF NOT EXISTS idx_restaurant_recipes_branch ON restaurant_recipes(branch_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_recipe_ingredients_recipe ON restaurant_recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_recipe_ingredients_item ON restaurant_recipe_ingredients(item_code);

-- Triggers for inventory updates
CREATE OR REPLACE FUNCTION update_inventory_on_consumption()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE restaurant_inventory_items 
    SET current_stock = current_stock - NEW.quantity,
        updated_at = NOW()
    WHERE item_code = NEW.item_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_on_consumption
    AFTER INSERT ON restaurant_consumption_items
    FOR EACH ROW EXECUTE FUNCTION update_inventory_on_consumption();

CREATE OR REPLACE FUNCTION update_inventory_on_wastage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE restaurant_inventory_items 
    SET current_stock = current_stock - NEW.quantity,
        updated_at = NOW()
    WHERE item_code = NEW.item_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_on_wastage
    AFTER INSERT ON restaurant_wastage_items
    FOR EACH ROW EXECUTE FUNCTION update_inventory_on_wastage();

-- Function to calculate recipe cost
CREATE OR REPLACE FUNCTION calculate_recipe_cost(p_recipe_id UUID)
RETURNS TABLE(
    total_cost DECIMAL,
    cost_per_serving DECIMAL,
    food_cost_percentage DECIMAL
) AS $$
DECLARE
    v_servings INTEGER;
    v_selling_price DECIMAL;
BEGIN
    SELECT r.servings, r.selling_price_per_serving 
    INTO v_servings, v_selling_price
    FROM restaurant_recipes r 
    WHERE r.id = p_recipe_id;
    
    RETURN QUERY
    SELECT 
        COALESCE(SUM(ri.quantity * ii.unit_cost), 0) as total_cost,
        COALESCE(SUM(ri.quantity * ii.unit_cost), 0) / v_servings as cost_per_serving,
        (COALESCE(SUM(ri.quantity * ii.unit_cost), 0) / v_servings) / v_selling_price * 100 as food_cost_percentage
    FROM restaurant_recipe_ingredients ri
    JOIN restaurant_inventory_items ii ON ri.item_code = ii.item_code
    WHERE ri.recipe_id = p_recipe_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock alerts
CREATE OR REPLACE FUNCTION get_low_stock_alerts(p_branch_id INTEGER DEFAULT NULL)
RETURNS TABLE(
    item_code VARCHAR,
    item_name VARCHAR,
    current_stock DECIMAL,
    min_stock_level DECIMAL,
    stock_status VARCHAR,
    suggested_order_quantity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ii.item_code,
        ii.name,
        ii.current_stock,
        ii.min_stock_level,
        CASE 
            WHEN ii.current_stock <= ii.min_stock_level THEN 'critical'
            WHEN ii.current_stock <= ii.min_stock_level * 1.5 THEN 'low'
            ELSE 'normal'
        END as stock_status,
        GREATEST(ii.max_stock_level - ii.current_stock, ii.min_stock_level * 2 - ii.current_stock, 0) as suggested_order_quantity
    FROM restaurant_inventory_items ii
    WHERE ii.is_active = true
    AND (p_branch_id IS NULL OR ii.branch_id = p_branch_id)
    AND ii.current_stock <= ii.min_stock_level * 1.5
    ORDER BY 
        CASE WHEN ii.current_stock <= ii.min_stock_level THEN 1 ELSE 2 END,
        ii.current_stock;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data
INSERT INTO restaurant_inventory_items (item_code, name, category, unit, current_stock, min_stock_level, max_stock_level, unit_cost, supplier, storage_location, branch_id) VALUES
('TOM001', 'Fresh Tomatoes', 'produce', 'kg', 25.5, 10, 50, 120.00, 'Fresh Produce Ltd', 'Cool Room 1', 1),
('CHK001', 'Chicken Breast', 'meat', 'kg', 15.0, 10, 30, 450.00, 'Quality Meats Ltd', 'Freezer 2', 1),
('RCE001', 'White Rice', 'dry_goods', 'kg', 50.0, 25, 100, 180.00, 'Grain Suppliers Ltd', 'Pantry A', 1),
('ONI001', 'Onions', 'produce', 'kg', 30.0, 15, 60, 80.00, 'Fresh Produce Ltd', 'Cool Room 1', 1),
('POT001', 'Potatoes', 'produce', 'kg', 40.0, 20, 80, 90.00, 'Fresh Produce Ltd', 'Storage Room B', 1),
('EGG001', 'Eggs', 'dairy', 'pieces', 120, 50, 200, 25.00, 'Dairy Farm Ltd', 'Cool Room 2', 1),
('MIL001', 'Fresh Milk', 'dairy', 'liters', 15.0, 5, 25, 150.00, 'Dairy Farm Ltd', 'Cool Room 2', 1),
('BRE001', 'Bread Loaves', 'dry_goods', 'pieces', 20, 10, 40, 120.00, 'Local Bakery', 'Pantry B', 1),
('OIL001', 'Cooking Oil', 'dry_goods', 'liters', 10.0, 3, 15, 280.00, 'Food Suppliers Ltd', 'Pantry A', 1),
('SAL001', 'Table Salt', 'spices', 'kg', 5.0, 1, 10, 60.00, 'Spice Company', 'Pantry C', 1),
('PEP001', 'Black Pepper', 'spices', 'kg', 2.0, 0.5, 5, 850.00, 'Spice Company', 'Pantry C', 1),
('GAR001', 'Garlic', 'produce', 'kg', 8.0, 3, 15, 320.00, 'Fresh Produce Ltd', 'Cool Room 1', 1)
ON CONFLICT (item_code) DO NOTHING;

-- Insert sample recipes
INSERT INTO restaurant_recipes (name, category, description, servings, selling_price_per_serving, preparation_time, cooking_time, difficulty_level, branch_id, created_by) VALUES
('Grilled Chicken with Rice', 'main_course', 'Grilled chicken breast served with seasoned rice and vegetables', 4, 850.00, 15, 25, 'medium', 1, (SELECT id FROM users WHERE email = 'restaurant@famousgate.com')),
('Vegetable Stir Fry', 'main_course', 'Mixed vegetables stir-fried with herbs and spices', 2, 450.00, 10, 15, 'easy', 1, (SELECT id FROM users WHERE email = 'restaurant@famousgate.com')),
('Fresh Garden Salad', 'salad', 'Mixed greens with fresh vegetables and dressing', 1, 280.00, 8, 5, 'easy', 1, (SELECT id FROM users WHERE email = 'restaurant@famousgate.com')),
('Tomato Soup', 'soup', 'Creamy tomato soup with fresh herbs', 6, 180.00, 10, 20, 'easy', 1, (SELECT id FROM users WHERE email = 'restaurant@famousgate.com'))
ON CONFLICT DO NOTHING;

-- Insert recipe ingredients
INSERT INTO restaurant_recipe_ingredients (recipe_id, item_code, quantity, unit, preparation_notes) VALUES
-- Grilled Chicken with Rice
((SELECT id FROM restaurant_recipes WHERE name = 'Grilled Chicken with Rice'), 'CHK001', 0.8, 'kg', 'Boneless, skinless chicken breast'),
((SELECT id FROM restaurant_recipes WHERE name = 'Grilled Chicken with Rice'), 'RCE001', 0.4, 'kg', 'Long grain white rice'),
((SELECT id FROM restaurant_recipes WHERE name = 'Grilled Chicken with Rice'), 'TOM001', 0.2, 'kg', 'Fresh tomatoes, diced'),
((SELECT id FROM restaurant_recipes WHERE name = 'Grilled Chicken with Rice'), 'GAR001', 0.05, 'kg', 'Fresh garlic, minced'),
((SELECT id FROM restaurant_recipes WHERE name = 'Grilled Chicken with Rice'), 'OIL001', 0.05, 'liters', 'For grilling'),

-- Vegetable Stir Fry
((SELECT id FROM restaurant_recipes WHERE name = 'Vegetable Stir Fry'), 'TOM001', 0.3, 'kg', 'Fresh tomatoes, chopped'),
((SELECT id FROM restaurant_recipes WHERE name = 'Vegetable Stir Fry'), 'ONI001', 0.2, 'kg', 'Fresh onions, sliced'),
((SELECT id FROM restaurant_recipes WHERE name = 'Vegetable Stir Fry'), 'GAR001', 0.03, 'kg', 'Fresh garlic, minced'),
((SELECT id FROM restaurant_recipes WHERE name = 'Vegetable Stir Fry'), 'OIL001', 0.08, 'liters', 'For stir-frying'),

-- Fresh Garden Salad
((SELECT id FROM restaurant_recipes WHERE name = 'Fresh Garden Salad'), 'TOM001', 0.15, 'kg', 'Fresh tomatoes, wedged'),
((SELECT id FROM restaurant_recipes WHERE name = 'Fresh Garden Salad'), 'ONI001', 0.05, 'kg', 'Red onion, thinly sliced'),

-- Tomato Soup
((SELECT id FROM restaurant_recipes WHERE name = 'Tomato Soup'), 'TOM001', 1.0, 'kg', 'Ripe tomatoes'),
((SELECT id FROM restaurant_recipes WHERE name = 'Tomato Soup'), 'ONI001', 0.1, 'kg', 'Onions, diced'),
((SELECT id FROM restaurant_recipes WHERE name = 'Tomato Soup'), 'GAR001', 0.02, 'kg', 'Garlic cloves')
ON CONFLICT DO NOTHING;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO restaurant_role;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO auditor_role;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO restaurant_role;

COMMIT;
