-- ============================================
-- KYOGONG BRANCH SHIFT-BASED POS SYSTEM
-- Migration: 28_kyogong_shift_pos_system.sql
-- Purpose: Implement comprehensive shift-controlled POS system for Kyogong Branch
-- ============================================

-- ============================================
-- 1. SALES POINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sales_points (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    requires_staff_assignment BOOLEAN DEFAULT FALSE,
    supports_petty_cash BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_sales_points_branch ON sales_points(branch_id);
CREATE INDEX idx_sales_points_code ON sales_points(code);

-- Insert Kyogong Branch Sales Points (assuming branch_id = 2 for Kyogong)
-- Note: Adjust branch_id based on your actual Kyogong branch ID
INSERT INTO sales_points (branch_id, code, name, description, requires_staff_assignment, supports_petty_cash) VALUES
(2, 'SPA', 'SPA Cashier', 'Massage, Waxing, Nail Parlour, Saloon, Sauna, Kinyozi', FALSE, FALSE),
(2, 'EXEC_BAR', 'Executive Bar Cashier', 'Bar sales, Restaurant sales with assigned staff', TRUE, FALSE),
(2, 'SPORTS_BAR', 'Sports Bar Cashier', 'Bar sales, Restaurant sales, Pool Tokens', TRUE, FALSE),
(2, 'RECEPTION', 'Reception/Overall Cashier', 'Restaurant, Car wash, Swimming, Rooms, Conference, Quadbikes, Petty Cash', FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. CASHIER SHIFTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cashier_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_number TEXT UNIQUE NOT NULL,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    sales_point_id INTEGER REFERENCES sales_points(id) NOT NULL,
    cashier_id UUID REFERENCES users(id) NOT NULL,
    
    -- Shift timing
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- Opening balances
    opening_cash_float DECIMAL(10,2) NOT NULL DEFAULT 0,
    opening_petty_cash DECIMAL(10,2) DEFAULT 0,
    
    -- Closing balances
    closing_cash_counted DECIMAL(10,2),
    closing_petty_cash DECIMAL(10,2),
    
    -- Sales summary
    total_sales DECIMAL(10,2) DEFAULT 0,
    cash_sales DECIMAL(10,2) DEFAULT 0,
    mpesa_sales DECIMAL(10,2) DEFAULT 0,
    card_sales DECIMAL(10,2) DEFAULT 0,
    
    -- Reconciliation
    cash_expected DECIMAL(10,2),
    cash_variance DECIMAL(10,2),
    variance_reason TEXT,
    
    -- Status
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'RECONCILED', 'APPROVED', 'FLAGGED')),
    
    -- Approval workflow
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_shift_times CHECK (closed_at IS NULL OR closed_at > opened_at)
);

-- Create indexes
CREATE INDEX idx_shifts_branch ON cashier_shifts(branch_id);
CREATE INDEX idx_shifts_cashier ON cashier_shifts(cashier_id);
CREATE INDEX idx_shifts_status ON cashier_shifts(status);
CREATE INDEX idx_shifts_opened_at ON cashier_shifts(opened_at);
CREATE INDEX idx_shifts_sales_point ON cashier_shifts(sales_point_id);

-- ============================================
-- 3. SHIFT STAFF ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shift_staff_assignments (
    id SERIAL PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) NOT NULL,
    staff_role TEXT NOT NULL CHECK (staff_role IN ('WAITER', 'BARTENDER', 'SERVICE_STAFF')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(shift_id, staff_id)
);

CREATE INDEX idx_staff_assignments_shift ON shift_staff_assignments(shift_id);
CREATE INDEX idx_staff_assignments_staff ON shift_staff_assignments(staff_id);

