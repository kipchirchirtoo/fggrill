-- ============================================================
-- FAMOUS GATE HOTEL - COMPLETE STOREKEEPING DATABASE
-- Run this single file to set up all storekeeping tables
-- Execute in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. APP CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS simple_app_config (
    id INT PRIMARY KEY DEFAULT 1,
    edit_lock BOOLEAN DEFAULT FALSE,
    edit_lock_message TEXT DEFAULT 'System is under maintenance.',
    allow_uploads BOOLEAN DEFAULT FALSE,
    allow_upload_deletions BOOLEAN DEFAULT FALSE,
    allow_email_notifications BOOLEAN DEFAULT TRUE,
    records_per_page INT DEFAULT 25,
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO simple_app_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. VEHICLES & DRIVERS
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_number VARCHAR(20) NOT NULL UNIQUE,
    make VARCHAR(50),
    model VARCHAR(50),
    type VARCHAR(30),
    capacity_kg DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    insurance_expiry DATE,
    total_trips INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    license_number VARCHAR(50),
    license_expiry DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    total_deliveries INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. SIMPLE SHOP ITEMS (Per-user inventory)
-- ============================================================

CREATE TABLE IF NOT EXISTS simple_shop_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_user_id UUID,
    branch_id INT,
    item_sku VARCHAR(50) NOT NULL,
    quantity INT DEFAULT 0,
    last_restocked TIMESTAMPTZ,
    last_sold TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_shop_user_item UNIQUE (shop_user_id, item_sku)
);

CREATE INDEX IF NOT EXISTS idx_shop_items_user ON simple_shop_items(shop_user_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_sku ON simple_shop_items(item_sku);

-- ============================================================
-- 4. SIMPLE TRANSFER ITEMS (Cart system)
-- ============================================================

CREATE TABLE IF NOT EXISTS simple_transfer_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_user_id UUID NOT NULL,
    branch_id INT,
    item_sku VARCHAR(50) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    ordered BOOLEAN DEFAULT FALSE,
    approved BOOLEAN,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    request_notes TEXT,
    approval_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transfer_user ON simple_transfer_items(shop_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_ordered ON simple_transfer_items(ordered);
CREATE INDEX IF NOT EXISTS idx_transfer_sku ON simple_transfer_items(item_sku);

-- ============================================================
-- 5. STOCK OUT RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_out_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INT,
    shop_user_id UUID,
    item_sku VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    out_type VARCHAR(30) NOT NULL,
    reason TEXT,
    receipt_number VARCHAR(50),
    recorded_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_out_branch ON stock_out_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_date ON stock_out_records(created_at);

-- ============================================================
-- 6. STOCK TAKES (Inventory counts)
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_takes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    take_number VARCHAR(30) NOT NULL UNIQUE,
    branch_id INT NOT NULL,
    take_type VARCHAR(20) DEFAULT 'FULL',
    status VARCHAR(20) DEFAULT 'IN_PROGRESS',
    total_items_counted INT DEFAULT 0,
    items_with_variance INT DEFAULT 0,
    started_by UUID NOT NULL,
    completed_by UUID,
    notes TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_take_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) NOT NULL,
    system_quantity INT NOT NULL,
    counted_quantity INT,
    variance_reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_take_item UNIQUE (stock_take_id, item_sku)
);

-- ============================================================
-- 7. SUPPLIERS
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    payment_terms VARCHAR(50) DEFAULT 'NET30',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. DISPATCH TRACKING
-- ============================================================

-- Add fields to dispatch_notes if they don't exist
DO $$
BEGIN
    ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS vehicle_id UUID;
    ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS driver_id UUID;
    ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'NORMAL';
    ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS route_distance_km DECIMAL(10,2);
    ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS delivery_signature TEXT;
EXCEPTION WHEN undefined_table THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS dispatch_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL,
    previous_status VARCHAR(30),
    location VARCHAR(100),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_tracking_dispatch ON dispatch_tracking(dispatch_id);

