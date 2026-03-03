-- ============================================================
-- Kyogong - COMBINED MIGRATION
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- ============================================================
-- PART 1: ENHANCED INVENTORY (from 20231127_enhanced_inventory.sql)
-- ============================================================

-- Add extended fields to simple_items
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(50) DEFAULT 'piece';
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0;
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS supplier VARCHAR(255);
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS reorder_level INT DEFAULT 10;
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create index on barcode for fast lookup
CREATE INDEX IF NOT EXISTS idx_simple_items_barcode ON simple_items(barcode);

-- Stock History Table for tracking all stock movements
CREATE TABLE IF NOT EXISTS stock_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_sku VARCHAR(50) NOT NULL,
    change_type VARCHAR(10) NOT NULL CHECK (change_type IN ('IN', 'OUT', 'ADJUST', 'TRANSFER')),
    quantity_change INT NOT NULL,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    reason VARCHAR(100),
    reference VARCHAR(100),
    notes TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast history lookup
CREATE INDEX IF NOT EXISTS idx_stock_history_item ON stock_history(item_sku);
CREATE INDEX IF NOT EXISTS idx_stock_history_date ON stock_history(created_at);

-- ============================================================
-- PART 2: SKU & ORDER NUMBER SEQUENCES (from 20231128_sku_order_sequences.sql)
-- ============================================================

-- 1. CATEGORY CODES TABLE (for SKU generation)
CREATE TABLE IF NOT EXISTS sku_categories (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    current_serial INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO sku_categories (code, name, description) VALUES
    ('BAR', 'Bar & Beverages', 'Alcoholic and non-alcoholic drinks, bar supplies'),
    ('KIT', 'Kitchen', 'Food items, cooking ingredients, kitchen supplies'),
    ('HK', 'Housekeeping', 'Cleaning supplies, toiletries, linens'),
    ('MNT', 'Maintenance', 'Tools, equipment, spare parts'),
    ('LDR', 'Laundry', 'Laundry chemicals, supplies'),
    ('FNB', 'Food & Beverage', 'Restaurant supplies, disposables'),
    ('GEN', 'General', 'Miscellaneous items'),
    ('OFF', 'Office', 'Stationery, office supplies'),
    ('AUTO', 'Auto-Generated', 'System auto-generated for unknown items')
ON CONFLICT (code) DO NOTHING;

-- 2. ORDER NUMBER SEQUENCES TABLE
CREATE TABLE IF NOT EXISTS order_sequences (
    sequence_type VARCHAR(20) NOT NULL,
    sequence_date DATE NOT NULL,
    current_number INT DEFAULT 0,
    PRIMARY KEY (sequence_type, sequence_date)
);

-- 3. Add SKU tracking columns to simple_items
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS category_code VARCHAR(10);
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS product_code VARCHAR(20);
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS is_auto_sku BOOLEAN DEFAULT FALSE;

-- 4. FUNCTION: Get next order number
CREATE OR REPLACE FUNCTION get_next_order_number(p_type VARCHAR(20))
RETURNS VARCHAR(30) AS $$
DECLARE
    v_date DATE := CURRENT_DATE;
    v_date_str VARCHAR(8);
    v_seq INT;
    v_order_num VARCHAR(30);
BEGIN
    v_date_str := TO_CHAR(v_date, 'YYYYMMDD');
    
    INSERT INTO order_sequences (sequence_type, sequence_date, current_number)
    VALUES (p_type, v_date, 1)
    ON CONFLICT (sequence_type, sequence_date) 
    DO UPDATE SET current_number = order_sequences.current_number + 1
    RETURNING current_number INTO v_seq;
    
    v_order_num := 'FGH-' || p_type || '-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_order_num;
END;
$$ LANGUAGE plpgsql;

-- 5. FUNCTION: Get next SKU serial for a category
CREATE OR REPLACE FUNCTION get_next_sku_serial(p_category_code VARCHAR(10))
RETURNS INT AS $$
DECLARE
    v_serial INT;
BEGIN
    UPDATE sku_categories 
    SET current_serial = current_serial + 1
    WHERE code = p_category_code
    RETURNING current_serial INTO v_serial;
    
    IF v_serial IS NULL THEN
        INSERT INTO sku_categories (code, name, current_serial)
        VALUES (p_category_code, p_category_code || ' (Custom)', 1)
        ON CONFLICT (code) DO UPDATE SET current_serial = sku_categories.current_serial + 1
        RETURNING current_serial INTO v_serial;
    END IF;
    
    RETURN COALESCE(v_serial, 1);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- GRANTS FOR SUPABASE ACCESS
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON stock_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sku_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON order_sequences TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_order_number(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_sku_serial(VARCHAR) TO authenticated;

-- ============================================================
-- DONE! Verify by running:
-- SELECT * FROM sku_categories;
-- SELECT get_next_order_number('STKIN');
-- ============================================================
