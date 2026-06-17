-- ============================================================
-- KITCHEN SHIFT MANAGEMENT SYSTEM
-- Created: 2026-06-18
-- Purpose: Full shift-based kitchen inventory control with
--          Store → Kitchen → POS → Sales → Stock Take → Approval
-- ============================================================

-- ============================================
-- 1. KITCHEN SHIFTS (Main shift header)
-- ============================================
CREATE TABLE IF NOT EXISTS kitchen_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

    -- Shift timing
    shift_type VARCHAR(50) NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'night')),
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,

    -- Personnel
    opened_by UUID REFERENCES users(id) ON DELETE SET NULL,
    store_keeper_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_chef_ids UUID[] DEFAULT '{}',

    -- Shift status workflow
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN (
        'open',
        'closed',
        'pending_chef_confirmation',
        'pending_accountant_review',
        'approved',
        'rejected'
    )),

    -- Closing info
    total_revenue NUMERIC(14,2) DEFAULT 0,
    total_cogs NUMERIC(14,2) DEFAULT 0,
    total_spoilage_cost NUMERIC(14,2) DEFAULT 0,
    total_variance_cost NUMERIC(14,2) DEFAULT 0,
    closing_notes TEXT,

    -- Approval timestamps
    chef_confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    chef_confirmed_at TIMESTAMPTZ,
    accountant_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    accountant_reviewed_at TIMESTAMPTZ,
    accountant_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    accountant_approved_at TIMESTAMPTZ,
    accountant_rejection_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_shifts_branch ON kitchen_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_shifts_date ON kitchen_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_shifts_status ON kitchen_shifts(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_shifts_store_keeper ON kitchen_shifts(store_keeper_id);

-- ============================================
-- 2. KITCHEN SHIFT ITEMS (Raw materials tracked per shift)
-- ============================================
CREATE TABLE IF NOT EXISTS kitchen_shift_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES kitchen_shifts(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

    -- Item info
    item_sku VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    cost_price NUMERIC(14,2) DEFAULT 0,

    -- Stock tracking
    opening_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
    opening_value NUMERIC(14,2) GENERATED ALWAYS AS (opening_stock * cost_price) STORED,

    -- Additions (store issues, transfers, production outputs)
    additions NUMERIC(14,3) NOT NULL DEFAULT 0,
    additions_value NUMERIC(14,2) GENERATED ALWAYS AS (additions * cost_price) STORED,

    -- Total available
    total_available NUMERIC(14,3) GENERATED ALWAYS AS (opening_stock + additions) STORED,

    -- Consumption (POS sales auto-deduct)
    sold_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    sold_value NUMERIC(14,2) GENERATED ALWAYS AS (sold_quantity * cost_price) STORED,

    -- Spoilage / wastage (manual entry at close)
    spoilage_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    spoilage_reason TEXT,
    spoilage_value NUMERIC(14,2) GENERATED ALWAYS AS (spoilage_quantity * cost_price) STORED,

    -- System closing stock
    system_closing_stock NUMERIC(14,3) GENERATED ALWAYS AS (opening_stock + additions - sold_quantity - spoilage_quantity) STORED,

    -- Physical count (entered at shift close)
    physical_count NUMERIC(14,3),

    -- Variance
    variance NUMERIC(14,3) GENERATED ALWAYS AS (COALESCE(physical_count, 0) - (opening_stock + additions - sold_quantity - spoilage_quantity)) STORED,
    variance_value NUMERIC(14,2) GENERATED ALWAYS AS ((COALESCE(physical_count, 0) - (opening_stock + additions - sold_quantity - spoilage_quantity)) * cost_price) STORED,
    variance_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(shift_id, item_sku)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_shift_items_shift ON kitchen_shift_items(shift_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_shift_items_sku ON kitchen_shift_items(item_sku);

-- ============================================
-- 3. KITCHEN SHIFT PRODUCTION (Raw → Portion conversion)
-- ============================================
CREATE TABLE IF NOT EXISTS kitchen_shift_production (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES kitchen_shifts(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

    -- Recipe / food control reference
    recipe_id UUID,
    food_control_id INTEGER,

    -- Raw material consumed
    raw_item_sku VARCHAR(100) NOT NULL,
    raw_item_name VARCHAR(255) NOT NULL,
    raw_quantity_used NUMERIC(14,3) NOT NULL DEFAULT 0,
    raw_unit VARCHAR(50) NOT NULL,

    -- Produced item (POS sellable)
    produced_item_name VARCHAR(255) NOT NULL,
    produced_item_sku VARCHAR(100),
    pos_outlet_item_id UUID REFERENCES pos_outlet_items(id) ON DELETE SET NULL,
    produced_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    produced_unit VARCHAR(50) NOT NULL DEFAULT 'portion',

    -- Conversion ratio (e.g. 2 kg flour → 27 chapatis)
    conversion_ratio NUMERIC(14,3),
    conversion_notes TEXT,

    -- Chef who produced
    produced_by UUID REFERENCES users(id) ON DELETE SET NULL,
    produced_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_production_shift ON kitchen_shift_production(shift_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_production_raw_sku ON kitchen_shift_production(raw_item_sku);
CREATE INDEX IF NOT EXISTS idx_kitchen_production_pos_item ON kitchen_shift_production(pos_outlet_item_id);

-- ============================================
-- 4. KITCHEN SHIFT STOCK TAKE (Closing audit)
-- ============================================
CREATE TABLE IF NOT EXISTS kitchen_shift_stock_take (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES kitchen_shifts(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

    -- Stock take info
    item_sku VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    cost_price NUMERIC(14,2) DEFAULT 0,

    opening_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
    additions NUMERIC(14,3) NOT NULL DEFAULT 0,
    total_available NUMERIC(14,3) NOT NULL DEFAULT 0,
    system_sales NUMERIC(14,3) NOT NULL DEFAULT 0,
    spoilage NUMERIC(14,3) NOT NULL DEFAULT 0,
    system_closing_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
    physical_count NUMERIC(14,3) NOT NULL DEFAULT 0,
    variance NUMERIC(14,3) NOT NULL DEFAULT 0,
    variance_value NUMERIC(14,2) DEFAULT 0,

    -- Variance categorization
    variance_category VARCHAR(50) CHECK (variance_category IN ('shortage', 'overage', 'ok')),
    variance_reason TEXT,

    -- Counted by
    counted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    counted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(shift_id, item_sku)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_stock_take_shift ON kitchen_shift_stock_take(shift_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_stock_take_sku ON kitchen_shift_stock_take(item_sku);

-- ============================================
-- 5. KITCHEN SHIFT APPROVALS (Audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS kitchen_shift_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES kitchen_shifts(id) ON DELETE CASCADE,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

    approval_stage VARCHAR(50) NOT NULL CHECK (approval_stage IN (
        'store_keeper_submitted',
        'chef_confirmed',
        'chef_rejected',
        'accountant_approved',
        'accountant_rejected',
        'auditor_reviewed'
    )),

    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_shift_approvals_shift ON kitchen_shift_approvals(shift_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_shift_approvals_stage ON kitchen_shift_approvals(approval_stage);

-- ============================================
-- 6. KITCHEN PRODUCTION RECIPES (Yield matrix)
-- ============================================
CREATE TABLE IF NOT EXISTS kitchen_production_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

    recipe_name VARCHAR(255) NOT NULL,
    recipe_code VARCHAR(100),

    -- Raw material input
    raw_item_sku VARCHAR(100) NOT NULL,
    raw_item_name VARCHAR(255) NOT NULL,
    raw_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    raw_unit VARCHAR(50) NOT NULL,

    -- Output (POS sellable)
    produced_item_name VARCHAR(255) NOT NULL,
    produced_item_sku VARCHAR(100),
    produced_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    produced_unit VARCHAR(50) NOT NULL DEFAULT 'portion',

    -- Conversion ratio = produced / raw
    conversion_ratio NUMERIC(14,3) GENERATED ALWAYS AS (
        CASE WHEN raw_quantity > 0 THEN produced_quantity / raw_quantity ELSE 0 END
    ) STORED,

    -- Link to POS outlet item
    pos_outlet_item_id UUID REFERENCES pos_outlet_items(id) ON DELETE SET NULL,

    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(branch_id, raw_item_sku, produced_item_name)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_recipes_branch ON kitchen_production_recipes(branch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_recipes_raw_sku ON kitchen_production_recipes(raw_item_sku);
CREATE INDEX IF NOT EXISTS idx_kitchen_recipes_pos_item ON kitchen_production_recipes(pos_outlet_item_id);

-- ============================================
-- 7. KITCHEN SPOILAGE CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS kitchen_spoilage_categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO kitchen_spoilage_categories (category_name, description)
VALUES
    ('burnt_food', 'Food that was burnt during cooking'),
    ('overcooked_food', 'Food that was overcooked and unservable'),
    ('expired_food', 'Food that expired before being sold'),
    ('staff_meals', 'Food consumed by staff during shift'),
    ('complimentary_meals', 'Free meals given to guests'),
    ('wastage', 'General kitchen wastage'),
    ('quality_issue', 'Food rejected due to quality concerns'),
    ('pest_damage', 'Food damaged by pests')
ON CONFLICT (category_name) DO NOTHING;

-- ============================================
-- 8. AUTO-UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_kitchen_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kitchen_shifts_updated_at
    BEFORE UPDATE ON kitchen_shifts
    FOR EACH ROW EXECUTE FUNCTION update_kitchen_updated_at();

CREATE TRIGGER trg_kitchen_shift_items_updated_at
    BEFORE UPDATE ON kitchen_shift_items
    FOR EACH ROW EXECUTE FUNCTION update_kitchen_updated_at();

CREATE TRIGGER trg_kitchen_stock_take_updated_at
    BEFORE UPDATE ON kitchen_shift_stock_take
    FOR EACH ROW EXECUTE FUNCTION update_kitchen_updated_at();

CREATE TRIGGER trg_kitchen_production_recipes_updated_at
    BEFORE UPDATE ON kitchen_production_recipes
    FOR EACH ROW EXECUTE FUNCTION update_kitchen_updated_at();

-- ============================================
-- 9. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE kitchen_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_shift_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_shift_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_shift_stock_take ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_shift_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_production_recipes ENABLE ROW LEVEL SECURITY;

-- Kitchen Shifts
CREATE POLICY kitchen_shifts_select ON kitchen_shifts
    FOR SELECT USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor', 'general_manager')
    );

CREATE POLICY kitchen_shifts_insert ON kitchen_shifts
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY kitchen_shifts_update ON kitchen_shifts
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor')
    );

-- Kitchen Shift Items
CREATE POLICY kitchen_shift_items_select ON kitchen_shift_items
    FOR SELECT USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor', 'general_manager')
    );

CREATE POLICY kitchen_shift_items_insert ON kitchen_shift_items
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY kitchen_shift_items_update ON kitchen_shift_items
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

-- Kitchen Shift Production
CREATE POLICY kitchen_production_select ON kitchen_shift_production
    FOR SELECT USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor', 'general_manager')
    );

CREATE POLICY kitchen_production_insert ON kitchen_shift_production
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

-- Kitchen Stock Take
CREATE POLICY kitchen_stock_take_select ON kitchen_shift_stock_take
    FOR SELECT USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor', 'general_manager')
    );

CREATE POLICY kitchen_stock_take_insert ON kitchen_shift_stock_take
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY kitchen_stock_take_update ON kitchen_shift_stock_take
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

-- Kitchen Production Recipes
CREATE POLICY kitchen_recipes_select ON kitchen_production_recipes
    FOR SELECT USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
        OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor', 'general_manager')
    );

CREATE POLICY kitchen_recipes_insert ON kitchen_production_recipes
    FOR INSERT WITH CHECK (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

CREATE POLICY kitchen_recipes_update ON kitchen_production_recipes
    FOR UPDATE USING (
        branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    );

-- ============================================
-- 10. HELPER FUNCTIONS
-- ============================================
-- Generate kitchen shift number
CREATE OR REPLACE FUNCTION generate_kitchen_shift_number(p_branch_id INTEGER, p_date DATE)
RETURNS VARCHAR AS $$
DECLARE
    next_num INTEGER;
    new_number VARCHAR;
    date_str VARCHAR;
BEGIN
    date_str := TO_CHAR(p_date, 'YYYYMMDD');
    SELECT COALESCE(MAX(CAST(SUBSTRING(shift_number FROM 11) AS INTEGER)), 0) + 1
    INTO next_num
    FROM kitchen_shifts
    WHERE shift_number ~ '^KS-' || date_str || '-[0-9]+$'
      AND branch_id = p_branch_id;

    new_number := 'KS-' || date_str || '-' || LPAD(next_num::TEXT, 3, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Calculate kitchen shift summary
CREATE OR REPLACE FUNCTION calculate_kitchen_shift_summary(p_shift_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_items', COUNT(*),
        'total_opening_value', COALESCE(SUM(opening_value), 0),
        'total_additions_value', COALESCE(SUM(additions_value), 0),
        'total_sold_value', COALESCE(SUM(sold_value), 0),
        'total_spoilage_value', COALESCE(SUM(spoilage_value), 0),
        'total_variance_value', COALESCE(SUM(variance_value), 0),
        'shortage_items', COUNT(*) FILTER (WHERE variance < 0),
        'overage_items', COUNT(*) FILTER (WHERE variance > 0),
        'ok_items', COUNT(*) FILTER (WHERE variance = 0)
    ) INTO v_summary
    FROM kitchen_shift_items
    WHERE shift_id = p_shift_id;

    RETURN v_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. COMMENTS
-- ============================================
COMMENT ON TABLE kitchen_shifts IS 'Kitchen production shifts managed by store keeper';
COMMENT ON TABLE kitchen_shift_items IS 'Raw material items tracked within a kitchen shift';
COMMENT ON TABLE kitchen_shift_production IS 'Production runs converting raw materials to POS sellable portions';
COMMENT ON TABLE kitchen_shift_stock_take IS 'Physical stock count at shift close with variance calculation';
COMMENT ON TABLE kitchen_shift_approvals IS 'Approval workflow audit trail for kitchen shifts';
COMMENT ON TABLE kitchen_production_recipes IS 'Recipe/yield matrix for raw material to portion conversion';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
