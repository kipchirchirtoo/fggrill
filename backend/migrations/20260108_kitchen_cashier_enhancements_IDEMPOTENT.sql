-- ============================================
-- IDEMPOTENT MIGRATION FOR KITCHEN & CASHIER ENHANCEMENTS
-- Safe to run multiple times - checks for existing objects
-- ============================================

-- PART 0: ADD MISSING USER ROLES TO ENUM (IF NOT EXISTS)
-- ============================================

DO $$
BEGIN
    -- Add cashier role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'cashier'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'cashier';
    END IF;

    -- Add head_chef role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'head_chef'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'head_chef';
    END IF;

    -- Add sous_chef role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'sous_chef'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'sous_chef';
    END IF;

    -- Add kitchen role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'kitchen'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'kitchen';
    END IF;

    -- Add pos_kitchen role
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'pos_kitchen'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'pos_kitchen';
    END IF;
END $$;

-- PART 1: CREATE TABLES (IF NOT EXISTS)
-- ============================================

-- Kitchen Ledger Entries
CREATE TABLE IF NOT EXISTS kitchen_ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    ledger_date DATE NOT NULL DEFAULT CURRENT_DATE,
    food_item_id UUID REFERENCES inventory_items(id),
    food_item_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(50),
    opening_balance DECIMAL(10, 2) DEFAULT 0,
    received_quantity DECIMAL(10, 2) DEFAULT 0,
    used_quantity DECIMAL(10, 2) DEFAULT 0,
    wastage_quantity DECIMAL(10, 2) DEFAULT 0,
    closing_balance DECIMAL(10, 2) DEFAULT 0,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Kitchen Store Receipts
CREATE TABLE IF NOT EXISTS kitchen_store_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    store_keeper_id UUID REFERENCES users(id),
    received_by UUID REFERENCES users(id),
    total_items INT DEFAULT 0,
    discrepancies_found BOOLEAN DEFAULT FALSE,
    discrepancy_notes TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'disputed')),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Kitchen Store Receipt Items
CREATE TABLE IF NOT EXISTS kitchen_store_receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID REFERENCES kitchen_store_receipts(id) ON DELETE CASCADE,
    item_id UUID REFERENCES inventory_items(id),
    item_name VARCHAR(255) NOT NULL,
    expected_quantity DECIMAL(10, 2) NOT NULL,
    received_quantity DECIMAL(10, 2) NOT NULL,
    unit_of_measure VARCHAR(50),
    discrepancy DECIMAL(10, 2) GENERATED ALWAYS AS (received_quantity - expected_quantity) STORED,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Kitchen Portion Tracking
CREATE TABLE IF NOT EXISTS kitchen_portion_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    food_item_id UUID REFERENCES inventory_items(id),
    food_item_name VARCHAR(255) NOT NULL,
    ingredient_quantity DECIMAL(10, 2) NOT NULL,
    unit_of_measure VARCHAR(50),
    expected_portions INT NOT NULL,
    actual_portions INT,
    variance_portions INT,
    variance_percentage DECIMAL(5, 2),
    reason_for_variance TEXT,
    chef_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Kitchen Variance Logs
CREATE TABLE IF NOT EXISTS kitchen_variance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    variance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    variance_type VARCHAR(50) NOT NULL CHECK (variance_type IN ('portion', 'wastage', 'theft', 'quality_issue', 'other')),
    food_item_id UUID REFERENCES inventory_items(id),
    food_item_name VARCHAR(255) NOT NULL,
    expected_value DECIMAL(10, 2),
    actual_value DECIMAL(10, 2),
    variance_amount DECIMAL(10, 2),
    reason TEXT NOT NULL,
    reported_by UUID REFERENCES users(id),
    approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    approval_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Additional Services
CREATE TABLE IF NOT EXISTS additional_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    pricing_type VARCHAR(50) NOT NULL CHECK (pricing_type IN ('per_hour', 'per_person', 'per_day', 'per_event', 'fixed')),
    base_price DECIMAL(10, 2) NOT NULL,
    is_branch_specific BOOLEAN DEFAULT FALSE,
    branch_id UUID REFERENCES branches(id),
    requires_advance_booking BOOLEAN DEFAULT FALSE,
    advance_booking_hours INT,
    max_capacity INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Service Bookings
