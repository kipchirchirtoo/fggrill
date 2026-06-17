-- ============================================
-- COMPLETE KITCHEN MODULE MIGRATION
-- Created: 2026-06-17
-- Purpose: Create all missing kitchen tables with proper relationships
-- ============================================

-- ============================================
-- 1. KITCHEN STORE RECEIPTS (from dispatch notes)
-- ============================================

CREATE TABLE IF NOT EXISTS kitchen_store_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    dispatch_note_id UUID REFERENCES store_dispatch_notes(id) ON DELETE SET NULL,
    received_from VARCHAR(255), -- e.g., "Central Store" or branch name
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_items INTEGER DEFAULT 0,
    remarks TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kitchen_store_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES kitchen_store_receipts(id) ON DELETE CASCADE,
    item_sku VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    expected_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
    received_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit_of_measure VARCHAR(50) NOT NULL,
    expected_portions NUMERIC(12,3), -- Expected portions from food control
    variance NUMERIC(12,3) GENERATED ALWAYS AS (received_quantity - expected_quantity) STORED,
    status VARCHAR(50) DEFAULT 'ok' CHECK (status IN ('ok', 'shortage', 'excess')),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for receipts
CREATE INDEX idx_kitchen_receipts_branch ON kitchen_store_receipts(branch_id);
CREATE INDEX idx_kitchen_receipts_date ON kitchen_store_receipts(receipt_date);
CREATE INDEX idx_kitchen_receipts_status ON kitchen_store_receipts(status);
CREATE INDEX idx_kitchen_receipt_items_receipt ON kitchen_store_receipt_items(receipt_id);

-- ============================================
-- 2. KITCHEN EXPECTED PORTIONS (Production Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS kitchen_expected_portions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    receipt_id UUID REFERENCES kitchen_store_receipts(id) ON DELETE SET NULL,
    dispatch_note_id UUID REFERENCES store_dispatch_notes(id) ON DELETE SET NULL,
    food_control_id INTEGER REFERENCES kitchen_food_controls(id) ON DELETE SET NULL,
    
    -- Raw material info
    raw_item_sku VARCHAR(100) NOT NULL,
    raw_item_name VARCHAR(255) NOT NULL,
    raw_quantity NUMERIC(12,3) NOT NULL,
    raw_unit VARCHAR(50) NOT NULL,
    
    -- Produced item info
    produced_item_name VARCHAR(255) NOT NULL,
    expected_portions NUMERIC(12,3) NOT NULL,
    actual_portions NUMERIC(12,3),
    
    -- Variance tracking
    variance NUMERIC(12,3) GENERATED ALWAYS AS (actual_portions - expected_portions) STORED,
    variance_percentage NUMERIC(5,2),
    variance_reason TEXT,
    
    -- Tracking info
    received_at TIMESTAMPTZ DEFAULT NOW(),
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for expected portions
CREATE INDEX idx_kitchen_expected_branch ON kitchen_expected_portions(branch_id);
CREATE INDEX idx_kitchen_expected_date ON kitchen_expected_portions(received_at);
CREATE INDEX idx_kitchen_expected_verified ON kitchen_expected_portions(verified_at);
CREATE INDEX idx_kitchen_expected_sku ON kitchen_expected_portions(raw_item_sku);

-- ============================================
-- 3. KITCHEN PORTION TRACKING (Real-time Production)
-- ============================================

CREATE TABLE IF NOT EXISTS kitchen_portion_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    receipt_id UUID REFERENCES kitchen_store_receipts(id) ON DELETE SET NULL,
    
    -- Raw material
    item_sku VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    received_quantity NUMERIC(12,3) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    
    -- Menu item
    menu_item_id UUID,
    menu_item_name VARCHAR(255) NOT NULL,
    expected_portions NUMERIC(12,3) NOT NULL,
    actual_portions_produced NUMERIC(12,3),
    
    -- Variance
    variance_reason TEXT,
    production_notes TEXT,
    
    -- Chef info
    chef_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tracking_date DATE DEFAULT CURRENT_DATE,
    
    status VARCHAR(50) DEFAULT 'tracking' CHECK (status IN (
        'tracking', 
        'completed', 
        'variance_pending_reason', 
        'variance_reported'
    )),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for portion tracking
CREATE INDEX idx_portion_tracking_branch ON kitchen_portion_tracking(branch_id);
CREATE INDEX idx_portion_tracking_date ON kitchen_portion_tracking(tracking_date);
CREATE INDEX idx_portion_tracking_status ON kitchen_portion_tracking(status);
CREATE INDEX idx_portion_tracking_chef ON kitchen_portion_tracking(chef_id);

-- ============================================
-- 4. KITCHEN DAILY VARIANCE (End-of-day Reconciliation)
-- ============================================

CREATE TABLE IF NOT EXISTS kitchen_daily_variance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    variance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Item details
    item_sku VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    
    -- Stock tracking
    opening_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
    received NUMERIC(12,3) NOT NULL DEFAULT 0,
    issued NUMERIC(12,3) NOT NULL DEFAULT 0,
    expected_closing NUMERIC(12,3) GENERATED ALWAYS AS (opening_stock + received - issued) STORED,
    physical_closing NUMERIC(12,3),
    variance NUMERIC(12,3) GENERATED ALWAYS AS (physical_closing - (opening_stock + received - issued)) STORED,
    
    -- Costing
    item_cost NUMERIC(12,2),
    cost_value NUMERIC(12,2),
    
    -- Reason and approval
    reason_id INTEGER REFERENCES kitchen_variance_reasons(id) ON DELETE SET NULL,
    notes TEXT,
    approval_notes TEXT,
    
    -- Approval tracking
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    is_locked BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(branch_id, variance_date, item_sku)
);

