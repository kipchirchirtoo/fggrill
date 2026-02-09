-- =====================================================
-- SHIFT LOGBOOK ENHANCEMENT - Revenue Breakdown
-- Adds detailed revenue tracking by source
-- =====================================================

-- Add revenue source columns
ALTER TABLE cashier_shift_logs
ADD COLUMN IF NOT EXISTS swimming_pool_revenue DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pool_token_revenue DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS conference_revenue DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS room_booking_revenue DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS restaurant_revenue DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bar_revenue DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_revenue DECIMAL(10, 2) DEFAULT 0;

-- Add credit & bills tracking
ALTER TABLE cashier_shift_logs
ADD COLUMN IF NOT EXISTS credit_bills_taken DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_bills_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_bills_value DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unpaid_bills_count INTEGER DEFAULT 0;

-- Add cash management columns
ALTER TABLE cashier_shift_logs
ADD COLUMN IF NOT EXISTS cash_at_hand DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_deposited DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bank_deposit_ref TEXT;

-- Add N/A flags for branch-specific facilities
ALTER TABLE cashier_shift_logs
ADD COLUMN IF NOT EXISTS pool_na BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS conference_na BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rooms_na BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN cashier_shift_logs.swimming_pool_revenue IS 'Revenue from swimming pool services';
COMMENT ON COLUMN cashier_shift_logs.pool_token_revenue IS 'Revenue from pool token sales';
COMMENT ON COLUMN cashier_shift_logs.conference_revenue IS 'Revenue from conference room bookings';
COMMENT ON COLUMN cashier_shift_logs.room_booking_revenue IS 'Revenue from hotel room bookings';
COMMENT ON COLUMN cashier_shift_logs.restaurant_revenue IS 'Revenue from restaurant sales';
COMMENT ON COLUMN cashier_shift_logs.bar_revenue IS 'Revenue from bar sales';
COMMENT ON COLUMN cashier_shift_logs.other_revenue IS 'Revenue from other sources';
COMMENT ON COLUMN cashier_shift_logs.credit_bills_taken IS 'Total value of credit bills issued during shift';
COMMENT ON COLUMN cashier_shift_logs.unpaid_bills_value IS 'Total value of unpaid bills at shift end';
COMMENT ON COLUMN cashier_shift_logs.cash_at_hand IS 'Cash physically present at shift end';
COMMENT ON COLUMN cashier_shift_logs.cash_deposited IS 'Cash deposited to bank during shift';
COMMENT ON COLUMN cashier_shift_logs.pool_na IS 'TRUE if branch does not have swimming pool';
COMMENT ON COLUMN cashier_shift_logs.conference_na IS 'TRUE if branch does not have conference facilities';
COMMENT ON COLUMN cashier_shift_logs.rooms_na IS 'TRUE if branch does not have hotel rooms';

-- Update calculate_shift_summary function to include revenue breakdown
CREATE OR REPLACE FUNCTION calculate_shift_summary(p_shift_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_summary JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_cash', COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount ELSE 0 END), 0),
    'total_mpesa', COALESCE(SUM(CASE WHEN payment_method IN ('MPESA', 'MPESA_MANUAL') THEN amount ELSE 0 END), 0),
    'total_card', COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN amount ELSE 0 END), 0),
    'total_sales', COALESCE(SUM(amount), 0),
    'transaction_count', COUNT(*)
  ) INTO v_summary
  FROM cashier_shift_transactions
  WHERE shift_id = p_shift_id;
  
  RETURN v_summary;
END;
$$ LANGUAGE plpgsql;
