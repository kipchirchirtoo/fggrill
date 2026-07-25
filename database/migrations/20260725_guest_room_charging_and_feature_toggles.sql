-- Migration: Guest Room Charging & Feature Toggles Configuration
-- Date: 2026-07-25

-- 1. Ensure branch_features table supports key/name, category, config, effective_from
CREATE TABLE IF NOT EXISTS branch_features (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    feature_key VARCHAR(100),
    category VARCHAR(50) DEFAULT 'General',
    is_enabled BOOLEAN DEFAULT FALSE,
    config JSONB DEFAULT '{}'::jsonb,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, feature_name)
);

-- Backfill feature_key from feature_name where null
UPDATE branch_features SET feature_key = feature_name WHERE feature_key IS NULL;

-- 2. Create index on branch_features
CREATE INDEX IF NOT EXISTS idx_branch_features_branch ON branch_features(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_features_key ON branch_features(branch_id, feature_key);

-- 3. Ensure folio_transactions table supports item snapshot & room charge metadata
CREATE TABLE IF NOT EXISTS folio_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID REFERENCES folios(id) ON DELETE SET NULL,
    booking_id UUID,
    guest_id UUID,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    room_number VARCHAR(50),
    type VARCHAR(30) DEFAULT 'charge',
    category VARCHAR(50) NOT NULL DEFAULT 'Other',
    outlet_name VARCHAR(100),
    outlet_type VARCHAR(50),
    pos_bill_number VARCHAR(100),
    pos_order_number VARCHAR(100),
    amount DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0.00,
    discount DECIMAL(10, 2) DEFAULT 0.00,
    service_charge DECIMAL(10, 2) DEFAULT 0.00,
    description TEXT NOT NULL,
    items_snapshot JSONB DEFAULT '[]'::jsonb,
    posted_by UUID,
    posted_by_name VARCHAR(100),
    waiter_name VARCHAR(100),
    status VARCHAR(30) DEFAULT 'active',
    reversal_status VARCHAR(30),
    reversed_at TIMESTAMPTZ,
    reversed_by UUID,
    reversal_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folio_trans_booking ON folio_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_folio_trans_folio ON folio_transactions(folio_id);
CREATE INDEX IF NOT EXISTS idx_folio_trans_branch ON folio_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_folio_trans_status ON folio_transactions(status);

-- 4. Add room charge columns to POS order/bill tables if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pos_orders' AND column_name = 'room_number') THEN
        ALTER TABLE pos_orders ADD COLUMN room_number VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pos_orders' AND column_name = 'guest_name') THEN
        ALTER TABLE pos_orders ADD COLUMN guest_name VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pos_orders' AND column_name = 'booking_id') THEN
        ALTER TABLE pos_orders ADD COLUMN booking_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pos_orders' AND column_name = 'folio_transaction_id') THEN
        ALTER TABLE pos_orders ADD COLUMN folio_transaction_id UUID;
    END IF;
END $$;

-- 5. Seed standard feature keys for existing branches
INSERT INTO branch_features (branch_id, feature_name, feature_key, category, is_enabled, config)
SELECT b.id, f.key, f.key, f.cat, f.enabled, '{}'::jsonb
FROM branches b
CROSS JOIN (
    VALUES 
        ('GUEST_ROOM_CHARGING', 'Accommodation', TRUE),
        ('RESTAURANT_ROOM_CHARGING', 'Restaurant POS', TRUE),
        ('EXECUTIVE_BAR_ROOM_CHARGING', 'Bar POS', TRUE),
        ('SPORTS_BAR_ROOM_CHARGING', 'Bar POS', FALSE)
) AS f(key, cat, enabled)
ON CONFLICT (branch_id, feature_name) DO NOTHING;
