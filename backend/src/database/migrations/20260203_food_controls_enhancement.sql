-- Food Controls Enhancement Migration
-- Created: 2026-02-03
-- Description: Adds portion tracking, standard yield rules seeding, and variance accountability

-- =====================================================
-- 1. KITCHEN FOOD CONTROLS (Standard Yield Rules)
-- =====================================================
-- Ensure the table exists if it wasn't captured in previous migrations
CREATE TABLE IF NOT EXISTS kitchen_food_controls (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  raw_item_sku VARCHAR(50),
  raw_item_name VARCHAR(255) NOT NULL,
  raw_quantity DECIMAL(10,3) NOT NULL,
  raw_unit VARCHAR(50) NOT NULL,
  produced_item_name VARCHAR(255) NOT NULL,
  produced_portions DECIMAL(10,3) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(branch_id, raw_item_name, produced_item_name)
);

-- =====================================================
-- 2. KITCHEN PORTION STOCK
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_portion_stock (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) NOT NULL,
  portion_name VARCHAR(255) NOT NULL,
  expected_balance DECIMAL(10,3) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(branch_id, item_sku)
);

CREATE INDEX IF NOT EXISTS idx_k_portion_stock_branch ON kitchen_portion_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_k_portion_stock_sku ON kitchen_portion_stock(item_sku);

-- =====================================================
-- 3. KITCHEN PORTION LEDGER
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_portion_ledger (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) NOT NULL,
  portion_name VARCHAR(255) NOT NULL,
  transaction_date TIMESTAMP DEFAULT NOW(),
  transaction_type VARCHAR(50) NOT NULL, -- 'ISSUE', 'POS_SALE', 'WASTAGE', 'ADJUSTMENT'
  reference_type VARCHAR(50), -- 'GRN', 'POS_ORDER', 'WASTAGE', 'MANUAL'
  reference_id VARCHAR(100),
  opening_balance DECIMAL(10,3) NOT NULL,
  quantity_in DECIMAL(10,3) DEFAULT 0,
  quantity_out DECIMAL(10,3) DEFAULT 0,
  closing_balance DECIMAL(10,3) NOT NULL,
  user_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_k_portion_ledger_branch_sku ON kitchen_portion_ledger(branch_id, item_sku, transaction_date DESC);

-- =====================================================
-- 4. KITCHEN VARIANCE REASONS
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_variance_reasons (
  id SERIAL PRIMARY KEY,
  reason VARCHAR(255) UNIQUE NOT NULL,
  requires_approval BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 5. ENHANCE DAILY VARIANCE
-- =====================================================
ALTER TABLE kitchen_daily_variance
ADD COLUMN IF NOT EXISTS reason_id INTEGER REFERENCES kitchen_variance_reasons(id),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approval_notes TEXT,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- =====================================================
-- 6. SEED DATA
-- =====================================================

-- Seed Variance Reasons
INSERT INTO kitchen_variance_reasons (reason, requires_approval) VALUES
('Over-portioning', false),
('Spillage / Burnt', false),
('Staff meal', true),
('Complimentary (approved)', true),
('Customer return', false),
('Theft / Loss', true),
('Cooking error', false)
ON CONFLICT (reason) DO NOTHING;

-- Seed Standard Yield Rules (Food Controls)
-- We use NULL for branch_id to make them global defaults, or we can seed for a specific branch if needed.
-- For this system, we'll seed them as defaults.
INSERT INTO kitchen_food_controls (raw_item_name, raw_quantity, raw_unit, produced_item_name, produced_portions) VALUES
('BEEF/ MBUZI', 1.0, 'kg', 'Beef/Mbuzi Portions', 4.0),
('BEEF', 1.0, 'kg', 'Mixes/Specials', 10.0),
('MINCED MEAT', 1.0, 'kg', 'Samosas', 30.0),
('EXE FLOUR', 2.0, 'kg', 'Chapatis', 30.0),
('MILK', 1.0, 'liters', 'Tea Cups', 4.0),
('AJAB FLOUR', 2.0, 'kg', 'Ugalis', 8.0),
('FULL CHICKEN', 1.0, 'pieces', 'Chicken Quarters', 4.0),
('POTATOES', 20.0, 'kg', 'Plates of Chips', 15.0),
('RICE', 1.0, 'kg', 'Plates of Rice/Pilau', 7.0)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. PORTION STOCK TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_kitchen_portion_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the expected_balance in kitchen_portion_stock
  UPDATE kitchen_portion_stock
  SET 
    expected_balance = NEW.closing_balance,
    last_updated = NOW()
  WHERE branch_id = NEW.branch_id AND item_sku = NEW.item_sku;
  
  -- If item doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO kitchen_portion_stock (branch_id, item_sku, portion_name, expected_balance)
    VALUES (NEW.branch_id, NEW.item_sku, NEW.portion_name, NEW.closing_balance);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_portion_stock ON kitchen_portion_ledger;
CREATE TRIGGER trigger_update_portion_stock
AFTER INSERT ON kitchen_portion_ledger
FOR EACH ROW
EXECUTE FUNCTION update_kitchen_portion_stock();
