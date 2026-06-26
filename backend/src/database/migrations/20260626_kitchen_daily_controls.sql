-- Create Kitchen Shift Controls table to persist calculated controls per shift

CREATE TABLE IF NOT EXISTS kitchen_shift_controls (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type VARCHAR(50) NOT NULL, -- e.g., 'A', 'B'
    cashier_shift_id UUID REFERENCES cashier_shift_logs(id) ON DELETE SET NULL,
    kitchen_session_id UUID REFERENCES kitchen_production_sessions(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL, -- e.g., 'BEEF', 'EXE FLOUR'
    expected_usage DECIMAL(10,3) DEFAULT 0,
    actual_usage DECIMAL(10,3) DEFAULT 0,
    variance DECIMAL(10,3) DEFAULT 0, -- positive means shortage, negative means overage
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'billed', 'resolved'
    credit_bill_id UUID REFERENCES staff_credit_bills(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, shift_date, shift_type, item_name)
);

CREATE INDEX IF NOT EXISTS idx_k_shift_controls_date ON kitchen_shift_controls(branch_id, shift_date, shift_type);

-- RLS Policies
ALTER TABLE kitchen_shift_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users" 
ON kitchen_shift_controls FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for branch managers and admins" 
ON kitchen_shift_controls FOR ALL 
USING (auth.role() = 'authenticated');
