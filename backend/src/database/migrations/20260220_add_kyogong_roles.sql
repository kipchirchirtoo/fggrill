-- Migration: Comprehensive Kyogong Authorization & Schema Fix
-- Created: 2026-02-20

-- 1. Add missing roles to user_role enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'kyogong_spa_cashier' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'kyogong_spa_cashier';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'kyogong_executive_bar_cashier' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'kyogong_executive_bar_cashier';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'kyogong_sports_bar_cashier' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'kyogong_sports_bar_cashier';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'kyogong_reception_cashier' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'kyogong_reception_cashier';
    END IF;
END$$;

-- 2. Fix payment_method constraint in shift_transactions to allow 'BILL'
-- First drop if exists (handle older versions)
ALTER TABLE shift_transactions DROP CONSTRAINT IF EXISTS shift_transactions_payment_method_check;
ALTER TABLE shift_transactions ADD CONSTRAINT shift_transactions_payment_method_check 
CHECK (payment_method IN ('CASH', 'MPESA', 'CARD', 'BILL', 'COMPLIMENTARY', 'OTHER'));

-- 3. Add kyogong_transaction_id to payments table for linkage
ALTER TABLE payments ADD COLUMN IF NOT EXISTS kyogong_transaction_id UUID REFERENCES shift_transactions(id);

COMMENT ON TYPE user_role IS 'Updated user roles including Kyogong-specific cashier roles.';
COMMENT ON TABLE shift_transactions IS 'Kyogong POS transactions with support for BILL payment method.';
