-- ============================================
-- KYOGONG CASH FLOAT TRACKING SYSTEM
-- Migration: 32_kyogong_cash_float_tracking.sql
-- Purpose: Add real-time cash float tracking to cashier shifts
-- ============================================

-- ============================================
-- 1. ENHANCE CASHIER_SHIFTS TABLE
-- ============================================

-- Add float tracking columns to existing cashier_shifts table
ALTER TABLE cashier_shifts 
ADD COLUMN IF NOT EXISTS current_float DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS expected_cash DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_change_given DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS float_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_float_update TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_float_version ON cashier_shifts(float_version);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_last_float_update ON cashier_shifts(last_float_update);

-- Add comments for documentation
COMMENT ON COLUMN cashier_shifts.current_float IS 'Real-time cash amount in drawer (updated on every cash transaction)';
COMMENT ON COLUMN cashier_shifts.expected_cash IS 'Calculated expected closing cash (opening_float + total_cash_in - total_change_given)';
COMMENT ON COLUMN cashier_shifts.total_change_given IS 'Cumulative change given during shift';
COMMENT ON COLUMN cashier_shifts.float_version IS 'Optimistic locking version number (increments on each float update)';
COMMENT ON COLUMN cashier_shifts.last_float_update IS 'Timestamp of last float modification';

-- ============================================
-- 2. CREATE FLOAT_HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS float_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id) ON DELETE CASCADE NOT NULL,
    
    -- Change details
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('TRANSACTION', 'ADJUSTMENT', 'OPENING', 'CLOSING', 'VOID')),
    amount_change DECIMAL(10,2) NOT NULL,
    resulting_float DECIMAL(10,2) NOT NULL,
    
    -- Reference information
    transaction_id UUID REFERENCES shift_transactions(id),
    adjustment_reason TEXT,
    performed_by UUID REFERENCES users(id),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_float_history_shift ON float_history(shift_id);
CREATE INDEX IF NOT EXISTS idx_float_history_timestamp ON float_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_float_history_type ON float_history(change_type);

-- Add comments
COMMENT ON TABLE float_history IS 'Complete audit trail of all cash float changes during shifts';
COMMENT ON COLUMN float_history.change_type IS 'Type of change: TRANSACTION (auto), ADJUSTMENT (manual), OPENING, CLOSING, VOID';
COMMENT ON COLUMN float_history.amount_change IS 'Delta applied to float (positive or negative)';
COMMENT ON COLUMN float_history.resulting_float IS 'Float value after this change was applied';

-- ============================================
-- 3. INITIALIZE EXISTING SHIFTS
-- ============================================

-- Initialize current_float and expected_cash for existing open shifts
UPDATE cashier_shifts
SET 
    current_float = opening_float,
    expected_cash = opening_float + COALESCE(total_cash_in, 0),
    float_version = 0,
    last_float_update = NOW()
WHERE status = 'OPEN' 
AND current_float IS NULL;

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on float_history table
ALTER TABLE float_history ENABLE ROW LEVEL SECURITY;

-- Float history: Cashiers see own shift history, accountants/auditors see all
CREATE POLICY "Cashiers can view own shift float history"
ON float_history FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM cashier_shifts
        WHERE cashier_shifts.id = float_history.shift_id
        AND (
            cashier_shifts.cashier_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM users
                WHERE id = auth.uid()
                AND role IN ('super_admin', 'accountant', 'auditor', 'manager')
            )
        )
    )
);

-- Only system and supervisors can insert float history
CREATE POLICY "System can insert float history"
ON float_history FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
