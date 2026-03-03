-- ============================================================
-- Kyogong - SKU & ORDER NUMBER SEQUENCE SYSTEM
-- Migration: 20231128_sku_order_sequences.sql
-- ============================================================

-- 1. CATEGORY CODES TABLE (for SKU generation)
CREATE TABLE IF NOT EXISTS sku_categories (
    code VARCHAR(10) PRIMARY KEY,        -- BAR, KIT, HK, MNT, GEN, etc.
    name VARCHAR(100) NOT NULL,          -- Full name
    description TEXT,
    current_serial INT DEFAULT 0,        -- Current serial for this category
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
    sequence_type VARCHAR(20) NOT NULL,  -- STKIN, STKOUT, PO, DN, INV, TRF
    sequence_date DATE NOT NULL,         -- Date for daily reset
    current_number INT DEFAULT 0,        -- Current sequence number for the day
    PRIMARY KEY (sequence_type, sequence_date)
);

-- 3. PRODUCT SKU REGISTRY (tracks all generated SKUs to ensure uniqueness)
CREATE TABLE IF NOT EXISTS sku_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(100),
    category_code VARCHAR(10) REFERENCES sku_categories(code),
    product_code VARCHAR(20),            -- Short product name code (VODKA, FLOUR, etc.)
    serial_number INT,
    is_auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on barcode for fast lookup
CREATE INDEX IF NOT EXISTS idx_sku_registry_barcode ON sku_registry(barcode);

-- 4. UPDATE simple_items TABLE to add proper SKU tracking
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS category_code VARCHAR(10);
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS product_code VARCHAR(20);
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS is_auto_sku BOOLEAN DEFAULT FALSE;

-- 5. FUNCTION: Get next order number
CREATE OR REPLACE FUNCTION get_next_order_number(p_type VARCHAR(20))
RETURNS VARCHAR(30) AS $$
DECLARE
    v_date DATE := CURRENT_DATE;
    v_date_str VARCHAR(8);
    v_seq INT;
    v_order_num VARCHAR(30);
BEGIN
    -- Format date as YYYYMMDD
    v_date_str := TO_CHAR(v_date, 'YYYYMMDD');
    
    -- Upsert and get next sequence
    INSERT INTO order_sequences (sequence_type, sequence_date, current_number)
    VALUES (p_type, v_date, 1)
    ON CONFLICT (sequence_type, sequence_date) 
    DO UPDATE SET current_number = order_sequences.current_number + 1
    RETURNING current_number INTO v_seq;
    
    -- Format: FGH-TYPE-YYYYMMDD-XXXX
    v_order_num := 'FGH-' || p_type || '-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_order_num;
END;
$$ LANGUAGE plpgsql;

-- 6. FUNCTION: Get next SKU serial for a category
CREATE OR REPLACE FUNCTION get_next_sku_serial(p_category_code VARCHAR(10))
RETURNS INT AS $$
DECLARE
    v_serial INT;
BEGIN
    UPDATE sku_categories 
    SET current_serial = current_serial + 1
    WHERE code = p_category_code
    RETURNING current_serial INTO v_serial;
    
    -- If category doesn't exist, create AUTO and get serial
    IF v_serial IS NULL THEN
        INSERT INTO sku_categories (code, name, current_serial)
        VALUES (p_category_code, p_category_code || ' (Custom)', 1)
        ON CONFLICT (code) DO UPDATE SET current_serial = sku_categories.current_serial + 1
        RETURNING current_serial INTO v_serial;
    END IF;
    
    RETURN COALESCE(v_serial, 1);
END;
$$ LANGUAGE plpgsql;

-- 7. FUNCTION: Generate SKU (main function)
CREATE OR REPLACE FUNCTION generate_sku(
    p_category_code VARCHAR(10),
    p_product_name VARCHAR(100),
    p_barcode VARCHAR(100) DEFAULT NULL
)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_product_code VARCHAR(20);
    v_serial INT;
    v_sku VARCHAR(50);
    v_existing_sku VARCHAR(50);
BEGIN
    -- Check if barcode already has an SKU
    IF p_barcode IS NOT NULL AND p_barcode != '' THEN
        SELECT sku INTO v_existing_sku 
        FROM sku_registry 
        WHERE barcode = p_barcode;
        
        IF v_existing_sku IS NOT NULL THEN
            RETURN v_existing_sku;
        END IF;
    END IF;
    
    -- Generate product code from name (first 6 chars, uppercase, no spaces)
    v_product_code := UPPER(REGEXP_REPLACE(
        SUBSTRING(p_product_name FROM 1 FOR 6), 
        '[^A-Z0-9]', '', 'g'
    ));
    
    -- If empty, use AUTO
    IF v_product_code = '' OR v_product_code IS NULL THEN
        v_product_code := 'ITEM';
    END IF;
    
    -- Get next serial for this category
    v_serial := get_next_sku_serial(COALESCE(p_category_code, 'GEN'));
    
    -- Build SKU: FGH-CATEGORY-PRODUCT-SERIAL
    v_sku := 'FGH-' || COALESCE(p_category_code, 'GEN') || '-' || v_product_code || '-' || LPAD(v_serial::TEXT, 4, '0');
    
    -- Register the SKU
    INSERT INTO sku_registry (sku, barcode, category_code, product_code, serial_number, is_auto_generated)
    VALUES (v_sku, p_barcode, COALESCE(p_category_code, 'GEN'), v_product_code, v_serial, TRUE)
    ON CONFLICT (sku) DO NOTHING;
    
    RETURN v_sku;
END;
$$ LANGUAGE plpgsql;

-- 8. FUNCTION: Generate auto-SKU for unknown barcodes
CREATE OR REPLACE FUNCTION generate_auto_sku(p_barcode VARCHAR(100))
RETURNS VARCHAR(50) AS $$
DECLARE
    v_serial INT;
    v_sku VARCHAR(50);
BEGIN
    -- Get next AUTO serial
    v_serial := get_next_sku_serial('AUTO');
    
    -- Build SKU: FGH-AUTO-XXXX
    v_sku := 'FGH-AUTO-' || LPAD(v_serial::TEXT, 4, '0');
    
    -- Register
    INSERT INTO sku_registry (sku, barcode, category_code, product_code, serial_number, is_auto_generated)
    VALUES (v_sku, p_barcode, 'AUTO', 'AUTO', v_serial, TRUE)
    ON CONFLICT (sku) DO NOTHING;
    
    RETURN v_sku;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- GRANTS (for Supabase access)
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON sku_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON order_sequences TO authenticated;
GRANT SELECT, INSERT ON sku_registry TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_order_number(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_sku_serial(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_sku(VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_auto_sku(VARCHAR) TO authenticated;
