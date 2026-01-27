-- ============================================================
-- FAMOUS GATE HOTEL - MULTI-BRANCH INVENTORY SYSTEM
-- Complete migration for central dispatch inventory architecture
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PART 1: EXTEND BRANCHES TABLE
-- ============================================================

-- Add inventory-specific fields to branches
ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_central_warehouse BOOLEAN DEFAULT FALSE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS can_create_items BOOLEAN DEFAULT FALSE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS can_dispatch BOOLEAN DEFAULT FALSE;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS warehouse_capacity INT DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100);

-- Ensure only one central warehouse before creating index
UPDATE branches SET is_central_warehouse = FALSE WHERE is_central_warehouse = TRUE;
UPDATE branches SET is_central_warehouse = TRUE WHERE is_main_branch = TRUE AND id = (SELECT MIN(id) FROM branches WHERE is_main_branch = TRUE);

-- Ensure only one central warehouse
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_central_warehouse 
ON branches (is_central_warehouse) 
WHERE is_central_warehouse = TRUE;

-- ============================================================
-- PART 2: MASTER PRODUCT CATALOG (simple_items becomes master)
-- ============================================================

-- Add master catalog fields to simple_items
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS is_master_item BOOLEAN DEFAULT TRUE;
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS created_by_branch_id INT;
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS min_order_quantity INT DEFAULT 1;
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS max_order_quantity INT DEFAULT 1000;
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS lead_time_days INT DEFAULT 0;
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN DEFAULT FALSE;
ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS shelf_life_days INT;

-- ============================================================
-- PART 3: BRANCH-SPECIFIC STOCK TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS branch_stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_branch_item UNIQUE (branch_id, item_sku)
);

ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES branches(id) ON DELETE CASCADE;
ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS item_sku VARCHAR(50);
ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;
ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS reserved_quantity INT DEFAULT 0;
ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS reorder_level INT DEFAULT 10;
ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS max_stock_level INT DEFAULT 100;
ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS bin_location VARCHAR(50);
ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS last_stock_in TIMESTAMPTZ;
ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS last_stock_out TIMESTAMPTZ;
ALTER TABLE branch_stock ADD COLUMN IF NOT EXISTS last_counted TIMESTAMPTZ;

