-- =====================================================
-- FOOD CONTROL INTEGRATION WITH STORE DISPATCH
-- =====================================================
-- This migration adds automatic portion calculation when
-- storekeeper issues raw ingredients to kitchen

-- Add item_sku column to food controls for better matching
ALTER TABLE kitchen_food_controls 
ADD COLUMN IF NOT EXISTS raw_item_sku TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create index for SKU matching
CREATE INDEX IF NOT EXISTS idx_kfc_raw_item_sku ON kitchen_food_controls(raw_item_sku);

-- Create table to track expected portions from store dispatches
CREATE TABLE IF NOT EXISTS kitchen_expected_portions (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    dispatch_id UUID REFERENCES dispatch_notes(id) ON DELETE CASCADE,
    dispatch_item_id INTEGER,
    
    -- Raw ingredient details
    raw_item_sku TEXT NOT NULL,
    raw_item_name TEXT NOT NULL,
    raw_quantity_received DECIMAL(10, 3) NOT NULL,
    raw_unit TEXT NOT NULL,
    
    -- Expected output details
    produced_item_name TEXT NOT NULL,
    expected_portions DECIMAL(10, 2) NOT NULL,
    
    -- Food control rule used
    food_control_rule_id INTEGER REFERENCES kitchen_food_controls(id),
    
    -- Tracking
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    received_by UUID REFERENCES users(id),
    
    -- Variance tracking (to be filled when actual portions are counted)
    actual_portions DECIMAL(10, 2),
    variance DECIMAL(10, 2),
    variance_percentage DECIMAL(5, 2),
    variance_reason TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kep_branch ON kitchen_expected_portions(branch_id);
CREATE INDEX IF NOT EXISTS idx_kep_dispatch ON kitchen_expected_portions(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_kep_received_at ON kitchen_expected_portions(received_at);
CREATE INDEX IF NOT EXISTS idx_kep_raw_item_sku ON kitchen_expected_portions(raw_item_sku);

-- Comments
COMMENT ON TABLE kitchen_expected_portions IS 'Tracks expected portions when raw ingredients are received from store, enabling variance analysis';
COMMENT ON COLUMN kitchen_expected_portions.expected_portions IS 'Calculated portions based on food control rules';
COMMENT ON COLUMN kitchen_expected_portions.actual_portions IS 'Actual portions produced/counted by kitchen staff';
COMMENT ON COLUMN kitchen_expected_portions.variance IS 'Difference between expected and actual (actual - expected)';
COMMENT ON COLUMN kitchen_expected_portions.variance_percentage IS 'Variance as percentage of expected';

-- Update existing food controls with SKU mapping (example data)
-- This should be customized based on your actual store items
UPDATE kitchen_food_controls SET raw_item_sku = 'BEEF-001' WHERE raw_item_name = 'BEEF / MBUZI';
UPDATE kitchen_food_controls SET raw_item_sku = 'BEEF-002' WHERE raw_item_name = 'BEEF';
UPDATE kitchen_food_controls SET raw_item_sku = 'MINCED-001' WHERE raw_item_name = 'MINCED MEAT';
UPDATE kitchen_food_controls SET raw_item_sku = 'FLOUR-WHEAT-001' WHERE raw_item_name = 'EXE (WHEAT FLOUR)';
UPDATE kitchen_food_controls SET raw_item_sku = 'MILK-001' WHERE raw_item_name = 'MILK';
UPDATE kitchen_food_controls SET raw_item_sku = 'FLOUR-MAIZE-001' WHERE raw_item_name = 'AJAB (MAIZE FLOUR)';
UPDATE kitchen_food_controls SET raw_item_sku = 'CHICKEN-FULL-001' WHERE raw_item_name = 'FULL CHICKEN';
UPDATE kitchen_food_controls SET raw_item_sku = 'POTATO-001' WHERE raw_item_name = 'POTATOES';
UPDATE kitchen_food_controls SET raw_item_sku = 'RICE-001' WHERE raw_item_name = 'RICE';

-- Function to automatically calculate expected portions on dispatch confirmation
CREATE OR REPLACE FUNCTION calculate_expected_portions_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
    v_dispatch RECORD;
    v_dispatch_item RECORD;
    v_food_control RECORD;
    v_expected_portions DECIMAL(10, 2);
BEGIN
    -- Only process when dispatch is confirmed
    IF NEW.status IN ('CONFIRMED', 'DISPUTED') AND (OLD.status IS NULL OR OLD.status NOT IN ('CONFIRMED', 'DISPUTED')) THEN
        
        -- Get dispatch details
        SELECT * INTO v_dispatch FROM dispatch_notes WHERE id = NEW.id;
        
        -- Process each dispatch item
        FOR v_dispatch_item IN 
            SELECT * FROM dispatch_items WHERE dispatch_id = NEW.id
        LOOP
            -- Check if there's a food control rule for this item
            SELECT * INTO v_food_control 
            FROM kitchen_food_controls 
            WHERE (raw_item_sku = v_dispatch_item.item_sku OR raw_item_name ILIKE '%' || v_dispatch_item.item_name || '%')
            AND is_active = TRUE
            AND (branch_id IS NULL OR branch_id = v_dispatch.to_branch_id)
            LIMIT 1;
            
            IF FOUND THEN
                -- Calculate expected portions
                -- Formula: (Received Quantity / Standard Raw Quantity) * Standard Produced Portions
                v_expected_portions := (v_dispatch_item.received_quantity / v_food_control.raw_quantity) * v_food_control.produced_portions;
                
                -- Insert expected portions record
                INSERT INTO kitchen_expected_portions (
                    branch_id,
                    dispatch_id,
                    dispatch_item_id,
                    raw_item_sku,
                    raw_item_name,
                    raw_quantity_received,
                    raw_unit,
                    produced_item_name,
                    expected_portions,
                    food_control_rule_id,
                    received_at,
                    received_by
                ) VALUES (
                    v_dispatch.to_branch_id,
                    NEW.id,
                    v_dispatch_item.id,
                    v_dispatch_item.item_sku,
                    v_dispatch_item.item_name,
                    v_dispatch_item.received_quantity,
                    v_food_control.raw_unit,
                    v_food_control.produced_item_name,
                    v_expected_portions,
                    v_food_control.id,
                    NEW.confirmed_at,
                    NEW.receiver_id
                );
                
                RAISE NOTICE 'Expected portions calculated: % % -> % %', 
                    v_dispatch_item.received_quantity, 
                    v_food_control.raw_unit,
                    v_expected_portions,
                    v_food_control.produced_item_name;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_calculate_expected_portions ON dispatch_notes;
CREATE TRIGGER trg_calculate_expected_portions
    AFTER UPDATE ON dispatch_notes
    FOR EACH ROW
    EXECUTE FUNCTION calculate_expected_portions_on_delivery();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON kitchen_expected_portions TO authenticated;
GRANT SELECT, UPDATE ON kitchen_food_controls TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE kitchen_expected_portions_id_seq TO authenticated;

COMMENT ON FUNCTION calculate_expected_portions_on_delivery() IS 'Automatically calculates expected portions when store dispatch is confirmed at branch';
COMMENT ON TRIGGER trg_calculate_expected_portions ON dispatch_notes IS 'Triggers portion calculation when dispatch is confirmed';

