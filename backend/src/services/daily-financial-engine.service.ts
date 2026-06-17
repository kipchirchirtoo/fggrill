/**
 * Daily Financial Engine
 *
 * Runs at midnight for every branch.
 * Pulls from all operational systems and saves a system-generated
 * baseline snapshot into financial_daily_snapshots.
 *
 * The Branch Accountant's Financial Workspace compares their submitted
 * figures against this baseline to compute variance.
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

const n = (v: any): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

// ── Revenue classifier (mirrors getDailyAutofill logic) ─────────────────────
const mapCategory = (raw: any): string => {
  const s = String(raw || '').toLowerCase().replace(/[\s-]/g, '_');
  if (s.includes('executive') && s.includes('bar')) return 'executive_bar';
  if (s.includes('sports') && s.includes('bar')) return 'sports_bar';
  if (s.includes('bar')) return 'bar';
  if (s.includes('restaurant') || s.includes('kitchen') || s.includes('food')) return 'restaurant';
  if (s.includes('room') || s.includes('accommodation') || s.includes('lodg')) return 'rooms';
  if (s.includes('pool_table') || s === 'pool' || s.includes('billiard')) return 'pool_table';
  if (s.includes('swim')) return 'swimming_pool';
  if (s.includes('spa') || s.includes('sauna') || s.includes('massage')) return 'spa_sauna';
  if (s.includes('carwash') || s.includes('car_wash')) return 'carwash';
  if (s.includes('conference') || s.includes('meeting') || s.includes('event')) return 'conferences';
  if (s.includes('cater')) return 'outside_catering';
  if (s.includes('non_consumable') || s.includes('shop') || s.includes('retail')) return 'non_consumables';
  return 'other';
};

// ── Snapshot for one branch/day ──────────────────────────────────────────────
export async function generateBranchDailySnapshot(
  branchId: number,
  date: string
): Promise<void> {
  const startTs = `${date}T00:00:00`;
  const endTs = `${date}T23:59:59`;

  const revenueMap: Record<string, number> = {
    restaurant: 0, bar: 0, executive_bar: 0, sports_bar: 0,
    rooms: 0, conferences: 0, outside_catering: 0, other: 0,
  };
  let systemBanked = 0;
  let systemCashCollected = 0;

  // ── POS outlets ─────────────────────────────────────────────────────────
  const { data: posOutlets } = await supabase
    .from('pos_outlets')
    .select('id, outlet_type')
    .eq('branch_id', branchId);

  const outletTypeMap = new Map<string, string>(
    (posOutlets || []).map((o: any) => [String(o.id), String(o.outlet_type || '')])
  );

  if ((posOutlets || []).length) {
    const { data: posOrders } = await supabase
      .from('pos_shift_orders')
      .select('outlet_id, total_amount, payment_method, created_at')
      .in('outlet_id', (posOutlets || []).map((o: any) => o.id))
      .gte('created_at', startTs)
      .lte('created_at', endTs)
      .eq('status', 'paid');
    for (const o of (posOrders || []) as any[]) {
      const field = mapCategory(outletTypeMap.get(String(o.outlet_id)));
      revenueMap[field] = (revenueMap[field] || 0) + n(o.total_amount);
    }
  }

  // ── Cashier shift logs ───────────────────────────────────────────────────
  const { data: shiftLogs } = await supabase
    .from('cashier_shift_logs')
    .select('restaurant_revenue, bar_revenue, room_booking_revenue, conference_revenue, total_cash_sales, cash_deposited')
    .eq('branch_id', branchId)
    .gte('shift_start', startTs)
    .lte('shift_start', endTs);

  for (const s of (shiftLogs || []) as any[]) {
    revenueMap.restaurant = Math.max(revenueMap.restaurant, n(s.restaurant_revenue));
    revenueMap.bar = Math.max(revenueMap.bar, n(s.bar_revenue));
    revenueMap.rooms = Math.max(revenueMap.rooms, n(s.room_booking_revenue));
    revenueMap.conferences = Math.max(revenueMap.conferences, n(s.conference_revenue));
    systemCashCollected += n(s.total_cash_sales);
    systemBanked += n(s.cash_deposited);
  }

  // ── Bookings revenue ─────────────────────────────────────────────────────
  if (revenueMap.rooms === 0) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('total_amount, status')
      .eq('branch_id', branchId)
      .gte('created_at', startTs)
      .lte('created_at', endTs);
    revenueMap.rooms = (bookings || [])
      .filter((b: any) => !['cancelled', 'no_show'].includes(String(b.status || '')))
      .reduce((s: number, b: any) => s + n(b.total_amount), 0);
  }

  // ── Banking transactions ─────────────────────────────────────────────────
  if (systemBanked === 0) {
    const { data: bankTxns } = await supabase
      .from('banking_transactions')
      .select('amount, transaction_type, transaction_date')
      .eq('branch_id', branchId)
      .gte('transaction_date', startTs)
      .lte('transaction_date', endTs);
    for (const b of (bankTxns || []) as any[]) {
      if (!String(b.transaction_type || '').toLowerCase().includes('withdraw')) {
        systemBanked += n(b.amount);
      }
    }
  }

  // ── Inventory COGS ───────────────────────────────────────────────────────
  const { data: inventoryMovements } = await supabase
    .from('inventory_movements')
    .select('quantity, unit_cost')
    .eq('branch_id', branchId)
    .in('movement_type', ['department_issue', 'pos_issue', 'production_consumption'])
    .gte('created_at', startTs)
    .lte('created_at', endTs);
  const inventoryCogs = (inventoryMovements || []).reduce(
    (s: number, m: any) => s + n(m.quantity) * n(m.unit_cost),
    0
  );

  // ── Supplier expenses ────────────────────────────────────────────────────
  const { data: supplierInvoices } = await supabase
    .from('supplier_invoices')
    .select('total_amount, status')
    .eq('branch_id', branchId)
    .in('status', ['paid', 'posted'])
    .gte('created_at', startTs)
    .lte('created_at', endTs);
  const supplierExpenses = (supplierInvoices || []).reduce(
    (s: number, inv: any) => s + n(inv.total_amount), 0
  );

  // ── Petty cash expenses ──────────────────────────────────────────────────
  const { data: pettyCash } = await supabase
    .from('petty_cash_transactions')
    .select('amount')
    .eq('branch_id', branchId)
    .gte('date', date)
    .lte('date', date);
  const pettyCashExpenses = (pettyCash || []).reduce((s: number, p: any) => s + n(p.amount), 0);

  // ── Payroll expense (prorated for the day: monthly payroll / 30) ─────────
  const { data: payrollBatch } = await supabase
    .from('payroll_batches')
    .select('total_net')
    .eq('branch_id', branchId)
    .eq('period_year', new Date(date).getFullYear())
    .eq('period_month', new Date(date).getMonth() + 1)
    .in('status', ['approved', 'locked'])
    .maybeSingle();
  const payrollExpense = payrollBatch ? round2(n(payrollBatch.total_net) / 30) : 0;

  const totalSystemRevenue = round2(Object.values(revenueMap).reduce((s, v) => s + v, 0));
  const totalSystemExpenses = round2(inventoryCogs + supplierExpenses + pettyCashExpenses + payrollExpense);
  const systemNetProfit = round2(totalSystemRevenue - totalSystemExpenses);

  const rawData = {
    revenue_breakdown: revenueMap,
    inventory_cogs: inventoryCogs,
    supplier_expenses: supplierExpenses,
    petty_cash_expenses: pettyCashExpenses,
    payroll_expense: payrollExpense,
    system_banked: systemBanked,
    system_cash_collected: systemCashCollected,
  };

  const snapshotPayload: Record<string, any> = {
    branch_id: branchId,
    snapshot_date: date,
    restaurant_revenue: round2(revenueMap.restaurant),
    rooms_revenue: round2(revenueMap.rooms),
    pos_revenue: round2((revenueMap.executive_bar || 0) + (revenueMap.sports_bar || 0) + (revenueMap.pool_table || 0)),
    other_revenue: round2((revenueMap.conferences || 0) + (revenueMap.outside_catering || 0) + (revenueMap.other || 0)),
    total_system_revenue: totalSystemRevenue,
    inventory_cogs: round2(inventoryCogs),
    supplier_expenses: round2(supplierExpenses),
    payroll_expense: round2(payrollExpense),
    petty_cash_expenses: round2(pettyCashExpenses),
    other_expenses: 0,
    total_system_expenses: totalSystemExpenses,
    system_banked: round2(systemBanked),
    system_cash_collected: round2(systemCashCollected),
    system_net_profit: systemNetProfit,
    raw_data: rawData,
  };

  // bar_revenue column added in migration 20260613_financial_governance.sql
  // Include it if the migration has been run; gracefully degrade if not.
  snapshotPayload.bar_revenue = round2(revenueMap.bar);

  const { error } = await supabase
    .from('financial_daily_snapshots')
    .upsert(snapshotPayload, { onConflict: 'branch_id,snapshot_date' });

  if (error) {
    const errCode = (error as any).code;
    if (errCode === 'PGRST204') {
      logger.warn(
        `[DailyEngine] Snapshot skipped branch=${branchId} date=${date}: schema cache missing columns. Run migration 20260613_financial_governance.sql.`
      );
      return;
    }
    logger.error(`[DailyEngine] Snapshot failed branch=${branchId} date=${date}:`, error);
    throw error;
  }

  logger.info(`[DailyEngine] Snapshot saved branch=${branchId} date=${date} revenue=${totalSystemRevenue} profit=${systemNetProfit}`);
}

// ── Run for ALL active branches ─────────────────────────────────────────────
export async function runDailyFinancialEngine(dateOverride?: string): Promise<void> {
  const date = dateOverride || new Date(Date.now() - 86_400_000).toISOString().split('T')[0]; // yesterday
  logger.info(`[DailyEngine] Starting run for date=${date}`);

  const { data: branches, error } = await supabase
    .from('branches')
    .select('id')
    .eq('is_active', true);

  if (error || !branches?.length) {
    logger.warn('[DailyEngine] No active branches found or error:', error);
    return;
  }

  let success = 0;
  let failed = 0;
  for (const branch of branches) {
    try {
      await generateBranchDailySnapshot(Number(branch.id), date);
      success++;
    } catch (err) {
      failed++;
      logger.error(`[DailyEngine] Failed branch=${branch.id}:`, err);
    }
  }

  logger.info(`[DailyEngine] Complete: ${success} ok, ${failed} failed`);
}

// ── Variance analysis engine ─────────────────────────────────────────────────
// Called when accountant submits workspace. Compares submitted figures
// against the system snapshot and 7-day rolling average.

export interface VarianceAnalysisResult {
  overallVariance: number;
  variancePct: number;
  revenueVariance: number;
  cashVariance: number;
  bankingVariance: number;
  posVariance: number;
  payrollVariance: number;
  supplierVariance: number;
  requiresExplanation: boolean;
  smartAnalysis: Array<{
    component: string;
    variance: number;
    possibleCauses: Array<{ cause: string; confidence: number }>;
  }>;
}

export async function computeVarianceAnalysis(params: {
  branchId: number;
  date: string;
  submittedRevenue: number;
  submittedExpenses: number;
  submittedNetProfit: number;
  submittedCash: number;
  submittedBanked: number;
}): Promise<VarianceAnalysisResult> {
  const { branchId, date, submittedRevenue, submittedExpenses, submittedNetProfit, submittedCash, submittedBanked } = params;

  // System snapshot for this day
  const { data: snapshot } = await supabase
    .from('financial_daily_snapshots')
    .select('*')
    .eq('branch_id', branchId)
    .eq('snapshot_date', date)
    .maybeSingle();

  // 7-day rolling average from daily_financial_records
  const sevenDaysAgo = new Date(Date.parse(date) - 7 * 86_400_000).toISOString().split('T')[0];
  const { data: recentRecords } = await supabase
    .from('daily_financial_records')
    .select('total_revenue, net_profit')
    .eq('branch_id', branchId)
    .eq('status', 'REVIEWED')
    .gte('record_date', sevenDaysAgo)
    .lt('record_date', date);

  const avgRevenue = recentRecords?.length
    ? recentRecords.reduce((s: number, r: any) => s + n(r.total_revenue), 0) / recentRecords.length
    : 0;

  const systemRevenue = snapshot ? n(snapshot.total_system_revenue) : avgRevenue;
  const systemBanked = snapshot ? n(snapshot.system_banked) : 0;
  const systemCash = snapshot ? n(snapshot.system_cash_collected) : 0;
  const systemSupplier = snapshot ? n(snapshot.supplier_expenses) : 0;
  const systemPayroll = snapshot ? n(snapshot.payroll_expense) : 0;

  const revenueVariance = round2(submittedRevenue - systemRevenue);
  const bankingVariance = round2(submittedBanked - systemBanked);
  const cashVariance = round2(submittedCash - systemCash);
  const supplierVariance = 0; // filled when supplier module integrated
  const payrollVariance = 0;  // filled when payroll batch linked
  const overallVariance = round2(submittedNetProfit - (systemRevenue - n(snapshot?.total_system_expenses || 0)));
  const variancePct = systemRevenue > 0 ? round2((revenueVariance / systemRevenue) * 100) : 0;

  const smartAnalysis: VarianceAnalysisResult['smartAnalysis'] = [];

  if (Math.abs(revenueVariance) > 100) {
    const causes: Array<{ cause: string; confidence: number }> = [];
    if (Math.abs(bankingVariance) > 100) causes.push({ cause: 'Missing Banking Entry', confidence: 91 });
    if (Math.abs(cashVariance) > 100) causes.push({ cause: 'Cashier Cash Shortage', confidence: 83 });
    if (revenueVariance < 0 && Math.abs(revenueVariance) < 5000)
      causes.push({ cause: 'POS Sync Delay', confidence: 71 });
    if (revenueVariance < -10000) causes.push({ cause: 'Revenue Leakage', confidence: 65 });
    smartAnalysis.push({ component: 'Revenue', variance: revenueVariance, possibleCauses: causes });
  }

  if (Math.abs(bankingVariance) > 100) {
    smartAnalysis.push({
      component: 'Banking',
      variance: bankingVariance,
      possibleCauses: [
        { cause: 'Banking Delay (end-of-day deposit)', confidence: 88 },
        { cause: 'Bank Reconciliation Lag', confidence: 72 },
      ],
    });
  }

  if (Math.abs(cashVariance) > 100) {
    smartAnalysis.push({
      component: 'Cash',
      variance: cashVariance,
      possibleCauses: [
        { cause: 'Cashier Float Variance', confidence: 85 },
        { cause: 'Petty Cash Unrecorded', confidence: 70 },
      ],
    });
  }

  return {
    overallVariance,
    variancePct,
    revenueVariance,
    cashVariance,
    bankingVariance,
    posVariance: 0,
    payrollVariance,
    supplierVariance,
    requiresExplanation: overallVariance < -500, // require explanation if loss > 500
    smartAnalysis,
  };
}
