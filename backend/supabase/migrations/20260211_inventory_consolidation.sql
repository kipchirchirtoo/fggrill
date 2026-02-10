-- Inventory Consolidation & Missing Kitchen Tables
-- Created: 2026-02-11
-- Description: Adds missing kitchen ledger, receipt, and tracking tables referenced in controllers.

-- =====================================================
-- 1. KITCHEN LEDGER ENTRIES
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_ledger_entries (
    id SERIAL PRIMARY KEY,
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL, -- SKU or Item ID
    item_name VARCHAR(255) NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opening_balance DECIMAL(10,3) NOT NULL DEFAULT 0,
    received_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    used_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    wastage_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
    expected_sales DECIMAL(10,3) NOT NULL DEFAULT 0,
    system_sales DECIMAL(10,3) NOT NULL DEFAULT 0,
    closing_balance DECIMAL(10,3) NOT NULL DEFAULT 0,
    unit_of_measure VARCHAR(50) NOT NULL,
    remarks TEXT,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'submitted', 'verified'
    submitted_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_k_ledger_entries_branch_date ON kitchen_ledger_entries(branch_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_k_ledger_entries_item ON kitchen_ledger_entries(item_id);

-- =====================================================
-- 2. KITCHEN STORE RECEIPTS
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_store_receipts (
    id SERIAL PRIMARY KEY,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    dispatch_note_id VARCHAR(100),
    received_from VARCHAR(255),
    received_by UUID REFERENCES users(id),
    receipt_date TIMESTAMP DEFAULT NOW(),
    total_items INTEGER DEFAULT 0,
    remarks TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kitchen_store_receipt_items (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES kitchen_store_receipts(id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    expected_quantity DECIMAL(10,3) NOT NULL,
    received_quantity DECIMAL(10,3) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    expected_portions INTEGER,
    status VARCHAR(20), -- 'ok', 'shortage', 'excess'
    remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_k_receipt_items_receipt ON kitchen_store_receipt_items(receipt_id);

-- =====================================================
-- 3. PORTION TRACKING & VARIANCE
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_portion_tracking (
    id SERIAL PRIMARY KEY,
    tracking_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    receipt_id INTEGER REFERENCES kitchen_store_receipts(id),
    item_id VARCHAR(50) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    menu_item_id UUID REFERENCES restaurant_menu_items(id),
    menu_item_name VARCHAR(255),
    tracking_date DATE DEFAULT CURRENT_DATE,
    received_quantity DECIMAL(10,3) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    expected_portions DECIMAL(10,3) NOT NULL,
    actual_portions_produced DECIMAL(10,3),
    chef_id UUID REFERENCES users(id),
    production_notes TEXT,
    variance_reason TEXT,
    status VARCHAR(30) DEFAULT 'tracking', -- 'tracking', 'completed', 'variance_reported', 'variance_pending_reason'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kitchen_variance_logs (
    id SERIAL PRIMARY KEY,
    portion_tracking_id INTEGER REFERENCES kitchen_portion_tracking(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    variance_type VARCHAR(50), -- 'yield_low', 'yield_high', 'wastage'
    variance_amount DECIMAL(10,3) NOT NULL,
    reason TEXT,
    corrective_action TEXT,
    reported_by UUID REFERENCES users(id),
    reported_at TIMESTAMP DEFAULT NOW(),
    approval_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_k_variance_logs_tracking ON kitchen_variance_logs(portion_tracking_id);

-- =====================================================
-- 4. HELPER FUNCTIONS (RPCs)
-- =====================================================

-- Generate Ledger Number
CREATE OR REPLACE FUNCTION generate_kitchen_ledger_number()
RETURNS TEXT AS $$
DECLARE
  new_no TEXT;
BEGIN
  new_no := 'KL' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(COALESCE((SELECT COUNT(*) FROM kitchen_ledger_entries WHERE entry_date = CURRENT_DATE), 0) + 1, 4, '0');
  RETURN new_no;
END;
$$ LANGUAGE plpgsql;

-- Generate Receipt Number
CREATE OR REPLACE FUNCTION generate_kitchen_receipt_number()
RETURNS TEXT AS $$
DECLARE
  new_no TEXT;
BEGIN
  new_no := 'KR' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(COALESCE((SELECT COUNT(*) FROM kitchen_store_receipts WHERE receipt_date::DATE = CURRENT_DATE), 0) + 1, 4, '0');
  RETURN new_no;
END;
$$ LANGUAGE plpgsql;

-- Generate Portion Tracking Number
CREATE OR REPLACE FUNCTION generate_portion_tracking_number()
RETURNS TEXT AS $$
DECLARE
  new_no TEXT;
BEGIN
  new_no := 'PT' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(COALESCE((SELECT COUNT(*) FROM kitchen_portion_tracking WHERE tracking_date = CURRENT_DATE), 0) + 1, 4, '0');
  RETURN new_no;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

ALTER TABLE kitchen_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_store_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_store_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_portion_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_variance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kitchen staff can manage ledger" ON kitchen_ledger_entries
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('super_admin', 'manager', 'restaurant', 'kitchen_operations')));

CREATE POLICY "Kitchen staff can manage receipts" ON kitchen_store_receipts
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('super_admin', 'manager', 'restaurant', 'kitchen_operations', 'storekeeper')));

CREATE POLICY "Kitchen staff can manage receipt items" ON kitchen_store_receipt_items
  FOR ALL USING (EXISTS (SELECT 1 FROM kitchen_store_receipts WHERE id = receipt_id));

CREATE POLICY "Kitchen staff can manage portion tracking" ON kitchen_portion_tracking
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('super_admin', 'manager', 'restaurant', 'kitchen_operations')));

CREATE POLICY "Kitchen staff can manage variance logs" ON kitchen_variance_logs
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('super_admin', 'manager', 'restaurant', 'kitchen_operations', 'auditor')));

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE kitchen_ledger_entries IS 'Manual daily ledger entries for kitchen inventory reconciliation';
COMMENT ON TABLE kitchen_store_receipts IS 'Records of items received from the main store into the kitchen';
COMMENT ON TABLE kitchen_portion_tracking IS 'Tracks the yield of raw ingredients into usable portions';
COMMENT ON TABLE kitchen_variance_logs IS 'Accountability logs for yield variances and wastage';
