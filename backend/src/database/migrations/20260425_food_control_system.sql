-- =====================================================
-- FOOD CONTROL & FINANCIAL INTELLIGENCE ENGINE
-- Migration: 20260425_food_control_system.sql
-- Description: Complete food control system with buffet, catering, and shift P&L
-- =====================================================

-- =====================================================
-- 1. EXTEND EXISTING TABLES
-- =====================================================

-- Add cost_per_unit to inventory_items if not exists
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(12,4) DEFAULT 0;

-- Add category to menu items if not exists
ALTER TABLE restaurant_menu_items 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) 
CHECK (category IN ('food','drink','buffet_item','catering_item','combo'));

-- Add recipe locking fields
ALTER TABLE recipes 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- =====================================================
-- 2. RECIPE CHANGE LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS recipe_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id),
  old_quantity DECIMAL(10,4),
  new_quantity DECIMAL(10,4),
  old_data JSONB,
  new_data JSONB,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES users(id),
  branch_id INTEGER REFERENCES branches(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_change_log_recipe ON recipe_change_log(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_change_log_date ON recipe_change_log(changed_at DESC);

-- =====================================================
-- 3. STOCK ISSUES (Enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS stock_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id INTEGER REFERENCES inventory_items(id),
  item_sku VARCHAR(50) NOT NULL,
  quantity_issued DECIMAL(10,4) NOT NULL,
  issued_to VARCHAR(30) CHECK (issued_to IN ('kitchen','buffet','catering','bar')),
  reference_type VARCHAR(20) CHECK (reference_type IN ('POS','BUFFET','CATERING','BAR','MANUAL')),
  reference_id VARCHAR(100),
  shift_id INTEGER,
  issued_by UUID NOT NULL REFERENCES users(id),
  received_by UUID REFERENCES users(id),
  notes TEXT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_issues_branch ON stock_issues(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_issues_shift ON stock_issues(shift_id);
CREATE INDEX IF NOT EXISTS idx_stock_issues_reference ON stock_issues(reference_type, reference_id);

-- =====================================================
-- 4. WASTE LOGS (Enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS waste_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id INTEGER REFERENCES inventory_items(id),
  item_sku VARCHAR(50) NOT NULL,
  quantity_wasted DECIMAL(10,4) NOT NULL,
  reason VARCHAR(50) CHECK (reason IN ('spillage','spoilage','over_production','theft','expired','contamination','other')),
  description TEXT,
  estimated_value DECIMAL(12,2),
  photo_url TEXT,
  shift_id INTEGER,
  logged_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approval_notes TEXT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waste_logs_branch ON waste_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_shift ON waste_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_reason ON waste_logs(reason);

-- =====================================================
-- 5. BUFFET MANAGEMENT
-- =====================================================
CREATE TABLE IF NOT EXISTS buffets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  buffet_type VARCHAR(30) CHECK (buffet_type IN ('breakfast','lunch','dinner','conference','custom')),
  price_per_person DECIMAL(12,2) NOT NULL,
  expected_guests INT NOT NULL DEFAULT 0,
  actual_guests INT,
  shift_id INTEGER,
  opened_by UUID REFERENCES users(id),
  closed_by UUID REFERENCES users(id),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned','active','closed','cancelled')),
  notes TEXT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buffets_branch ON buffets(branch_id);
CREATE INDEX IF NOT EXISTS idx_buffets_shift ON buffets(shift_id);
CREATE INDEX IF NOT EXISTS idx_buffets_status ON buffets(status);
CREATE INDEX IF NOT EXISTS idx_buffets_date ON buffets(created_at DESC);

-- =====================================================
-- 6. BUFFET MENU ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS buffet_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buffet_id UUID NOT NULL REFERENCES buffets(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES restaurant_menu_items(id),
  menu_item_name VARCHAR(255) NOT NULL,
  portion_per_guest DECIMAL(10,4) DEFAULT 1.0,
  recipe_id INTEGER REFERENCES recipes(id),
  UNIQUE(buffet_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_buffet_menu_items_buffet ON buffet_menu_items(buffet_id);

-- =====================================================
-- 7. CATERING EVENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS catering_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_number VARCHAR(50) UNIQUE NOT NULL,
  client_name VARCHAR(150) NOT NULL,
  client_phone VARCHAR(20),
  client_email VARCHAR(100),
  event_name VARCHAR(200),
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT NOT NULL,
  expected_guests INT NOT NULL,
  actual_guests INT,
  agreed_price DECIMAL(14,2) NOT NULL,
  deposit_paid DECIMAL(14,2) DEFAULT 0,
  balance_due DECIMAL(14,2) GENERATED ALWAYS AS (agreed_price - deposit_paid) STORED,
  lead_chef UUID REFERENCES users(id),
  catering_manager UUID REFERENCES users(id),
  status VARCHAR(30) DEFAULT 'pending' 
    CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','invoiced')),
  shift_id INTEGER,
  notes TEXT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catering_events_branch ON catering_events(branch_id);
CREATE INDEX IF NOT EXISTS idx_catering_events_shift ON catering_events(shift_id);
CREATE INDEX IF NOT EXISTS idx_catering_events_status ON catering_events(status);
CREATE INDEX IF NOT EXISTS idx_catering_events_date ON catering_events(event_date DESC);

-- =====================================================
-- 8. CATERING MENU ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS catering_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES catering_events(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES restaurant_menu_items(id),
  menu_item_name VARCHAR(255) NOT NULL,
  quantity_expected INT NOT NULL,
  quantity_actual INT,
  recipe_id INTEGER REFERENCES recipes(id),
  UNIQUE(event_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_catering_menu_items_event ON catering_menu_items(event_id);

-- =====================================================
-- 9. CATERING STOCK ALLOCATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS catering_stock_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES catering_events(id) ON DELETE CASCADE,
  ingredient_id INTEGER REFERENCES inventory_items(id),
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity_allocated DECIMAL(10,4) NOT NULL,
  quantity_returned DECIMAL(10,4) DEFAULT 0,
  quantity_used DECIMAL(10,4) GENERATED ALWAYS AS (quantity_allocated - quantity_returned) STORED,
  unit_cost DECIMAL(12,4),
  total_cost DECIMAL(12,4) GENERATED ALWAYS AS ((quantity_allocated - quantity_returned) * unit_cost) STORED,
  allocated_by UUID REFERENCES users(id),
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  branch_id INTEGER NOT NULL REFERENCES branches(id)
);

CREATE INDEX IF NOT EXISTS idx_catering_stock_allocations_event ON catering_stock_allocations(event_id);
CREATE INDEX IF NOT EXISTS idx_catering_stock_allocations_branch ON catering_stock_allocations(branch_id);

-- =====================================================
-- 10. FOOD CONTROL VARIANCE
-- =====================================================
CREATE TABLE IF NOT EXISTS food_control_variance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id INTEGER NOT NULL,
  ingredient_id INTEGER REFERENCES inventory_items(id),
  item_sku VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  reference_type VARCHAR(20) CHECK (reference_type IN ('POS','BUFFET','CATERING')),
  reference_id VARCHAR(100),
  theoretical_usage DECIMAL(10,4) NOT NULL,
  actual_usage DECIMAL(10,4) NOT NULL,
  variance DECIMAL(10,4) GENERATED ALWAYS AS (actual_usage - theoretical_usage) STORED,
  variance_cost DECIMAL(12,4),
  variance_reason VARCHAR(50) 
    CHECK (variance_reason IN ('wastage','spillage','theft','over_portioning','measurement_error','approved_extra','other')),
  reason_description TEXT,
  requires_explanation BOOLEAN DEFAULT FALSE,
  explained_by UUID REFERENCES users(id),
  explained_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','explained','approved','flagged')),
  flagged_by UUID REFERENCES users(id),
  flagged_at TIMESTAMPTZ,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, item_sku, reference_type, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_food_control_variance_shift ON food_control_variance(shift_id);
CREATE INDEX IF NOT EXISTS idx_food_control_variance_branch ON food_control_variance(branch_id);
CREATE INDEX IF NOT EXISTS idx_food_control_variance_status ON food_control_variance(status);
CREATE INDEX IF NOT EXISTS idx_food_control_variance_requires_explanation ON food_control_variance(requires_explanation);

-- =====================================================
-- 11. SHIFT FINANCIALS (P&L per Shift)
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id INTEGER NOT NULL UNIQUE,
  
  -- Revenue breakdown
  pos_revenue DECIMAL(14,2) DEFAULT 0,
  buffet_revenue DECIMAL(14,2) DEFAULT 0,
  catering_revenue DECIMAL(14,2) DEFAULT 0,
  total_revenue DECIMAL(14,2) GENERATED ALWAYS AS (pos_revenue + buffet_revenue + catering_revenue) STORED,
  
  -- COGS breakdown
  pos_theoretical_cogs DECIMAL(14,2) DEFAULT 0,
  pos_actual_cogs DECIMAL(14,2) DEFAULT 0,
  buffet_theoretical_cogs DECIMAL(14,2) DEFAULT 0,
  buffet_actual_cogs DECIMAL(14,2) DEFAULT 0,
  catering_cogs DECIMAL(14,2) DEFAULT 0,
  
  theoretical_cogs DECIMAL(14,2) GENERATED ALWAYS AS (
    pos_theoretical_cogs + buffet_theoretical_cogs + catering_cogs
  ) STORED,
  actual_cogs DECIMAL(14,2) GENERATED ALWAYS AS (
    pos_actual_cogs + buffet_actual_cogs + catering_cogs
  ) STORED,
  variance_cost DECIMAL(14,2) GENERATED ALWAYS AS (
    (pos_actual_cogs + buffet_actual_cogs) - (pos_theoretical_cogs + buffet_theoretical_cogs)
  ) STORED,
  
  -- Profit
  gross_profit_expected DECIMAL(14,2) GENERATED ALWAYS AS (
    (pos_revenue + buffet_revenue + catering_revenue) - (pos_theoretical_cogs + buffet_theoretical_cogs + catering_cogs)
  ) STORED,
  gross_profit_actual DECIMAL(14,2) GENERATED ALWAYS AS (
    (pos_revenue + buffet_revenue + catering_revenue) - (pos_actual_cogs + buffet_actual_cogs + catering_cogs)
  ) STORED,
  
  -- KPIs
  food_cost_percentage DECIMAL(5,2),
  food_revenue DECIMAL(14,2),
  
  -- Workflow
  status VARCHAR(20) DEFAULT 'draft' 
    CHECK (status IN ('draft','pending_accountant','accountant_reviewed','auditor_approved','flagged')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  accountant_notes TEXT,
  auditor_notes TEXT,
  branch_id INTEGER NOT NULL REFERENCES branches(id)
);

CREATE INDEX IF NOT EXISTS idx_shift_financials_shift ON shift_financials(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_financials_branch ON shift_financials(branch_id);
CREATE INDEX IF NOT EXISTS idx_shift_financials_status ON shift_financials(status);
CREATE INDEX IF NOT EXISTS idx_shift_financials_date ON shift_financials(generated_at DESC);

-- =====================================================
-- 12. BRANCH FOOD CONTROL CONFIG
-- =====================================================
CREATE TABLE IF NOT EXISTS branch_food_control_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL UNIQUE REFERENCES branches(id),
  variance_threshold_kes DECIMAL(12,2) DEFAULT 200,
  variance_threshold_percent DECIMAL(5,2) DEFAULT 10,
  food_cost_alert_threshold DECIMAL(5,2) DEFAULT 35,
  allowed_waste_reason_codes JSONB DEFAULT '["spillage","spoilage","over_production","expired","contamination","other"]'::jsonb,
  require_manager_approval_for_theft BOOLEAN DEFAULT TRUE,
  auto_submit_to_accountant_on_close BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_food_control_config_branch ON branch_food_control_config(branch_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to generate catering event number
CREATE OR REPLACE FUNCTION generate_catering_event_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_number IS NULL OR NEW.event_number = '' THEN
    NEW.event_number := 'CAT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('catering_events_id_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_gen_catering_event_number ON catering_events;
CREATE TRIGGER trigger_gen_catering_event_number
BEFORE INSERT ON catering_events
FOR EACH ROW
EXECUTE FUNCTION generate_catering_event_number();

-- Function to update buffet updated_at
CREATE OR REPLACE FUNCTION update_buffet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_buffet_updated_at ON buffets;
CREATE TRIGGER trigger_update_buffet_updated_at
BEFORE UPDATE ON buffets
FOR EACH ROW
EXECUTE FUNCTION update_buffet_updated_at();

-- Function to update catering event updated_at
CREATE OR REPLACE FUNCTION update_catering_event_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_catering_event_updated_at ON catering_events;
CREATE TRIGGER trigger_update_catering_event_updated_at
BEFORE UPDATE ON catering_events
FOR EACH ROW
EXECUTE FUNCTION update_catering_event_updated_at();

-- =====================================================
-- SEED DEFAULT CONFIGS FOR EXISTING BRANCHES
-- =====================================================
INSERT INTO branch_food_control_config (branch_id)
SELECT id FROM branches
WHERE id NOT IN (SELECT branch_id FROM branch_food_control_config)
ON CONFLICT (branch_id) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE buffets IS 'Buffet events with guest tracking and menu items';
COMMENT ON TABLE catering_events IS 'Outside catering events with stock allocation and P&L';
COMMENT ON TABLE food_control_variance IS 'Theoretical vs actual usage variance per shift';
COMMENT ON TABLE shift_financials IS 'Shift-level P&L with revenue and COGS breakdown';
COMMENT ON TABLE stock_issues IS 'Stock issued to kitchen, buffet, catering, or bar';
COMMENT ON TABLE waste_logs IS 'Waste tracking with approval workflow';
COMMENT ON TABLE recipe_change_log IS 'Audit trail for recipe changes';
COMMENT ON TABLE branch_food_control_config IS 'Branch-specific food control configuration';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
-- Grant appropriate permissions based on existing RBAC patterns
-- This will be handled by the application layer