-- ============================================
-- 4. SPA SERVICES CATALOG
-- ============================================
CREATE TABLE IF NOT EXISTS spa_services (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    category TEXT NOT NULL CHECK (category IN ('MASSAGE', 'WAXING', 'NAIL', 'SALOON', 'SAUNA', 'KINYOZI')),
    name TEXT NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_spa_services_branch ON spa_services(branch_id);
CREATE INDEX idx_spa_services_category ON spa_services(category);

-- Insert sample SPA services for Kyogong
INSERT INTO spa_services (branch_id, category, name, base_price, duration_minutes) VALUES
(2, 'MASSAGE', 'Full Body Massage', 2500, 60),
(2, 'MASSAGE', 'Back Massage', 1500, 30),
(2, 'MASSAGE', 'Foot Massage', 1000, 30),
(2, 'WAXING', 'Full Body Waxing', 3000, 90),
(2, 'WAXING', 'Leg Waxing', 1000, 30),
(2, 'WAXING', 'Arm Waxing', 800, 20),
(2, 'NAIL', 'Manicure', 800, 45),
(2, 'NAIL', 'Pedicure', 1000, 45),
(2, 'NAIL', 'Gel Nails', 1500, 60),
(2, 'SALOON', 'Hair Cut (Ladies)', 500, 30),
(2, 'SALOON', 'Hair Styling', 1500, 60),
(2, 'SALOON', 'Hair Treatment', 2000, 90),
(2, 'SAUNA', 'Sauna Session (30 min)', 1000, 30),
(2, 'SAUNA', 'Sauna Session (60 min)', 1500, 60),
(2, 'KINYOZI', 'Hair Cut (Gents)', 300, 20),
(2, 'KINYOZI', 'Shave', 200, 15),
(2, 'KINYOZI', 'Hair Cut + Shave', 450, 30)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. POOL TOKENS INVENTORY
-- ============================================
CREATE TABLE IF NOT EXISTS pool_tokens_inventory (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    shift_id UUID REFERENCES cashier_shifts(id),
    
    -- Token tracking
    opening_balance INTEGER NOT NULL DEFAULT 0,
    tokens_received INTEGER DEFAULT 0,
    tokens_sold INTEGER DEFAULT 0,
    tokens_issued INTEGER DEFAULT 0, -- Complimentary/promotional
    closing_balance INTEGER,
    variance INTEGER,
    variance_reason TEXT,
    
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(branch_id, shift_id)
);

CREATE INDEX idx_pool_tokens_branch ON pool_tokens_inventory(branch_id);
CREATE INDEX idx_pool_tokens_shift ON pool_tokens_inventory(shift_id);
CREATE INDEX idx_pool_tokens_date ON pool_tokens_inventory(date);

-- ============================================
-- 6. PETTY CASH LEDGER
-- ============================================
CREATE TABLE IF NOT EXISTS petty_cash_ledger (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    shift_id UUID REFERENCES cashier_shifts(id),
    
    -- Transaction details
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    amount DECIMAL(10,2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('CASH_IN', 'CASH_OUT')),
    
    -- Purpose details
    purpose_category TEXT NOT NULL CHECK (purpose_category IN ('REPAIRS', 'MAINTENANCE', 'FUEL', 'TRANSPORT', 'SUPPLIES', 'OTHER')),
    purpose_description TEXT NOT NULL,
    
    -- Recipient details
    paid_to_name TEXT,
    paid_to_id_number TEXT,
    
    -- Authorization
    authorized_by UUID REFERENCES users(id),
    authorizer_name TEXT,
    
    -- Supporting documents
    receipt_number TEXT,
    receipt_attachment_url TEXT,
    
    -- Audit
    recorded_by UUID REFERENCES users(id) NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_petty_cash_branch ON petty_cash_ledger(branch_id);
CREATE INDEX idx_petty_cash_shift ON petty_cash_ledger(shift_id);
CREATE INDEX idx_petty_cash_date ON petty_cash_ledger(transaction_date);

-- ============================================
-- 7. DYNAMIC SERVICES (Car Wash, Quadbikes, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS dynamic_services (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    service_type TEXT NOT NULL CHECK (service_type IN ('CAR_WASH', 'SWIMMING', 'BOUNCING_CASTLE', 'QUADBIKE', 'CONFERENCE')),
    name TEXT NOT NULL,
    pricing_model TEXT NOT NULL CHECK (pricing_model IN ('FIXED', 'TIME_BASED', 'VEHICLE_TYPE')),
    base_price DECIMAL(10,2) NOT NULL,
    price_per_hour DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dynamic_services_branch ON dynamic_services(branch_id);
CREATE INDEX idx_dynamic_services_type ON dynamic_services(service_type);

-- Insert sample dynamic services for Kyogong
INSERT INTO dynamic_services (branch_id, service_type, name, pricing_model, base_price, price_per_hour) VALUES
(2, 'CAR_WASH', 'Saloon Car Wash', 'VEHICLE_TYPE', 500, NULL),
(2, 'CAR_WASH', 'SUV/4x4 Wash', 'VEHICLE_TYPE', 800, NULL),
(2, 'CAR_WASH', 'Pickup/Van Wash', 'VEHICLE_TYPE', 700, NULL),
(2, 'SWIMMING', 'Swimming Pool Entry (Adult)', 'FIXED', 300, NULL),
(2, 'SWIMMING', 'Swimming Pool Entry (Child)', 'FIXED', 200, NULL),
(2, 'BOUNCING_CASTLE', 'Bouncing Castle (1 hour)', 'TIME_BASED', 500, 200),
(2, 'QUADBIKE', 'Quadbike Rental (30 min)', 'TIME_BASED', 1000, 500),
(2, 'CONFERENCE', 'Conference Room (Half Day)', 'TIME_BASED', 5000, 1000),
(2, 'CONFERENCE', 'Conference Room (Full Day)', 'FIXED', 8000, NULL)
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. SHIFT TRANSACTIONS (Unified)
-- ============================================
CREATE TABLE IF NOT EXISTS shift_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id) NOT NULL,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    sales_point_id INTEGER REFERENCES sales_points(id) NOT NULL,
    
    -- Transaction details
    transaction_number TEXT UNIQUE NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('SALE', 'REFUND', 'VOID')),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Service/Product details
    service_category TEXT CHECK (service_category IN ('SPA', 'BAR', 'RESTAURANT', 'POOL_TOKEN', 'DYNAMIC_SERVICE', 'ROOM', 'CONFERENCE')),
    
    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Payment
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'MPESA', 'CARD', 'MIXED')),
    cash_amount DECIMAL(10,2) DEFAULT 0,
    mpesa_amount DECIMAL(10,2) DEFAULT 0,
    card_amount DECIMAL(10,2) DEFAULT 0,
    mpesa_reference TEXT,
    
    -- Customer details
    customer_name TEXT,
    customer_phone TEXT,
    customer_room_number TEXT,
    
    -- Staff
    served_by UUID REFERENCES users(id),
    
    -- Authorization (for voids/discounts)
    requires_authorization BOOLEAN DEFAULT FALSE,
    authorized_by UUID REFERENCES users(id),
    authorization_reason TEXT,
    
    -- Audit
    is_voided BOOLEAN DEFAULT FALSE,
    void_reason TEXT,
    voided_by UUID REFERENCES users(id),
    voided_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shift_trans_shift ON shift_transactions(shift_id);