CREATE TABLE IF NOT EXISTS service_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    service_id UUID REFERENCES additional_services(id) ON DELETE RESTRICT,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    room_number VARCHAR(50),
    booking_date DATE NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_hours DECIMAL(5, 2),
    number_of_people INT,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity DECIMAL(10, 2) DEFAULT 1,
    total_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    booking_status VARCHAR(50) DEFAULT 'pending' CHECK (booking_status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    special_requests TEXT,
    booked_by UUID REFERENCES users(id),
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Unpaid Bills
CREATE TABLE IF NOT EXISTS unpaid_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    bill_type VARCHAR(50) NOT NULL CHECK (bill_type IN ('restaurant', 'bar', 'room_service', 'conference', 'banqueting', 'additional_service', 'other')),
    reference_type VARCHAR(50),
    reference_id UUID,
    customer_type VARCHAR(50) NOT NULL CHECK (customer_type IN ('guest', 'walk_in', 'corporate', 'staff', 'other')),
    customer_id UUID,
    customer_name VARCHAR(255) NOT NULL,
    room_number VARCHAR(50),
    waiter_id UUID REFERENCES users(id),
    bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    total_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) DEFAULT 0,
    payment_terms TEXT,
    status VARCHAR(50) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'cancelled')),
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Credit Bills
CREATE TABLE IF NOT EXISTS credit_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credit_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    staff_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50),
    department VARCHAR(100),
    bill_type VARCHAR(50) NOT NULL CHECK (bill_type IN ('restaurant', 'bar', 'room_service', 'shop', 'other')),
    reference_type VARCHAR(50),
    reference_id UUID,
    credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    total_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'salary_deduction' CHECK (payment_method IN ('salary_deduction', 'cash', 'mpesa', 'bank_transfer')),
    deduction_months INT DEFAULT 1,
    monthly_deduction DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paid', 'cancelled')),
    approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cashier Transactions
CREATE TABLE IF NOT EXISTS cashier_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES cashier_shifts(id),
    cashier_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_time TIMESTAMP DEFAULT NOW(),
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('payment', 'refund', 'float_in', 'float_out', 'expense')),
    revenue_type VARCHAR(50) CHECK (revenue_type IN ('restaurant', 'bar', 'accommodation', 'conference', 'banqueting', 'additional_service', 'staff_credit', 'other')),
    reference_type VARCHAR(50),
    reference_id UUID,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'card', 'bank_transfer', 'cheque')),
    amount DECIMAL(10, 2) NOT NULL,
    payment_reference VARCHAR(255),
    customer_name VARCHAR(255),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cashier Shifts
CREATE TABLE IF NOT EXISTS cashier_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    cashier_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    opening_float DECIMAL(10, 2) DEFAULT 0,
    closing_float DECIMAL(10, 2),
    expected_cash DECIMAL(10, 2),
    actual_cash DECIMAL(10, 2),
    cash_variance DECIMAL(10, 2),
    total_transactions INT DEFAULT 0,
    total_cash_in DECIMAL(10, 2) DEFAULT 0,
    total_mpesa_in DECIMAL(10, 2) DEFAULT 0,
    total_card_in DECIMAL(10, 2) DEFAULT 0,
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'reconciled')),
    remarks TEXT,
    reconciled_by UUID REFERENCES users(id),
    reconciled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- PART 2: CREATE OR REPLACE FUNCTIONS
-- ============================================

