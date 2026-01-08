-- Migration: Kitchen Ledger & Cashier Enhancements
-- Date: 2026-01-08
-- Description: Add kitchen ledger system, cashier functionality, additional revenue streams, and credit bills tracking

-- ============================================
-- PART 1: KITCHEN LEDGER SYSTEM
-- ============================================

-- Kitchen Ledger Entries Table
CREATE TABLE IF NOT EXISTS kitchen_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL,
    item_id UUID NOT NULL, -- References inventory_items
    item_name VARCHAR(255) NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opening_balance DECIMAL(10, 3) DEFAULT 0,
    received_quantity DECIMAL(10, 3) DEFAULT 0,
    used_quantity DECIMAL(10, 3) DEFAULT 0,
    wastage_quantity DECIMAL(10, 3) DEFAULT 0,
    closing_balance DECIMAL(10, 3) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT positive_quantities CHECK (
        opening_balance >= 0 AND
        received_quantity >= 0 AND
        used_quantity >= 0 AND
        wastage_quantity >= 0 AND
        closing_balance >= 0
    )
);

-- Kitchen Store Receipts Table (when kitchen receives from storekeeper)
CREATE TABLE IF NOT EXISTS kitchen_store_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL,
    dispatch_note_id UUID, -- References dispatch notes from store
    received_from UUID REFERENCES users(id), -- Storekeeper who dispatched
    received_by UUID REFERENCES users(id), -- Chef who received
    receipt_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'discrepancy'
    total_items INTEGER DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kitchen Store Receipt Items
CREATE TABLE IF NOT EXISTS kitchen_store_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES kitchen_store_receipts(id) ON DELETE CASCADE,
    item_id UUID NOT NULL, -- References inventory_items
    item_name VARCHAR(255) NOT NULL,
    expected_quantity DECIMAL(10, 3) NOT NULL,
    received_quantity DECIMAL(10, 3) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    expected_portions INTEGER, -- Expected portions this item can produce
    status VARCHAR(20) DEFAULT 'ok', -- 'ok', 'shortage', 'excess', 'damaged'
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kitchen Portion Tracking Table
CREATE TABLE IF NOT EXISTS kitchen_portion_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL,
    receipt_id UUID REFERENCES kitchen_store_receipts(id),
    item_id UUID NOT NULL, -- Raw material item
    item_name VARCHAR(255) NOT NULL,
    menu_item_id UUID, -- References restaurant_menu_items
    menu_item_name VARCHAR(255),
    received_quantity DECIMAL(10, 3) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    expected_portions INTEGER NOT NULL,
    actual_portions_produced INTEGER,
    portion_variance INTEGER, -- actual - expected
    variance_percentage DECIMAL(5, 2),
    tracking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'tracking', -- 'tracking', 'completed', 'variance_reported'
    chef_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kitchen Variance Logs (reasons for portion variance)
CREATE TABLE IF NOT EXISTS kitchen_variance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portion_tracking_id UUID REFERENCES kitchen_portion_tracking(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    variance_type VARCHAR(50) NOT NULL, -- 'shortage', 'excess', 'quality_issue', 'measurement_error', 'waste', 'other'
    variance_amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    corrective_action TEXT,
    reported_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approval_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 2: ADDITIONAL REVENUE STREAMS
-- ============================================

-- Additional Services Table (Pool, Conference, Car Wash, etc.)
CREATE TABLE IF NOT EXISTS additional_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_code VARCHAR(50) UNIQUE NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    service_type VARCHAR(50) NOT NULL, -- 'swimming_pool', 'conference', 'banqueting', 'pool_table', 'bouncing_castle', 'car_wash'
    description TEXT,
    branch_id UUID, -- NULL means available at all branches, specific UUID means specific branch only
    is_branch_specific BOOLEAN DEFAULT false, -- true for services only at main branch
    pricing_type VARCHAR(50) NOT NULL, -- 'per_hour', 'per_person', 'per_day', 'per_event', 'fixed'
    base_price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    capacity INTEGER, -- Max people/items that can use service at once
    duration_minutes INTEGER, -- Standard duration if applicable
    is_active BOOLEAN DEFAULT true,
    requires_booking BOOLEAN DEFAULT true,
    advance_booking_hours INTEGER DEFAULT 0, -- Minimum hours needed to book in advance
    terms_and_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_price CHECK (base_price >= 0)
);

