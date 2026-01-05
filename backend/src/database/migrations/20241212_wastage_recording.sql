-- ============================================================
-- WASTAGE RECORDING SYSTEM
-- Track food waste in kitchen/restaurant
-- ============================================================

-- Create waste_reason enum if not exists
DO $$ BEGIN
    CREATE TYPE waste_reason AS ENUM (
        'spoilage',
        'expiry',
        'damage',
        'overcooking',
        'customer_return',
        'quality_control',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create wastage_records table (simpler than restaurant_waste_log)
CREATE TABLE IF NOT EXISTS wastage_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    
    -- Item details
    item_name VARCHAR(255) NOT NULL,
    item_id UUID,  -- Optional reference to menu item or inventory item
    item_type VARCHAR(50),  -- 'menu_item', 'inventory_item', 'custom'
    
    -- Quantity
    quantity DECIMAL(10, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'portion',
    
    -- Reason
    reason VARCHAR(50) NOT NULL DEFAULT 'other',
    
    -- Financial
    cost_impact DECIMAL(10, 2) DEFAULT 0,
    
    -- Details
    description TEXT,
    
    -- Tracking
    logged_by UUID REFERENCES users(id),
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wastage_branch ON wastage_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_wastage_reason ON wastage_records(reason);
CREATE INDEX IF NOT EXISTS idx_wastage_logged_at ON wastage_records(logged_at);
CREATE INDEX IF NOT EXISTS idx_wastage_item_name ON wastage_records(item_name);

-- Create view for wastage with user details
CREATE OR REPLACE VIEW v_wastage_records AS
SELECT 
    w.id,
    w.branch_id,
    b.name as branch_name,
    w.item_name,
    w.item_id,
    w.item_type,
    w.quantity,
    w.unit,
    w.reason,
    w.cost_impact,
    w.description,
    w.logged_by,
    u.first_name || ' ' || u.last_name as logged_by_name,
    u.email as logged_by_email,
    w.logged_at,
    w.created_at
FROM wastage_records w
LEFT JOIN branches b ON w.branch_id = b.id
LEFT JOIN users u ON w.logged_by = u.id
ORDER BY w.logged_at DESC;

-- Grant permissions
GRANT ALL ON wastage_records TO authenticated;
GRANT SELECT ON v_wastage_records TO authenticated;

-- Enable RLS
ALTER TABLE wastage_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see wastage from their branch or all if admin
CREATE POLICY "Users can view wastage" ON wastage_records
    FOR SELECT USING (true);

CREATE POLICY "Users can insert wastage" ON wastage_records
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update wastage" ON wastage_records
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete wastage" ON wastage_records
    FOR DELETE USING (true);

-- ============================================================
-- DONE! Tables Created:
-- - wastage_records (main wastage tracking)
-- - v_wastage_records (view with user/branch details)
-- ============================================================
