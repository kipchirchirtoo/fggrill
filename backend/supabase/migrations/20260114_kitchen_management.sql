-- Kitchen Management Module - Database Schema Migration
-- Created: 2026-01-14
-- Description: Ledger-based kitchen stock tracking with recipes, requisitions, and food cost control

-- =====================================================
-- 1. KITCHEN STOCK TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_stock (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL,
  current_balance DECIMAL(10,3) DEFAULT 0, -- Computed from ledger
  reorder_level DECIMAL(10,3) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(branch_id, item_sku)
);

CREATE INDEX idx_k_main_stock_branch ON kitchen_stock(branch_id);
CREATE INDEX idx_k_main_stock_sku ON kitchen_stock(item_sku);

-- =====================================================
-- 2. KITCHEN STOCK LEDGER (Immutable Transaction Log)
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_stock_ledger (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  transaction_date TIMESTAMP DEFAULT NOW(),
  transaction_type VARCHAR(50) NOT NULL, -- 'RECEIPT', 'USAGE', 'WASTAGE', 'ADJUSTMENT', 'OPENING'
  reference_type VARCHAR(50), -- 'GRN', 'POS_ORDER', 'WASTAGE', 'MANUAL', 'OPENING_BALANCE'
  reference_id VARCHAR(100),
  opening_balance DECIMAL(10,3) NOT NULL,
  quantity_in DECIMAL(10,3) DEFAULT 0,
  quantity_out DECIMAL(10,3) DEFAULT 0,
  closing_balance DECIMAL(10,3) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL,
  shift VARCHAR(50),
  user_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_k_main_stock_ledger_branch_item ON kitchen_stock_ledger(branch_id, item_sku, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_k_main_stock_ledger_date ON kitchen_stock_ledger(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_k_main_stock_ledger_type ON kitchen_stock_ledger(transaction_type);

-- =====================================================
-- 3. KITCHEN REQUISITIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_requisitions (
  id SERIAL PRIMARY KEY,
  requisition_number VARCHAR(50) UNIQUE NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id),
  requested_at TIMESTAMP DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'
  priority VARCHAR(50) DEFAULT 'NORMAL', -- 'LOW', 'NORMAL', 'HIGH', 'URGENT'
  reason TEXT,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_k_main_req_branch ON kitchen_requisitions(branch_id);
CREATE INDEX idx_k_main_req_status ON kitchen_requisitions(status);
CREATE INDEX idx_k_main_req_date ON kitchen_requisitions(requested_at DESC);

-- =====================================================
-- 4. KITCHEN REQUISITION ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_requisition_items (
  id SERIAL PRIMARY KEY,
  requisition_id INTEGER REFERENCES kitchen_requisitions(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  requested_quantity DECIMAL(10,3) NOT NULL,
  approved_quantity DECIMAL(10,3),
  issued_quantity DECIMAL(10,3),
  unit_of_measure VARCHAR(50) NOT NULL,
  notes TEXT
);

CREATE INDEX idx_k_main_req_items_req ON kitchen_requisition_items(requisition_id);

-- =====================================================
-- 5. KITCHEN GRN (Goods Received Note)
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_grn (
  id SERIAL PRIMARY KEY,
  grn_number VARCHAR(50) UNIQUE NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  requisition_id INTEGER REFERENCES kitchen_requisitions(id),
  received_by UUID REFERENCES users(id),
  received_at TIMESTAMP DEFAULT NOW(),
  issued_by UUID REFERENCES users(id), -- Storekeeper
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_k_main_grn_branch ON kitchen_grn(branch_id);
CREATE INDEX idx_k_main_grn_req ON kitchen_grn(requisition_id);

-- =====================================================
-- 6. KITCHEN GRN ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_grn_items (
  id SERIAL PRIMARY KEY,
  grn_id INTEGER REFERENCES kitchen_grn(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL,
  ledger_entry_id INTEGER REFERENCES kitchen_stock_ledger(id)
);

CREATE INDEX idx_k_main_grn_items_grn ON kitchen_grn_items(grn_id);

-- =====================================================
-- 7. RECIPES (Bill of Materials)
-- =====================================================
CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  menu_item_id UUID REFERENCES restaurant_menu_items(id),
  menu_item_name VARCHAR(255) NOT NULL,
  recipe_code VARCHAR(50) UNIQUE,
  portion_size VARCHAR(50),
  portions_per_recipe INTEGER DEFAULT 1,
  standard_cost DECIMAL(10,2), -- Computed from ingredients
  selling_price DECIMAL(10,2),
  food_cost_percentage DECIMAL(5,2), -- Auto-calculated
  preparation_time INTEGER, -- minutes
  cooking_instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recipes_menu_item ON recipes(menu_item_id);
CREATE INDEX idx_recipes_active ON recipes(is_active);

-- =====================================================
-- 8. RECIPE ITEMS (BOM Items)
-- =====================================================
CREATE TABLE IF NOT EXISTS recipe_items (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity_per_portion DECIMAL(10,3) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL,
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2), -- quantity * unit_cost
  notes TEXT
);

CREATE INDEX idx_recipe_items_recipe ON recipe_items(recipe_id);

-- =====================================================
-- 9. KITCHEN USAGE
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_usage (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  usage_type VARCHAR(50) NOT NULL, -- 'SALES', 'STAFF_MEAL', 'COMPLIMENTARY', 'TEST', 'OTHER'
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL,
  linked_order_id UUID REFERENCES restaurant_orders(id),
  linked_menu_item_id UUID REFERENCES restaurant_menu_items(id),
  recipe_id INTEGER REFERENCES recipes(id),
  shift VARCHAR(50),
  chef_on_duty UUID REFERENCES users(id),
  notes TEXT,
  ledger_entry_id INTEGER REFERENCES kitchen_stock_ledger(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_k_main_usage_branch_date ON kitchen_usage(branch_id, usage_date DESC);
CREATE INDEX idx_k_main_usage_type ON kitchen_usage(usage_type);
CREATE INDEX idx_k_main_usage_order ON kitchen_usage(linked_order_id);

-- =====================================================
-- 10. KITCHEN WASTAGE
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_wastage (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  wastage_date DATE NOT NULL,
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_of_measure VARCHAR(50) NOT NULL,
  reason VARCHAR(255) NOT NULL, -- 'SPOILAGE', 'OVERCOOKING', 'CONTAMINATION', 'EXPIRED', 'DROPPED', 'OTHER'
  estimated_value DECIMAL(10,2),
  photo_url TEXT,
  reported_by UUID REFERENCES users(id),
  shift VARCHAR(50),
  ledger_entry_id INTEGER REFERENCES kitchen_stock_ledger(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_k_main_wastage_branch_date ON kitchen_wastage(branch_id, wastage_date DESC);
CREATE INDEX idx_k_main_wastage_reason ON kitchen_wastage(reason);

-- =====================================================
-- 11. KITCHEN DAILY VARIANCE
-- =====================================================
CREATE TABLE IF NOT EXISTS kitchen_daily_variance (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  variance_date DATE NOT NULL,
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  opening_stock DECIMAL(10,3),
  received_qty DECIMAL(10,3),
  expected_usage DECIMAL(10,3), -- From POS sales
  actual_usage DECIMAL(10,3), -- From physical count
  wastage_qty DECIMAL(10,3),
  expected_closing DECIMAL(10,3),
  actual_closing DECIMAL(10,3),
  variance DECIMAL(10,3), -- expected_closing - actual_closing
  variance_percentage DECIMAL(5,2),
  is_flagged BOOLEAN DEFAULT false, -- Auto-flag if variance > threshold
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(branch_id, variance_date, item_sku)
);

CREATE INDEX idx_k_main_variance_branch_date ON kitchen_daily_variance(branch_id, variance_date DESC);
CREATE INDEX idx_k_main_variance_flagged ON kitchen_daily_variance(is_flagged);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update kitchen stock balance from ledger
DROP FUNCTION IF EXISTS update_kitchen_stock_balance() CASCADE;
CREATE OR REPLACE FUNCTION update_kitchen_stock_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the current balance in kitchen_stock
  UPDATE kitchen_stock
  SET 
    current_balance = NEW.closing_balance,
    last_updated = NOW()
  WHERE branch_id = NEW.branch_id AND item_sku = NEW.item_sku;
  
  -- If item doesn't exist in kitchen_stock, create it
  IF NOT FOUND THEN
    INSERT INTO kitchen_stock (branch_id, item_sku, item_name, unit_of_measure, current_balance)
    VALUES (NEW.branch_id, NEW.item_sku, NEW.item_name, NEW.unit_of_measure, NEW.closing_balance);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update stock balance when ledger entry is created
CREATE TRIGGER trigger_update_kitchen_stock
AFTER INSERT ON kitchen_stock_ledger
FOR EACH ROW
EXECUTE FUNCTION update_kitchen_stock_balance();

-- Function to generate requisition number
DROP FUNCTION IF EXISTS generate_requisition_number() CASCADE;
CREATE OR REPLACE FUNCTION generate_requisition_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requisition_number IS NULL OR NEW.requisition_number = '' THEN
    NEW.requisition_number := 'KR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('kitchen_requisitions_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gen_requisition_number
BEFORE INSERT ON kitchen_requisitions
FOR EACH ROW
EXECUTE FUNCTION generate_requisition_number();

-- Function to generate GRN number
DROP FUNCTION IF EXISTS generate_grn_number() CASCADE;
CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.grn_number IS NULL OR NEW.grn_number = '' THEN
    NEW.grn_number := 'KGRN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('kitchen_grn_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gen_grn_number
BEFORE INSERT ON kitchen_grn
FOR EACH ROW
EXECUTE FUNCTION generate_grn_number();

-- Function to calculate recipe cost
DROP FUNCTION IF EXISTS calculate_recipe_cost() CASCADE;
CREATE OR REPLACE FUNCTION calculate_recipe_cost()
RETURNS TRIGGER AS $$
DECLARE
  total_cost DECIMAL(10,2);
BEGIN
  -- Calculate total cost from recipe items
  SELECT COALESCE(SUM(total_cost), 0) INTO total_cost
  FROM recipe_items
  WHERE recipe_id = NEW.recipe_id;
  
  -- Update recipe standard cost
  UPDATE recipes
  SET 
    standard_cost = total_cost,
    food_cost_percentage = CASE 
      WHEN selling_price > 0 THEN (total_cost / selling_price * 100)
      ELSE 0
    END,
    updated_at = NOW()
  WHERE id = NEW.recipe_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calc_recipe_cost
AFTER INSERT OR UPDATE ON recipe_items
FOR EACH ROW
EXECUTE FUNCTION calculate_recipe_cost();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE kitchen_stock IS 'Current kitchen stock balances (computed from ledger)';
COMMENT ON TABLE kitchen_stock_ledger IS 'Immutable transaction log for all kitchen stock movements';
COMMENT ON TABLE kitchen_requisitions IS 'Requests from kitchen to main store for items';
COMMENT ON TABLE kitchen_grn IS 'Goods received notes when kitchen receives items from store';
COMMENT ON TABLE recipes IS 'Bill of materials for menu items';
COMMENT ON TABLE recipe_items IS 'Ingredients required for each recipe';
COMMENT ON TABLE kitchen_usage IS 'Track all stock usage (sales, staff meals, etc)';
COMMENT ON TABLE kitchen_wastage IS 'Record all wastage with reasons';
COMMENT ON TABLE kitchen_daily_variance IS 'Daily variance between expected and actual stock';
