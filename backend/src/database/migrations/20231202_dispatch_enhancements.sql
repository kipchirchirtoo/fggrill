-- ============================================================
-- FAMOUS GATE HOTEL - DISPATCH ENHANCEMENTS
-- Additional fields for vehicle tracking and delivery management
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PART 1: VEHICLES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic Info
    registration_number VARCHAR(20) NOT NULL UNIQUE,
    make VARCHAR(50),
    model VARCHAR(50),
    year INT,
    type VARCHAR(30),  -- VAN, TRUCK, MOTORCYCLE, CAR
    
    -- Capacity
    capacity_kg DECIMAL(10,2),
    capacity_volume VARCHAR(50),  -- e.g., "5 cubic meters"
    
    -- Status
    status VARCHAR(20) DEFAULT 'AVAILABLE',  -- AVAILABLE, IN_USE, MAINTENANCE, RETIRED
    current_location VARCHAR(100),
    
    -- Insurance & Compliance
    insurance_expiry DATE,
    inspection_expiry DATE,
    
    -- Tracking
    last_used TIMESTAMPTZ,
    total_trips INT DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_reg ON vehicles(registration_number);

-- ============================================================
-- PART 2: DRIVERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS drivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Link to user (optional - can be external driver)
    user_id UUID REFERENCES users(id),
    
    -- Basic Info
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    alt_phone VARCHAR(20),
    email VARCHAR(100),
    
    -- License Info
    license_number VARCHAR(50),
    license_expiry DATE,
    license_class VARCHAR(10),  -- B, C, CE, etc.
    
    -- Employment
    employment_type VARCHAR(20) DEFAULT 'PERMANENT',  -- PERMANENT, CONTRACT, CASUAL
    branch_id INT REFERENCES branches(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, INACTIVE, ON_LEAVE, TERMINATED
    
    -- Performance
    total_deliveries INT DEFAULT 0,
    total_distance_km DECIMAL(10,2) DEFAULT 0,
    rating DECIMAL(3,2),
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_branch ON drivers(branch_id);

-- ============================================================
-- PART 3: ENHANCE DISPATCH_NOTES
-- ============================================================

-- Add vehicle and logistics fields
ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id);
ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id);
ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS route_distance_km DECIMAL(10,2);
ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS fuel_cost DECIMAL(10,2);
ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS delivery_signature TEXT;  -- Base64 signature
ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS delivery_photo TEXT;       -- Photo URL
ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS gps_coordinates_pickup VARCHAR(50);
ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS gps_coordinates_delivery VARCHAR(50);
ALTER TABLE dispatch_notes ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'NORMAL';  -- LOW, NORMAL, HIGH, URGENT

-- ============================================================
-- PART 4: DISPATCH TRACKING LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatch_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID NOT NULL REFERENCES dispatch_notes(id) ON DELETE CASCADE,
    
    -- Status change
    status VARCHAR(30) NOT NULL,
    previous_status VARCHAR(30),
    
    -- Location
    location VARCHAR(100),
    gps_coordinates VARCHAR(50),
    
    -- Notes
    notes TEXT,
    
    -- Who recorded
    recorded_by UUID REFERENCES users(id),
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_tracking_dispatch ON dispatch_tracking(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_tracking_date ON dispatch_tracking(created_at);

-- ============================================================
-- PART 5: DELIVERY SCHEDULES
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Branch
    branch_id INT NOT NULL REFERENCES branches(id),
    
    -- Schedule Info
    day_of_week INT,  -- 0=Sunday, 6=Saturday
    delivery_time TIME,
    cutoff_time TIME,  -- Order cutoff for that delivery
    
    -- Assignment
    default_vehicle_id UUID REFERENCES vehicles(id),
    default_driver_id UUID REFERENCES drivers(id),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_branch_day UNIQUE (branch_id, day_of_week)
);

-- ============================================================
-- PART 6: DISPATCH ITEMS ENHANCEMENTS
-- ============================================================

-- Add more tracking fields to dispatch_items
ALTER TABLE dispatch_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2);
ALTER TABLE dispatch_items ADD COLUMN IF NOT EXISTS total_value DECIMAL(12,2);
ALTER TABLE dispatch_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE dispatch_items ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE dispatch_items ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id);