-- PART 4: STOCK REQUESTS (Branch → Central)
-- ... (skipping some comments for brevity)
CREATE TABLE IF NOT EXISTS stock_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_number VARCHAR(30) NOT NULL UNIQUE,
    requesting_branch_id INT NOT NULL REFERENCES branches(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(30);
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS requesting_branch_id INT REFERENCES branches(id);
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS requested_by UUID;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS request_type VARCHAR(20) DEFAULT 'ROUTINE';
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'NORMAL';
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS needed_by_date DATE;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS approved_quantity_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_requests_branch ON stock_requests(requesting_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_stock_requests_date ON stock_requests(created_at);

-- Request line items
CREATE TABLE IF NOT EXISTS stock_request_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) NOT NULL,
    
    -- Quantities
    requested_quantity INT NOT NULL,
    approved_quantity INT,  -- Can be less than requested
    current_branch_stock INT,  -- Stock at time of request
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, PARTIAL
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_items_request ON stock_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_request_items_sku ON stock_request_items(item_sku);

-- ============================================================
-- PART 5: DISPATCH NOTES (Central → Branch)
-- ============================================================

-- Dispatch sequence table
CREATE TABLE IF NOT EXISTS dispatch_sequences (
    branch_code VARCHAR(10) NOT NULL,
    sequence_date DATE NOT NULL,
    current_number INT DEFAULT 0,
    PRIMARY KEY (branch_code, sequence_date)
);

CREATE TABLE IF NOT EXISTS dispatch_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_number VARCHAR(30) NOT NULL UNIQUE,  -- FGH-DN-BOMET-20251126-0001
    
    -- Link to request (optional - dispatches can be ad-hoc)
    stock_request_id UUID REFERENCES stock_requests(id),
    
    -- Branch info
    from_branch_id INT NOT NULL REFERENCES branches(id),  -- Central warehouse
    to_branch_id INT NOT NULL REFERENCES branches(id),    -- Receiving branch
    
    -- Personnel
    created_by UUID NOT NULL,
    picker_id UUID,           -- Who picked the items
    packer_id UUID,           -- Who packed the items
    dispatcher_id UUID,       -- Who dispatched
    receiver_id UUID,         -- Who received at branch
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT, PICKING, PACKING, READY, IN_TRANSIT, DELIVERED, CONFIRMED, DISPUTED
    
    -- Logistics
    vehicle_number VARCHAR(20),
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),
    estimated_delivery TIMESTAMPTZ,
    
    -- Notes
    dispatch_notes TEXT,
    delivery_notes TEXT,
    discrepancy_notes TEXT,
    
    -- Timestamps
    picked_at TIMESTAMPTZ,
    packed_at TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_notes_from ON dispatch_notes(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_notes_to ON dispatch_notes(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_notes_status ON dispatch_notes(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_notes_request ON dispatch_notes(stock_request_id);

-- Dispatch line items
CREATE TABLE IF NOT EXISTS dispatch_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID NOT NULL REFERENCES dispatch_notes(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) NOT NULL,
    
    -- Quantities
    dispatched_quantity INT NOT NULL,
    received_quantity INT,        -- Confirmed by receiver
    damaged_quantity INT DEFAULT 0,
    missing_quantity INT DEFAULT 0,
    
    -- Tracking
    batch_number VARCHAR(50),
    expiry_date DATE,
    bin_location VARCHAR(50),    -- Where it was picked from
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, RECEIVED, PARTIAL, DISPUTED
    discrepancy_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch ON dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_sku ON dispatch_items(item_sku);

-- ============================================================
-- PART 6: PURCHASE ORDERS (Central → Suppliers)
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_order_sequences (
    sequence_date DATE NOT NULL PRIMARY KEY,
    current_number INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_number VARCHAR(30) NOT NULL UNIQUE,
    supplier_name VARCHAR(100) NOT NULL,
    receiving_branch_id INT NOT NULL REFERENCES branches(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist if table was pre-existing
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS receiving_branch_id INT REFERENCES branches(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(100);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_contact VARCHAR(100);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_email VARCHAR(100);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_phone VARCHAR(20);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_by UUID;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS actual_delivery DATE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS order_notes TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch ON purchase_orders(receiving_branch_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) NOT NULL,
    ordered_quantity INT NOT NULL,
    received_quantity INT DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist if table was pre-existing
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS item_sku VARCHAR(50);
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS ordered_quantity INT;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity INT DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2);
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12,2);
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

-- ============================================================
-- PART 7: BRANCH STOCK MOVEMENTS LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS branch_stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INT NOT NULL REFERENCES branches(id),
    item_sku VARCHAR(50) NOT NULL,
    
    -- Movement type
    movement_type VARCHAR(20) NOT NULL,
    -- IN: PURCHASE, DISPATCH_RECEIVE, ADJUSTMENT_IN, TRANSFER_IN, RETURN
    -- OUT: SALE, KITCHEN_USE, HOUSEKEEPING_USE, DAMAGE, LOSS, TRANSFER_OUT, ADJUSTMENT_OUT
    
    -- Quantities
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    
    -- Reference
    reference_type VARCHAR(20),  -- DISPATCH, PO, SALE, MANUAL
    reference_id UUID,
    reference_number VARCHAR(30),
    
    -- Details
    reason TEXT,
    notes TEXT,
    
    -- Personnel
    performed_by UUID NOT NULL,
    approved_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_branch ON branch_stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_movements_sku ON branch_stock_movements(item_sku);
CREATE INDEX IF NOT EXISTS idx_movements_type ON branch_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_date ON branch_stock_movements(created_at);

-- ============================================================
-- PART 8: IN-TRANSIT STOCK (Holds dispatched but not received)
-- ============================================================

CREATE TABLE IF NOT EXISTS in_transit_stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID NOT NULL REFERENCES dispatch_notes(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    dispatched_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_transit_item UNIQUE (dispatch_id, item_sku)
);

CREATE INDEX IF NOT EXISTS idx_transit_dispatch ON in_transit_stock(dispatch_id);

-- ============================================================
-- PART 9: FUNCTIONS FOR NUMBER GENERATION
-- ============================================================

-- Generate Stock Request Number
DROP FUNCTION IF EXISTS get_next_stock_request_number(VARCHAR);
CREATE OR REPLACE FUNCTION get_next_stock_request_number(p_branch_code VARCHAR(10))
RETURNS VARCHAR(30) AS $$
DECLARE
    v_date DATE := CURRENT_DATE;
    v_date_str VARCHAR(8);
    v_seq INT;
    v_request_num VARCHAR(30);
BEGIN
    v_date_str := TO_CHAR(v_date, 'YYYYMMDD');
    
    INSERT INTO stock_request_sequences (branch_code, sequence_date, current_number)
    VALUES (p_branch_code, v_date, 1)
    ON CONFLICT (branch_code, sequence_date) 
    DO UPDATE SET current_number = stock_request_sequences.current_number + 1
    RETURNING current_number INTO v_seq;
    
    v_request_num := 'FGH-SR-' || UPPER(p_branch_code) || '-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_request_num;
END;
$$ LANGUAGE plpgsql;

-- Generate Dispatch Note Number
DROP FUNCTION IF EXISTS get_next_dispatch_number(VARCHAR);
CREATE OR REPLACE FUNCTION get_next_dispatch_number(p_branch_code VARCHAR(10))
RETURNS VARCHAR(30) AS $$
DECLARE
    v_date DATE := CURRENT_DATE;
    v_date_str VARCHAR(8);
    v_seq INT;
    v_dispatch_num VARCHAR(30);
BEGIN
    v_date_str := TO_CHAR(v_date, 'YYYYMMDD');
    
    INSERT INTO dispatch_sequences (branch_code, sequence_date, current_number)
    VALUES (p_branch_code, v_date, 1)
    ON CONFLICT (branch_code, sequence_date) 
    DO UPDATE SET current_number = dispatch_sequences.current_number + 1
    RETURNING current_number INTO v_seq;
    
    v_dispatch_num := 'FGH-DN-' || UPPER(p_branch_code) || '-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_dispatch_num;
END;
$$ LANGUAGE plpgsql;

-- Generate Purchase Order Number
DROP FUNCTION IF EXISTS get_next_po_number();
CREATE OR REPLACE FUNCTION get_next_po_number()
RETURNS VARCHAR(30) AS $$
DECLARE
    v_date DATE := CURRENT_DATE;
    v_date_str VARCHAR(8);
    v_seq INT;
    v_po_num VARCHAR(30);
BEGIN
    v_date_str := TO_CHAR(v_date, 'YYYYMMDD');
    
    INSERT INTO purchase_order_sequences (sequence_date, current_number)
    VALUES (v_date, 1)
    ON CONFLICT (sequence_date) 
    DO UPDATE SET current_number = purchase_order_sequences.current_number + 1
    RETURNING current_number INTO v_seq;
    
    v_po_num := 'FGH-PO-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_po_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 10: USEFUL VIEWS
-- ============================================================

-- View: Low stock items by branch
DROP VIEW IF EXISTS v_low_stock_by_branch;
CREATE OR REPLACE VIEW v_low_stock_by_branch AS
SELECT 
    b.id as branch_id,
    b.name as branch_name,
    b.code as branch_code,
    bs.item_sku,
    si.item_name,
    si.description,
    bs.quantity as current_stock,
    bs.reorder_level,
    bs.max_stock_level,
    (bs.reorder_level - bs.quantity) as shortage
FROM branch_stock bs
JOIN branches b ON bs.branch_id = b.id
JOIN simple_items si ON bs.item_sku = si.sku
WHERE bs.quantity <= bs.reorder_level
ORDER BY b.name, shortage DESC;

-- View: Pending requests summary
DROP VIEW IF EXISTS v_pending_requests;
CREATE OR REPLACE VIEW v_pending_requests AS
SELECT 
    sr.id,
    sr.request_number,
    b.name as branch_name,
    b.code as branch_code,
    sr.request_type,
    sr.priority,
    sr.status,
    sr.created_at,
    sr.needed_by_date,
    COUNT(sri.id) as total_items,
    SUM(sri.requested_quantity) as total_quantity
FROM stock_requests sr
JOIN branches b ON sr.requesting_branch_id = b.id
LEFT JOIN stock_request_items sri ON sr.id = sri.request_id
WHERE sr.status IN ('PENDING', 'UNDER_REVIEW')
GROUP BY sr.id, sr.request_number, b.name, b.code, sr.request_type, sr.priority, sr.status, sr.created_at, sr.needed_by_date
ORDER BY 
    CASE sr.priority 
        WHEN 'URGENT' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'NORMAL' THEN 3 
        WHEN 'LOW' THEN 4 
    END,
    sr.created_at;

-- View: In-transit stock summary
DROP VIEW IF EXISTS v_in_transit_summary;
CREATE OR REPLACE VIEW v_in_transit_summary AS
SELECT 
    dn.to_branch_id,
    b.name as destination_branch,
    dn.dispatch_number,
    dn.status,
    dn.dispatched_at,
    dn.estimated_delivery,
    COUNT(di.id) as total_items,
    SUM(di.dispatched_quantity) as total_quantity
FROM dispatch_notes dn
JOIN branches b ON dn.to_branch_id = b.id
JOIN dispatch_items di ON dn.id = di.dispatch_id
WHERE dn.status = 'IN_TRANSIT'
GROUP BY dn.to_branch_id, b.name, dn.dispatch_number, dn.status, dn.dispatched_at, dn.estimated_delivery;

-- ============================================================
-- PART 11: GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON branch_stock TO authenticated;
GRANT SELECT, INSERT, UPDATE ON stock_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON stock_request_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON dispatch_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON dispatch_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON purchase_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON branch_stock_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON in_transit_stock TO authenticated;
GRANT SELECT, INSERT, UPDATE ON stock_request_sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON dispatch_sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON purchase_order_sequences TO authenticated;

GRANT EXECUTE ON FUNCTION get_next_stock_request_number(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_dispatch_number(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_po_number() TO authenticated;

GRANT SELECT ON v_low_stock_by_branch TO authenticated;
GRANT SELECT ON v_pending_requests TO authenticated;
GRANT SELECT ON v_in_transit_summary TO authenticated;

-- ============================================================
-- SETUP: Mark the first branch as central warehouse
-- ============================================================

-- Update the main branch to be central warehouse (run once)
UPDATE branches 
SET is_central_warehouse = TRUE, 
    can_create_items = TRUE, 
    can_dispatch = TRUE
WHERE id = (SELECT MIN(id) FROM branches WHERE is_main_branch = TRUE);

-- ============================================================
-- DONE! 
-- Tables created:
-- - branch_stock
-- - stock_requests + stock_request_items
-- - dispatch_notes + dispatch_items
-- - purchase_orders + purchase_order_items
-- - branch_stock_movements
-- - in_transit_stock
-- ============================================================
