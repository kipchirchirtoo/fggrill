-- Corporate Credit Accounts & Invoicing System

-- 1. Corporate Customers Table
CREATE TABLE IF NOT EXISTS corporate_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    credit_period_days INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corporate_customers_branch ON corporate_customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_corporate_customers_active ON corporate_customers(is_active);

-- 2. Corporate Invoices Table (Groups bills together)
CREATE TABLE IF NOT EXISTS corporate_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    corporate_customer_id UUID REFERENCES corporate_customers(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    amount_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID')),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corporate_invoices_customer ON corporate_invoices(corporate_customer_id);
CREATE INDEX IF NOT EXISTS idx_corporate_invoices_status ON corporate_invoices(status);

-- 3. Corporate Credit Bills Table (Links POS bill to a corporate customer)
CREATE TABLE IF NOT EXISTS corporate_credit_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    corporate_customer_id UUID REFERENCES corporate_customers(id) ON DELETE CASCADE,
    pos_bill_id UUID REFERENCES master_bills(id) ON DELETE RESTRICT,
    corporate_invoice_id UUID REFERENCES corporate_invoices(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'UNINVOICED' CHECK (status IN ('UNINVOICED', 'INVOICED', 'PAID')),
    cashier_id UUID REFERENCES auth.users(id),
    shift_id UUID REFERENCES cashier_shift_logs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corporate_credit_bills_customer ON corporate_credit_bills(corporate_customer_id);
CREATE INDEX IF NOT EXISTS idx_corporate_credit_bills_invoice ON corporate_credit_bills(corporate_invoice_id);
CREATE INDEX IF NOT EXISTS idx_corporate_credit_bills_status ON corporate_credit_bills(status);

-- Triggers for updated_at
CREATE TRIGGER set_timestamp_corporate_customers
BEFORE UPDATE ON corporate_customers
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_corporate_invoices
BEFORE UPDATE ON corporate_invoices
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_corporate_credit_bills
BEFORE UPDATE ON corporate_credit_bills
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