-- Service Bookings Table
CREATE TABLE IF NOT EXISTS service_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_number VARCHAR(50) UNIQUE NOT NULL,
    service_id UUID REFERENCES additional_services(id),
    branch_id UUID NOT NULL,
    customer_type VARCHAR(20) NOT NULL, -- 'guest', 'walk_in', 'staff', 'corporate'
    guest_id UUID REFERENCES users(id), -- If hotel guest
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    booking_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    duration_hours DECIMAL(4, 2),
    number_of_people INTEGER DEFAULT 1,
    total_amount DECIMAL(10, 2) NOT NULL,
    deposit_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'unpaid'
    booking_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
    special_requests TEXT,
    booked_by UUID REFERENCES users(id), -- Staff who made the booking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    CONSTRAINT valid_amounts CHECK (
        total_amount >= 0 AND
        deposit_amount >= 0 AND
        balance_amount >= 0 AND
        deposit_amount <= total_amount
    )
);

-- ============================================
-- PART 3: CASHIER & PAYMENT MANAGEMENT
-- ============================================

-- Unpaid Bills Table
CREATE TABLE IF NOT EXISTS unpaid_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL,
    bill_type VARCHAR(50) NOT NULL, -- 'restaurant', 'bar', 'room_service', 'additional_service', 'accommodation', 'other'
    reference_type VARCHAR(50), -- 'restaurant_order', 'bar_order', 'service_booking', 'booking', 'folio'
    reference_id UUID, -- ID of the related order/booking
    customer_type VARCHAR(20) NOT NULL, -- 'guest', 'walk_in', 'staff', 'waiter'
    customer_id UUID, -- References users table
    customer_name VARCHAR(255) NOT NULL,
    room_number VARCHAR(20),
    waiter_id UUID REFERENCES users(id), -- For waiter unpaid bills
    total_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) NOT NULL,
    bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid', 'overdue', 'written_off'
    payment_terms VARCHAR(50), -- 'immediate', 'end_of_stay', 'credit_30_days', etc.
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_bill_amounts CHECK (
        total_amount >= 0 AND
        paid_amount >= 0 AND
        balance_amount >= 0 AND
        paid_amount <= total_amount
    )
);

-- Credit Bills Table (Staff Credit)
CREATE TABLE IF NOT EXISTS credit_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL,
    staff_id UUID REFERENCES users(id) NOT NULL,
    staff_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50),
    department VARCHAR(100),
    bill_type VARCHAR(50) NOT NULL, -- 'restaurant', 'bar', 'other'
    reference_type VARCHAR(50),
    reference_id UUID,
    total_amount DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(10, 2) NOT NULL,
    credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    payment_method VARCHAR(50) DEFAULT 'salary_deduction', -- 'salary_deduction', 'cash', 'mpesa'
    deduction_months INTEGER DEFAULT 1, -- Number of months to spread deduction
    monthly_deduction DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paid', 'overdue', 'written_off'
    approved_by UUID REFERENCES users(id),
    approval_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_at TIMESTAMP WITH TIME ZONE,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_credit_amounts CHECK (
        total_amount >= 0 AND
        paid_amount >= 0 AND
        balance_amount >= 0 AND
        paid_amount <= total_amount AND
        deduction_months > 0
    )
);

-- Cashier Transactions Table
CREATE TABLE IF NOT EXISTS cashier_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL,
    cashier_id UUID REFERENCES users(id) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'payment', 'refund', 'float', 'deposit', 'withdrawal'
    revenue_type VARCHAR(50), -- 'restaurant', 'bar', 'accommodation', 'conference', 'swimming_pool', 'car_wash', etc.
    reference_type VARCHAR(50), -- 'unpaid_bill', 'service_booking', 'booking', 'credit_bill', 'restaurant_order', 'bar_order'
    reference_id UUID,
    payment_method VARCHAR(50) NOT NULL, -- 'cash', 'mpesa', 'card', 'bank_transfer', 'cheque'
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    payment_reference VARCHAR(255), -- M-Pesa code, card authorization, cheque number, etc.
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    remarks TEXT,
    shift_id UUID, -- References cashier_shifts table
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_transaction_amount CHECK (amount > 0)
);

