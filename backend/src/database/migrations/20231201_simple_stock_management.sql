-- ============================================================
-- FAMOUS GATE HOTEL - SIMPLE STOCK MANAGEMENT TABLES
-- Based on simple-stock-management reference project
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PART 1: APP CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS simple_app_config (
    id INT PRIMARY KEY DEFAULT 1,
    
    -- Edit Lock (Maintenance Mode)
    edit_lock BOOLEAN DEFAULT FALSE,
    edit_lock_message TEXT DEFAULT 'System is under maintenance. Please try again later.',
    edit_lock_enabled_by UUID,
    edit_lock_enabled_at TIMESTAMPTZ,
    
    -- Feature Flags
    allow_uploads BOOLEAN DEFAULT FALSE,
    allow_upload_deletions BOOLEAN DEFAULT FALSE,
    allow_email_notifications BOOLEAN DEFAULT TRUE,
    allow_barcode_scanning BOOLEAN DEFAULT TRUE,
    
    -- Display Settings
    records_per_page INT DEFAULT 25,
    default_currency VARCHAR(10) DEFAULT 'KES',
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    
    -- Stock Settings
    low_stock_threshold INT DEFAULT 10,
    auto_reorder_enabled BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT single_config CHECK (id = 1)
);

-- Insert default config
INSERT INTO simple_app_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PART 2: SHOP ITEMS (Per-user/branch inventory)
-- ============================================================

