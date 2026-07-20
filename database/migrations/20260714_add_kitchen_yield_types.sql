CREATE TABLE IF NOT EXISTS kitchen_yield_types (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO kitchen_yield_types (code, name, description) 
VALUES 
    ('DIRECT', 'Direct Yield (1:1)', 'One raw item produces exactly one POS item.'),
    ('PRODUCTION', 'Production (Batch)', 'One raw item produces multiple identical POS items (e.g. 1 Flour = 20 Buns).'),
    ('COMPLEX', 'Complex Yield (1:Many)', 'One raw item produces different fractional items (e.g. 1 Chicken = 1/2, 1/4 pieces).')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE kitchen_production_recipes
ADD COLUMN IF NOT EXISTS yield_type_code VARCHAR(50) REFERENCES kitchen_yield_types(code) DEFAULT 'PRODUCTION';