-- ============================================================
-- PART 7: RETURNS TABLE (For damaged/rejected items)
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatch_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    return_number VARCHAR(30) NOT NULL UNIQUE,  -- FGH-RET-20251127-0001
    
    -- Link to dispatch
    dispatch_id UUID NOT NULL REFERENCES dispatch_notes(id),
    dispatch_item_id UUID REFERENCES dispatch_items(id),
    
    -- Branch
    from_branch_id INT NOT NULL REFERENCES branches(id),
    to_branch_id INT NOT NULL REFERENCES branches(id),  -- Usually central
    
    -- Item
    item_sku VARCHAR(50) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    
    -- Reason
    return_type VARCHAR(30) NOT NULL,  -- DAMAGED, EXPIRED, WRONG_ITEM, EXCESS, QUALITY
    reason TEXT,
    condition VARCHAR(20),  -- RESELLABLE, DAMAGED, DESTROYED
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, IN_TRANSIT, RECEIVED, PROCESSED, REJECTED
    
    -- Processing
    created_by UUID NOT NULL REFERENCES users(id),
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    
    -- Financials
    credit_amount DECIMAL(10,2),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_dispatch ON dispatch_returns(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON dispatch_returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_branch ON dispatch_returns(from_branch_id);

-- ============================================================
-- PART 8: VIEWS
-- ============================================================

-- View: Dispatch summary with vehicle/driver info
CREATE OR REPLACE VIEW v_dispatch_summary AS
SELECT 
    dn.id,
    dn.dispatch_number,
    dn.status,
    dn.priority,
    fb.name as from_branch,
    tb.name as to_branch,
    v.registration_number as vehicle,
    d.name as driver_name,
    d.phone as driver_phone,
    dn.created_at,
    dn.dispatched_at,
    dn.estimated_delivery,
    dn.delivered_at,
    COUNT(di.id) as items_count,
    SUM(di.dispatched_quantity) as total_quantity,
    SUM(di.total_value) as total_value
FROM dispatch_notes dn
JOIN branches fb ON dn.from_branch_id = fb.id
JOIN branches tb ON dn.to_branch_id = tb.id
LEFT JOIN vehicles v ON dn.vehicle_id = v.id
LEFT JOIN drivers d ON dn.driver_id = d.id
LEFT JOIN dispatch_items di ON dn.id = di.dispatch_id
GROUP BY dn.id, dn.dispatch_number, dn.status, dn.priority, fb.name, tb.name, 
         v.registration_number, d.name, d.phone, dn.created_at, dn.dispatched_at,
         dn.estimated_delivery, dn.delivered_at;

-- View: Vehicle utilization
CREATE OR REPLACE VIEW v_vehicle_utilization AS
SELECT 
    v.id,
    v.registration_number,
    v.make,
    v.model,
    v.status,
    v.total_trips,
    COUNT(dn.id) as recent_dispatches,
    MAX(dn.dispatched_at) as last_dispatch,
    SUM(dn.route_distance_km) as total_distance
FROM vehicles v
LEFT JOIN dispatch_notes dn ON v.id = dn.vehicle_id 
    AND dn.dispatched_at > NOW() - INTERVAL '30 days'
GROUP BY v.id, v.registration_number, v.make, v.model, v.status, v.total_trips;

-- View: Driver performance
CREATE OR REPLACE VIEW v_driver_performance AS
SELECT 
    d.id,
    d.name,
    d.phone,
    d.status,
    d.total_deliveries,
    COUNT(dn.id) FILTER (WHERE dn.status = 'CONFIRMED') as confirmed_deliveries,
    COUNT(dn.id) FILTER (WHERE dn.status = 'DISPUTED') as disputed_deliveries,
    AVG(EXTRACT(EPOCH FROM (dn.delivered_at - dn.dispatched_at))/3600) as avg_delivery_hours
FROM drivers d
LEFT JOIN dispatch_notes dn ON d.id = dn.driver_id
GROUP BY d.id, d.name, d.phone, d.status, d.total_deliveries;

-- ============================================================
-- PART 9: FUNCTION FOR RETURN NUMBER
-- ============================================================

CREATE OR REPLACE FUNCTION get_return_number()
RETURNS VARCHAR(30) AS $$
DECLARE
    v_date DATE := CURRENT_DATE;
    v_date_str VARCHAR(8);
    v_seq INT;
    v_result VARCHAR(30);
BEGIN
    v_date_str := TO_CHAR(v_date, 'YYYYMMDD');
    
    INSERT INTO simple_sequences (sequence_name, sequence_date, current_number)
    VALUES ('RETURN', v_date, 1)
    ON CONFLICT (sequence_name, sequence_date) 
    DO UPDATE SET current_number = simple_sequences.current_number + 1
    RETURNING current_number INTO v_seq;
    
    v_result := 'FGH-RET-' || v_date_str || '-' || LPAD(v_seq::TEXT, 4, '0');
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PART 10: GRANTS
-- ============================================================

GRANT ALL ON vehicles TO authenticated;
GRANT ALL ON drivers TO authenticated;
GRANT ALL ON dispatch_tracking TO authenticated;
GRANT ALL ON delivery_schedules TO authenticated;
GRANT ALL ON dispatch_returns TO authenticated;

GRANT SELECT ON v_dispatch_summary TO authenticated;
GRANT SELECT ON v_vehicle_utilization TO authenticated;
GRANT SELECT ON v_driver_performance TO authenticated;

GRANT EXECUTE ON FUNCTION get_return_number() TO authenticated;

-- ============================================================
-- SAMPLE DATA: Add some vehicles and drivers
-- ============================================================

-- Insert sample vehicles (uncomment to use)
/*
INSERT INTO vehicles (registration_number, make, model, year, type, capacity_kg, status) VALUES
('KCN 123A', 'Toyota', 'Hiace', 2020, 'VAN', 1500, 'AVAILABLE'),
('KCN 456B', 'Isuzu', 'NKR', 2019, 'TRUCK', 3000, 'AVAILABLE'),
('KCN 789C', 'Honda', 'CG125', 2021, 'MOTORCYCLE', 100, 'AVAILABLE');

INSERT INTO drivers (name, phone, license_number, status) VALUES
('John Kipchoge', '+254712345678', 'DL123456', 'ACTIVE'),
('Mary Wanjiku', '+254723456789', 'DL234567', 'ACTIVE'),
('Peter Ochieng', '+254734567890', 'DL345678', 'ACTIVE');
*/

-- ============================================================
-- DONE! Tables Created:
-- - vehicles (company vehicles)
-- - drivers (delivery personnel)
-- - dispatch_tracking (status history)
-- - delivery_schedules (recurring schedules)
-- - dispatch_returns (returns management)
-- Enhanced:
-- - dispatch_notes (vehicle, driver, route fields)
-- - dispatch_items (pricing, receiving fields)
-- ============================================================
