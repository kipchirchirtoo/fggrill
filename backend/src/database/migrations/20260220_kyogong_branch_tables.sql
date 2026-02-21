-- 1. Create sales_points table
CREATE TABLE IF NOT EXISTS sales_points (
    id SERIAL PRIMARY KEY,
    branch_id INT REFERENCES branches(id),
    name TEXT NOT NULL,
    code TEXT,
    is_active BOOLEAN DEFAULT true,
    supports_petty_cash BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, code)
);

-- 2. Create dynamic_services table
CREATE TABLE IF NOT EXISTS dynamic_services (
    id SERIAL PRIMARY KEY,
    branch_id INT REFERENCES branches(id),
    service_type TEXT NOT NULL, -- 'car_wash', 'spa', etc.
    name TEXT NOT NULL,
    pricing_model TEXT DEFAULT 'fixed', -- 'fixed', 'dynamic', 'hourly'
    base_price DECIMAL(10, 2) DEFAULT 0,
    price_per_hour DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Modify cashier_shifts table
ALTER TABLE cashier_shifts
ADD COLUMN IF NOT EXISTS sales_point_id INT REFERENCES sales_points(id),
ADD COLUMN IF NOT EXISTS opening_petty_cash DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_petty_cash DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS variance_reason TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- 4. Create petty_cash_ledger table
CREATE TABLE IF NOT EXISTS petty_cash_ledger (
    id SERIAL PRIMARY KEY,
    branch_id INT REFERENCES branches(id),
    shift_id UUID REFERENCES cashier_shifts(id),
    amount DECIMAL(10, 2) NOT NULL,
    transaction_type TEXT NOT NULL, -- 'CASH_IN', 'CASH_OUT'
    purpose_category TEXT,
    purpose_description TEXT,
    paid_to_name TEXT,
    paid_to_id_number TEXT,
    authorized_by UUID REFERENCES users(id),
    authorizer_name TEXT,
    receipt_number TEXT,
    receipt_attachment_url TEXT,
    recorded_by UUID REFERENCES users(id),
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create pool_tokens_inventory table
CREATE TABLE IF NOT EXISTS pool_tokens_inventory (
    id SERIAL PRIMARY KEY,
    branch_id INT REFERENCES branches(id),
    shift_id UUID REFERENCES cashier_shifts(id),
    opening_balance INT DEFAULT 0,
    tokens_sold INT DEFAULT 0,
    tokens_issued INT DEFAULT 0,
    closing_balance INT DEFAULT 0,
    variance INT DEFAULT 0,
    variance_reason TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create shift_staff_assignments table
CREATE TABLE IF NOT EXISTS shift_staff_assignments (
    id SERIAL PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id),
    staff_role TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create shift_transactions table (if not exists)
CREATE TABLE IF NOT EXISTS shift_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES cashier_shifts(id),
    branch_id INT REFERENCES branches(id),
    sales_point_id INT REFERENCES sales_points(id),
    transaction_number TEXT UNIQUE,
    transaction_type TEXT DEFAULT 'SALE',
    service_category TEXT,
    subtotal DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    payment_method TEXT,
    cash_amount DECIMAL(10, 2) DEFAULT 0,
    mpesa_amount DECIMAL(10, 2) DEFAULT 0,
    card_amount DECIMAL(10, 2) DEFAULT 0,
    mpesa_reference TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_room_number TEXT,
    served_by UUID REFERENCES users(id),
    is_voided BOOLEAN DEFAULT false,
    void_reason TEXT,
    voided_by UUID REFERENCES users(id),
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create shift_transaction_items table
CREATE TABLE IF NOT EXISTS shift_transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES shift_transactions(id) ON DELETE CASCADE,
    item_type TEXT,
    item_id TEXT,
    item_name TEXT,
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit_price DECIMAL(10, 2) DEFAULT 0,
    total_price DECIMAL(10, 2) DEFAULT 0,
    service_staff_id UUID REFERENCES users(id),
    service_staff_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create shift_audit_log table
CREATE TABLE IF NOT EXISTS shift_audit_log (
    id SERIAL PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id),
    action TEXT,
    reason TEXT,
    performed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    old_value JSONB,
    new_value JSONB
);

-- 10. Insert Kyogong Departments (Use DO NOTHING to avoid errors if they exist)
INSERT INTO departments (name, description) VALUES 
('Spa', 'Spa and Wellness Services'),
('Sports Bar', 'Sports Bar Operations'),
('Car Wash', 'Car Wash Services'),
('Swimming Pool', 'Pool and Recreation'),
('Sauna', 'Sauna Services'),
('Kinyozi', 'Barbershop Services')
ON CONFLICT (name) DO NOTHING;
