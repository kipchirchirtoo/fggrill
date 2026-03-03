-- ============================================
-- CONFERENCE DAILY ATTENDANCE & BANKING MODULE
-- Migration: 29_conference_daily_attendance_and_banking.sql
-- Purpose: Support variable daily attendance for conferences and add banking module for accountants
-- ============================================

-- ============================================
-- 1. CONFERENCE DAILY ATTENDANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conference_daily_attendance (
    id SERIAL PRIMARY KEY,
    booking_id UUID REFERENCES conference_hall_bookings(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    num_participants INTEGER NOT NULL DEFAULT 0,
    meal_plan_details JSONB, -- Array of meals for this specific day
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(booking_id, attendance_date)
);

CREATE INDEX idx_conf_attendance_booking ON conference_daily_attendance(booking_id);
CREATE INDEX idx_conf_attendance_date ON conference_daily_attendance(attendance_date);

COMMENT ON TABLE conference_daily_attendance IS 'Tracks daily attendance for multi-day conferences with variable participant counts';

-- ============================================
-- 2. BANKING TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS banking_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    transaction_date DATE NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'BANK_CHARGE')),
    
    -- Bank details
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT,
    
    -- Transaction details
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'KES',
    reference_number TEXT UNIQUE NOT NULL,
    
    -- Source/Destination
    source TEXT, -- e.g., 'Cash Sales', 'M-Pesa', 'Customer Payment'
    destination TEXT, -- e.g., 'Operating Account', 'Supplier Payment'
    
    -- Payment method for deposits
    payment_method TEXT CHECK (payment_method IN ('CASH', 'CHEQUE', 'MPESA', 'BANK_TRANSFER', 'CARD')),
    
    -- Supporting documents
    receipt_number TEXT,
    slip_attachment_url TEXT,
    
    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    reconciled_by UUID REFERENCES users(id),
    
    -- Purpose and notes
    purpose_category TEXT CHECK (purpose_category IN ('DAILY_SALES', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'TRANSFER', 'OTHER')),
    purpose_description TEXT NOT NULL,
    notes TEXT,
    
    -- Audit
    recorded_by UUID REFERENCES users(id) NOT NULL,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RECONCILED')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_banking_branch ON banking_transactions(branch_id);
CREATE INDEX idx_banking_date ON banking_transactions(transaction_date);
CREATE INDEX idx_banking_type ON banking_transactions(transaction_type);
CREATE INDEX idx_banking_status ON banking_transactions(status);
CREATE INDEX idx_banking_reference ON banking_transactions(reference_number);

COMMENT ON TABLE banking_transactions IS 'Records all banking transactions managed by accountants';

-- ============================================
-- 3. BANK ACCOUNTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT CHECK (account_type IN ('CURRENT', 'SAVINGS', 'FIXED_DEPOSIT')),
    currency TEXT DEFAULT 'KES',
    opening_balance DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(branch_id, bank_name, account_number)
);

CREATE INDEX idx_bank_accounts_branch ON bank_accounts(branch_id);
CREATE INDEX idx_bank_accounts_active ON bank_accounts(is_active);

COMMENT ON TABLE bank_accounts IS 'Master list of bank accounts per branch';

-- ============================================
-- 4. BANKING RECONCILIATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS banking_reconciliations (
    id SERIAL PRIMARY KEY,
    bank_account_id INTEGER REFERENCES bank_accounts(id) NOT NULL,
    reconciliation_date DATE NOT NULL,
    statement_balance DECIMAL(12,2) NOT NULL,
    book_balance DECIMAL(12,2) NOT NULL,
    variance DECIMAL(12,2) NOT NULL,
    variance_reason TEXT,
    reconciled_by UUID REFERENCES users(id) NOT NULL,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(bank_account_id, reconciliation_date)
);

CREATE INDEX idx_banking_recon_account ON banking_reconciliations(bank_account_id);
CREATE INDEX idx_banking_recon_date ON banking_reconciliations(reconciliation_date);

COMMENT ON TABLE banking_reconciliations IS 'Monthly bank reconciliation records';

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Function to update bank account balance
CREATE OR REPLACE FUNCTION update_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status != 'APPROVED') THEN
        -- Update bank account balance
        IF NEW.transaction_type = 'DEPOSIT' THEN
            UPDATE bank_accounts
            SET current_balance = current_balance + NEW.amount,
                updated_at = NOW()
            WHERE bank_name = NEW.bank_name
            AND account_number = NEW.account_number;
        ELSIF NEW.transaction_type = 'WITHDRAWAL' THEN
            UPDATE bank_accounts
            SET current_balance = current_balance - NEW.amount,
                updated_at = NOW()
            WHERE bank_name = NEW.bank_name
            AND account_number = NEW.account_number;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update bank balance on transaction approval
CREATE TRIGGER trigger_update_bank_balance
AFTER INSERT OR UPDATE ON banking_transactions
FOR EACH ROW
EXECUTE FUNCTION update_bank_account_balance();

-- Function to calculate conference invoice with daily attendance
CREATE OR REPLACE FUNCTION calculate_conference_invoice_with_attendance(p_booking_id UUID)
RETURNS TABLE (
    total_hall_rental DECIMAL,
    total_meals DECIMAL,
    total_amenities DECIMAL,
    grand_total DECIMAL,
    daily_breakdown JSONB
) AS $$
DECLARE
    v_booking RECORD;
    v_daily_total DECIMAL := 0;
    v_hall_rental DECIMAL := 0;
    v_meals_total DECIMAL := 0;
    v_amenities_total DECIMAL := 0;
    v_daily_data JSONB := '[]'::JSONB;
    v_day_record RECORD;
