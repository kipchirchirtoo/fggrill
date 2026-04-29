-- Daily Financial Records Migration

CREATE TYPE financial_record_status AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'FLAGGED');

CREATE TABLE IF NOT EXISTS daily_financial_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    status financial_record_status DEFAULT 'DRAFT',
    
    -- Revenue Summary
    revenue_data JSONB DEFAULT '{}', -- { restaurant: 0, bar: 0, pool: 0, spa: 0, wash: 0, conf: 0, catering: 0, rooms: 0, bills: 0, non_consumables: 0 }
    total_revenue DECIMAL(15, 2) DEFAULT 0,
    
    -- Payment Breakdown
    payment_data JSONB DEFAULT '{}', -- { cash: 0, mpesa: 0, card: 0 }
    total_payments DECIMAL(15, 2) DEFAULT 0,
    
    -- Cash Banking
    banking_data JSONB DEFAULT '{}', -- { banked: 0, account: '', time: '', ref: '' }
    expected_cash DECIMAL(15, 2) DEFAULT 0,
    unbanked_cash DECIMAL(15, 2) DEFAULT 0,
    
    -- COGS
    cogs_data JSONB DEFAULT '{}', -- { opening: 0, central: 0, deliveries: 0, closing: 0 }
    total_cogs DECIMAL(15, 2) DEFAULT 0,
    
    -- Expenses
    expense_data JSONB DEFAULT '{}', -- { petty_cash: [], suppliers: [], transaction: [], wastage: [], shorts: [], credit: [], other: [] }
    total_expenses DECIMAL(15, 2) DEFAULT 0,
    
    -- Profit
    net_profit DECIMAL(15, 2) DEFAULT 0,
    
    notes TEXT,
    created_by UUID REFERENCES users(id),
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    flagged_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(branch_id, record_date)
);

CREATE TABLE IF NOT EXISTS monthly_financial_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    fiscal_month INTEGER NOT NULL,
    
    -- Fixed Monthly Expenses
    electricity DECIMAL(15, 2) DEFAULT 0,
    salaries DECIMAL(15, 2) DEFAULT 0,
    water DECIMAL(15, 2) DEFAULT 0,
    subscriptions JSONB DEFAULT '{}',
    rent DECIMAL(15, 2) DEFAULT 0,
    nssf DECIMAL(15, 2) DEFAULT 0,
    shif DECIMAL(15, 2) DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    levy DECIMAL(15, 2) DEFAULT 0,
    licenses DECIMAL(15, 2) DEFAULT 0,
    
    -- Monthly Outputs
    total_monthly_expenses DECIMAL(15, 2) DEFAULT 0,
    monthly_profit DECIMAL(15, 2) DEFAULT 0,
    
    -- Additional Statements (Manual Entry)
    cash_flow_data JSONB DEFAULT '{}',
    balance_sheet_data JSONB DEFAULT '{}',
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(branch_id, fiscal_year, fiscal_month)
);

CREATE INDEX IF NOT EXISTS idx_daily_fin_branch_date ON daily_financial_records(branch_id, record_date);
CREATE INDEX IF NOT EXISTS idx_daily_fin_status ON daily_financial_records(status);
CREATE INDEX IF NOT EXISTS idx_monthly_adj_branch_period ON monthly_financial_adjustments(branch_id, fiscal_year, fiscal_month);
