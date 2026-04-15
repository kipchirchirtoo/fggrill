-- =====================================================
-- PHASE 3A: CREATE ONLY MISSING TABLES
-- Migration: 20260415_phase3a_create_missing_tables_only.sql
-- Created: April 15, 2026
-- Purpose: Create 6 missing tables and add 8 missing columns
-- =====================================================

-- =====================================================
-- SECTION 1: CREATE MISSING TABLES (6 tables)
-- =====================================================

-- 1. Create store_inventory table
CREATE TABLE IF NOT EXISTS store_inventory (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL,
    item_id VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 0,
    unit_of_measure VARCHAR(50) DEFAULT 'pcs',
    unit_cost NUMERIC(12, 2) DEFAULT 0,
    total_value NUMERIC(12, 2) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, item_id)
);

-- 2. Create folio_transactions table
CREATE TABLE IF NOT EXISTS folio_transactions (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL,
    booking_id UUID,
    transaction_type VARCHAR(50) NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50),
    reference VARCHAR(255),
    posted_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL,
    movement_number VARCHAR(50) UNIQUE NOT NULL,
    item_id VARCHAR(100) NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_of_measure VARCHAR(50) DEFAULT 'pcs',
    reference_type VARCHAR(50),
    reference_id INTEGER,
    performed_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create inventory_transfers table
CREATE TABLE IF NOT EXISTS inventory_transfers (
    id SERIAL PRIMARY KEY,
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    from_branch_id INTEGER NOT NULL,
    to_branch_id INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    requested_by UUID,
    approved_by UUID,
    sent_by UUID,
    received_by UUID,
    sent_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create inventory_transfer_items table
CREATE TABLE IF NOT EXISTS inventory_transfer_items (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL,
    item_id VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity_requested INTEGER NOT NULL,
    quantity_sent INTEGER,
    quantity_received INTEGER,
    unit_of_measure VARCHAR(50) DEFAULT 'pcs',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create kitchen_food_control_logs table
CREATE TABLE IF NOT EXISTS kitchen_food_control_logs (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL,
    log_date DATE NOT NULL,
    shift VARCHAR(50),
    item_name VARCHAR(255) NOT NULL,
    quantity_prepared INTEGER,
    quantity_sold INTEGER,
    quantity_wasted INTEGER,
    waste_reason TEXT,
    recorded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SECTION 2: ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================

-- 2.1 Add invoice_id to bookings table (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_id INTEGER;
    END IF;
END $$;

-- 2.2 Add invoice_id to restaurant_reservations table (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_reservations') THEN
        ALTER TABLE restaurant_reservations ADD COLUMN IF NOT EXISTS invoice_id INTEGER;
    END IF;
END $$;

-- 2.3 Add updated_at to accounting_bank_transactions table (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounting_bank_transactions') THEN
        ALTER TABLE accounting_bank_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2.4 Add updated_at to stock_counts table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_counts') THEN
        ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2.5 Add is_flagged to accounting_ar_invoices table (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounting_ar_invoices') THEN
        ALTER TABLE accounting_ar_invoices ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2.6 Add is_available to hk_staff_profiles table (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hk_staff_profiles') THEN
        ALTER TABLE hk_staff_profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 2.7 Add assigned_to to hk_tasks table (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hk_tasks') THEN
        ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS assigned_to UUID;
    END IF;
END $$;

-- 2.8 Add is_bar to restaurant_menu_categories table (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_menu_categories') THEN
        ALTER TABLE restaurant_menu_categories ADD COLUMN IF NOT EXISTS is_bar BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- =====================================================
-- SECTION 3: CREATE INDEXES FOR NEW TABLES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_store_inventory_branch_id ON store_inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_item_id ON store_inventory(item_id);

CREATE INDEX IF NOT EXISTS idx_folio_transactions_branch_id ON folio_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_folio_transactions_booking_id ON folio_transactions(booking_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_id ON stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from_branch ON inventory_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to_branch ON inventory_transfers(to_branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_status ON inventory_transfers(status);

CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_transfer_id ON inventory_transfer_items(transfer_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_food_control_logs_branch_id ON kitchen_food_control_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_food_control_logs_log_date ON kitchen_food_control_logs(log_date);

-- =====================================================
-- SECTION 4: ENABLE RLS ON NEW TABLES
-- =====================================================

ALTER TABLE store_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE folio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_food_control_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 5: CREATE BASIC RLS POLICIES
-- =====================================================

CREATE POLICY "store_inventory_select_policy" ON store_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "folio_transactions_select_policy" ON folio_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_movements_select_policy" ON stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_transfers_select_policy" ON inventory_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_transfer_items_select_policy" ON inventory_transfer_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "kitchen_food_control_logs_select_policy" ON kitchen_food_control_logs FOR SELECT TO authenticated USING (true);

-- =====================================================
-- SECTION 6: CREATE AUTO-UPDATE TRIGGERS
-- =====================================================

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to inventory_transfers
CREATE TRIGGER update_inventory_transfers_updated_at BEFORE UPDATE ON inventory_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Summary:
-- ✓ Created 6 missing tables
-- ✓ Added 8 missing columns to existing tables
-- ✓ Created 10+ performance indexes
-- ✓ Enabled RLS on all new tables
-- ✓ Created basic RLS policies
-- ✓ Added auto-update triggers
--
-- This migration fixes the remaining CRITICAL errors from the schema audit.
