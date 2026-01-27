-- ============================================================
-- FAMOUS GATE HOTEL - KITCHEN USAGE TRACKING
-- Track how received items are consumed in the kitchen
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PART 1: KITCHEN USAGE TYPES ENUM
-- ============================================================

DO $$ BEGIN
    CREATE TYPE kitchen_usage_type AS ENUM (
        'CONSUMED',      -- Used by chef for cooking
        'SPOILT',        -- Item got spoiled
        'LOST',          -- Item was lost
        'DAMAGED',       -- Item was damaged
        'EXPIRED',       -- Item expired before use
        'RETURNED',      -- Returned to central store
        'ADJUSTMENT'     -- Stock adjustment
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PART 2: KITCHEN USAGE RECORDS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS kitchen_usage_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Reference to dispatch/receipt
    dispatch_id UUID REFERENCES dispatch_notes(id),
    receipt_reference VARCHAR(50),  -- Can link to a receipt batch
    
    -- Location
    branch_id INT NOT NULL REFERENCES branches(id),
    
    -- Item details
    item_sku VARCHAR(50) NOT NULL,
    
    -- Quantities
    received_quantity INT NOT NULL,          -- Original quantity received
    consumed_quantity INT DEFAULT 0,         -- Used in cooking
    spoilt_quantity INT DEFAULT 0,           -- Got spoiled
    lost_quantity INT DEFAULT 0,             -- Lost/missing
    damaged_quantity INT DEFAULT 0,          -- Damaged
    expired_quantity INT DEFAULT 0,          -- Expired
    returned_quantity INT DEFAULT 0,         -- Returned to store
    
    -- Computed remaining (for quick access)
    remaining_quantity INT GENERATED ALWAYS AS (
        received_quantity - consumed_quantity - spoilt_quantity - 
        lost_quantity - damaged_quantity - expired_quantity - returned_quantity
    ) STORED,
    
    -- Financial impact
    unit_cost DECIMAL(10,2) DEFAULT 0,
    expected_revenue DECIMAL(12,2) DEFAULT 0,  -- What this should have generated
    actual_revenue DECIMAL(12,2) DEFAULT 0,    -- What it actually generated
    loss_value DECIMAL(12,2) GENERATED ALWAYS AS (
        (spoilt_quantity + lost_quantity + damaged_quantity + expired_quantity) * unit_cost
    ) STORED,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PARTIAL, COMPLETED, CLOSED
    
    -- Recording
    recorded_by UUID NOT NULL REFERENCES users(id),
    
    -- Timestamps
    usage_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_usage_branch ON kitchen_usage_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_usage_item ON kitchen_usage_records(item_sku);
CREATE INDEX IF NOT EXISTS idx_kitchen_usage_date ON kitchen_usage_records(usage_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_usage_status ON kitchen_usage_records(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_usage_dispatch ON kitchen_usage_records(dispatch_id);

-- ============================================================
-- PART 3: KITCHEN USAGE DETAIL ENTRIES (Individual transactions)
-- ============================================================

CREATE TABLE IF NOT EXISTS kitchen_usage_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Parent record
    usage_record_id UUID NOT NULL REFERENCES kitchen_usage_records(id) ON DELETE CASCADE,
    
    -- Usage type
    usage_type VARCHAR(20) NOT NULL,  -- CONSUMED, SPOILT, LOST, DAMAGED, EXPIRED, RETURNED
    
    -- Quantity
    quantity INT NOT NULL CHECK (quantity > 0),
    
    -- Staff accountability
    responsible_staff_id UUID REFERENCES users(id),  -- Who used/lost/spoiled it
    responsible_staff_name VARCHAR(100),             -- Cached for reporting
    
    -- Details
    reason TEXT,
    notes TEXT,
    
    -- For consumed items - what was produced
    produced_item VARCHAR(100),      -- e.g., "Grilled Chicken"
    portions_produced INT,           -- How many portions made
    
    -- Timestamps
    entry_date DATE DEFAULT CURRENT_DATE,
    entry_time TIME DEFAULT CURRENT_TIME,
    recorded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_entry_record ON kitchen_usage_entries(usage_record_id);
CREATE INDEX IF NOT EXISTS idx_usage_entry_type ON kitchen_usage_entries(usage_type);
CREATE INDEX IF NOT EXISTS idx_usage_entry_staff ON kitchen_usage_entries(responsible_staff_id);
CREATE INDEX IF NOT EXISTS idx_usage_entry_date ON kitchen_usage_entries(entry_date);

-- ============================================================
-- PART 4: STAFF ACCOUNTABILITY SUMMARY (Aggregate view)
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_usage_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Staff member
    staff_id UUID NOT NULL REFERENCES users(id),
    branch_id INT NOT NULL REFERENCES branches(id),
    
    -- Period
    period_month VARCHAR(7) NOT NULL,  -- YYYY-MM format
    
    -- Aggregates
    total_items_used INT DEFAULT 0,
    total_items_spoilt INT DEFAULT 0,
    total_items_lost INT DEFAULT 0,
    total_items_damaged INT DEFAULT 0,
    
    -- Financial impact
    total_value_used DECIMAL(12,2) DEFAULT 0,
    total_loss_value DECIMAL(12,2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique per staff per month per branch
    CONSTRAINT unique_staff_period UNIQUE (staff_id, branch_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_staff_summary_staff ON staff_usage_summary(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_summary_branch ON staff_usage_summary(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_summary_period ON staff_usage_summary(period_month);

-- ============================================================
-- PART 5: TRIGGER TO UPDATE USAGE RECORD TOTALS
-- ============================================================

CREATE OR REPLACE FUNCTION update_kitchen_usage_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the parent record totals
    IF TG_OP = 'INSERT' THEN
        UPDATE kitchen_usage_records
        SET 
            consumed_quantity = consumed_quantity + CASE WHEN NEW.usage_type = 'CONSUMED' THEN NEW.quantity ELSE 0 END,
            spoilt_quantity = spoilt_quantity + CASE WHEN NEW.usage_type = 'SPOILT' THEN NEW.quantity ELSE 0 END,
            lost_quantity = lost_quantity + CASE WHEN NEW.usage_type = 'LOST' THEN NEW.quantity ELSE 0 END,
            damaged_quantity = damaged_quantity + CASE WHEN NEW.usage_type = 'DAMAGED' THEN NEW.quantity ELSE 0 END,
            expired_quantity = expired_quantity + CASE WHEN NEW.usage_type = 'EXPIRED' THEN NEW.quantity ELSE 0 END,
            returned_quantity = returned_quantity + CASE WHEN NEW.usage_type = 'RETURNED' THEN NEW.quantity ELSE 0 END,
            updated_at = NOW()
        WHERE id = NEW.usage_record_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_usage_totals ON kitchen_usage_entries;
CREATE TRIGGER trg_update_usage_totals
AFTER INSERT ON kitchen_usage_entries
FOR EACH ROW
EXECUTE FUNCTION update_kitchen_usage_totals();

-- ============================================================
-- PART 6: TRIGGER TO UPDATE STAFF SUMMARY
-- ============================================================

CREATE OR REPLACE FUNCTION update_staff_usage_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_period VARCHAR(7);
    v_branch_id INT;
    v_unit_cost DECIMAL(10,2);
BEGIN
    IF NEW.responsible_staff_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    v_period := TO_CHAR(NEW.entry_date, 'YYYY-MM');
    
    -- Get branch_id and unit_cost from parent record
    SELECT branch_id, unit_cost INTO v_branch_id, v_unit_cost
    FROM kitchen_usage_records WHERE id = NEW.usage_record_id;
    
    -- Upsert the summary
    INSERT INTO staff_usage_summary (staff_id, branch_id, period_month)
    VALUES (NEW.responsible_staff_id, v_branch_id, v_period)
    ON CONFLICT (staff_id, branch_id, period_month) DO NOTHING;
    
    -- Update the totals
    UPDATE staff_usage_summary
    SET 
        total_items_used = total_items_used + CASE WHEN NEW.usage_type = 'CONSUMED' THEN NEW.quantity ELSE 0 END,
        total_items_spoilt = total_items_spoilt + CASE WHEN NEW.usage_type = 'SPOILT' THEN NEW.quantity ELSE 0 END,
        total_items_lost = total_items_lost + CASE WHEN NEW.usage_type = 'LOST' THEN NEW.quantity ELSE 0 END,
        total_items_damaged = total_items_damaged + CASE WHEN NEW.usage_type = 'DAMAGED' THEN NEW.quantity ELSE 0 END,
        total_value_used = total_value_used + CASE WHEN NEW.usage_type = 'CONSUMED' THEN NEW.quantity * COALESCE(v_unit_cost, 0) ELSE 0 END,
        total_loss_value = total_loss_value + CASE WHEN NEW.usage_type IN ('SPOILT', 'LOST', 'DAMAGED', 'EXPIRED') THEN NEW.quantity * COALESCE(v_unit_cost, 0) ELSE 0 END,
        updated_at = NOW()
    WHERE staff_id = NEW.responsible_staff_id 
      AND branch_id = v_branch_id 
      AND period_month = v_period;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_staff_summary ON kitchen_usage_entries;
CREATE TRIGGER trg_update_staff_summary
AFTER INSERT ON kitchen_usage_entries
FOR EACH ROW
EXECUTE FUNCTION update_staff_usage_summary();

-- ============================================================
-- PART 7: VIEWS FOR REPORTING
-- ============================================================

-- Drop views if they exist to prevent column rename errors
DROP VIEW IF EXISTS v_kitchen_usage_details;
DROP VIEW IF EXISTS v_staff_accountability;
DROP VIEW IF EXISTS v_daily_kitchen_usage;

-- View: Kitchen usage with item details
CREATE OR REPLACE VIEW v_kitchen_usage_details AS
SELECT 
    kur.id,
    kur.branch_id,
    b.name as branch_name,
    kur.item_sku,
    si.item_name,
    si.category,
    kur.received_quantity,
    kur.consumed_quantity,
    kur.spoilt_quantity,
    kur.lost_quantity,
    kur.damaged_quantity,
    kur.expired_quantity,
    kur.returned_quantity,
    kur.remaining_quantity,
    kur.unit_cost,
    kur.expected_revenue,
    kur.actual_revenue,
    kur.loss_value,
    kur.status,
    kur.usage_date,
    kur.recorded_by,
    u.first_name || ' ' || u.last_name as recorded_by_name,
    kur.created_at
FROM kitchen_usage_records kur
LEFT JOIN branches b ON kur.branch_id = b.id
LEFT JOIN simple_items si ON kur.item_sku = si.sku
LEFT JOIN users u ON kur.recorded_by = u.id
ORDER BY kur.usage_date DESC, kur.created_at DESC;

-- View: Staff accountability report
CREATE OR REPLACE VIEW v_staff_accountability AS
SELECT 
    sus.id,
    sus.staff_id,
    u.first_name || ' ' || u.last_name as staff_name,
    u.email as staff_email,
    sus.branch_id,
    b.name as branch_name,
    sus.period_month,
    sus.total_items_used,
    sus.total_items_spoilt,
    sus.total_items_lost,
    sus.total_items_damaged,
    (sus.total_items_spoilt + sus.total_items_lost + sus.total_items_damaged) as total_wastage,
    sus.total_value_used,
    sus.total_loss_value,
    CASE 
        WHEN sus.total_items_used > 0 
        THEN ROUND((sus.total_items_spoilt + sus.total_items_lost + sus.total_items_damaged)::DECIMAL / sus.total_items_used * 100, 2)
        ELSE 0 
    END as wastage_percentage
FROM staff_usage_summary sus
LEFT JOIN users u ON sus.staff_id = u.id
LEFT JOIN branches b ON sus.branch_id = b.id
ORDER BY sus.period_month DESC, sus.total_loss_value DESC;

-- View: Daily usage summary
CREATE OR REPLACE VIEW v_daily_kitchen_usage AS
SELECT 
    kur.usage_date,
    kur.branch_id,
    b.name as branch_name,
    COUNT(DISTINCT kur.item_sku) as items_tracked,
    SUM(kur.received_quantity) as total_received,
    SUM(kur.consumed_quantity) as total_consumed,
    SUM(kur.spoilt_quantity) as total_spoilt,
    SUM(kur.lost_quantity) as total_lost,
    SUM(kur.damaged_quantity) as total_damaged,
    SUM(kur.loss_value) as total_loss_value,
    SUM(kur.expected_revenue) as total_expected_revenue,
    SUM(kur.actual_revenue) as total_actual_revenue
FROM kitchen_usage_records kur
LEFT JOIN branches b ON kur.branch_id = b.id
GROUP BY kur.usage_date, kur.branch_id, b.name
ORDER BY kur.usage_date DESC;

-- ============================================================
-- PART 8: SEQUENCE FOR USAGE RECORD NUMBERS
-- ============================================================

CREATE OR REPLACE FUNCTION get_kitchen_usage_number()
RETURNS VARCHAR(30) AS $$
BEGIN
    RETURN get_next_simple_sequence('KITCHEN_USAGE', 'FGH-KU');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 9: GRANTS
-- ============================================================

GRANT ALL ON kitchen_usage_records TO authenticated;
GRANT ALL ON kitchen_usage_entries TO authenticated;
GRANT ALL ON staff_usage_summary TO authenticated;
GRANT SELECT ON v_kitchen_usage_details TO authenticated;
GRANT SELECT ON v_staff_accountability TO authenticated;
GRANT SELECT ON v_daily_kitchen_usage TO authenticated;
GRANT EXECUTE ON FUNCTION get_kitchen_usage_number() TO authenticated;

-- ============================================================
-- DONE! Tables Created:
-- - kitchen_usage_records (main usage tracking per item batch)
-- - kitchen_usage_entries (individual usage transactions)
-- - staff_usage_summary (aggregated staff accountability)
-- - Views for reporting
-- ============================================================
