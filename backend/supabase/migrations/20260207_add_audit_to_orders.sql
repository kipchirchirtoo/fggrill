-- Migration: Add Audit Fields to Order Tables
-- This allows auditors to verify and clear voided/cancelled orders.

DO $$ 
BEGIN
    -- 1. Update restaurant_orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'auditor_id') THEN
        ALTER TABLE restaurant_orders ADD COLUMN auditor_id UUID REFERENCES users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'audited_at') THEN
        ALTER TABLE restaurant_orders ADD COLUMN audited_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'audit_notes') THEN
        ALTER TABLE restaurant_orders ADD COLUMN audit_notes TEXT;
    END IF;

    -- 2. Update bar_orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bar_orders' AND column_name = 'auditor_id') THEN
        ALTER TABLE bar_orders ADD COLUMN auditor_id UUID REFERENCES users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bar_orders' AND column_name = 'audited_at') THEN
        ALTER TABLE bar_orders ADD COLUMN audited_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bar_orders' AND column_name = 'audit_notes') THEN
        ALTER TABLE bar_orders ADD COLUMN audit_notes TEXT;
    END IF;

END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_auditor ON restaurant_orders(auditor_id);
CREATE INDEX IF NOT EXISTS idx_bar_orders_auditor ON bar_orders(auditor_id);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
