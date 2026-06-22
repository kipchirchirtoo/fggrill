-- =====================================================================
-- FAMOUSGATE — KITCHEN / STOREKEEPER INTEGRATION MIGRATION
-- File: 20260622_kitchen_storekeeper_integration.sql
-- OUTPUT ONLY — DO NOT AUTO-EXECUTE. Paste into the Supabase SQL editor
-- for manual review and execution.
--
-- LIVE-DATABASE VERIFICATION / DEVIATION NOTES
-- =====================================================================
-- DEVIATION (scope decision, confirmed with requester): `kitchen_production_sessions`
-- is NOT a deprecated predecessor of `kitchen_shifts`. It is a fully separate,
-- currently-live system (backend/src/controllers/kitchen/kitchen-production.controller.ts,
-- routes /api/kitchen/production-sessions*) with its own recipe source
-- (`recipes`/`recipe_items`, distinct from `kitchen_production_recipes`) and its
-- own per-staff credit-bill penalty-splitting logic on session completion.
-- Section 1 below is therefore limited to the additive, harmless pieces only
-- (the nullable kitchen_shift_id link column + a read-only compatibility view).
-- No write-path redirection of kitchen_production_sessions consumers is
-- performed in this pass — that would require re-deriving the existing
-- per-staff penalty split against a different schema, which is a real risk to
-- a live financial flow and was explicitly deferred.
--
-- DEVIATION: kitchen_shift_production already has an `actual_quantity` /
-- `variance_cost` / `credit_bill_id` flow (confirmed live in
-- kitchen-shift.controller.ts's confirmProductionActual()). Section 5's new
-- columns (variance_pct, recipe_max_raw_allowed, variance_flagged,
-- variance_reason) are additive alongside that existing flow, used by the new
-- recipe-input-time variance check in recordProduction — they do not replace
-- or rename any existing column.
--
-- DEVIATION: kitchen_production_recipes already has a per-recipe
-- `allowed_variance_percent` column (confirmed live in
-- kitchen-shift.controller.ts's createProductionRecipe()). The new
-- kitchen_wastage_thresholds table (section 6) supplies the BRANCH-LEVEL
-- default used when a recipe's own allowed_variance_percent is null; the
-- recipe-level value, where present, takes precedence in the backend logic.
--
-- ADDITION (not in the original request, but required to satisfy "approving a
-- bar stocktake variance creates a P&L entry"): get_branch_profit_loss()
-- (migration 20260622_famousgate_major_redesign.sql, section 2) is
-- CREATE OR REPLACE'd here with one new additive expense component —
-- bar_stock_variance, summed from approved, negative-variance
-- bar_stocktake_records joined to inventory_items.unit_cost. All other logic
-- in the function is reproduced unchanged from the live version.
-- =====================================================================


-- =====================================================================
-- 1. CANONICAL KITCHEN TABLE LINK (additive only — see deviation note above)
-- =====================================================================

ALTER TABLE kitchen_production_sessions
  ADD COLUMN IF NOT EXISTS kitchen_shift_id UUID REFERENCES kitchen_shifts(id);

-- Read-only compatibility view for any future kitchen_shifts-based consumer
-- that wants the kitchen_production_sessions shape. Existing
-- kitchen_production_sessions readers/writers are untouched.
-- DEVIATION (live error correction): kitchen_shifts has no `closed_by` column
-- — closeKitchenShift() (kitchen-shift.controller.ts) never records who
-- closed the shift, only closed_at. There is also no generic `notes` column;
-- the controller writes `closing_notes`. Both corrected below against the
-- live schema (confirmed via the resulting 42703 error and a re-read of
-- kitchen-shift.controller.ts).
CREATE OR REPLACE VIEW kitchen_production_sessions_view AS
SELECT
  ks.id,
  ks.branch_id,
  ks.shift_type,
  ks.status,
  ks.opened_at,
  ks.closed_at,
  ks.opened_by,
  ks.closing_notes AS notes,
  ks.created_at
FROM kitchen_shifts ks;


-- =====================================================================
-- 2. KITCHEN SHIFT POS CONSUMPTION
--    Per-sale link between a POS order line and the raw kitchen_shift_items
--    stock it consumed, sourced from kitchen_production_recipes.
-- =====================================================================

CREATE TABLE IF NOT EXISTS kitchen_shift_pos_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES kitchen_shifts(id),
  pos_shift_id UUID,
  pos_order_id UUID,
  pos_outlet_item_id UUID,
  produced_item_sku VARCHAR(100),
  produced_item_name VARCHAR(255),
  portions_sold NUMERIC(14,3) NOT NULL DEFAULT 0,
  raw_item_sku VARCHAR(100),
  raw_item_name VARCHAR(255),
  raw_quantity_consumed NUMERIC(14,3) NOT NULL DEFAULT 0,
  raw_unit VARCHAR(50),
  cost_price NUMERIC(14,2) DEFAULT 0,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  sold_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kspc_shift_id ON kitchen_shift_pos_consumption(shift_id);
CREATE INDEX IF NOT EXISTS idx_kspc_branch_id ON kitchen_shift_pos_consumption(branch_id);
CREATE INDEX IF NOT EXISTS idx_kspc_sold_at ON kitchen_shift_pos_consumption(sold_at);


-- =====================================================================
-- 3. KITCHEN WASTAGE ALERTS
--    Real-time, acknowledgeable alerts — distinct from the existing
--    end-of-shift kitchen_shift_stock_take variance rows, which are computed
--    only at closeKitchenShift() time.
-- =====================================================================

CREATE TABLE IF NOT EXISTS kitchen_wastage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES kitchen_shifts(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  alert_type VARCHAR(50) CHECK (alert_type IN (
    'recipe_variance','spoilage_spike','unexplained_shortage','production_shortfall'
  )),
  severity VARCHAR(20) CHECK (severity IN ('warning','critical')),
  item_sku VARCHAR(100),
  item_name VARCHAR(255),
  expected_value NUMERIC(14,3),
  actual_value NUMERIC(14,3),
  variance_value NUMERIC(14,3),
  variance_cost NUMERIC(14,2),
  message TEXT,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kwa_shift_id ON kitchen_wastage_alerts(shift_id);
CREATE INDEX IF NOT EXISTS idx_kwa_branch_id ON kitchen_wastage_alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_kwa_severity ON kitchen_wastage_alerts(severity);


-- =====================================================================
-- 4. BAR STOCKTAKE RECORDS
-- =====================================================================

CREATE TABLE IF NOT EXISTS bar_stocktake_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  bar_location TEXT NOT NULL CHECK (bar_location IN ('main_bar','executive_bar')),
  stocktake_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_id UUID REFERENCES cashier_shifts(id),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  system_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  physical_quantity NUMERIC(12,3),
  variance NUMERIC(12,3) GENERATED ALWAYS AS (
    CASE WHEN physical_quantity IS NOT NULL
    THEN physical_quantity - system_quantity
    ELSE NULL END
  ) STORED,
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','approved','rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, bar_location, stocktake_date, item_id)
);

CREATE INDEX IF NOT EXISTS idx_bsr_branch_date ON bar_stocktake_records(branch_id, stocktake_date);
CREATE INDEX IF NOT EXISTS idx_bsr_status ON bar_stocktake_records(status);


-- =====================================================================
-- 5. KITCHEN SHIFT PRODUCTION — RECIPE VARIANCE COLUMNS (additive)
-- =====================================================================

ALTER TABLE kitchen_shift_production
  ADD COLUMN IF NOT EXISTS variance_reason TEXT,
  ADD COLUMN IF NOT EXISTS variance_pct NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS recipe_max_raw_allowed NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS variance_flagged BOOLEAN DEFAULT false;


-- =====================================================================
-- 6. WASTAGE ALERT THRESHOLDS (per-branch config, branch-level default —
--    a recipe's own allowed_variance_percent, where set, takes precedence)
-- =====================================================================

CREATE TABLE IF NOT EXISTS kitchen_wastage_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  recipe_variance_warning_pct NUMERIC(5,2) DEFAULT 5.0,
  recipe_variance_critical_pct NUMERIC(5,2) DEFAULT 15.0,
  spoilage_warning_pct NUMERIC(5,2) DEFAULT 5.0,
  spoilage_critical_pct NUMERIC(5,2) DEFAULT 10.0,
  shortage_warning_kes NUMERIC(12,2) DEFAULT 500.0,
  shortage_critical_kes NUMERIC(12,2) DEFAULT 2000.0,
  production_shortfall_warning_pct NUMERIC(5,2) DEFAULT 5.0,
  production_shortfall_critical_pct NUMERIC(5,2) DEFAULT 15.0,
  bar_variance_warning_kes NUMERIC(12,2) DEFAULT 500.0,
  bar_variance_critical_kes NUMERIC(12,2) DEFAULT 2000.0,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id)
);

-- Insert defaults for all existing branches
INSERT INTO kitchen_wastage_thresholds (branch_id)
SELECT id FROM branches
ON CONFLICT (branch_id) DO NOTHING;


-- =====================================================================
-- 7. P&L EXTENSION — BAR STOCK VARIANCE (ADDITION, see header note)
--    CREATE OR REPLACE of the live get_branch_profit_loss() function
--    (migration 20260622_famousgate_major_redesign.sql, section 2),
--    reproduced unchanged plus one new additive expense component.
-- =====================================================================

CREATE OR REPLACE FUNCTION get_branch_profit_loss(
  branch_id INTEGER,
  start_date DATE,
  end_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_system_revenue NUMERIC := 0;
  v_rev_mpesa NUMERIC := 0;
  v_rev_cash NUMERIC := 0;
  v_rev_card NUMERIC := 0;
  v_rev_credit NUMERIC := 0;
  v_verified_revenue NUMERIC := 0;
  v_exp_daily_purchase NUMERIC := 0;
  v_exp_petty_cash NUMERIC := 0;
  v_exp_transaction_cost NUMERIC := 0;
  v_exp_operational NUMERIC := 0;
  v_exp_bar_variance NUMERIC := 0;
  v_cogs NUMERIC := 0;
  v_gross_profit NUMERIC := 0;
  v_net_profit NUMERIC := 0;
  v_total_expenses NUMERIC := 0;
BEGIN
  -- Revenue by payment method: cashier_shifts joined with cashier_shift_transactions
  SELECT
    COALESCE(SUM(CASE WHEN norm.method = 'mpesa' THEN norm.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN norm.method = 'cash' THEN norm.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN norm.method = 'card' THEN norm.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN norm.method = 'credit' THEN norm.amount ELSE 0 END), 0)
  INTO v_rev_mpesa, v_rev_cash, v_rev_card, v_rev_credit
  FROM (
    SELECT
      cst.amount,
      CASE lower(cst.payment_method)
        WHEN 'credit_bill' THEN 'credit'
        WHEN 'mobile_money' THEN 'mpesa'
        ELSE lower(cst.payment_method)
      END AS method
    FROM cashier_shift_transactions cst
    JOIN cashier_shifts cs ON cs.id = cst.shift_id
    WHERE cs.branch_id = get_branch_profit_loss.branch_id
      AND cs.shift_date BETWEEN start_date AND end_date
  ) norm;

  v_system_revenue := v_rev_mpesa + v_rev_cash + v_rev_card + v_rev_credit;

  -- Accountant-verified revenue: shift_actual_collections
  SELECT COALESCE(SUM(sac.actual_amount), 0)
  INTO v_verified_revenue
  FROM shift_actual_collections sac
  JOIN cashier_shifts cs ON cs.id = sac.shift_id
  WHERE sac.branch_id = get_branch_profit_loss.branch_id
    AND cs.shift_date BETWEEN start_date AND end_date;

  -- Outbound payments by category: branch_payments.cash_flow_category
  SELECT
    COALESCE(SUM(CASE WHEN bp.cash_flow_category = 'daily_purchase' THEN bp.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN bp.cash_flow_category = 'petty_cash' THEN bp.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN bp.cash_flow_category = 'transaction_cost' THEN bp.amount ELSE 0 END), 0)
  INTO v_exp_daily_purchase, v_exp_petty_cash, v_exp_transaction_cost
  FROM branch_payments bp
  WHERE bp.branch_id = get_branch_profit_loss.branch_id
    AND bp.created_at::date BETWEEN start_date AND end_date;

  -- Shift-level reconciliation expenses — additive to branch_payments
  SELECT
    v_exp_petty_cash + COALESCE(SUM(CASE WHEN sre.category = 'petty_cash' THEN sre.amount ELSE 0 END), 0),
    v_exp_transaction_cost + COALESCE(SUM(CASE WHEN sre.category = 'transaction_cost' THEN sre.amount ELSE 0 END), 0)
  INTO v_exp_petty_cash, v_exp_transaction_cost
  FROM shift_reconciliation_expenses sre
  JOIN cashier_shifts cs ON cs.id = sre.shift_id
  WHERE sre.branch_id = get_branch_profit_loss.branch_id
    AND cs.shift_date BETWEEN start_date AND end_date;

  -- Operational expenses: branch_stock_movements flagged is_operational_expense
  SELECT COALESCE(SUM(bsm.line_cost), 0)
  INTO v_exp_operational
  FROM branch_stock_movements bsm
  WHERE bsm.branch_id = get_branch_profit_loss.branch_id
    AND bsm.is_operational_expense = true
    AND bsm.created_at::date BETWEEN start_date AND end_date
    AND (
      bsm.quantity < 0
      OR lower(COALESCE(bsm.movement_type, '')) = ANY (ARRAY['stock_out','out','issue','department_issue','pos_issue','kitchen_issue','usage'])
    );

  -- NEW: Bar stock variance — approved, negative-variance bar_stocktake_records
  -- (shortage cost only; overages are not booked as an expense).
  SELECT COALESCE(SUM(ABS(bsr.variance) * COALESCE(ii.unit_cost, 0)), 0)
  INTO v_exp_bar_variance
  FROM bar_stocktake_records bsr
  JOIN inventory_items ii ON ii.id = bsr.item_id
  WHERE bsr.branch_id = get_branch_profit_loss.branch_id
    AND bsr.status = 'approved'
    AND bsr.variance < 0
    AND bsr.stocktake_date BETWEEN start_date AND end_date;

  -- COGS: received PO line costs from the real base tables
  SELECT COALESCE(SUM(grl.line_total), 0)
  INTO v_cogs
  FROM goods_receipt_lines grl
  JOIN goods_receipts gr ON gr.id = grl.goods_receipt_id
  WHERE gr.branch_id = get_branch_profit_loss.branch_id
    AND gr.received_at::date BETWEEN start_date AND end_date;

  v_total_expenses := v_exp_daily_purchase + v_exp_petty_cash + v_exp_transaction_cost + v_exp_operational + v_exp_bar_variance;
  v_gross_profit := v_system_revenue - v_cogs;
  v_net_profit := v_gross_profit - v_total_expenses;

  RETURN jsonb_build_object(
    'system_revenue', round(v_system_revenue, 2),
    'system_revenue_by_method', jsonb_build_object(
      'mpesa', round(v_rev_mpesa, 2),
      'cash', round(v_rev_cash, 2),
      'card', round(v_rev_card, 2),
      'credit', round(v_rev_credit, 2)
    ),
    'verified_revenue', round(v_verified_revenue, 2),
    'revenue_variance', round(v_verified_revenue - v_system_revenue, 2),
    'expenses_by_category', jsonb_build_object(
      'daily_purchase', round(v_exp_daily_purchase, 2),
      'petty_cash', round(v_exp_petty_cash, 2),
      'transaction_cost', round(v_exp_transaction_cost, 2),
      'operational', round(v_exp_operational, 2),
      'bar_stock_variance', round(v_exp_bar_variance, 2)
    ),
    'cogs', round(v_cogs, 2),
    'gross_profit', round(v_gross_profit, 2),
    'net_profit', round(v_net_profit, 2),
    'net_margin', CASE WHEN v_system_revenue = 0 THEN 0 ELSE round((v_net_profit / v_system_revenue) * 100, 2) END
  );
END;
$$ LANGUAGE plpgsql STABLE;