-- ============================================================
-- 9. DISPATCH RETURNS
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatch_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_number VARCHAR(30) NOT NULL UNIQUE,
    dispatch_id UUID NOT NULL,
    from_branch_id INT NOT NULL,
    to_branch_id INT NOT NULL,
    item_sku VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    return_type VARCHAR(30) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_by UUID NOT NULL,
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. SEQUENCE GENERATOR
-- ============================================================

CREATE TABLE IF NOT EXISTS simple_sequences (
    sequence_name VARCHAR(50) NOT NULL,
    sequence_date DATE NOT NULL,
    current_number INT DEFAULT 0,
    PRIMARY KEY (sequence_name, sequence_date)
);

CREATE OR REPLACE FUNCTION get_next_simple_sequence(p_name VARCHAR(50), p_prefix VARCHAR(20))
RETURNS VARCHAR(30) AS $$
DECLARE
    v_date DATE := CURRENT_DATE;
    v_date_str VARCHAR(8);
    v_seq INT;
BEGIN
    v_date_str := TO_CHAR(v_date, 'YYYYMMDD');
    INSERT INTO simple_sequences (sequence_name, sequence_date, current_number)
    VALUES (p_name, v_date, 1)
    ON CONFLICT (sequence_name, sequence_date) 
    DO UPDATE SET current_number = simple_sequences.current_number + 1
    RETURNING current_number INTO v_seq;
    RETURN p_prefix || '-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. GRANTS
-- ============================================================

GRANT ALL ON simple_app_config TO authenticated;
GRANT ALL ON vehicles TO authenticated;
GRANT ALL ON drivers TO authenticated;
GRANT ALL ON simple_shop_items TO authenticated;
GRANT ALL ON simple_transfer_items TO authenticated;
GRANT ALL ON stock_out_records TO authenticated;
GRANT ALL ON stock_takes TO authenticated;
GRANT ALL ON stock_take_items TO authenticated;
GRANT ALL ON suppliers TO authenticated;
GRANT ALL ON dispatch_tracking TO authenticated;
GRANT ALL ON dispatch_returns TO authenticated;
GRANT ALL ON simple_sequences TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_simple_sequence(VARCHAR, VARCHAR) TO authenticated;

-- ============================================================
-- 12. SAMPLE DATA
-- ============================================================

-- Insert sample vehicles
INSERT INTO vehicles (registration_number, make, model, type, capacity_kg, status) VALUES
('KCN 123A', 'Toyota', 'Hiace', 'VAN', 1500, 'AVAILABLE'),
('KCN 456B', 'Isuzu', 'NKR', 'TRUCK', 3000, 'AVAILABLE'),
('KCN 789C', 'Honda', 'CG125', 'MOTORCYCLE', 100, 'AVAILABLE')
ON CONFLICT (registration_number) DO NOTHING;

-- Insert sample drivers
INSERT INTO drivers (name, phone, license_number, status) VALUES
('John Kipchoge', '+254712345678', 'DL123456', 'ACTIVE'),
('Mary Wanjiku', '+254723456789', 'DL234567', 'ACTIVE'),
('Peter Ochieng', '+254734567890', 'DL345678', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Insert sample suppliers
INSERT INTO suppliers (name, code, contact_person, phone, city, status) VALUES
('Kenya Breweries Limited', 'KBL', 'Sales Team', '+254202221000', 'Nairobi', 'ACTIVE'),
('Coca-Cola Beverages', 'CCB', 'Distribution', '+254202222000', 'Nairobi', 'ACTIVE'),
('Bidco Africa', 'BIDCO', 'Sales Rep', '+254208642000', 'Thika', 'ACTIVE'),
('Unilever Kenya', 'ULK', 'Customer Service', '+254203210000', 'Nairobi', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- DONE! All storekeeping tables created.
-- ============================================================

SELECT 'Storekeeping database setup complete!' as status;