CREATE INDEX idx_shift_trans_branch ON shift_transactions(branch_id);
CREATE INDEX idx_shift_trans_date ON shift_transactions(transaction_date);
CREATE INDEX idx_shift_trans_number ON shift_transactions(transaction_number);

-- ============================================
-- 9. SHIFT TRANSACTION ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS shift_transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id UUID REFERENCES shift_transactions(id) ON DELETE CASCADE,
    
    -- Item details
    item_type TEXT NOT NULL CHECK (item_type IN ('SPA_SERVICE', 'MENU_ITEM', 'POOL_TOKEN', 'DYNAMIC_SERVICE')),
    item_id TEXT, -- Reference to spa_services, menu_items, etc.
    item_name TEXT NOT NULL,
    
    -- Pricing
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Service staff (for SPA)
    service_staff_id UUID REFERENCES users(id),
    service_staff_name TEXT,
    
    -- Additional details
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shift_trans_items_transaction ON shift_transaction_items(transaction_id);

-- ============================================
-- 10. SHIFT AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS shift_audit_log (
    id SERIAL PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id),
    action TEXT NOT NULL CHECK (action IN ('OPEN', 'CLOSE', 'APPROVE', 'FLAG', 'VOID', 'DISCOUNT', 'EDIT')),
    performed_by UUID REFERENCES users(id) NOT NULL,
    reason TEXT,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shift_audit_shift ON shift_audit_log(shift_id);
CREATE INDEX idx_shift_audit_action ON shift_audit_log(action);
CREATE INDEX idx_shift_audit_date ON shift_audit_log(created_at);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Function to generate shift number
CREATE OR REPLACE FUNCTION generate_shift_number()
RETURNS TRIGGER AS $$
DECLARE
    branch_code TEXT;
    point_code TEXT;
    date_str TEXT;
    seq_num TEXT;
    count INT;
BEGIN
    -- Get branch code (first 3 letters)
    SELECT UPPER(SUBSTRING(name FROM 1 FOR 3)) INTO branch_code
    FROM branches WHERE id = NEW.branch_id;
    
    -- Get sales point code
    SELECT code INTO point_code
    FROM sales_points WHERE id = NEW.sales_point_id;
    
    -- Get date string (YYYYMMDD)
    date_str := TO_CHAR(NEW.opened_at, 'YYYYMMDD');
    
    -- Get sequence number for today
    SELECT COUNT(*) + 1 INTO count
    FROM cashier_shifts
    WHERE branch_id = NEW.branch_id
    AND sales_point_id = NEW.sales_point_id
    AND DATE(opened_at) = DATE(NEW.opened_at);
    
    seq_num := LPAD(count::TEXT, 3, '0');
    
    -- Generate shift number: KYG-SPA-20260218-001
    NEW.shift_number := branch_code || '-' || point_code || '-' || date_str || '-' || seq_num;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate shift number
CREATE TRIGGER trigger_generate_shift_number
BEFORE INSERT ON cashier_shifts
FOR EACH ROW
WHEN (NEW.shift_number IS NULL OR NEW.shift_number = '')
EXECUTE FUNCTION generate_shift_number();

