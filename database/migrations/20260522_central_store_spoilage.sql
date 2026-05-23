-- ============================================================
-- CENTRAL STORE SPOILAGE LOG
-- Track spoilage events in central store with atomic stock deduction
-- ============================================================

-- Create spoilage reason enum if not exists
DO $$ BEGIN
    CREATE TYPE spoilage_reason AS ENUM (
        'EXPIRED',
        'DAMAGED',
        'SPOILED',
        'QUALITY_ISSUE',
        'THEFT',
        'BREAKAGE',
        'CONTAMINATION',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create central_spoilage_log table
CREATE TABLE IF NOT EXISTS central_spoilage_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Reference
    spoilage_number VARCHAR(30) UNIQUE NOT NULL,
    
    -- Item details (references simple_items)
    item_sku VARCHAR(100) NOT NULL REFERENCES simple_items(sku) ON DELETE RESTRICT,
    item_name VARCHAR(255) NOT NULL,
    store_type TEXT NOT NULL CHECK (store_type IN ('foodstuffs', 'bar_store')),
    category VARCHAR(100),
    
    -- Quantity and cost
    quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_loss DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    
    -- Reason and details
    reason spoilage_reason NOT NULL,
    reason_details TEXT,
    disposal_method VARCHAR(50),
    
    -- Approval workflow
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Audit
    recorded_by UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    
    -- Timestamps
    spoilage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_central_spoilage_sku ON central_spoilage_log(item_sku);
CREATE INDEX IF NOT EXISTS idx_central_spoilage_store_type ON central_spoilage_log(store_type);
CREATE INDEX IF NOT EXISTS idx_central_spoilage_reason ON central_spoilage_log(reason);
CREATE INDEX IF NOT EXISTS idx_central_spoilage_status ON central_spoilage_log(status);
CREATE INDEX IF NOT EXISTS idx_central_spoilage_date ON central_spoilage_log(spoilage_date DESC);
CREATE INDEX IF NOT EXISTS idx_central_spoilage_recorded_by ON central_spoilage_log(recorded_by);

-- Create view with item details
CREATE OR REPLACE VIEW v_central_spoilage_log AS
SELECT 
    csl.id,
    csl.spoilage_number,
    csl.item_sku,
    csl.item_name,
    csl.store_type,
    csl.category,
    csl.quantity,
    csl.unit,
    csl.unit_cost,
    csl.total_loss,
    csl.reason,
    csl.reason_details,
    csl.disposal_method,
    csl.status,
    csl.approved_by,
    csl.approved_at,
    csl.rejection_reason,
    csl.recorded_by,
    u1.first_name || ' ' || u1.last_name as recorded_by_name,
    csl.notes,
    csl.spoilage_date,
    csl.created_at,
    csl.updated_at,
    si.quantity as current_stock
FROM central_spoilage_log csl
LEFT JOIN users u1 ON csl.recorded_by = u1.id
LEFT JOIN simple_items si ON csl.item_sku = si.sku
ORDER BY csl.created_at DESC;

-- Enable RLS
ALTER TABLE central_spoilage_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view central spoilage" ON central_spoilage_log
    FOR SELECT USING (true);

CREATE POLICY "Central storekeepers can insert spoilage" ON central_spoilage_log
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'general_manager', 'central_storekeeper', 'auditor')
        )
    );

CREATE POLICY "Managers can approve/reject spoilage" ON central_spoilage_log
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'general_manager', 'auditor')
        )
    );

-- Function to generate spoilage number
CREATE OR REPLACE FUNCTION get_spoilage_number()
RETURNS VARCHAR(30) AS $$
DECLARE
    v_date_str VARCHAR(8);
    v_seq INT;
    v_spoilage_num VARCHAR(30);
BEGIN
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Get next sequence for the day
    WITH seq AS (
        SELECT COUNT(*) + 1 as next_seq
        FROM central_spoilage_log
        WHERE spoilage_number LIKE 'FGH-SPL-' || v_date_str || '%'
    )
    SELECT next_seq INTO v_seq FROM seq;
    
    v_spoilage_num := 'FGH-SPL-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_spoilage_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_central_spoilage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_central_spoilage_timestamp ON central_spoilage_log;
CREATE TRIGGER trigger_update_central_spoilage_timestamp
    BEFORE UPDATE ON central_spoilage_log
    FOR EACH ROW
    EXECUTE FUNCTION update_central_spoilage_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON central_spoilage_log TO authenticated;
GRANT SELECT ON v_central_spoilage_log TO authenticated;
GRANT EXECUTE ON FUNCTION get_spoilage_number() TO authenticated;

-- ============================================================
-- DONE! Tables Created:
-- - central_spoilage_log (main spoilage tracking)
-- - v_central_spoilage_log (view with user/item details)
-- ============================================================