-- Indexes for daily variance
CREATE INDEX idx_daily_variance_branch ON kitchen_daily_variance(branch_id);
CREATE INDEX idx_daily_variance_date ON kitchen_daily_variance(variance_date);
CREATE INDEX idx_daily_variance_sku ON kitchen_daily_variance(item_sku);
CREATE INDEX idx_daily_variance_reason ON kitchen_daily_variance(reason_id);
CREATE INDEX idx_daily_variance_approved ON kitchen_daily_variance(approved_at);

-- ============================================
-- 5. KITCHEN PORTION STOCK (Current Stock by Portion)
-- ============================================

CREATE TABLE IF NOT EXISTS kitchen_portion_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    
    -- Portion details
    portion_name VARCHAR(255) NOT NULL,
    portion_sku VARCHAR(100),
    unit_of_measure VARCHAR(50) NOT NULL,
    
    -- Stock levels
    current_balance NUMERIC(12,3) NOT NULL DEFAULT 0,
    reorder_level NUMERIC(12,3),
    
    -- Costing
    cost_per_portion NUMERIC(12,2),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(branch_id, portion_name)
);

-- Indexes for portion stock
CREATE INDEX idx_portion_stock_branch ON kitchen_portion_stock(branch_id);
CREATE INDEX idx_portion_stock_active ON kitchen_portion_stock(is_active);

-- ============================================
-- 6. KITCHEN PORTION LEDGER (Portion Movement Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS kitchen_portion_ledger (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    
    -- Portion details
    portion_sku VARCHAR(100),
    portion_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    
    -- Transaction details
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'PRODUCTION',    -- Created from raw materials
        'POS_SALE',      -- Sold via POS
        'WASTAGE',       -- Wasted/spoiled
        'ADJUSTMENT',    -- Manual adjustment
        'TRANSFER'       -- Transfer between outlets
    )),
    reference_type VARCHAR(50),
    reference_id VARCHAR(100),
    
    -- Quantities
    opening_balance NUMERIC(12,3) NOT NULL,
    quantity_in NUMERIC(12,3) DEFAULT 0,
    quantity_out NUMERIC(12,3) DEFAULT 0,
    closing_balance NUMERIC(12,3) NOT NULL,
    
    -- Context
    shift VARCHAR(50),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for portion ledger
CREATE INDEX idx_portion_ledger_branch ON kitchen_portion_ledger(branch_id);
CREATE INDEX idx_portion_ledger_date ON kitchen_portion_ledger(transaction_date);
CREATE INDEX idx_portion_ledger_type ON kitchen_portion_ledger(transaction_type);
CREATE INDEX idx_portion_ledger_sku ON kitchen_portion_ledger(portion_sku);