-- Function to update shift totals
CREATE OR REPLACE FUNCTION update_shift_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update shift totals when transaction is added
    UPDATE cashier_shifts
    SET 
        total_sales = COALESCE(total_sales, 0) + NEW.total_amount,
        cash_sales = COALESCE(cash_sales, 0) + NEW.cash_amount,
        mpesa_sales = COALESCE(mpesa_sales, 0) + NEW.mpesa_amount,
        card_sales = COALESCE(card_sales, 0) + NEW.card_amount,
        updated_at = NOW()
    WHERE id = NEW.shift_id
    AND NEW.is_voided = FALSE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update shift totals
CREATE TRIGGER trigger_update_shift_totals
AFTER INSERT ON shift_transactions
FOR EACH ROW
EXECUTE FUNCTION update_shift_totals();

-- Function to calculate cash variance on shift close
CREATE OR REPLACE FUNCTION calculate_cash_variance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CLOSED' AND OLD.status = 'OPEN' THEN
        -- Calculate expected cash
        NEW.cash_expected := NEW.opening_cash_float + NEW.cash_sales;
        
        -- Calculate variance
        NEW.cash_variance := NEW.closing_cash_counted - NEW.cash_expected;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate variance
CREATE TRIGGER trigger_calculate_cash_variance
BEFORE UPDATE ON cashier_shifts
FOR EACH ROW
EXECUTE FUNCTION calculate_cash_variance();

-- Function to log shift actions
CREATE OR REPLACE FUNCTION log_shift_action()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF NEW.status != OLD.status THEN
            INSERT INTO shift_audit_log (shift_id, action, performed_by, old_value, new_value)
            VALUES (
                NEW.id,
                CASE NEW.status
                    WHEN 'CLOSED' THEN 'CLOSE'
                    WHEN 'APPROVED' THEN 'APPROVE'
                    WHEN 'FLAGGED' THEN 'FLAG'
                    ELSE 'EDIT'
                END,
                NEW.cashier_id,
                jsonb_build_object('status', OLD.status),
                jsonb_build_object('status', NEW.status)
            );
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        -- Log shift opening
        INSERT INTO shift_audit_log (shift_id, action, performed_by, new_value)
        VALUES (
            NEW.id,
            'OPEN',
            NEW.cashier_id,
            jsonb_build_object(
                'shift_number', NEW.shift_number,
                'opening_cash_float', NEW.opening_cash_float,
                'opening_petty_cash', NEW.opening_petty_cash
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log actions
CREATE TRIGGER trigger_log_shift_action
AFTER INSERT OR UPDATE ON cashier_shifts
FOR EACH ROW
EXECUTE FUNCTION log_shift_action();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE sales_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE spa_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_tokens_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_audit_log ENABLE ROW LEVEL SECURITY;

-- Sales Points: All authenticated users can view
CREATE POLICY "Sales points are viewable by authenticated users"
ON sales_points FOR SELECT
TO authenticated
USING (true);

-- Cashier Shifts: Cashiers see own shifts, accountants/auditors see all
CREATE POLICY "Cashiers can view own shifts"
ON cashier_shifts FOR SELECT
TO authenticated
USING (
    cashier_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'BRANCH_ACCOUNTANT', 'ACCOUNTANT', 'AUDITOR', 'GENERAL_MANAGER')
    )
);

-- Cashiers can insert their own shifts
CREATE POLICY "Cashiers can open shifts"
ON cashier_shifts FOR INSERT
TO authenticated
WITH CHECK (cashier_id = auth.uid());

-- Cashiers can update their own open shifts
CREATE POLICY "Cashiers can update own shifts"
ON cashier_shifts FOR UPDATE
TO authenticated
USING (
    cashier_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'BRANCH_ACCOUNTANT', 'ACCOUNTANT')
    )
);

-- Similar policies for other tables...
-- (Add more RLS policies as needed for production security)

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE sales_points IS 'Defines sales points/POS terminals for each branch';
COMMENT ON TABLE cashier_shifts IS 'Core shift management table tracking cashier shifts';
COMMENT ON TABLE shift_staff_assignments IS 'Tracks waiters/bartenders assigned to shifts';
COMMENT ON TABLE spa_services IS 'Catalog of SPA services with pricing';
COMMENT ON TABLE pool_tokens_inventory IS 'Tracks pool token inventory per shift';
COMMENT ON TABLE petty_cash_ledger IS 'Records all petty cash transactions';
COMMENT ON TABLE dynamic_services IS 'Configurable services like car wash, quadbikes';
COMMENT ON TABLE shift_transactions IS 'All sales transactions tied to shifts';
COMMENT ON TABLE shift_transaction_items IS 'Line items for each transaction';
COMMENT ON TABLE shift_audit_log IS 'Immutable audit trail of all shift actions';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
