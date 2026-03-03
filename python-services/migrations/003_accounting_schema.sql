-- Kyogong - Accounting & Audit Database Schema
-- Migration script for accounting functionality

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id SERIAL PRIMARY KEY,
    account_code VARCHAR(10) UNIQUE NOT NULL,
    account_name VARCHAR(200) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_account_id INTEGER REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal Entries Header
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL,
    reference VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'posted', 'rejected')),
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',
    department VARCHAR(100),
    category VARCHAR(20) CHECK (category IN ('revenue', 'expense', 'asset', 'liability', 'equity')),
    tax_code VARCHAR(10),
    project_code VARCHAR(50),
    branch_id INTEGER REFERENCES branches(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    submitted_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    posted_at TIMESTAMP WITH TIME ZONE,
    posted_by UUID REFERENCES users(id),
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}'
);

-- Journal Entry Lines (Debit/Credit)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    account_code VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(account_code),
    account_name VARCHAR(200) NOT NULL,
    debit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    credit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    description TEXT,
    cost_center VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_debit_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR 
        (credit_amount > 0 AND debit_amount = 0)
    )
);

-- Audit Trail
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SUBMIT', 'APPROVE', 'REJECT', 'POST')),
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    notes TEXT,
    session_id VARCHAR(255)
);

-- Bank Reconciliation
CREATE TABLE IF NOT EXISTS bank_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(account_code),
    reconciliation_date DATE NOT NULL,
    book_balance DECIMAL(15,2) NOT NULL,
    bank_balance DECIMAL(15,2) NOT NULL,
    difference DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'reconciled', 'discrepancy')),
    reconciled_by UUID REFERENCES users(id),
    reconciled_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    adjustments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Workpapers
CREATE TABLE IF NOT EXISTS audit_workpapers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('workpaper', 'schedule', 'supporting_document', 'exception')),
    period VARCHAR(20) NOT NULL, -- e.g., '2024-Q4', '2024-12'
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'completed', 'approved')),
    description TEXT,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    file_type VARCHAR(50),
    prepared_by UUID REFERENCES users(id),
    prepared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    findings JSONB DEFAULT '[]',
    recommendations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tax Codes
CREATE TABLE IF NOT EXISTS tax_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    rate DECIMAL(5,4) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    effective_date DATE,
    expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cost Centers
CREATE TABLE IF NOT EXISTS cost_centers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    branch_id INTEGER REFERENCES branches(id),
    manager_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial Periods
