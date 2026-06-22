// Request/response shapes for the 14 API features built on top of
// migration 20260622_famousgate_major_redesign.sql.

// ── 1. Branch P&L (get_branch_profit_loss RPC) ──────────────────────────────
export interface BranchProfitLossQuery {
  branch_id?: string | number;
  from_date?: string;
  to_date?: string;
  start_date?: string; // alias
  end_date?: string;   // alias
}

export interface BranchProfitLossResponse {
  period: { from: string; to: string };
  branch_id: number;
  [key: string]: any; // passthrough of get_branch_profit_loss() JSONB shape
}

// ── 2. Branch Payments (outbound) ───────────────────────────────────────────
export type CashFlowCategory = 'daily_purchase' | 'petty_cash' | 'transaction_cost';
export type SettlementStatus = 'pending' | 'settled';
export type PaymentSource = 'manual' | 'po_auto';

export interface BranchPaymentListQuery {
  branch_id?: string | number;
  status?: string;
  cash_flow_category?: CashFlowCategory | 'all';
  settlement_status?: SettlementStatus | 'all';
  source?: PaymentSource | 'all';
}

export interface CreateBranchPaymentBody {
  category: string;
  payment_method: string;
  payee_name: string;
  payee_account?: string;
  amount: number;
  currency?: string;
  description?: string;
  reference?: string;
  receipt_url?: string;
  po_id?: string;
  grn_id?: string;
  invoice_id?: string;
  cash_flow_category?: CashFlowCategory;
  source?: PaymentSource;
}

export interface SettlePaymentBody {
  note?: string;
}

// ── 3. Purchase order outbound-payment guard ────────────────────────────────
export interface PurchaseOrderOutboundPayment {
  id: string;
  purchase_order_id: string;
  branch_id: number;
  amount: number;
  settlement_status: SettlementStatus;
  status: string;
}

export interface CreatePurchaseOrderResponse {
  success: boolean;
  data: Record<string, any>;
  outbound_payment: PurchaseOrderOutboundPayment | null;
}

// ── 5. Shift Reconciliation ──────────────────────────────────────────────────
export type ReconciliationPaymentMethod = 'mpesa' | 'cash' | 'card' | 'credit';
export type ReconciliationExpenseCategory = 'petty_cash' | 'transaction_cost' | 'other';

export interface AddShiftActualCollectionBody {
  payment_method: ReconciliationPaymentMethod;
  system_amount: number;
  actual_amount: number;
}

export interface AddShiftReconciliationExpenseBody {
  category: ReconciliationExpenseCategory;
  amount: number;
  description?: string;
}

export interface ShiftReconciliationSummary {
  total_system: number;
  total_actual: number;
  total_variance: number;
  total_expenses: number;
}

export interface ShiftReconciliationResponse {
  shift: { id: string; branch_id: number; cashier_id?: string; shift_date?: string; status?: string };
  actual_collections: Array<Record<string, any>>;
  reconciliation_expenses: Array<Record<string, any>>;
  summary: ShiftReconciliationSummary;
}

// ── 6. Payment method breakdown ─────────────────────────────────────────────
export interface PaymentMethodBreakdownDTO {
  mpesa: number;
  cash: number;
  card: number;
  credit: number;
  total: number;
  transaction_count: number;
}

// ── 7/8. Revenue oversight date range ───────────────────────────────────────
export interface RevenueOversightQuery {
  branch_id?: string | number;
  period?: string;
  from_date?: string;
  to_date?: string;
}

