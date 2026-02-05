-- =============================================
-- FIX: Change branch_id from UUID to INTEGER
-- =============================================
-- This migration fixes the data type mismatch

-- First, drop the existing tables completely
DROP TABLE IF EXISTS cashier_logbook_lines CASCADE;
DROP TABLE IF EXISTS cashier_logbooks CASCADE;

-- Recreate with correct INTEGER branch_id
CREATE TABLE cashier_logbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('reception', 'bar')),
    log_date DATE NOT NULL,
    
    -- Financial Data
    opening_float DECIMAL(15, 2) DEFAULT 0,
    closing_float DECIMAL(15, 2) DEFAULT 0,
    sales_breakdown JSONB DEFAULT '{}',
    total_mpesa DECIMAL(15, 2) DEFAULT 0,
    total_swipe DECIMAL(15, 2) DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one logbook per branch/type/date
    UNIQUE(branch_id, type, log_date)
);

CREATE TABLE cashier_logbook_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logbook_id UUID NOT NULL REFERENCES cashier_logbooks(id) ON DELETE CASCADE,
    section TEXT NOT NULL CHECK (section IN ('credit_bill', 'unpaid_bill', 'paid_bill')),
    customer_name TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cashier_logbooks_branch_date ON cashier_logbooks(branch_id, log_date DESC);
CREATE INDEX idx_cashier_logbooks_cashier ON cashier_logbooks(cashier_id);
CREATE INDEX idx_cashier_logbooks_type_date ON cashier_logbooks(type, log_date DESC);
CREATE INDEX idx_cashier_logbook_lines_logbook ON cashier_logbook_lines(logbook_id);
CREATE INDEX idx_cashier_logbook_lines_section ON cashier_logbook_lines(section);

-- RLS
ALTER TABLE cashier_logbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_logbook_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY cashier_logbooks_select_policy ON cashier_logbooks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY cashier_logbooks_insert_policy ON cashier_logbooks FOR INSERT WITH CHECK (cashier_id = auth.uid());
CREATE POLICY cashier_logbooks_update_policy ON cashier_logbooks FOR UPDATE USING (cashier_id = auth.uid());
CREATE POLICY cashier_logbook_lines_select_policy ON cashier_logbook_lines FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY cashier_logbook_lines_insert_policy ON cashier_logbook_lines FOR INSERT WITH CHECK (logbook_id IN (SELECT id FROM cashier_logbooks WHERE cashier_id = auth.uid()));
CREATE POLICY cashier_logbook_lines_delete_policy ON cashier_logbook_lines FOR DELETE USING (logbook_id IN (SELECT id FROM cashier_logbooks WHERE cashier_id = auth.uid()));