BEGIN
    -- Get booking details
    SELECT * INTO v_booking
    FROM conference_hall_bookings
    WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
    
    -- Calculate hall rental (from booking)
    SELECT 
        CASE 
            WHEN EXTRACT(EPOCH FROM (cb.end_date - cb.start_date)) / 3600 >= 8 THEN
                CEIL(EXTRACT(EPOCH FROM (cb.end_date - cb.start_date)) / 86400) * COALESCE(ch.base_price_per_day, 0)
            ELSE
                CEIL(EXTRACT(EPOCH FROM (cb.end_date - cb.start_date)) / 3600) * COALESCE(ch.base_price_per_hour, 0)
        END INTO v_hall_rental
    FROM conference_hall_bookings cb
    LEFT JOIN conference_halls ch ON cb.conference_hall_id = ch.id
    WHERE cb.id = p_booking_id;
    
    -- Calculate meals from daily attendance
    FOR v_day_record IN
        SELECT 
            attendance_date,
            num_participants,
            meal_plan_details
        FROM conference_daily_attendance
        WHERE booking_id = p_booking_id
        ORDER BY attendance_date
    LOOP
        DECLARE
            v_day_meals_total DECIMAL := 0;
            v_meal JSONB;
        BEGIN
            -- Calculate meals for this day
            IF v_day_record.meal_plan_details IS NOT NULL THEN
                FOR v_meal IN SELECT * FROM jsonb_array_elements(v_day_record.meal_plan_details)
                LOOP
                    v_day_meals_total := v_day_meals_total + 
                        (COALESCE((v_meal->>'price')::DECIMAL, 0) * v_day_record.num_participants);
                END LOOP;
            END IF;
            
            v_meals_total := v_meals_total + v_day_meals_total;
            
            -- Build daily breakdown
            v_daily_data := v_daily_data || jsonb_build_object(
                'date', v_day_record.attendance_date,
                'participants', v_day_record.num_participants,
                'meals_total', v_day_meals_total
            );
        END;
    END LOOP;
    
    -- Calculate amenities (from booking)
    IF v_booking.amenities_details IS NOT NULL THEN
        SELECT SUM((item->>'unit_cost')::DECIMAL * (item->>'quantity')::DECIMAL)
        INTO v_amenities_total
        FROM jsonb_array_elements(v_booking.amenities_details) AS item;
    END IF;
    
    -- Return results
    RETURN QUERY SELECT
        COALESCE(v_hall_rental, 0),
        COALESCE(v_meals_total, 0),
        COALESCE(v_amenities_total, 0),
        COALESCE(v_hall_rental, 0) + COALESCE(v_meals_total, 0) + COALESCE(v_amenities_total, 0),
        v_daily_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE conference_daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_reconciliations ENABLE ROW LEVEL SECURITY;

-- Conference Daily Attendance Policies
CREATE POLICY "Staff can view conference attendance"
ON conference_daily_attendance FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can manage conference attendance"
ON conference_daily_attendance FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'GENERAL_MANAGER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'BRANCH_ACCOUNTANT')
    )
);

-- Banking Transactions Policies
CREATE POLICY "Accountants can view banking transactions"
ON banking_transactions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ACCOUNTANT', 'AUDITOR', 'GENERAL_MANAGER')
    )
);

CREATE POLICY "Accountants can manage banking transactions"
ON banking_transactions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ACCOUNTANT')
    )
);

-- Bank Accounts Policies
CREATE POLICY "Accountants can view bank accounts"
ON bank_accounts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ACCOUNTANT', 'AUDITOR', 'GENERAL_MANAGER')
    )
);

CREATE POLICY "Accountants can manage bank accounts"
ON bank_accounts FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ACCOUNTANT')
    )
);

-- Banking Reconciliations Policies
CREATE POLICY "Accountants can view reconciliations"
ON banking_reconciliations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ACCOUNTANT', 'AUDITOR', 'GENERAL_MANAGER')
    )
);

CREATE POLICY "Accountants can manage reconciliations"
ON banking_reconciliations FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_ACCOUNTANT')
    )
);

-- ============================================
-- SAMPLE DATA (Optional)
-- ============================================

-- Insert sample bank accounts (adjust branch_id as needed)
INSERT INTO bank_accounts (branch_id, bank_name, account_number, account_name, account_type, opening_balance, current_balance) VALUES
(1, 'Equity Bank', '0123456789', 'Kyogongs - Main Branch', 'CURRENT', 500000, 500000),
(1, 'KCB Bank', '9876543210', 'Kyogongs - Savings', 'SAVINGS', 1000000, 1000000),
(2, 'Equity Bank', '0123456790', 'Kyogongs - Kyogong Branch', 'CURRENT', 300000, 300000)
ON CONFLICT (branch_id, bank_name, account_number) DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON COLUMN conference_daily_attendance.meal_plan_details IS 'JSON array of meals for this specific day: [{"name": "Breakfast", "price": 500, "menu_item_id": null}]';
COMMENT ON COLUMN banking_transactions.slip_attachment_url IS 'URL to uploaded bank slip/receipt image';
COMMENT ON COLUMN banking_transactions.is_reconciled IS 'Whether this transaction has been reconciled with bank statement';
