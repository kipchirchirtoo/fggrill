-- =====================================================
-- PHASE 3E: SAFE FINAL CLEANUP
-- Migration: 20260415_phase3e_safe_cleanup.sql
-- Created: April 15, 2026
-- Purpose: Safely make columns optional where they exist
-- =====================================================

-- Helper function to safely alter column
CREATE OR REPLACE FUNCTION safe_alter_column_nullable(
    p_table_name TEXT,
    p_column_name TEXT
) RETURNS VOID AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = p_table_name AND column_name = p_column_name
    ) THEN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL', p_table_name, p_column_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Make key columns optional
SELECT safe_alter_column_nullable('cashier_transactions', 'branch_id');
SELECT safe_alter_column_nullable('cashier_transactions', 'transaction_type');
SELECT safe_alter_column_nullable('cashier_transactions', 'cashier_id');
SELECT safe_alter_column_nullable('cashier_transactions', 'amount');

SELECT safe_alter_column_nullable('folio_transactions', 'branch_id');
SELECT safe_alter_column_nullable('folio_transactions', 'transaction_type');
SELECT safe_alter_column_nullable('folio_transactions', 'amount');

SELECT safe_alter_column_nullable('expenses', 'branch_id');
SELECT safe_alter_column_nullable('expenses', 'amount');

SELECT safe_alter_column_nullable('staff_payroll_adjustments', 'staff_id');
SELECT safe_alter_column_nullable('staff_payroll_adjustments', 'branch_id');
SELECT safe_alter_column_nullable('staff_payroll_adjustments', 'amount');

SELECT safe_alter_column_nullable('staff_loans', 'staff_id');
SELECT safe_alter_column_nullable('staff_loans', 'branch_id');
SELECT safe_alter_column_nullable('staff_loans', 'principal_amount');

SELECT safe_alter_column_nullable('staff_advances', 'staff_id');
SELECT safe_alter_column_nullable('staff_advances', 'branch_id');
SELECT safe_alter_column_nullable('staff_advances', 'amount');

-- Set defaults where columns exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashier_transactions' AND column_name = 'transaction_type') THEN
        ALTER TABLE cashier_transactions ALTER COLUMN transaction_type SET DEFAULT 'sale';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashier_transactions' AND column_name = 'amount') THEN
        ALTER TABLE cashier_transactions ALTER COLUMN amount SET DEFAULT 0;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'folio_transactions' AND column_name = 'transaction_type') THEN
        ALTER TABLE folio_transactions ALTER COLUMN transaction_type SET DEFAULT 'charge';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'folio_transactions' AND column_name = 'amount') THEN
        ALTER TABLE folio_transactions ALTER COLUMN amount SET DEFAULT 0;
    END IF;
END $$;

-- Create missing tables
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER,
    name VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    price NUMERIC(12, 2) DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    preparation_time INTEGER DEFAULT 0,
    image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER,
    name VARCHAR(100),
    start_time TIME,
    end_time TIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "menu_items_select_policy" ON menu_items;
CREATE POLICY "menu_items_select_policy" ON menu_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shifts_select_policy" ON shifts;
CREATE POLICY "shifts_select_policy" ON shifts FOR SELECT TO authenticated USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_branch_id ON menu_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_shifts_branch_id ON shifts(branch_id);

-- Drop helper function
DROP FUNCTION IF EXISTS safe_alter_column_nullable(TEXT, TEXT);

-- Summary: Made key columns optional and created missing tables