-- Generate Kitchen Ledger Number
CREATE OR REPLACE FUNCTION generate_kitchen_ledger_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(ledger_number FROM 3) AS INT)), 0) + 1
    INTO seq_num
    FROM kitchen_ledger_entries
    WHERE ledger_number ~ '^KL[0-9]+$';

    new_number := 'KL' || LPAD(seq_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Kitchen Receipt Number
CREATE OR REPLACE FUNCTION generate_kitchen_receipt_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 3) AS INT)), 0) + 1
    INTO seq_num
    FROM kitchen_store_receipts
    WHERE receipt_number ~ '^KR[0-9]+$';

    new_number := 'KR' || LPAD(seq_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Tracking Number
CREATE OR REPLACE FUNCTION generate_tracking_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(tracking_number FROM 3) AS INT)), 0) + 1
    INTO seq_num
    FROM kitchen_portion_tracking
    WHERE tracking_number ~ '^PT[0-9]+$';

    new_number := 'PT' || LPAD(seq_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Variance Log Number
CREATE OR REPLACE FUNCTION generate_variance_log_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(log_number FROM 3) AS INT)), 0) + 1
    INTO seq_num
    FROM kitchen_variance_logs
    WHERE log_number ~ '^VL[0-9]+$';

    new_number := 'VL' || LPAD(seq_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Service Booking Number
CREATE OR REPLACE FUNCTION generate_service_booking_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(booking_number FROM 3) AS INT)), 0) + 1
    INTO seq_num
    FROM service_bookings
    WHERE booking_number ~ '^SB[0-9]+$';

    new_number := 'SB' || LPAD(seq_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Bill Number
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(bill_number FROM 5) AS INT)), 0) + 1
    INTO seq_num
    FROM unpaid_bills
    WHERE bill_number ~ '^BILL[0-9]+$';

    new_number := 'BILL' || LPAD(seq_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Credit Number
CREATE OR REPLACE FUNCTION generate_credit_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(credit_number FROM 3) AS INT)), 0) + 1
    INTO seq_num
    FROM credit_bills
    WHERE credit_number ~ '^CR[0-9]+$';

    new_number := 'CR' || LPAD(seq_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Cashier Transaction Number
CREATE OR REPLACE FUNCTION generate_cashier_transaction_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(transaction_number FROM 3) AS INT)), 0) + 1
    INTO seq_num
    FROM cashier_transactions
    WHERE transaction_number ~ '^CT[0-9]+$';

    new_number := 'CT' || LPAD(seq_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Shift Number
CREATE OR REPLACE FUNCTION generate_shift_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    seq_num INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(shift_number FROM 3) AS INT)), 0) + 1
    INTO seq_num
    FROM cashier_shifts
    WHERE shift_number ~ '^SH[0-9]+$';

    new_number := 'SH' || LPAD(seq_num::TEXT, 6, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Calculate Portion Variance Function
CREATE OR REPLACE FUNCTION calculate_portion_variance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.actual_portions IS NOT NULL AND NEW.expected_portions > 0 THEN
        NEW.variance_portions := NEW.actual_portions - NEW.expected_portions;
        NEW.variance_percentage := ((NEW.actual_portions - NEW.expected_portions)::DECIMAL / NEW.expected_portions) * 100;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update Bill Balance Function
CREATE OR REPLACE FUNCTION update_bill_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.balance_amount := NEW.total_amount - COALESCE(NEW.paid_amount, 0);

    IF NEW.balance_amount <= 0 THEN
        NEW.status := 'paid';
        NEW.payment_status := 'paid';
    ELSIF NEW.paid_amount > 0 THEN
        NEW.status := 'partial';
        NEW.payment_status := 'partial';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update Service Booking Balance Function
CREATE OR REPLACE FUNCTION update_service_booking_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.balance_amount := NEW.total_amount - COALESCE(NEW.paid_amount, 0);

    IF NEW.balance_amount <= 0 THEN
        NEW.payment_status := 'paid';
    ELSIF NEW.paid_amount > 0 THEN
        NEW.payment_status := 'partial';
    ELSE
        NEW.payment_status := 'unpaid';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PART 3: DROP AND RECREATE TRIGGERS
-- ============================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_calculate_portion_variance ON kitchen_portion_tracking;
DROP TRIGGER IF EXISTS trigger_update_bill_balance ON unpaid_bills;
DROP TRIGGER IF EXISTS trigger_update_credit_balance ON credit_bills;
DROP TRIGGER IF EXISTS trigger_update_service_booking_balance ON service_bookings;

-- Create triggers
CREATE TRIGGER trigger_calculate_portion_variance
    BEFORE INSERT OR UPDATE ON kitchen_portion_tracking
    FOR EACH ROW
    EXECUTE FUNCTION calculate_portion_variance();

CREATE TRIGGER trigger_update_bill_balance
    BEFORE INSERT OR UPDATE ON unpaid_bills
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_balance();

CREATE TRIGGER trigger_update_credit_balance
    BEFORE INSERT OR UPDATE ON credit_bills
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_balance();

CREATE TRIGGER trigger_update_service_booking_balance
    BEFORE INSERT OR UPDATE ON service_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_service_booking_balance();

-- PART 4: SEED DATA (ONLY IF NOT EXISTS)
-- ============================================

-- Insert default additional services (only if table is empty)
INSERT INTO additional_services (name, description, category, pricing_type, base_price, is_branch_specific, requires_advance_booking, advance_booking_hours, max_capacity)
SELECT * FROM (VALUES
    ('Swimming Pool Access', 'Access to hotel swimming pool facilities', 'Recreation', 'per_person', 500.00, true, false, NULL, 50),
    ('Conference Room - Small', 'Small conference room for meetings up to 20 people', 'Business', 'per_hour', 2000.00, false, true, 24, 20),
    ('Conference Room - Large', 'Large conference room for meetings up to 100 people', 'Business', 'per_hour', 5000.00, false, true, 48, 100),
    ('Banqueting Hall', 'Full banqueting hall for events and celebrations', 'Events', 'per_event', 50000.00, false, true, 72, 300),
    ('Pool Table', 'Hourly rental of pool table', 'Recreation', 'per_hour', 300.00, true, false, NULL, 4),
    ('Bouncing Castle', 'Kids bouncing castle rental', 'Recreation', 'per_day', 3000.00, true, true, 24, 15),
    ('Car Wash - Standard', 'Standard car wash service', 'Services', 'fixed', 500.00, false, false, NULL, NULL),
    ('Car Wash - Premium', 'Premium car wash with interior cleaning and waxing', 'Services', 'fixed', 1500.00, false, false, NULL, NULL)
) AS v(name, description, category, pricing_type, base_price, is_branch_specific, requires_advance_booking, advance_booking_hours, max_capacity)
WHERE NOT EXISTS (SELECT 1 FROM additional_services LIMIT 1);

-- PART 5: CREATE SIMPLIFIED RLS POLICIES (IF NOT EXISTS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE kitchen_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_store_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_store_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_portion_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_variance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE additional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE unpaid_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_shifts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Authenticated users can access kitchen ledger" ON kitchen_ledger_entries;
DROP POLICY IF EXISTS "Authenticated users can access store receipts" ON kitchen_store_receipts;
DROP POLICY IF EXISTS "Authenticated users can access receipt items" ON kitchen_store_receipt_items;
DROP POLICY IF EXISTS "Authenticated users can access portion tracking" ON kitchen_portion_tracking;
DROP POLICY IF EXISTS "Authenticated users can access variance logs" ON kitchen_variance_logs;
DROP POLICY IF EXISTS "Authenticated users can access additional services" ON additional_services;
DROP POLICY IF EXISTS "Authenticated users can access service bookings" ON service_bookings;
DROP POLICY IF EXISTS "Authenticated users can access unpaid bills" ON unpaid_bills;
DROP POLICY IF EXISTS "Authenticated users can access credit bills" ON credit_bills;
DROP POLICY IF EXISTS "Authenticated users can access cashier transactions" ON cashier_transactions;
DROP POLICY IF EXISTS "Authenticated users can access cashier shifts" ON cashier_shifts;

-- Create simplified policies for authenticated users
CREATE POLICY "Authenticated users can access kitchen ledger"
    ON kitchen_ledger_entries FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access store receipts"
    ON kitchen_store_receipts FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access receipt items"
    ON kitchen_store_receipt_items FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access portion tracking"
    ON kitchen_portion_tracking FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access variance logs"
    ON kitchen_variance_logs FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access additional services"
    ON additional_services FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access service bookings"
    ON service_bookings FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access unpaid bills"
    ON unpaid_bills FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access credit bills"
    ON credit_bills FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access cashier transactions"
    ON cashier_transactions FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access cashier shifts"
    ON cashier_shifts FOR ALL
    USING (auth.role() = 'authenticated');

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify migration
DO $$
DECLARE
    table_count INT;
BEGIN
    SELECT COUNT(*)
    INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'kitchen_ledger_entries',
        'kitchen_store_receipts',
        'kitchen_store_receipt_items',
        'kitchen_portion_tracking',
        'kitchen_variance_logs',
        'additional_services',
        'service_bookings',
        'unpaid_bills',
        'credit_bills',
        'cashier_transactions',
        'cashier_shifts'
    );

    RAISE NOTICE 'Migration completed successfully. Created/verified % tables.', table_count;
END $$;