CREATE TABLE IF NOT EXISTS financial_periods (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
    month INTEGER CHECK (month BETWEEN 1 AND 12),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    closed_by UUID REFERENCES users(id),
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(year, quarter, month)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_branch ON journal_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_department ON journal_entries(department);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_code);
CREATE INDEX IF NOT EXISTS idx_audit_trail_record ON audit_trail(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_account ON bank_reconciliations(account_code);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_date ON bank_reconciliations(reconciliation_date);

-- Triggers for audit trail
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_trail (
            table_name, 
            record_id, 
            action, 
            old_values, 
            user_id,
            user_email,
            timestamp
        ) VALUES (
            TG_TABLE_NAME,
            OLD.id,
            'DELETE',
            row_to_json(OLD),
            OLD.updated_by,
            NULL, -- Will be set by application
            NOW()
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_trail (
            table_name, 
            record_id, 
            action, 
            old_values, 
            new_values,
            user_id,
            user_email,
            timestamp
        ) VALUES (
            TG_TABLE_NAME,
            NEW.id,
            'UPDATE',
            row_to_json(OLD),
            row_to_json(NEW),
            NEW.updated_by,
            NULL, -- Will be set by application
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_trail (
            table_name, 
            record_id, 
            action, 
            new_values,
            user_id,
            user_email,
            timestamp
        ) VALUES (
            TG_TABLE_NAME,
            NEW.id,
            'INSERT',
            row_to_json(NEW),
            NEW.created_by,
            NULL, -- Will be set by application
            NOW()
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers
CREATE TRIGGER journal_entries_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER journal_entry_lines_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Views for reporting
CREATE OR REPLACE VIEW journal_entries_view AS
SELECT 
    je.id,
    je.entry_date,
    je.reference,
    je.description,
    je.status,
    je.total_amount,
    je.currency,
    je.department,
    je.category,
    je.branch_id,
    b.name as branch_name,
    je.created_by,
    u.first_name || ' ' || u.last_name as created_by_name,
    je.created_at,
    je.reviewed_by,
    ru.first_name || ' ' || ru.last_name as reviewed_by_name,
    je.reviewed_at,
    je.posted_by,
    pu.first_name || ' ' || pu.last_name as posted_by_name,
    je.posted_at
FROM journal_entries je
LEFT JOIN branches b ON je.branch_id = b.id
LEFT JOIN users u ON je.created_by = u.id
LEFT JOIN users ru ON je.reviewed_by = ru.id
LEFT JOIN users pu ON je.posted_by = pu.id;

CREATE OR REPLACE VIEW trial_balance_view AS
SELECT 
    coa.account_code,
    coa.account_name,
    coa.account_type,
    COALESCE(SUM(jel.debit_amount), 0) as total_debits,
    COALESCE(SUM(jel.credit_amount), 0) as total_credits,
    COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0) as balance
FROM chart_of_accounts coa
LEFT JOIN journal_entry_lines jel ON coa.account_code = jel.account_code
LEFT JOIN journal_entries je ON jel.entry_id = je.id AND je.status = 'posted'
GROUP BY coa.account_code, coa.account_name, coa.account_type
ORDER BY coa.account_code;

-- Insert default chart of accounts
INSERT INTO chart_of_accounts (account_code, account_name, account_type, description) VALUES
('1000', 'Cash and Cash Equivalents', 'asset', 'Petty cash, bank accounts, and cash equivalents'),
('1100', 'Accounts Receivable', 'asset', 'Amounts owed by guests and customers'),
('1200', 'Inventory', 'asset', 'Food, beverages, and supplies inventory'),
('1300', 'Prepaid Expenses', 'asset', 'Prepaid rent, insurance, and other expenses'),
('1400', 'Furniture & Equipment', 'asset', 'Hotel furniture, fixtures, and equipment'),
('1500', 'Accumulated Depreciation', 'asset', 'Accumulated depreciation on fixed assets'),
('2000', 'Accounts Payable', 'liability', 'Amounts owed to suppliers and vendors'),
('2100', 'Accrued Expenses', 'liability', 'Expenses incurred but not yet paid'),
('2200', 'Taxes Payable', 'liability', 'VAT, withholding tax, and other taxes'),
('2300', 'Deferred Revenue', 'liability', 'Advance payments from guests'),
('3000', 'Owner''s Equity', 'equity', 'Owner''s investment and equity'),
('3100', 'Retained Earnings', 'equity', 'Accumulated retained earnings'),
('4000', 'Room Revenue', 'revenue', 'Revenue from room rentals'),
('4100', 'Restaurant Revenue', 'revenue', 'Revenue from restaurant operations'),
('4200', 'Bar Revenue', 'revenue', 'Revenue from bar operations'),
('4300', 'Other Revenue', 'revenue', 'Other operating revenues'),
('5000', 'Cost of Goods Sold', 'expense', 'Cost of food, beverages, and supplies'),
('5100', 'Salaries & Wages', 'expense', 'Employee salaries and wages'),
('5200', 'Utilities', 'expense', 'Electricity, water, and other utilities'),
('5300', 'Rent Expense', 'expense', 'Property rent and lease payments'),
('5400', 'Marketing & Advertising', 'expense', 'Marketing and advertising expenses'),
('5500', 'Maintenance & Repairs', 'expense', 'Building and equipment maintenance'),
('5600', 'Office Supplies', 'expense', 'Office and administrative supplies'),
('5700', 'Insurance', 'expense', 'Insurance premiums'),
('5800', 'Depreciation Expense', 'expense', 'Depreciation of fixed assets'),
('5900', 'Other Expenses', 'expense', 'Other operating expenses')
ON CONFLICT (account_code) DO NOTHING;

-- Insert default tax codes
INSERT INTO tax_codes (code, name, rate, description) VALUES
('VAT0', 'VAT Exempt', 0.0000, 'VAT exempt items and services'),
('VAT16', 'Standard VAT', 0.1600, 'Standard VAT rate of 16%'),
('VAT8', 'Reduced VAT', 0.0800, 'Reduced VAT rate of 8%'),
('WHT5', 'Withholding Tax 5%', 0.0500, 'Withholding tax at 5%'),
('WHT15', 'Withholding Tax 15%', 0.1500, 'Withholding tax at 15%')
ON CONFLICT (code) DO NOTHING;

-- Insert default cost centers
INSERT INTO cost_centers (code, name, department, branch_id) VALUES
('CC-001', 'Rooms Division', 'Rooms Division', 1),
('CC-002', 'Food & Beverage', 'Food & Beverage', 1),
('CC-003', 'Bar Operations', 'Bar Operations', 1),
('CC-004', 'Housekeeping', 'Housekeeping', 1),
('CC-005', 'Maintenance', 'Maintenance', 1),
('CC-006', 'Administration', 'Administration', 1),
('CC-007', 'Marketing', 'Marketing', 1),
('CC-008', 'Human Resources', 'Human Resources', 1),
('CC-009', 'Finance', 'Finance', 1)
ON CONFLICT (code) DO NOTHING;

-- Insert financial periods for 2024
INSERT INTO financial_periods (year, quarter, month, start_date, end_date) VALUES
(2024, 1, 1, '2024-01-01', '2024-01-31'),
(2024, 1, 2, '2024-02-01', '2024-02-29'),
(2024, 1, 3, '2024-03-01', '2024-03-31'),
(2024, 2, 4, '2024-04-01', '2024-04-30'),
(2024, 2, 5, '2024-05-01', '2024-05-31'),
(2024, 2, 6, '2024-06-01', '2024-06-30'),
(2024, 3, 7, '2024-07-01', '2024-07-31'),
(2024, 3, 8, '2024-08-01', '2024-08-31'),
(2024, 3, 9, '2024-09-01', '2024-09-30'),
(2024, 4, 10, '2024-10-01', '2024-10-31'),
(2024, 4, 11, '2024-11-01', '2024-11-30'),
(2024, 4, 12, '2024-12-01', '2024-12-31')
ON CONFLICT (year, quarter, month) DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO accountant_role;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO auditor_role;

COMMIT;