// ── 9. Void approvals / void_items ──────────────────────────────────────────
export interface VoidItemEntry {
  order_item_id: string;
  menu_item_id?: string | null;
  name?: string | null;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface RequestVoidOrderBody {
  reason: string;
  void_items?: VoidItemEntry[];
}

// ── 10. Opening stock gate ───────────────────────────────────────────────────
export type StockLocation = 'branch_store' | 'main_bar' | 'executive_bar';

export interface OpeningStockItemInput {
  item_id: string;
  system_quantity: number;
  actual_quantity: number;
}

export interface SubmitOpeningStockBody {
  stock_location: StockLocation;
  items: OpeningStockItemInput[];
}

export interface OpeningStockStatusResponse {
  shift_id: string;
  branch_id: number;
  gate_open: boolean;
  status: {
    branch_store_complete: boolean;
    main_bar_complete: boolean;
    executive_bar_complete: boolean;
    completed_at?: string | null;
  };
  items: Array<Record<string, any>>;
}

// ── 11. Stock balance ledger ─────────────────────────────────────────────────
export interface StockLedgerQuery {
  branch_id: string | number;
  item_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface RecordActualClosingBody {
  actual_closing: number;
}

// ── 12. Kitchen ledger config ────────────────────────────────────────────────
export interface AddKitchenLedgerItemBody {
  branch_id: number;
  item_id: string;
}

// ── 13. Pastry production log ────────────────────────────────────────────────
export interface RecordPastryProductionBody {
  branch_id: number;
  shift_id?: string;
  item_id: string;
  quantity_produced: number;
}

export interface IssuePastryToKitchenBody {
  issued_quantity?: number;
}

// ── 14. Non-sale stock-out / operational expense ────────────────────────────
export interface NonSaleStockOutQuery {
  branch_id: string | number;
  from_date?: string;
  to_date?: string;
}

export interface SetOperationalExpenseFlagBody {
  is_operational_expense: boolean;
  line_cost?: number;
}

// ── 15. Cashier logbook history ──────────────────────────────────────────────
export interface LogbookHistoryQuery {
  branch_id?: string | number;
  status?: 'all' | string;
  cashier_id?: string;
  date_from?: string;
  date_to?: string;
  from_date?: string; // alias
  to_date?: string;   // alias
}

// Request/response shapes for migration 20260622_kitchen_storekeeper_integration.sql
// (kitchen/storekeeper restructure: POS-kitchen consumption link, recipe
// variance enforcement, wastage alerts, bar stocktake).

// ── Kitchen shift POS consumption ───────────────────────────────────────────
export interface KitchenShiftPosConsumption {
  id: string;
  shift_id: string;
  branch_id: number;
  pos_shift_id?: string | null;
  pos_order_id?: string | null;
  pos_outlet_item_id?: string | null;
  produced_item_sku?: string | null;
  produced_item_name?: string | null;
  portions_sold: number;
  raw_item_sku?: string | null;
  raw_item_name?: string | null;
  raw_quantity_consumed: number;
  raw_unit?: string | null;
  cost_price: number;
  sold_at: string;
  created_at: string;
}

// ── Recipe variance enforcement (recordProduction) ──────────────────────────
export interface RecordProductionLine {
  recipe_id?: string;
  food_control_id?: string;
  raw_item_sku: string;
  raw_item_name: string;
  raw_quantity_used: number;
  raw_unit: string;
  produced_item_name: string;
  produced_item_sku?: string;
  pos_outlet_item_id?: string;
  produced_quantity: number;
  produced_unit?: string;
  conversion_ratio?: number;
  conversion_notes?: string;
  produced_by?: string;
  /** Required when raw_quantity_used exceeds the recipe's critical variance threshold. */
  variance_reason?: string;
}

export interface RecipeVarianceExceededResponse {
  success: false;
  code: 'RECIPE_VARIANCE_EXCEEDED';
  message: string;
  data: {
    recipe: Record<string, any>;
    maxRawAllowed: number;
    actualUsed: number;
    variancePct: number;
  };
}

// ── Kitchen wastage alerts ──────────────────────────────────────────────────
export type WastageAlertType = 'recipe_variance' | 'spoilage_spike' | 'unexplained_shortage' | 'production_shortfall';
export type WastageAlertSeverity = 'warning' | 'critical';

export interface KitchenWastageAlert {
  id: string;
  shift_id: string;
  branch_id: number;
  alert_type: WastageAlertType;
  severity: WastageAlertSeverity;
  item_sku?: string | null;
  item_name?: string | null;
  expected_value?: number | null;
  actual_value?: number | null;
  variance_value?: number | null;
  variance_cost?: number | null;
  message?: string | null;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  created_at: string;
}

export interface WastageAlertPayload {
  shift_id: string;
  branch_id: number;
  alert_type: WastageAlertType;
  severity: WastageAlertSeverity;
  item_sku?: string | null;
  item_name?: string | null;
  expected_value?: number | null;
  actual_value?: number | null;
  variance_value?: number | null;
  variance_cost?: number | null;
  message?: string | null;
}

export interface WastageAlertsQuery {
  branch_id: string | number;
  shift_id?: string;
  severity?: WastageAlertSeverity;
  acknowledged?: 'true' | 'false';
}

export interface WastageReportQuery {
  branch_id: string | number;
  from_date?: string;
  to_date?: string;
}

export interface WastageReportResponse {
  total_wastage_cost: number;
  by_category: {
    recipe_variance: number;
    spoilage: number;
    unexplained_shortage: number;
    production_shortfall: number;
  };
  top_10_wastage_items: Array<{
    item_sku: string;
    item_name: string;
    total_variance_cost: number;
    occurrence_count: number;
  }>;
  by_chef: Array<{
    chef_id: string;
    chef_name: string;
    total_variance_cost: number;
  }>;
  daily_trend: Array<{
    date: string;
    wastage_cost: number;
    expected_raw_usage: number;
    actual_raw_usage: number;
    pos_sales_consumption: number;
  }>;
}

export interface KitchenWastageThresholds {
  branch_id: number;
  recipe_variance_warning_pct: number;
  recipe_variance_critical_pct: number;
  spoilage_warning_pct: number;
  spoilage_critical_pct: number;
  shortage_warning_kes: number;
  shortage_critical_kes: number;
  production_shortfall_warning_pct: number;
  production_shortfall_critical_pct: number;
  bar_variance_warning_kes: number;
  bar_variance_critical_kes: number;
}

// ── Bar stocktake ────────────────────────────────────────────────────────────
export type BarLocation = 'main_bar' | 'executive_bar';
export type BarStocktakeStatus = 'pending' | 'reviewed' | 'approved' | 'rejected';

export interface BarStocktakeRecord {
  id: string;
  branch_id: number;
  bar_location: BarLocation;
  stocktake_date: string;
  shift_id?: string | null;
  item_id: string;
  system_quantity: number;
  physical_quantity?: number | null;
  variance?: number | null;
  recorded_by?: string | null;
  recorded_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  status: BarStocktakeStatus;
  notes?: string | null;
  created_at: string;
}

export interface RecordBarStocktakeBody {
  branch_id: number;
  bar_location: BarLocation;
  stocktake_date?: string;
  shift_id?: string;
  items: Array<{ item_id: string; physical_quantity: number }>;
}

export interface BarStocktakeReviewBody {
  notes?: string;
}

export interface BarStocktakeRejectBody {
  notes: string;
}

export interface BarStocktakeSummaryEntry {
  bar_location: BarLocation;
  date: string;
  variance_value: number;
}

// ── Accountant deliberate credit-bill allocation ────────────────────────────
export interface KitchenLiabilityAllocation {
  staff_id?: string;
  staff_profile_id?: string;
  user_id?: string;
  amount: number;
  reason?: string;
  description?: string;
}

export interface AccountantReviewShiftBody {
  approved: boolean;
  notes?: string;
  liability_action?: 'approve_only' | 'write_off' | 'staff_liability';
  allocations?: KitchenLiabilityAllocation[];
  write_off_reason?: string;
}

export interface AllocationsRequiredResponse {
  success: false;
  code: 'ALLOCATIONS_REQUIRED';
  message: string;
}