-- Cashier Shifts Table (for accountability)
CREATE TABLE IF NOT EXISTS cashier_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id UUID NOT NULL,
    cashier_id UUID REFERENCES users(id) NOT NULL,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    opening_float DECIMAL(10, 2) NOT NULL DEFAULT 0,
    closing_float DECIMAL(10, 2),
    expected_cash DECIMAL(10, 2),
    actual_cash DECIMAL(10, 2),
    cash_variance DECIMAL(10, 2), -- actual - expected
    total_transactions INTEGER DEFAULT 0,
    total_cash_in DECIMAL(10, 2) DEFAULT 0,
    total_mpesa_in DECIMAL(10, 2) DEFAULT 0,
    total_card_in DECIMAL(10, 2) DEFAULT 0,
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed', 'reconciled'
    remarks TEXT,
    supervisor_approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Kitchen Ledger Indexes
CREATE INDEX IF NOT EXISTS idx_kitchen_ledger_branch ON kitchen_ledger_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_ledger_item ON kitchen_ledger_entries(item_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_ledger_date ON kitchen_ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_receipts_branch ON kitchen_store_receipts(branch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_receipts_status ON kitchen_store_receipts(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_portion_tracking_branch ON kitchen_portion_tracking(branch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_portion_tracking_date ON kitchen_portion_tracking(tracking_date);

-- Services Indexes
CREATE INDEX IF NOT EXISTS idx_additional_services_type ON additional_services(service_type);
CREATE INDEX IF NOT EXISTS idx_additional_services_branch ON additional_services(branch_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_branch ON service_bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_date ON service_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_service_bookings_status ON service_bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_service_bookings_payment_status ON service_bookings(payment_status);

-- Bills Indexes
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_branch ON unpaid_bills(branch_id);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_status ON unpaid_bills(status);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_customer ON unpaid_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_unpaid_bills_date ON unpaid_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_credit_bills_branch ON credit_bills(branch_id);
CREATE INDEX IF NOT EXISTS idx_credit_bills_staff ON credit_bills(staff_id);
CREATE INDEX IF NOT EXISTS idx_credit_bills_status ON credit_bills(status);

-- Cashier Indexes
CREATE INDEX IF NOT EXISTS idx_cashier_transactions_branch ON cashier_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_cashier_transactions_cashier ON cashier_transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cashier_transactions_date ON cashier_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cashier_transactions_type ON cashier_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_branch ON cashier_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_cashier ON cashier_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_date ON cashier_shifts(shift_date);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to generate kitchen ledger entry number
CREATE OR REPLACE FUNCTION generate_kitchen_ledger_number()
RETURNS TEXT AS $$
DECLARE
    entry_date TEXT;
    entry_seq INT;
    entry_number TEXT;
BEGIN
    entry_date := TO_CHAR(NOW(), 'YYMMDD');
    SELECT COUNT(*) + 1 INTO entry_seq
    FROM kitchen_ledger_entries
    WHERE entry_number LIKE 'KL' || entry_date || '%';
    entry_number := 'KL' || entry_date || LPAD(entry_seq::TEXT, 4, '0');
    RETURN entry_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate kitchen receipt number
CREATE OR REPLACE FUNCTION generate_kitchen_receipt_number()
RETURNS TEXT AS $$
DECLARE
    receipt_date TEXT;
    receipt_seq INT;
    receipt_number TEXT;
BEGIN
    receipt_date := TO_CHAR(NOW(), 'YYMMDD');
    SELECT COUNT(*) + 1 INTO receipt_seq
    FROM kitchen_store_receipts
    WHERE receipt_number LIKE 'KR' || receipt_date || '%';
    receipt_number := 'KR' || receipt_date || LPAD(receipt_seq::TEXT, 4, '0');
    RETURN receipt_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate portion tracking number
CREATE OR REPLACE FUNCTION generate_portion_tracking_number()
RETURNS TEXT AS $$
DECLARE
    tracking_date TEXT;
    tracking_seq INT;
    tracking_number TEXT;
BEGIN
    tracking_date := TO_CHAR(NOW(), 'YYMMDD');
    SELECT COUNT(*) + 1 INTO tracking_seq
    FROM kitchen_portion_tracking
    WHERE tracking_number LIKE 'PT' || tracking_date || '%';
    tracking_number := 'PT' || tracking_date || LPAD(tracking_seq::TEXT, 4, '0');
    RETURN tracking_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate service booking number
CREATE OR REPLACE FUNCTION generate_service_booking_number()
RETURNS TEXT AS $$
DECLARE
    booking_date TEXT;
    booking_seq INT;
    booking_number TEXT;
BEGIN
    booking_date := TO_CHAR(NOW(), 'YYMMDD');
    SELECT COUNT(*) + 1 INTO booking_seq
    FROM service_bookings
    WHERE booking_number LIKE 'SB' || booking_date || '%';
    booking_number := 'SB' || booking_date || LPAD(booking_seq::TEXT, 4, '0');
    RETURN booking_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate bill number
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
    bill_date TEXT;
    bill_seq INT;
    bill_number TEXT;
BEGIN
    bill_date := TO_CHAR(NOW(), 'YYMMDD');
    SELECT COUNT(*) + 1 INTO bill_seq
    FROM unpaid_bills
    WHERE bill_number LIKE 'BILL' || bill_date || '%';
    bill_number := 'BILL' || bill_date || LPAD(bill_seq::TEXT, 4, '0');
    RETURN bill_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate credit number
CREATE OR REPLACE FUNCTION generate_credit_number()
RETURNS TEXT AS $$
DECLARE
    credit_date TEXT;
    credit_seq INT;
    credit_number TEXT;
BEGIN
    credit_date := TO_CHAR(NOW(), 'YYMMDD');
    SELECT COUNT(*) + 1 INTO credit_seq
    FROM credit_bills
    WHERE credit_number LIKE 'CR' || credit_date || '%';
    credit_number := 'CR' || credit_date || LPAD(credit_seq::TEXT, 4, '0');
    RETURN credit_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate cashier transaction number
CREATE OR REPLACE FUNCTION generate_cashier_transaction_number()
RETURNS TEXT AS $$
DECLARE
    trans_date TEXT;
    trans_seq INT;
    trans_number TEXT;
BEGIN
    trans_date := TO_CHAR(NOW(), 'YYMMDD');
    SELECT COUNT(*) + 1 INTO trans_seq
    FROM cashier_transactions
    WHERE transaction_number LIKE 'CT' || trans_date || '%';
    trans_number := 'CT' || trans_date || LPAD(trans_seq::TEXT, 4, '0');
    RETURN trans_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate shift number
CREATE OR REPLACE FUNCTION generate_shift_number()
RETURNS TEXT AS $$
DECLARE
    shift_date TEXT;
    shift_seq INT;
    shift_number TEXT;
BEGIN
    shift_date := TO_CHAR(NOW(), 'YYMMDD');
    SELECT COUNT(*) + 1 INTO shift_seq
    FROM cashier_shifts
    WHERE shift_number LIKE 'SH' || shift_date || '%';
    shift_number := 'SH' || shift_date || LPAD(shift_seq::TEXT, 4, '0');
    RETURN shift_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update portion variance
CREATE OR REPLACE FUNCTION calculate_portion_variance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.actual_portions_produced IS NOT NULL THEN
        NEW.portion_variance := NEW.actual_portions_produced - NEW.expected_portions;
        IF NEW.expected_portions > 0 THEN
            NEW.variance_percentage := (NEW.portion_variance::DECIMAL / NEW.expected_portions::DECIMAL) * 100;
        END IF;
        IF NEW.portion_variance <> 0 THEN
            NEW.status := 'variance_reported';
        ELSE
            NEW.status := 'completed';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_portion_variance
    BEFORE INSERT OR UPDATE ON kitchen_portion_tracking
    FOR EACH ROW
    EXECUTE FUNCTION calculate_portion_variance();

-- Trigger to update bill balance
CREATE OR REPLACE FUNCTION update_bill_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.balance_amount := NEW.total_amount - NEW.paid_amount;
    IF NEW.balance_amount <= 0 THEN
        NEW.status := 'paid';
    ELSIF NEW.paid_amount > 0 THEN
        NEW.status := 'partial';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_unpaid_bill_balance
    BEFORE INSERT OR UPDATE ON unpaid_bills
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_balance();

CREATE TRIGGER trigger_update_credit_bill_balance
    BEFORE INSERT OR UPDATE ON credit_bills
    FOR EACH ROW
    EXECUTE FUNCTION update_bill_balance();

-- Trigger to update service booking balance
CREATE OR REPLACE FUNCTION update_service_booking_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.balance_amount := NEW.total_amount - NEW.deposit_amount;
    IF NEW.balance_amount <= 0 THEN
        NEW.payment_status := 'paid';
    ELSIF NEW.deposit_amount > 0 THEN
        NEW.payment_status := 'partial';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_service_booking_balance
    BEFORE INSERT OR UPDATE ON service_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_service_booking_balance();

-- ============================================
-- SEED DATA FOR ADDITIONAL SERVICES
-- ============================================

-- Insert default additional services (main branch specific UUID would need to be replaced)
INSERT INTO additional_services (service_code, service_name, service_type, description, is_branch_specific, pricing_type, base_price, capacity, duration_minutes, requires_booking, advance_booking_hours) VALUES
('SWIM001', 'Swimming Pool Access', 'swimming_pool', 'Access to main branch swimming pool with changing facilities', true, 'per_person', 500.00, 50, 180, true, 2),
('CONF001', 'Conference Room - Small', 'conference', 'Small conference room for up to 20 people with projector and whiteboard', false, 'per_hour', 2000.00, 20, 60, true, 24),
('CONF002', 'Conference Room - Large', 'conference', 'Large conference hall for up to 100 people with full AV equipment', false, 'per_hour', 5000.00, 100, 60, true, 48),
('BANQ001', 'Banqueting Hall', 'banqueting', 'Full banqueting facility with catering options', false, 'per_event', 50000.00, 200, 300, true, 168),
('POOL001', 'Pool Table - Hourly', 'pool_table', 'Pool table rental at main branch', true, 'per_hour', 300.00, 4, 60, false, 0),
('BOUNCE001', 'Bouncing Castle', 'bouncing_castle', 'Kids bouncing castle at main branch', true, 'per_hour', 500.00, 10, 60, true, 4),
('CARWASH001', 'Car Wash - Standard', 'car_wash', 'Standard exterior car wash', false, 'fixed', 500.00, NULL, 30, false, 0),
('CARWASH002', 'Car Wash - Premium', 'car_wash', 'Full car wash with interior cleaning and waxing', false, 'fixed', 1500.00, NULL, 60, false, 0);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
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

-- Kitchen staff can view and manage kitchen records
CREATE POLICY "Kitchen staff can manage kitchen ledger"
    ON kitchen_ledger_entries FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen', 'pos_kitchen')
        )
    );

CREATE POLICY "Kitchen staff can manage receipts"
    ON kitchen_store_receipts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'branch_manager', 'head_chef', 'sous_chef', 'kitchen', 'branch_storekeeper', 'central_storekeeper')
        )
    );