CREATE TABLE IF NOT EXISTS simple_shop_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Owner - can be user or branch
    shop_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
    
    -- Item reference
    item_sku VARCHAR(50) NOT NULL,
    
    -- Stock
    quantity INT DEFAULT 0 CHECK (quantity >= 0),
    min_stock_level INT DEFAULT 5,
    max_stock_level INT DEFAULT 100,
    
    -- Tracking
    last_restocked TIMESTAMPTZ,
    last_sold TIMESTAMPTZ,
    total_sold INT DEFAULT 0,
    total_received INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_shop_user_item UNIQUE (shop_user_id, item_sku),
    CONSTRAINT unique_branch_shop_item UNIQUE (branch_id, item_sku),
    CONSTRAINT must_have_owner CHECK (shop_user_id IS NOT NULL OR branch_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_shop_items_user ON simple_shop_items(shop_user_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_branch ON simple_shop_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_sku ON simple_shop_items(item_sku);
CREATE INDEX IF NOT EXISTS idx_shop_items_low_stock ON simple_shop_items(quantity) WHERE quantity <= 5;

-- ============================================================
-- PART 3: TRANSFER ITEMS (Cart system for stock requests)
-- ============================================================

CREATE TABLE IF NOT EXISTS simple_transfer_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Who is requesting
    shop_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id INT REFERENCES branches(id),
    
    -- Item to transfer
    item_sku VARCHAR(50) NOT NULL,
    
    -- Quantity
    quantity INT NOT NULL CHECK (quantity > 0),
    original_quantity INT,  -- What was originally in stock when requested
    
    -- Status
    ordered BOOLEAN DEFAULT FALSE,  -- FALSE = in cart, TRUE = submitted for approval
    approved BOOLEAN,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    
    -- Notes
    request_notes TEXT,
    approval_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Prevent duplicate items in cart per user
    CONSTRAINT unique_user_item_transfer UNIQUE (shop_user_id, item_sku, ordered)
);

CREATE INDEX IF NOT EXISTS idx_transfer_user ON simple_transfer_items(shop_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_ordered ON simple_transfer_items(ordered);
CREATE INDEX IF NOT EXISTS idx_transfer_sku ON simple_transfer_items(item_sku);
CREATE INDEX IF NOT EXISTS idx_transfer_pending ON simple_transfer_items(shop_user_id, ordered) WHERE ordered = FALSE;

-- ============================================================
-- PART 4: TRANSFER BATCHES (Group transfers into requests)
-- ============================================================

CREATE TABLE IF NOT EXISTS transfer_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_number VARCHAR(30) NOT NULL UNIQUE,  -- FGH-TB-20251127-0001
    
    -- Requestor info
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_branch_id INT REFERENCES branches(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, APPROVED, PARTIAL, REJECTED, COMPLETED, CANCELLED
    
    -- Processing
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    process_notes TEXT,
    
    -- Summary (denormalized for quick access)
    total_items INT DEFAULT 0,
    total_quantity INT DEFAULT 0,
    approved_items INT DEFAULT 0,
    approved_quantity INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_status ON transfer_batches(status);
CREATE INDEX IF NOT EXISTS idx_batch_user ON transfer_batches(requested_by);

-- ============================================================
-- PART 5: STOCK SALES/OUT RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_out_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Location
    branch_id INT REFERENCES branches(id),
    shop_user_id UUID REFERENCES users(id),
    
    -- Item
    item_sku VARCHAR(50) NOT NULL,
    
    -- Quantity
    quantity INT NOT NULL CHECK (quantity > 0),
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    
    -- Type
    out_type VARCHAR(30) NOT NULL,  -- SALE, KITCHEN_USE, BAR_USE, WASTE, DAMAGE, THEFT, ADJUSTMENT
    
    -- Details
    reason TEXT,
    notes TEXT,
    receipt_number VARCHAR(50),
    
    -- Recording
    recorded_by UUID NOT NULL REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_out_branch ON stock_out_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_sku ON stock_out_records(item_sku);
CREATE INDEX IF NOT EXISTS idx_stock_out_type ON stock_out_records(out_type);
CREATE INDEX IF NOT EXISTS idx_stock_out_date ON stock_out_records(created_at);

-- ============================================================
-- PART 6: STOCK TAKES / INVENTORY COUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_takes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    take_number VARCHAR(30) NOT NULL UNIQUE,  -- FGH-ST-20251127-0001
    
    -- Location
    branch_id INT NOT NULL REFERENCES branches(id),
    
    -- Type
    take_type VARCHAR(20) DEFAULT 'FULL',  -- FULL, PARTIAL, SPOT_CHECK
    category_filter VARCHAR(50),  -- If partial, which category
    
    -- Status
    status VARCHAR(20) DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS, COMPLETED, CANCELLED
    
    -- Summary
    total_items_counted INT DEFAULT 0,
    items_with_variance INT DEFAULT 0,
    total_variance_value DECIMAL(12,2) DEFAULT 0,
    
    -- Personnel
    started_by UUID NOT NULL REFERENCES users(id),
    completed_by UUID,
    approved_by UUID,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_take_branch ON stock_takes(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_take_status ON stock_takes(status);

-- Stock take line items
CREATE TABLE IF NOT EXISTS stock_take_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) NOT NULL,
    
    -- Counts
    system_quantity INT NOT NULL,  -- What system says we should have
    counted_quantity INT,          -- What was actually counted
    variance INT GENERATED ALWAYS AS (COALESCE(counted_quantity, 0) - system_quantity) STORED,
    
    -- Value
    unit_cost DECIMAL(10,2),
    variance_value DECIMAL(12,2) GENERATED ALWAYS AS (variance * COALESCE(unit_cost, 0)) STORED,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, COUNTED, VERIFIED
    
    -- Notes
    variance_reason TEXT,
    notes TEXT,
    
    -- Timestamps
    counted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_take_item UNIQUE (stock_take_id, item_sku)
);

CREATE INDEX IF NOT EXISTS idx_take_items_take ON stock_take_items(stock_take_id);
CREATE INDEX IF NOT EXISTS idx_take_items_variance ON stock_take_items(variance) WHERE variance != 0;

-- ============================================================
-- PART 7: SUPPLIER MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic Info
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    
    -- Contact
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    
    -- Address
    address TEXT,
    city VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'Kenya',
    
    -- Business
    tax_pin VARCHAR(50),
    payment_terms VARCHAR(50) DEFAULT 'NET30',  -- NET30, NET60, COD, etc.
    credit_limit DECIMAL(12,2) DEFAULT 0,
    
    -- Categories they supply
    categories TEXT[],
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, INACTIVE, BLOCKED
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- ============================================================
-- PART 8: SEQUENCE GENERATORS
-- ============================================================

CREATE TABLE IF NOT EXISTS simple_sequences (
    sequence_name VARCHAR(50) NOT NULL,
    sequence_date DATE NOT NULL,
    current_number INT DEFAULT 0,
    PRIMARY KEY (sequence_name, sequence_date)
);

-- Function to get next sequence number
CREATE OR REPLACE FUNCTION get_next_simple_sequence(p_name VARCHAR(50), p_prefix VARCHAR(20))
RETURNS VARCHAR(30) AS $$
DECLARE
    v_date DATE := CURRENT_DATE;
    v_date_str VARCHAR(8);
    v_seq INT;
    v_result VARCHAR(30);
BEGIN
    v_date_str := TO_CHAR(v_date, 'YYYYMMDD');
    
    INSERT INTO simple_sequences (sequence_name, sequence_date, current_number)
    VALUES (p_name, v_date, 1)
    ON CONFLICT (sequence_name, sequence_date) 
    DO UPDATE SET current_number = simple_sequences.current_number + 1
    RETURNING current_number INTO v_seq;
    
    v_result := p_prefix || '-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 9: USEFUL FUNCTIONS
-- ============================================================

-- Get transfer batch number
CREATE OR REPLACE FUNCTION get_transfer_batch_number()
RETURNS VARCHAR(30) AS $$
BEGIN
    RETURN get_next_simple_sequence('TRANSFER_BATCH', 'FGH-TB');
END;
$$ LANGUAGE plpgsql;

-- Get stock take number
CREATE OR REPLACE FUNCTION get_stock_take_number()
RETURNS VARCHAR(30) AS $$
BEGIN
    RETURN get_next_simple_sequence('STOCK_TAKE', 'FGH-ST');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 10: TRIGGERS FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all relevant tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'simple_app_config',
        'simple_shop_items',
        'simple_transfer_items',
        'transfer_batches',
        'suppliers'
    ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS set_updated_at ON %I;
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t);
    END LOOP;
END;
$$;

-- ============================================================
-- PART 11: VIEWS FOR REPORTING
-- ============================================================

-- View: Pending transfer requests
CREATE OR REPLACE VIEW v_pending_transfers AS
SELECT 
    st.id,
    st.shop_user_id,
    u.first_name || ' ' || u.last_name as requester_name,
    u.email as requester_email,
    b.name as branch_name,
    st.item_sku,
    si.item_name,
    si.description,
    st.quantity,
    si.quantity as available_stock,
    si.retail_price,
    (st.quantity * si.retail_price) as total_value,
    st.request_notes,
    st.created_at,
    st.submitted_at
FROM simple_transfer_items st
JOIN users u ON st.shop_user_id = u.id
LEFT JOIN branches b ON st.branch_id = b.id OR u.branch_id = b.id
LEFT JOIN simple_items si ON st.item_sku = si.sku
WHERE st.ordered = TRUE AND st.approved IS NULL
ORDER BY st.created_at;

-- View: Shop inventory summary
CREATE OR REPLACE VIEW v_shop_inventory AS
SELECT 
    ssi.id,
    ssi.shop_user_id,
    u.first_name || ' ' || u.last_name as user_name,
    ssi.branch_id,
    b.name as branch_name,
    ssi.item_sku,
    si.item_name,
    si.category,
    ssi.quantity,
    ssi.min_stock_level,
    ssi.max_stock_level,
    si.retail_price,
    (ssi.quantity * si.retail_price) as stock_value,
    CASE 
        WHEN ssi.quantity <= ssi.min_stock_level THEN 'LOW'
        WHEN ssi.quantity >= ssi.max_stock_level THEN 'OVER'
        ELSE 'NORMAL'
    END as stock_status,
    ssi.last_restocked,
    ssi.last_sold
FROM simple_shop_items ssi
LEFT JOIN users u ON ssi.shop_user_id = u.id
LEFT JOIN branches b ON ssi.branch_id = b.id
LEFT JOIN simple_items si ON ssi.item_sku = si.sku
ORDER BY b.name, si.item_name;

-- View: Daily stock out summary
CREATE OR REPLACE VIEW v_daily_stock_out AS
SELECT 
    DATE(sor.created_at) as date,
    b.name as branch_name,
    sor.out_type,
    COUNT(*) as transaction_count,
    SUM(sor.quantity) as total_quantity,
    SUM(sor.quantity * si.cost_price) as total_cost_value,
    SUM(sor.quantity * si.retail_price) as total_retail_value
FROM stock_out_records sor
LEFT JOIN branches b ON sor.branch_id = b.id
LEFT JOIN simple_items si ON sor.item_sku = si.sku
GROUP BY DATE(sor.created_at), b.name, sor.out_type
ORDER BY DATE(sor.created_at) DESC, b.name;

-- ============================================================
-- PART 12: GRANTS
-- ============================================================

GRANT ALL ON simple_app_config TO authenticated;
GRANT ALL ON simple_shop_items TO authenticated;
GRANT ALL ON simple_transfer_items TO authenticated;
GRANT ALL ON transfer_batches TO authenticated;
GRANT ALL ON stock_out_records TO authenticated;
GRANT ALL ON stock_takes TO authenticated;
GRANT ALL ON stock_take_items TO authenticated;
GRANT ALL ON suppliers TO authenticated;
GRANT ALL ON simple_sequences TO authenticated;

GRANT EXECUTE ON FUNCTION get_next_simple_sequence(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_transfer_batch_number() TO authenticated;
GRANT EXECUTE ON FUNCTION get_stock_take_number() TO authenticated;

GRANT SELECT ON v_pending_transfers TO authenticated;
GRANT SELECT ON v_shop_inventory TO authenticated;
GRANT SELECT ON v_daily_stock_out TO authenticated;

-- ============================================================
-- DONE! Tables Created:
-- - simple_app_config (system settings)
-- - simple_shop_items (per-user/branch inventory)
-- - simple_transfer_items (transfer cart/requests)
-- - transfer_batches (grouped transfer requests)
-- - stock_out_records (sales/usage tracking)
-- - stock_takes + stock_take_items (inventory counts)
-- - suppliers (vendor management)
-- - simple_sequences (number generation)
-- ============================================================
