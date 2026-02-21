-- =====================================================
-- COMPREHENSIVE SYSTEM ENHANCEMENTS MIGRATION (FIXED)
-- Created: February 19, 2026
-- =====================================================

-- =====================================================
-- PART 1: SUPPLIER MANAGEMENT (Branch Storekeeper)
-- =====================================================

-- Add missing columns to existing suppliers table
DO $$ 
BEGIN
    -- Add category column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'category'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN category TEXT;
    END IF;

    -- Add rating column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'rating'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5);
    END IF;
END $$;

-- Create supplier_products table if not exists
CREATE TABLE IF NOT EXISTS supplier_products (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    product_code TEXT,
    unit_price DECIMAL(10,2),
    minimum_order_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add supplier_id to purchase orders if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'purchase_orders' AND column_name = 'supplier_id'
    ) THEN
        ALTER TABLE purchase_orders ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id);
    END IF;
END $$;

-- Create indexes for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);

-- =====================================================
-- PART 2: SHIFT MANAGEMENT (Branch Manager)
-- =====================================================

CREATE TABLE IF NOT EXISTS shift_templates (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_shifts (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) ON DELETE CASCADE,
    shift_template_id INTEGER REFERENCES shift_templates(id),
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(staff_id, shift_date, start_time)
);

CREATE TABLE IF NOT EXISTS shift_swaps (
    id SERIAL PRIMARY KEY,
    original_shift_id INTEGER REFERENCES staff_shifts(id) ON DELETE CASCADE,
    requesting_staff_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_staff_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for shifts
CREATE INDEX IF NOT EXISTS idx_staff_shifts_branch_id ON staff_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff_id ON staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_shift_date ON staff_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_status ON staff_shifts(status);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON shift_swaps(status);

-- =====================================================
-- PART 3: ENHANCED PAYROLL (HR Manager)
-- =====================================================

-- Add new deduction columns to payroll table
DO $$ 
BEGIN
    -- SHA deduction
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payroll' AND column_name = 'sha_deduction'
    ) THEN
        ALTER TABLE payroll ADD COLUMN sha_deduction DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- NSSF deduction
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payroll' AND column_name = 'nssf_deduction'
    ) THEN
        ALTER TABLE payroll ADD COLUMN nssf_deduction DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Uniform deduction
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payroll' AND column_name = 'uniform_deduction'
    ) THEN
        ALTER TABLE payroll ADD COLUMN uniform_deduction DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Contributions deduction
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payroll' AND column_name = 'contributions_deduction'
    ) THEN
        ALTER TABLE payroll ADD COLUMN contributions_deduction DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Absent days
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payroll' AND column_name = 'absent_days'
    ) THEN
        ALTER TABLE payroll ADD COLUMN absent_days INTEGER DEFAULT 0;
    END IF;

    -- Absent days deduction
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payroll' AND column_name = 'absent_days_deduction'
    ) THEN
        ALTER TABLE payroll ADD COLUMN absent_days_deduction DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Net salary
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payroll' AND column_name = 'net_salary'
    ) THEN
        ALTER TABLE payroll ADD COLUMN net_salary DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Working days per month
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payroll' AND column_name = 'working_days'
    ) THEN
        ALTER TABLE payroll ADD COLUMN working_days INTEGER DEFAULT 26;
    END IF;
END $$;

