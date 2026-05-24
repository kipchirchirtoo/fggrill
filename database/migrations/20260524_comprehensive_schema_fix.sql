-- Comprehensive Schema Fix Migration
-- Addresses schema mismatches identified in audit
-- Run this migration to fix missing tables and columns

-- ============================================
-- 1. Create Missing Tables
-- ============================================

-- Notifications table (if not exists)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Loyalty transactions table (if not exists)
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    transaction_type VARCHAR(50) NOT NULL, -- 'earn', 'redeem', 'expire'
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_guest_id ON loyalty_transactions(guest_id);

-- Audit config consumption table (if not exists)
CREATE TABLE IF NOT EXISTS audit_config_consumption (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    item_id UUID,
    expected_quantity DECIMAL(10,2),
    actual_quantity DECIMAL(10,2),
    variance DECIMAL(10,2),
    audit_date DATE DEFAULT CURRENT_DATE,
    audited_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_config_branch_id ON audit_config_consumption(branch_id);

-- Discrepancy flags table (if not exists)
CREATE TABLE IF NOT EXISTS discrepancy_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    item_id UUID,
    discrepancy_type VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discrepancy_flags_branch_id ON discrepancy_flags(branch_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_flags_resolved ON discrepancy_flags(resolved);

-- Branch notifications table (if not exists)
CREATE TABLE IF NOT EXISTS branch_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    notification_type VARCHAR(50) DEFAULT 'info',
    source VARCHAR(100),
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_branch_notifications_branch_id ON branch_notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_notifications_is_global ON branch_notifications(is_global);

-- Branch messages table (if not exists)
CREATE TABLE IF NOT EXISTS branch_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    sender_id UUID REFERENCES users(id),
    recipient_id UUID REFERENCES users(id),
    is_global BOOLEAN DEFAULT false,
    subject VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_messages_branch_id ON branch_messages(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_messages_recipient_id ON branch_messages(recipient_id);

-- ============================================
-- 2. Add Missing Columns
-- ============================================

-- Add payment_status to bookings if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
        COMMENT ON COLUMN bookings.payment_status IS 'Payment status: pending, partial, paid, overdue, cancelled';
    END IF;
END $$;

-- Add branch_id to payments if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN branch_id INTEGER REFERENCES branches(id);
        -- Backfill branch_id from related bookings
        UPDATE payments p
        SET branch_id = b.branch_id
        FROM bookings b
        WHERE p.booking_id = b.id AND p.branch_id IS NULL;
        COMMENT ON COLUMN payments.branch_id IS 'Branch ID for multi-branch isolation';
    END IF;
END $$;

-- Add auditor fields to credit_bills if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_bills' AND column_name = 'auditor_id'
    ) THEN
        ALTER TABLE credit_bills ADD COLUMN auditor_id UUID REFERENCES users(id);
        COMMENT ON COLUMN credit_bills.auditor_id IS 'Auditor who reviewed the credit bill';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_bills' AND column_name = 'auditor_notes'
    ) THEN
        ALTER TABLE credit_bills ADD COLUMN auditor_notes TEXT;
        COMMENT ON COLUMN credit_bills.auditor_notes IS 'Notes from auditor review';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_bills' AND column_name = 'audited_at'
    ) THEN
        ALTER TABLE credit_bills ADD COLUMN audited_at TIMESTAMPTZ;
        COMMENT ON COLUMN credit_bills.audited_at IS 'Timestamp when auditor reviewed the bill';
    END IF;
END $$;

-- ============================================
-- 3. Create Helper Functions
-- ============================================

-- Function to get table columns (for schema audit)
CREATE OR REPLACE FUNCTION get_table_columns(table_name TEXT)
RETURNS TABLE (
    column_name TEXT,
    data_type TEXT,
    is_nullable TEXT,
    column_default TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.column_name::TEXT,
        c.data_type::TEXT,
        c.is_nullable::TEXT,
        c.column_default::TEXT
    FROM information_schema.columns c
    WHERE c.table_name = lower(table_name)
    AND c.table_schema = 'public'
    ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Enable Row Level Security
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_config_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE discrepancy_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_messages ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust based on your security requirements)
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view loyalty transactions for their guests" ON loyalty_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM guests g 
            WHERE g.id = loyalty_transactions.guest_id 
            AND g.user_id = auth.uid()
        )
    );

-- ============================================
-- 5. Create Updated Triggers
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
DO $$
DECLARE
    table_rec RECORD;
BEGIN
    FOR table_rec IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS update_%s_updated_at ON %I',
            table_rec.table_name, table_rec.table_name
        );
        EXECUTE format(
            'CREATE TRIGGER update_%s_updated_at 
             BEFORE UPDATE ON %I 
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            table_rec.table_name, table_rec.table_name
        );
    END LOOP;
END $$;

-- ============================================
-- 6. Verification Queries
-- ============================================

-- Verify tables exist
DO $$
DECLARE
    table_rec RECORD;
    missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
    FOR table_rec IN 
        SELECT unnest(ARRAY['notifications', 'loyalty_transactions', 'audit_config_consumption', 
                           'discrepancy_flags', 'branch_notifications', 'branch_messages']) as table_name
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = table_rec.table_name 
            AND table_schema = 'public'
        ) THEN
            missing_tables := array_append(missing_tables, table_rec.table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE NOTICE 'Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✅ All required tables exist';
    END IF;
END $$;

-- Verify columns exist
DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'payment_status'
    ) THEN
        missing_columns := array_append(missing_columns, 'bookings.payment_status');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'branch_id'
    ) THEN
        missing_columns := array_append(missing_columns, 'payments.branch_id');
    END IF;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE 'Missing columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ All required columns exist';
    END IF;
END $$;