-- ============================================
-- 7. KITCHEN VARIANCE LOGS (Detailed Variance Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS kitchen_variance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portion_tracking_id UUID REFERENCES kitchen_portion_tracking(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    
    -- Variance details
    variance_type VARCHAR(50) NOT NULL CHECK (variance_type IN ('shortage', 'excess', 'quality_issue', 'theft', 'other')),
    variance_amount NUMERIC(12,3) NOT NULL,
    reason TEXT NOT NULL,
    corrective_action TEXT,
    
    -- Financial impact
    cost_impact NUMERIC(12,2),
    
    -- Reporting
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Approval
    approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    remarks TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for variance logs
CREATE INDEX idx_variance_logs_branch ON kitchen_variance_logs(branch_id);
CREATE INDEX idx_variance_logs_tracking ON kitchen_variance_logs(portion_tracking_id);
CREATE INDEX idx_variance_logs_status ON kitchen_variance_logs(approval_status);
CREATE INDEX idx_variance_logs_date ON kitchen_variance_logs(reported_at);

-- ============================================
-- 8. WASTAGE RECORDS (General Wastage Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS wastage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    
    -- Item details
    item_name VARCHAR(255) NOT NULL,
    item_id VARCHAR(100), -- Can be SKU, portion ID, etc.
    item_type VARCHAR(50) CHECK (item_type IN ('raw_material', 'portion', 'finished_product', 'other')),
    
    -- Quantity
    quantity NUMERIC(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    
    -- Reason
    reason VARCHAR(100) NOT NULL CHECK (reason IN (
        'spoilage',
        'expiry',
        'contamination',
        'over_production',
        'breakage',
        'quality_issue',
        'staff_error',
        'pest_damage',
        'other'
    )),
    description TEXT,
    
    -- Cost impact
    cost_impact NUMERIC(12,2) DEFAULT 0,
    
    -- Tracking
    logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for wastage records
CREATE INDEX idx_wastage_branch ON wastage_records(branch_id);
CREATE INDEX idx_wastage_date ON wastage_records(logged_at);
CREATE INDEX idx_wastage_reason ON wastage_records(reason);
CREATE INDEX idx_wastage_logged_by ON wastage_records(logged_by);

-- ============================================
-- 9. AUTO-UPDATE TRIGGERS
-- ============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_kitchen_receipts_updated_at
    BEFORE UPDATE ON kitchen_store_receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kitchen_expected_updated_at
    BEFORE UPDATE ON kitchen_expected_portions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portion_tracking_updated_at
    BEFORE UPDATE ON kitchen_portion_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_variance_updated_at
    BEFORE UPDATE ON kitchen_daily_variance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wastage_updated_at
    BEFORE UPDATE ON wastage_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE kitchen_store_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_store_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_expected_portions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_portion_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_daily_variance ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_portion_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_portion_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_variance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wastage_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies (branch-based isolation)
-- Kitchen Store Receipts
CREATE POLICY kitchen_receipts_select ON kitchen_store_receipts
    FOR SELECT USING (
        branch_id IN (SELECT id FROM branches WHERE id = current_setting('app.current_branch_id', TRUE)::INTEGER)
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor')
    );

CREATE POLICY kitchen_receipts_insert ON kitchen_store_receipts
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY kitchen_receipts_update ON kitchen_store_receipts
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

-- Expected Portions
CREATE POLICY expected_portions_select ON kitchen_expected_portions
    FOR SELECT USING (
        branch_id IN (SELECT id FROM branches WHERE id = current_setting('app.current_branch_id', TRUE)::INTEGER)
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor')
    );

CREATE POLICY expected_portions_insert ON kitchen_expected_portions
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY expected_portions_update ON kitchen_expected_portions
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

-- Portion Tracking
CREATE POLICY portion_tracking_select ON kitchen_portion_tracking
    FOR SELECT USING (
        branch_id IN (SELECT id FROM branches WHERE id = current_setting('app.current_branch_id', TRUE)::INTEGER)
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor')
    );

CREATE POLICY portion_tracking_insert ON kitchen_portion_tracking
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY portion_tracking_update ON kitchen_portion_tracking
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

-- Daily Variance
CREATE POLICY daily_variance_select ON kitchen_daily_variance
    FOR SELECT USING (
        branch_id IN (SELECT id FROM branches WHERE id = current_setting('app.current_branch_id', TRUE)::INTEGER)
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor')
    );

CREATE POLICY daily_variance_insert ON kitchen_daily_variance
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY daily_variance_update ON kitchen_daily_variance
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
        OR current_setting('app.user_role', TRUE) IN ('branch_manager', 'auditor')
    );

-- Portion Stock
CREATE POLICY portion_stock_select ON kitchen_portion_stock
    FOR SELECT USING (
        branch_id IN (SELECT id FROM branches WHERE id = current_setting('app.current_branch_id', TRUE)::INTEGER)
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor')
    );

CREATE POLICY portion_stock_insert ON kitchen_portion_stock
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY portion_stock_update ON kitchen_portion_stock
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

-- Portion Ledger
CREATE POLICY portion_ledger_select ON kitchen_portion_ledger
    FOR SELECT USING (
        branch_id IN (SELECT id FROM branches WHERE id = current_setting('app.current_branch_id', TRUE)::INTEGER)
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor')
    );

CREATE POLICY portion_ledger_insert ON kitchen_portion_ledger
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

-- Variance Logs
CREATE POLICY variance_logs_select ON kitchen_variance_logs
    FOR SELECT USING (
        branch_id IN (SELECT id FROM branches WHERE id = current_setting('app.current_branch_id', TRUE)::INTEGER)
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor')
    );

CREATE POLICY variance_logs_insert ON kitchen_variance_logs
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY variance_logs_update ON kitchen_variance_logs
    FOR UPDATE USING (
        current_setting('app.user_role', TRUE) IN ('branch_manager', 'auditor', 'super_admin')
    );

-- Wastage Records
CREATE POLICY wastage_select ON wastage_records
    FOR SELECT USING (
        branch_id IN (SELECT id FROM branches WHERE id = current_setting('app.current_branch_id', TRUE)::INTEGER)
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor')
    );

CREATE POLICY wastage_insert ON wastage_records
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY wastage_update ON wastage_records
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY wastage_delete ON wastage_records
    FOR DELETE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
        AND current_setting('app.user_role', TRUE) IN ('branch_manager', 'super_admin')
    );

-- ============================================
-- 11. HELPER FUNCTIONS
-- ============================================

-- Generate receipt number
CREATE OR REPLACE FUNCTION generate_kitchen_receipt_number()
RETURNS VARCHAR AS $$
DECLARE
    next_num INTEGER;
    new_number VARCHAR;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 3) AS INTEGER)), 0) + 1
    INTO next_num
    FROM kitchen_store_receipts
    WHERE receipt_number ~ '^KR[0-9]+$';
    
    new_number := 'KR' || LPAD(next_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate tracking number
CREATE OR REPLACE FUNCTION generate_portion_tracking_number()
RETURNS VARCHAR AS $$
DECLARE
    next_num INTEGER;
    new_number VARCHAR;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(tracking_number FROM 3) AS INTEGER)), 0) + 1
    INTO next_num
    FROM kitchen_portion_tracking
    WHERE tracking_number ~ '^PT[0-9]+$';
    
    new_number := 'PT' || LPAD(next_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 12. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE kitchen_store_receipts IS 'Records of items received by kitchen from dispatch notes';
COMMENT ON TABLE kitchen_store_receipt_items IS 'Line items for kitchen store receipts';
COMMENT ON TABLE kitchen_expected_portions IS 'Tracks expected vs actual portion production from raw materials';
COMMENT ON TABLE kitchen_portion_tracking IS 'Real-time tracking of portion production during shifts';
COMMENT ON TABLE kitchen_daily_variance IS 'End-of-day variance reconciliation for kitchen items';
COMMENT ON TABLE kitchen_portion_stock IS 'Current stock levels of prepared portions';
COMMENT ON TABLE kitchen_portion_ledger IS 'Movement ledger for prepared portions';
COMMENT ON TABLE kitchen_variance_logs IS 'Detailed variance logs requiring approval';
COMMENT ON TABLE wastage_records IS 'General wastage tracking across all kitchen items';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