-- Create deduction rates configuration table
CREATE TABLE IF NOT EXISTS payroll_deduction_rates (
    id SERIAL PRIMARY KEY,
    deduction_type TEXT NOT NULL,
    rate_type TEXT CHECK (rate_type IN ('percentage', 'fixed')),
    rate_value DECIMAL(10,4),
    min_amount DECIMAL(10,2),
    max_amount DECIMAL(10,2),
    effective_from DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default deduction rates
INSERT INTO payroll_deduction_rates (deduction_type, rate_type, rate_value, is_active, effective_from) 
VALUES
    ('SHA', 'percentage', 2.75, TRUE, '2024-01-01'),
    ('NSSF', 'percentage', 6.00, TRUE, '2024-01-01')
ON CONFLICT DO NOTHING;

-- Create index for deduction rates
CREATE INDEX IF NOT EXISTS idx_payroll_deduction_rates_type ON payroll_deduction_rates(deduction_type);
CREATE INDEX IF NOT EXISTS idx_payroll_deduction_rates_active ON payroll_deduction_rates(is_active);

-- =====================================================
-- PART 4: CATERING BOOKINGS (Manager & Receptionist)
-- =====================================================

CREATE TABLE IF NOT EXISTS catering_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    booking_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    event_type TEXT,
    event_date DATE NOT NULL,
    event_time TIME,
    venue_address TEXT NOT NULL,
    num_guests INTEGER NOT NULL CHECK (num_guests > 0),
    menu_details JSONB,
    special_requirements TEXT,
    total_amount DECIMAL(10,2) DEFAULT 0,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
    booking_status TEXT DEFAULT 'confirmed' CHECK (booking_status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for catering bookings
CREATE INDEX IF NOT EXISTS idx_catering_bookings_branch_id ON catering_bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_catering_bookings_event_date ON catering_bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_catering_bookings_status ON catering_bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_catering_bookings_customer_phone ON catering_bookings(customer_phone);

-- =====================================================
-- PART 5: NOTIFICATIONS SYSTEM ENHANCEMENT
-- =====================================================

-- Ensure notifications table has proper structure
DO $$ 
BEGIN
    -- Add notification_type if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'notification_type'
    ) THEN
        ALTER TABLE notifications ADD COLUMN notification_type TEXT;
    END IF;

    -- Add reference_id if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'reference_id'
    ) THEN
        ALTER TABLE notifications ADD COLUMN reference_id TEXT;
    END IF;

    -- Add reference_table if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'reference_table'
    ) THEN
        ALTER TABLE notifications ADD COLUMN reference_table TEXT;
    END IF;

    -- Add action_url if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'action_url'
    ) THEN
        ALTER TABLE notifications ADD COLUMN action_url TEXT;
    END IF;
END $$;

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_id, reference_table);

-- =====================================================
-- PART 6: STOCK COUNT ENHANCEMENT
-- =====================================================

-- Ensure stock_counts table has proper status tracking
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stock_counts' AND column_name = 'status'
    ) THEN
        ALTER TABLE stock_counts ADD COLUMN status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled'));
    END IF;
END $$;

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to new tables
DROP TRIGGER IF EXISTS update_supplier_products_updated_at ON supplier_products;
CREATE TRIGGER update_supplier_products_updated_at
    BEFORE UPDATE ON supplier_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shift_templates_updated_at ON shift_templates;
CREATE TRIGGER update_shift_templates_updated_at
    BEFORE UPDATE ON shift_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_shifts_updated_at ON staff_shifts;
CREATE TRIGGER update_staff_shifts_updated_at
    BEFORE UPDATE ON staff_shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shift_swaps_updated_at ON shift_swaps;
CREATE TRIGGER update_shift_swaps_updated_at
    BEFORE UPDATE ON shift_swaps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_catering_bookings_updated_at ON catering_bookings;
CREATE TRIGGER update_catering_bookings_updated_at
    BEFORE UPDATE ON catering_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert default shift templates for main branch
INSERT INTO shift_templates (branch_id, name, start_time, end_time, description)
SELECT 1, 'Morning Shift', '06:00:00', '14:00:00', 'Early morning shift'
WHERE NOT EXISTS (SELECT 1 FROM shift_templates WHERE name = 'Morning Shift' AND branch_id = 1);

INSERT INTO shift_templates (branch_id, name, start_time, end_time, description)
SELECT 1, 'Afternoon Shift', '14:00:00', '22:00:00', 'Afternoon to evening shift'
WHERE NOT EXISTS (SELECT 1 FROM shift_templates WHERE name = 'Afternoon Shift' AND branch_id = 1);

INSERT INTO shift_templates (branch_id, name, start_time, end_time, description)
SELECT 1, 'Night Shift', '22:00:00', '06:00:00', 'Overnight shift'
WHERE NOT EXISTS (SELECT 1 FROM shift_templates WHERE name = 'Night Shift' AND branch_id = 1);

-- =====================================================
-- PERMISSIONS AND GRANTS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON staff_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shift_swaps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payroll_deduction_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON catering_bookings TO authenticated;

-- Grant sequence usage
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE supplier_products IS 'Products offered by suppliers';
COMMENT ON TABLE shift_templates IS 'Reusable shift templates for branch managers';
COMMENT ON TABLE staff_shifts IS 'Staff shift assignments and tracking';
COMMENT ON TABLE shift_swaps IS 'Shift swap requests between staff';
COMMENT ON TABLE payroll_deduction_rates IS 'Configurable deduction rates for payroll';
COMMENT ON TABLE catering_bookings IS 'Outside catering bookings for events';