-- Cashier policies
CREATE POLICY "Cashiers can view all transactions"
    ON cashier_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'branch_manager', 'receptionist', 'accountant', 'branch_accountant', 'auditor')
        )
    );

CREATE POLICY "Cashiers can create transactions"
    ON cashier_transactions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'branch_manager', 'receptionist', 'accountant')
        )
    );

-- Credit bills policies
CREATE POLICY "Staff can view credit bills"
    ON credit_bills FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND (
                role IN ('super_admin', 'branch_manager', 'accountant', 'branch_accountant', 'auditor', 'hr_manager')
                OR id = staff_id
            )
        )
    );

-- Unpaid bills policies
CREATE POLICY "Staff can manage unpaid bills"
    ON unpaid_bills FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'branch_manager', 'receptionist', 'accountant', 'branch_accountant', 'waiter', 'bartender')
        )
    );

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE kitchen_ledger_entries IS 'Daily ledger entries for kitchen food control and inventory tracking';
COMMENT ON TABLE kitchen_store_receipts IS 'Records of items received by kitchen from storekeeper';
COMMENT ON TABLE kitchen_portion_tracking IS 'Tracks expected vs actual portions produced from ingredients';
COMMENT ON TABLE kitchen_variance_logs IS 'Logs reasons for variances in portion production';
COMMENT ON TABLE additional_services IS 'Additional revenue-generating services beyond accommodation';
COMMENT ON TABLE service_bookings IS 'Bookings for additional services like pool, conference, etc.';
COMMENT ON TABLE unpaid_bills IS 'Tracks all unpaid bills from various revenue streams';
COMMENT ON TABLE credit_bills IS 'Staff credit bills and waiter unpaid bills';
COMMENT ON TABLE cashier_transactions IS 'All cashier payment transactions';
COMMENT ON TABLE cashier_shifts IS 'Cashier shift management and reconciliation';

-- Migration complete
