-- =====================================================
-- KITCHEN FOOD CONTROLS (YIELD RULES)
-- =====================================================

CREATE TABLE IF NOT EXISTS kitchen_food_controls (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    raw_item_name TEXT NOT NULL,
    raw_quantity DECIMAL(10, 2) NOT NULL,
    raw_unit TEXT NOT NULL,
    produced_item_name TEXT NOT NULL,
    produced_portions DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed with data from the provided image
INSERT INTO kitchen_food_controls (raw_item_name, raw_quantity, raw_unit, produced_item_name, produced_portions) VALUES
('BEEF / MBUZI', 1, 'KG', 'PORTIONS', 4),
('BEEF', 1, 'KG', 'MIXES / SPECIALS', 10),
('MINCED MEAT', 1, 'KG', 'SAMOSAS', 30),
('EXE (WHEAT FLOUR)', 2, 'KG', 'CHAPATIS', 30),
('MILK', 1, 'LITRE', 'TEA CUPS', 4),
('AJAB (MAIZE FLOUR)', 2, 'KG', 'UGALIS', 8),
('FULL CHICKEN', 1, 'QTY', 'QUARTERS', 4),
('POTATOES', 20, 'KG', 'PLATES OF CHIPS', 15),
('RICE', 1, 'KG', 'PLATES OF RICE / PILAU', 7)
ON CONFLICT DO NOTHING;

-- Index for searching item names
CREATE INDEX IF NOT EXISTS idx_kfc_raw_item ON kitchen_food_controls(raw_item_name);

-- Comments
COMMENT ON TABLE kitchen_food_controls IS 'Standard yield rules for kitchen portion control and recipe management';
