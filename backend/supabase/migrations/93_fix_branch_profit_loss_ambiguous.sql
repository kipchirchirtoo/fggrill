-- Fix ambiguous column reference "branch_id" in get_branch_profit_loss.
-- All table columns must be fully qualified to avoid clashing with the function parameter.

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
  v_exp_other NUMERIC := 0;
  v_exp_operational NUMERIC := 0;
  v_cogs NUMERIC := 0;
  v_gross_profit NUMERIC := 0;
  v_net_profit NUMERIC := 0;
  v_total_expenses NUMERIC := 0;
BEGIN
  -- Revenue by payment method: cashier_shift_transactions joined with cashier_shift_logs
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
    JOIN cashier_shift_logs csl ON csl.id = cst.shift_id
    WHERE csl.branch_id = get_branch_profit_loss.branch_id
      AND csl.shift_start::date BETWEEN start_date AND end_date
      AND cst.is_voided IS DISTINCT FROM true
  ) norm;

  v_system_revenue := v_rev_mpesa + v_rev_cash + v_rev_card + v_rev_credit;

  -- Verified revenue: shift-declared totals from cashier_shift_logs
  SELECT COALESCE(SUM(csl.total_sales), 0)
  INTO v_verified_revenue
  FROM cashier_shift_logs csl
  WHERE csl.branch_id = get_branch_profit_loss.branch_id
    AND csl.shift_start::date BETWEEN start_date AND end_date;

  -- Outbound payments by category: branch_payments
  SELECT
    COALESCE(SUM(CASE WHEN bp.cash_flow_category = 'daily_purchase' THEN bp.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN bp.cash_flow_category = 'petty_cash' THEN bp.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN bp.cash_flow_category = 'transaction_cost' THEN bp.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN bp.cash_flow_category IS NULL OR bp.cash_flow_category NOT IN ('daily_purchase','petty_cash','transaction_cost') THEN bp.amount ELSE 0 END), 0)
  INTO v_exp_daily_purchase, v_exp_petty_cash, v_exp_transaction_cost, v_exp_other
  FROM branch_payments bp
  WHERE bp.branch_id = get_branch_profit_loss.branch_id
    AND bp.created_at::date BETWEEN start_date AND end_date;

  -- Shift-level reconciliation expenses (additive to branch_payments)
  SELECT
    v_exp_petty_cash + COALESCE(SUM(CASE WHEN sre.category = 'petty_cash' THEN sre.amount ELSE 0 END), 0),
    v_exp_transaction_cost + COALESCE(SUM(CASE WHEN sre.category = 'transaction_cost' THEN sre.amount ELSE 0 END), 0)
  INTO v_exp_petty_cash, v_exp_transaction_cost
  FROM shift_reconciliation_expenses sre
  JOIN cashier_shifts cs ON cs.id = sre.shift_id
  WHERE sre.branch_id = get_branch_profit_loss.branch_id
    AND cs.opened_at::date BETWEEN start_date AND end_date;

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

  -- COGS: received PO line costs from goods_receipt_lines
  SELECT COALESCE(SUM(grl.line_total), 0)
  INTO v_cogs
  FROM goods_receipt_lines grl
  JOIN goods_receipts gr ON gr.id = grl.goods_receipt_id
  WHERE gr.branch_id = get_branch_profit_loss.branch_id
    AND gr.received_at::date BETWEEN start_date AND end_date;

  v_total_expenses := v_exp_daily_purchase + v_exp_petty_cash + v_exp_transaction_cost + v_exp_other + v_exp_operational;
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
      'transaction_cost', round(v_exp_transaction_cost, 2)
    ),
    'other_expenses', round(v_exp_other, 2),
    'operational_expenses', round(v_exp_operational, 2),
    'total_expenses', round(v_total_expenses, 2),
    'cogs', round(v_cogs, 2),
    'gross_profit', round(v_gross_profit, 2),
    'net_profit', round(v_net_profit, 2)
  );
END;
$$ LANGUAGE plpgsql;
