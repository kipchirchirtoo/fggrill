import { z } from 'zod';
import db from '../db';
import { logger } from '../utils/logger';
import { buildDailyControlPayload } from '../controllers/kitchen/kitchen-controls.controller';
import {
  KITCHEN_STOCKTAKE_ITEMS,
  getApprovedKitchenSpoilageByName,
  getKitchenSoldByName,
  getKitchenSoldByNameForDay,
} from '../controllers/storekeeping/kitchen-stocktake.controller';
import {
  FOOD_CONTROL_SYSTEM_MODEL,
  buildFallbackDiagnosis,
  getLatestHealthCheck,
  runStructuralChecks,
} from './branch-health.service';

/**
 * Lina Daily Food Control briefing.
 *
 * Mirrors the storekeeper Daily Controls page server-side: the deterministic
 * payload comes from the SAME buildDailyControlPayload used by
 * /api/kitchen/daily-control, structural setup context comes from the
 * branch-health checks, and Claude is called exactly once to interpret the
 * day for a manager/accountant. AI never detects anything — all numbers are
 * computed before the call, and a schema-validated fallback briefing is
 * derived directly from the numbers if the AI call fails.
 */

export interface DailyBriefingConcern {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  explanation: string;
  action: string;
}

export interface LinaDailyBriefing {
  headline: string;
  food_cost_assessment: string;
  top_concerns: DailyBriefingConcern[];
  wins: string[];
  data_quality_notes: string[];
}

export interface LinaDailyFoodControlResult {
  branch_id: number;
  date: string;
  shift: string | null;
  briefing: LinaDailyBriefing;
  is_ai_interpreted: boolean;
  /** Key day numbers echoed back so the client can render chips without re-fetching. */
  day_summary: Record<string, any>;
  /** Deterministic reconciliations across sales, kitchen shifts/stocktakes, bar and cash. */
  cross_checks: Record<string, any>;
  structural_health: { health_score: number; top_issues: string[] };
  generated_at: string;
}

const BriefingSchema = z.object({
  headline: z.string().min(1),
  food_cost_assessment: z.string().min(1),
  top_concerns: z
    .array(
      z.object({
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        title: z.string().min(1),
        explanation: z.string().min(1),
        action: z.string().min(1),
      })
    )
    .max(8),
  wins: z.array(z.string()).max(6),
  data_quality_notes: z.array(z.string()).max(6),
});

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_TIMEOUT_MS = 45_000;
const CACHE_TTL_MS = 5 * 60_000;

// Both the accountant and superadmin pages hit this within minutes of each
// other; a short TTL cache keeps that to one AI call per branch/date/shift.
const briefingCache = new Map<string, { expiresAt: number; result: LinaDailyFoodControlResult }>();

const num = (v: any): number => (typeof v === 'number' ? v : Number(v) || 0);

/** Trim the daily payload to what the model needs — top movers, not every row. */
function compactDailyData(daily: Record<string, any>): Record<string, any> {
  const bom: any[] = Array.isArray(daily.bom_control) ? daily.bom_control : [];
  const kvs: any[] = Array.isArray(daily.kitchen_vs_sales) ? daily.kitchen_vs_sales : [];
  const noRecipe: any[] = Array.isArray(daily.no_recipe_items) ? daily.no_recipe_items : [];

  const topBomVariances = [...bom]
    .sort((a, b) => Math.abs(num(b.variance_cost)) - Math.abs(num(a.variance_cost)))
    .slice(0, 15)
    .map((i) => ({
      item: i.item_name,
      unit: i.unit,
      theoretical_qty: num(i.theoretical_qty),
      actual_qty: num(i.actual_qty),
      variance_qty: num(i.variance_qty),
      variance_cost: num(i.variance_cost),
      variance_type: i.variance_type,
    }));

  const topProductionMismatches = [...kvs]
    .sort((a, b) => Math.abs(num(b.variance)) - Math.abs(num(a.variance)))
    .slice(0, 15)
    .map((i) => ({
      item: i.item_name,
      produced: num(i.produced_qty),
      sold: num(i.sold_qty),
      variance: num(i.variance),
      status: i.status,
    }));

  return {
    summary: daily.summary || {},
    stock_vs_sales: daily.stock_vs_sales || {},
    has_kitchen_session: daily.has_kitchen_session === true,
    kitchen_issue_summary: daily.kitchen_issue_summary || {},
    shift_team: daily.shift_team || [],
    top_bom_variances: topBomVariances,
    top_production_mismatches: topProductionMismatches,
    items_sold_without_recipe: noRecipe.length,
    no_recipe_examples: noRecipe.slice(0, 8).map((i: any) => i.item_name),
  };
}

// ── Cross-table daily reconciliations ───────────────────────────────────────
//
// buildDailyControlPayload covers restaurant sales vs recipe theory vs kitchen
// issue workflows. These cross-checks sweep the REST of the food-control
// tables for the same day so Lina reconciles every tier:
//   - kitchen_shift_items      → physical shift ledger (opening/added/sold/spoilage/count/variance)
//   - kitchen_stocktake_*      → tier-2 physical stocktakes and their approval status
//   - pos_shift_orders (bar)   → bar sales that the restaurant-only payload skips
//   - bar_stock_ledger         → what the bar stock system actually deducted
//   - bar_stocktake_records    → physical bar counts + variances (costed via bar_drinks)
//   - cashier_shifts           → cash-side revenue for the shifts that sold that day
//   - branch_stock_movements   → stock received/dispatched/adjusted that day

/** Same shift windows as buildDailyControlPayload (kept identical on purpose). */
function dayWindow(controlDate: string, shift: string | null): { start: string; end: string } {
  if (shift === 'A') {
    return {
      start: `${controlDate}T06:00:00.000Z`,
      end: `${controlDate}T18:00:00.000Z`,
    };
  }
  if (shift === 'B') {
    const next = new Date(`${controlDate}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return {
      start: `${controlDate}T18:00:00.000Z`,
      end: `${next.toISOString().split('T')[0]}T06:00:00.000Z`,
    };
  }
  const next = new Date(`${controlDate}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    start: `${controlDate}T00:00:00.000Z`,
    end: next.toISOString(),
  };
}

async function gatherDailyCrossChecks(
  branchId: number,
  controlDate: string,
  shift: string | null
): Promise<Record<string, any>> {
  const { start, end } = dayWindow(controlDate, shift);
  const shiftAliases =
    shift === 'A' ? ['A'] : shift === 'B' ? ['B'] : ['A', 'B'];
  const shiftClause = `AND ks.shift = ANY($3::text[])`;
  const shiftParams = [branchId, controlDate, shiftAliases];

  // Run in small batches so this never saturates the shared pool.
  const safeQuery = async (label: string, sql: string, params: any[]): Promise<any[]> => {
    try {
      const { rows } = await db.query(sql, params);
      return rows || [];
    } catch (err) {
      logger.warn(`lina-daily-food-control: cross-check "${label}" failed`, {
        branch_id: branchId,
        error: (err as Error).message,
      });
      return [];
    }
  };

  // 1. Fetch physical counts from kitchen_stocktake_items
  const stocktakeItems = await safeQuery(
    'kitchen_stocktake_items_raw',
    `SELECT ki.item_name,
            COALESCE(ki.opening_qty, 0)::numeric AS opening,
            COALESCE(ki.added_qty, 0)::numeric AS added,
            COALESCE(ki.closing_qty, 0)::numeric AS closing,
            COALESCE(ki.variance, 0)::numeric AS variance
       FROM kitchen_stocktake_items ki
       JOIN kitchen_stocktake_shifts ks ON ks.id = ki.shift_id
      WHERE ks.branch_id = $1 AND ks.stocktake_date = $2::date ${shiftClause}`,
    shiftParams
  );

  const finalizedShifts = await safeQuery(
    'finalized_shifts',
    `SELECT id, shift, status
       FROM kitchen_stocktake_shifts ks
      WHERE ks.branch_id = $1 AND ks.stocktake_date = $2::date ${shiftClause}
        AND COALESCE(ks.status, '') != 'draft'`,
    shiftParams
  );

  // Fetch opening stock and additions from kitchen_shift_items (Kitchen Sessions screen)
  const shiftAliasesForShifts =
    shift === 'A'
      ? ['shift_a', 'a', 'morning']
      : shift === 'B'
        ? ['shift_b', 'b', 'evening', 'night']
        : ['shift_a', 'a', 'morning', 'shift_b', 'b', 'evening', 'night'];

  const shiftItemsRaw = await safeQuery(
    'kitchen_shift_items_raw',
    `SELECT ksi.item_sku,
            ksi.item_name,
            COALESCE(SUM(COALESCE(ksi.opening_stock, 0)), 0)::numeric AS opening,
            COALESCE(SUM(COALESCE(ksi.additions, 0)), 0)::numeric AS added
       FROM kitchen_shift_items ksi
       JOIN kitchen_shifts ks ON ks.id = ksi.shift_id
      WHERE ks.branch_id = $1 AND ks.shift_date = $2::date
        AND LOWER(COALESCE(ks.shift_type, '')) = ANY($3::text[])
      GROUP BY ksi.item_sku, ksi.item_name`,
    [branchId, controlDate, shiftAliasesForShifts]
  );

  const MAP_SHIFT_ITEM_TO_STOCKTAKE: Record<string, string> = {
    'FG-16': 'Sausages',
    'FG-149': 'Mbuzi Raw',
    'FG-15': 'Chicken B',
    'FG-18': 'Fish',
    'FG-3': 'Chapati',
    'FG-14': 'Mandazi',
    'FG-106': 'Milk',
    'FG-5': 'Rice',
    'FG-80': 'Beef',
    'FG-86': 'Chips',
    'FG-51': 'Eggs B',
    'FG-52': 'Pilau',
  };

  const mapShiftItemToStocktake = (sku: string, name: string): string => {
    const s = String(sku || '').toUpperCase();
    const n = String(name || '').toUpperCase();
    if (MAP_SHIFT_ITEM_TO_STOCKTAKE[s]) {
      return MAP_SHIFT_ITEM_TO_STOCKTAKE[s];
    }
    if (s === 'FG-16' || n.includes('SAUSAGE')) return 'Sausages';
    if (s === 'FG-149' || n.includes('MBUZI')) return 'Mbuzi Raw';
    if (s === 'FG-15' || n.includes('BROILER')) return 'Chicken B';
    if (s === 'FG-18' || n.includes('FISH')) return 'Fish';
    if (s === 'FG-3' || n.includes('EXE ALL PURPOSE')) return 'Chapati';
    if (s === 'FG-14' || n.includes('SELFRAISING') || n.includes('NDAZI') || n.includes('MANDAZI')) return 'Mandazi';
    if (s === 'FG-106' || n.includes('MILK')) return 'Milk';
    if (s === 'FG-5' || n.includes('RICE')) return 'Rice';
    if (s === 'FG-80' || n.includes('BEEF')) return 'Beef';
    if (s === 'FG-86' || n.includes('POTATO')) return 'Chips';
    if (s === 'FG-51' || n.includes('EGG')) return 'Eggs B';
    for (const item of KITCHEN_STOCKTAKE_ITEMS) {
      const itemUpper = item.toUpperCase();
      if (itemUpper === n || n.includes(itemUpper) || itemUpper.includes(n)) {
        return item;
      }
    }
    return name;
  };

  const shiftOpeningMap = new Map<string, number>();
  const shiftAddedMap = new Map<string, number>();

  shiftItemsRaw.forEach((row: any) => {
    const stocktakeName = mapShiftItemToStocktake(row.item_sku, row.item_name);
    shiftOpeningMap.set(stocktakeName, (shiftOpeningMap.get(stocktakeName) ?? 0) + Number(row.opening));
    shiftAddedMap.set(stocktakeName, (shiftAddedMap.get(stocktakeName) ?? 0) + Number(row.added));
  });

  const itemsList = [...new Set(stocktakeItems.map(i => i.item_name))];

  // Fetch spoilage and sales maps
  let spoilageMap = new Map<string, number>();
  let soldMap = new Map<string, number>();

  if (itemsList.length > 0) {
    if (shift === 'A' || shift === 'B') {
      const [spoilage, sold] = await Promise.all([
        getApprovedKitchenSpoilageByName(branchId, itemsList, controlDate, shift),
        getKitchenSoldByName(branchId, itemsList, controlDate, shift)
      ]);
      spoilageMap = spoilage;
      soldMap = sold;
    } else {
      const spoilageMaps = await Promise.all(
        finalizedShifts.map(s => getApprovedKitchenSpoilageByName(branchId, itemsList, controlDate, s.shift))
      );
      itemsList.forEach(name => {
        const total = spoilageMaps.reduce((sum, m) => sum + (m.get(name) ?? 0), 0);
        spoilageMap.set(name, total);
      });
      soldMap = await getKitchenSoldByNameForDay(branchId, itemsList, controlDate);
    }
  }

  const processedItems = stocktakeItems.map(row => {
    const name = row.item_name;
    const opening = shiftOpeningMap.get(name) ?? 0;
    const added = shiftAddedMap.get(name) ?? 0;
    const closing = num(row.closing);
    const spoilage = spoilageMap.get(name) ?? 0;
    const systemSold = soldMap.get(name) ?? 0;

    const totals = opening + added;
    const quantitySold = totals - closing - spoilage;
    // variance = systemSold - physical quantitySold. Negative represents shortage.
    const variance = systemSold - quantitySold;

    return {
      item_name: name,
      opening,
      added,
      sold: quantitySold,
      spoilage,
      physical_count: closing,
      variance: Number(variance.toFixed(3)),
      variance_value: 0
    };
  });

  const totalOpening = processedItems.reduce((sum, item) => sum + item.opening, 0);
  const totalAdded = processedItems.reduce((sum, item) => sum + item.added, 0);
  const totalSold = processedItems.reduce((sum, item) => sum + item.sold, 0);
  const totalSpoilage = processedItems.reduce((sum, item) => sum + item.spoilage, 0);
  const totalCountedRows = processedItems.filter(item => item.physical_count !== null).length;
  const totalVarianceQty = processedItems.reduce((sum, item) => sum + item.variance, 0);

  const shiftLedgerTotals = [{
    rows: processedItems.length,
    opening: totalOpening,
    added: totalAdded,
    sold: totalSold,
    spoilage: totalSpoilage,
    counted_rows: totalCountedRows,
    variance_qty: Number(totalVarianceQty.toFixed(3)),
    variance_value: 0
  }];

  const shiftLedgerTop = processedItems
    .filter(item => item.variance !== 0)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 8);

  const [stocktakeShifts] = await Promise.all([
    safeQuery(
      'kitchen_stocktakes',
      `SELECT ks.shift, ks.status,
              COUNT(ki.id)::int AS items,
              COALESCE(SUM(ki.variance), 0) AS net_variance_qty
         FROM kitchen_stocktake_shifts ks
         LEFT JOIN kitchen_stocktake_items ki ON ki.shift_id = ks.id
        WHERE ks.branch_id = $1 AND ks.stocktake_date = $2::date
        GROUP BY ks.id, ks.shift, ks.status`,
      [branchId, controlDate]
    ),
  ]);

  const [posByGroup, barLedger, barStocktake] = await Promise.all([
    safeQuery(
      'pos_sales_by_group',
      `SELECT COALESCE(itm->>'item_group', 'other') AS grp,
              COALESCE(SUM(GREATEST(COALESCE((itm->>'quantity')::numeric, 0)
                        - COALESCE((itm->>'voided_qty')::numeric, 0), 0)), 0) AS qty,
              COALESCE(SUM(GREATEST(COALESCE((itm->>'quantity')::numeric, 0)
                        - COALESCE((itm->>'voided_qty')::numeric, 0), 0)
                        * COALESCE((itm->>'unit_price')::numeric, 0)), 0) AS revenue
         FROM pos_shift_orders o
        CROSS JOIN LATERAL jsonb_array_elements(o.items) itm
        WHERE o.branch_id = $1 AND o.created_at >= $2 AND o.created_at < $3
          AND (o.status IN ('paid','credit_bill') OR o.payment_status IN ('paid','credit_bill'))
        GROUP BY 1`,
      [branchId, start, end]
    ),
    safeQuery(
      'bar_stock_ledger',
      `SELECT transaction_type, COUNT(*)::int AS entries, COALESCE(SUM(quantity), 0) AS qty
         FROM bar_stock_ledger
        WHERE branch_id = $1 AND created_at >= $2 AND created_at < $3
        GROUP BY 1`,
      [branchId, start, end]
    ),
    safeQuery(
      'bar_stocktake',
      // item_id → inventory_items (FK verified), not bar_drinks.
      `SELECT COUNT(*)::int AS records,
              COUNT(*) FILTER (WHERE COALESCE(variance, 0) <> 0)::int AS nonzero_variances,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'pending')::int AS pending_review,
              COALESCE(SUM(variance), 0) AS net_variance_qty,
              COALESCE(SUM(bsr.variance * COALESCE(ii.cost_price, ii.default_unit_cost, 0)), 0) AS net_variance_cost
         FROM bar_stocktake_records bsr
         LEFT JOIN inventory_items ii ON ii.id = bsr.item_id
        WHERE bsr.branch_id = $1 AND bsr.stocktake_date = $2::date`,
      [branchId, controlDate]
    ),
  ]);

  const [barStocktakeTop, cashierShifts, movements] = await Promise.all([
    safeQuery(
      'bar_stocktake_top_variances',
      `SELECT COALESCE(ii.item_name, bsr.item_id::text) AS drink,
              bsr.system_quantity, bsr.physical_quantity, bsr.variance,
              (bsr.variance * COALESCE(ii.cost_price, ii.default_unit_cost, 0)) AS variance_cost,
              bsr.reason_for_variance, bsr.status
         FROM bar_stocktake_records bsr
         LEFT JOIN inventory_items ii ON ii.id = bsr.item_id
        WHERE bsr.branch_id = $1 AND bsr.stocktake_date = $2::date
          AND COALESCE(bsr.variance, 0) <> 0
        ORDER BY ABS(bsr.variance * COALESCE(ii.cost_price, ii.default_unit_cost, 0)) DESC, ABS(bsr.variance) DESC
        LIMIT 8`,
      [branchId, controlDate]
    ),
    safeQuery(
      'cashier_shifts',
      // cashier_shift_logs is the operational cashier table (used by
      // closeShift): variance = expected vs actual float, total_sales =
      // reconciled revenue. NOTE pos_shift_orders.shift_id references
      // pos_outlet_shifts, NOT cashier shifts — match by day window instead.
      `SELECT COUNT(*)::int AS shifts,
              COUNT(*) FILTER (WHERE LOWER(COALESCE(csl.status, '')) IN ('open', 'active'))::int AS still_open,
              COALESCE(SUM(csl.total_sales), 0) AS cashier_total_sales,
              COALESCE(SUM(csl.variance), 0) AS cash_variance
         FROM cashier_shift_logs csl
        WHERE csl.branch_id = $1 AND csl.shift_start >= $2 AND csl.shift_start < $3
          AND LOWER(COALESCE(csl.status, '')) NOT IN ('rejected', 'cancelled')`,
      [branchId, start, end]
    ),
    safeQuery(
      'stock_movements',
      `SELECT movement_type, COUNT(*)::int AS entries, COALESCE(SUM(quantity), 0) AS qty
         FROM branch_stock_movements
        WHERE branch_id = $1 AND created_at >= $2 AND created_at < $3
        GROUP BY 1 ORDER BY 2 DESC`,
      [branchId, start, end]
    ),
  ]);

  const ledgerByType: Record<string, { entries: number; qty: number }> = {};
  for (const row of barLedger) {
    ledgerByType[row.transaction_type] = { entries: row.entries, qty: num(row.qty) };
  }
  const posBar = posByGroup.find((r: any) => r.grp === 'bar');
  const posRestaurant = posByGroup.find((r: any) => r.grp === 'restaurant');
  const barPosQty = num(posBar?.qty);
  const barLedgerNetSales =
    num(ledgerByType['sale']?.qty) - num(ledgerByType['sale_reversal']?.qty);

  return {
    kitchen_shift_ledger: {
      ...(shiftLedgerTotals[0] || { rows: 0 }),
      top_variances: shiftLedgerTop,
    },
    kitchen_stocktakes: stocktakeShifts,
    pos_sales_by_group: posByGroup,
    bar: {
      pos_bar_qty_sold: barPosQty,
      pos_bar_revenue: num(posBar?.revenue),
      ledger: ledgerByType,
      ledger_net_sale_qty: barLedgerNetSales,
      // If POS sold N drinks but the ledger deducted M ≠ N, some bar items
      // are not linked to bar stock (or reversals/voids are off).
      pos_vs_ledger_gap_qty: barPosQty - barLedgerNetSales,
      stocktake: barStocktake[0] || { records: 0 },
      stocktake_top_variances: barStocktakeTop,
    },
    revenue: {
      pos_restaurant_revenue: num(posRestaurant?.revenue),
      pos_bar_revenue: num(posBar?.revenue),
      pos_total_revenue: posByGroup.reduce((s: number, r: any) => s + num(r.revenue), 0),
      cashier: cashierShifts[0] || { shifts: 0 },
    },
    stock_movements: movements,
  };
}

function buildBriefingPrompt(
  compactDaily: Record<string, any>,
  crossChecks: Record<string, any>,
  structural: { health_score: number; top_issues: string[] },
  branchName: string,
  date: string,
  shift: string | null
): string {
  return [
    `You are Lina, the food-control analyst for a Kenyan hotel/restaurant group. Interpret ONE day's pre-computed food-control numbers for branch "${branchName}" on ${date}${shift ? ` (shift ${shift})` : ' (full day)'}. All detection is already done — you only interpret, prioritize, and explain. Never invent numbers.`,
    '',
    'HOW THE CONTROL SYSTEM WORKS:',
    FOOD_CONTROL_SYSTEM_MODEL.tier_2_kitchen,
    FOOD_CONTROL_SYSTEM_MODEL.tier_1_bar,
    FOOD_CONTROL_SYSTEM_MODEL.tier_3_store,
    '',
    "TODAY'S KITCHEN CONTROL DATA (sales vs recipe theory vs recorded usage):",
    JSON.stringify(compactDaily, null, 2),
    '',
    "TODAY'S CROSS-TABLE RECONCILIATIONS (kitchen shift ledger, physical stocktakes, bar tier, cash tier, stock movements):",
    JSON.stringify(crossChecks, null, 2),
    '',
    `BRANCH SETUP HEALTH (structural, not day-specific): score ${structural.health_score}/100; open setup issues: ${structural.top_issues.join('; ') || 'none'}.`,
    '',
    'RULES:',
    '1. Negative BOM variance_cost = ingredients used beyond recipe theory (waste/over-portioning/loss); positive = under-usage (possible under-recording).',
    '2. produced > sold in production mismatches = unsold food risk; sold > produced = unrecorded production.',
    '3. If has_kitchen_session is false or issued qty is 0, treat "Actual" figures as unrecorded, not as real zero usage — say so in data_quality_notes instead of alarming about variance.',
    '4. items_sold_without_recipe means those sales have NO theoretical cost at all — call this out when material.',
    '5. Amounts are KES. Name items and amounts, but NEVER expose internal field names, flags, or codes (no has_kitchen_session, issued_qty, still_open=1, variance_cost, "38 rows", etc.) — say it in human words ("the kitchen session was never opened", "the cashier shift is still open").',
    '6. Only real concerns supported by the data; an empty top_concerns array is a valid answer for a clean day.',
    '7. EXTREMELY BRIEF — this renders on a small dashboard card, not a report. Hard limits: headline ≤ 18 words; food_cost_assessment ≤ 2 short sentences; at most 3 top_concerns with title ≤ 8 words, explanation exactly ONE sentence ≤ 18 words, action exactly ONE sentence ≤ 12 words; at most 2 wins and 2 data_quality_notes, each ONE short sentence. Merge related problems into one concern instead of listing them separately.',
    '8. kitchen_shift_ledger is the storekeeper\'s physical shift record (opening + added − sold − spoilage vs physical count); its variance_value is money lost/unexplained at ingredient level. kitchen_stocktakes shows whether the physical counts were even submitted/approved.',
    '9. Bar tier: pos_vs_ledger_gap_qty ≠ 0 means POS drink sales and bar stock deductions disagree (unlinked drinks or reversal issues). The bar stocktake net_variance_cost is money value of missing/excess bar stock; pending_review counts are counts awaiting accountant approval.',
    '10. Cash tier: compare pos_total_revenue to cashier.cashier_total_sales — a material gap means sales and cashier reconciliation disagree; cashier.cash_variance is over/short cash. still_open shifts mean the day is not closed yet.',
    '11. Weigh the day holistically across ALL tiers (kitchen, bar, cash, stock movements) — pick the 3 concerns with the biggest financial impact regardless of tier.',
    '',
    'Respond with ONLY valid JSON (no markdown fences) exactly in this shape:',
    '{',
    '  "headline": "<ONE sentence, max 18 words, plain words>",',
    '  "food_cost_assessment": "<max 2 short sentences>",',
    '  "top_concerns": [ { "severity": "critical"|"high"|"medium"|"low", "title": "<max 8 words>", "explanation": "<one sentence, max 18 words>", "action": "<one sentence, max 12 words>" } ],',
    '  "wins": [ "<one short sentence>" ],',
    '  "data_quality_notes": [ "<one short sentence>" ]',
    '}',
  ].join('\n');
}

/** Deterministic briefing straight from the numbers — used when AI is unavailable. */
export function buildFallbackBriefing(
  compactDaily: Record<string, any>,
  structural: { health_score: number; top_issues: string[] },
  crossChecks: Record<string, any> = {}
): LinaDailyBriefing {
  const summary = compactDaily.summary || {};
  const svs = compactDaily.stock_vs_sales || {};
  const revenue = num(summary.total_food_revenue);
  const foodCostPct = summary.food_cost_percent != null ? num(summary.food_cost_percent) : null;
  const targetPct = num(summary.target_food_cost_percent) || num(svs.target_percent) || 35;
  const varianceCost = num(summary.bom_variance_cost);

  const concerns: DailyBriefingConcern[] = [];
  const wins: string[] = [];
  const notes: string[] = [];

  if (!compactDaily.has_kitchen_session) {
    notes.push('No kitchen session was recorded, so actual ingredient usage is estimated from stock movements.');
  } else if (num(compactDaily.kitchen_issue_summary?.total_issued_qty) <= 0) {
    notes.push('A kitchen shift exists but no ingredient usage was confirmed — actual figures show 0 because nothing was logged, not because nothing was used.');
  }

  if (foodCostPct != null && foodCostPct > targetPct) {
    concerns.push({
      severity: foodCostPct > targetPct + 10 ? 'critical' : 'high',
      title: `Food cost ${foodCostPct.toFixed(1)}% is above the ${targetPct.toFixed(0)}% target`,
      explanation: 'Ingredient cost consumed is high relative to food revenue for this day.',
      action: 'Review the biggest variance items below and confirm portioning and recording with the kitchen team.',
    });
  } else if (foodCostPct != null && revenue > 0) {
    wins.push(`Food cost ${foodCostPct.toFixed(1)}% is within the ${targetPct.toFixed(0)}% target.`);
  }

  for (const item of (compactDaily.top_bom_variances || []).slice(0, 3)) {
    if (Math.abs(num(item.variance_cost)) <= 0) continue;
    const over = num(item.variance_cost) < 0;
    concerns.push({
      severity: Math.abs(num(item.variance_cost)) > 1000 ? 'high' : 'medium',
      title: `${item.item}: KES ${Math.abs(num(item.variance_cost)).toFixed(0)} ${over ? 'over' : 'under'} recipe theory`,
      explanation: over
        ? 'More of this ingredient was used than the recipes for what was sold require.'
        : 'Less usage was recorded than the recipes require — possible under-recording.',
      action: `Check ${item.item} portioning and stock records for this day.`,
    });
  }

  const noRecipeCount = num(compactDaily.items_sold_without_recipe);
  if (noRecipeCount > 0) {
    concerns.push({
      severity: 'medium',
      title: `${noRecipeCount} menu item(s) sold without a recipe`,
      explanation: 'These sales carry no theoretical ingredient cost, so their true food cost is invisible.',
      action: 'Create recipes for the affected items in kitchen management.',
    });
  }

  // Bar tier: POS drink sales vs bar stock deductions, and physical count variances.
  const bar = crossChecks.bar || {};
  const barGap = num(bar.pos_vs_ledger_gap_qty);
  if (Math.abs(barGap) >= 5) {
    concerns.push({
      severity: 'high',
      title: `Bar sales and bar stock disagree by ${Math.abs(barGap).toFixed(0)} unit(s)`,
      explanation: barGap > 0
        ? 'POS sold more drinks than were deducted from bar stock — some drinks are not linked to stock.'
        : 'Bar stock deducted more than POS sold — check reversals and manual ledger entries.',
      action: 'Compare POS bar items against the bar drinks list and fix missing links.',
    });
  }
  const barStocktakeVarCost = num(bar.stocktake?.net_variance_cost);
  if (Math.abs(barStocktakeVarCost) >= 500) {
    concerns.push({
      severity: Math.abs(barStocktakeVarCost) >= 3000 ? 'high' : 'medium',
      title: `Bar stocktake variance of KES ${Math.abs(barStocktakeVarCost).toFixed(0)}`,
      explanation: 'Physical bar counts differ from what the system expected for this day.',
      action: 'Review the largest drink variances with the bartender and record reasons.',
    });
  }

  // Cash tier: sales vs cashier reconciliation.
  const rev = crossChecks.revenue || {};
  const posTotal = num(rev.pos_total_revenue);
  const cashierTotal = num(rev.cashier?.cashier_total_sales);
  if (posTotal > 0 && cashierTotal > 0 && Math.abs(posTotal - cashierTotal) / posTotal > 0.05) {
    concerns.push({
      severity: 'high',
      title: `POS revenue (KES ${posTotal.toFixed(0)}) and cashier totals (KES ${cashierTotal.toFixed(0)}) disagree`,
      explanation: 'The sales system and cashier shift reconciliation differ by more than 5% for this day.',
      action: 'Reconcile the cashier shifts against POS orders before closing the day.',
    });
  }
  if (num(rev.cashier?.still_open) > 0) {
    notes.push(`${num(rev.cashier?.still_open)} cashier shift(s) covering this day are still open — cash figures are not final.`);
  }

  if (structural.top_issues.length) {
    notes.push(`Branch setup issues also affect accuracy: ${structural.top_issues.slice(0, 2).join('; ')}.`);
  }

  const headline =
    revenue <= 0
      ? 'No food sales were recorded for this day/shift.'
      : foodCostPct == null
        ? `KES ${revenue.toFixed(0)} food revenue recorded, but food cost could not be computed for this day.`
        : `KES ${revenue.toFixed(0)} food revenue at ${foodCostPct.toFixed(1)}% food cost${varianceCost !== 0 ? `, KES ${Math.abs(varianceCost).toFixed(0)} BOM variance` : ''}.`;

  return {
    headline,
    food_cost_assessment:
      foodCostPct == null
        ? 'Food cost % is unavailable — usually because ingredient usage or costs are not fully recorded for this period.'
        : `Food cost came to ${foodCostPct.toFixed(1)}% against a ${targetPct.toFixed(0)}% target. BOM variance for the day is KES ${varianceCost.toFixed(0)}.`,
    top_concerns: concerns.slice(0, 3),
    wins: wins.slice(0, 2),
    data_quality_notes: notes.slice(0, 2),
  };
}

async function callClaudeForBriefing(prompt: string, branchId: number): Promise<LinaDailyBriefing | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    logger.warn('lina-daily-food-control: ANTHROPIC_API_KEY not configured');
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2500,
        system:
          'You are Lina, a food-control analyst. You only interpret pre-computed numbers; you never detect or invent data. You always respond with valid JSON only, and you keep every string short.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Anthropic API ${response.status}: ${errBody.slice(0, 300)}`);
    }
    const payload: any = await response.json();
    if (payload?.stop_reason === 'max_tokens') {
      throw new Error('response truncated at max_tokens — JSON incomplete');
    }
    logger.info('lina-daily-food-control: Claude call complete', {
      branch_id: branchId,
      latency_ms: Date.now() - startedAt,
      input_tokens: payload?.usage?.input_tokens,
      output_tokens: payload?.usage?.output_tokens,
    });
    let text: string = payload?.content?.[0]?.text ?? '';
    text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = BriefingSchema.parse(JSON.parse(text));
    // Hard display caps — this renders on a dashboard card, never an essay.
    return {
      ...parsed,
      top_concerns: parsed.top_concerns.slice(0, 3),
      wins: parsed.wins.slice(0, 2),
      data_quality_notes: parsed.data_quality_notes.slice(0, 2),
    };
  } catch (err) {
    logger.warn('lina-daily-food-control: AI briefing failed — using deterministic fallback', {
      branch_id: branchId,
      error: (err as Error).message,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Structural setup context for the prompt. Prefers the cached
 * branch_health_checks row (setup issues change slowly), so briefings don't
 * re-run 12 structural queries and starve the shared DB pool; falls back to
 * a live run only when no cached result exists yet.
 */
async function getStructuralContext(
  branchId: number
): Promise<{ health_score: number; top_issues: string[]; branch_name: string }> {
  const cached = await getLatestHealthCheck(branchId);
  if (cached) {
    return {
      health_score: cached.health_score,
      top_issues: (cached.issues || []).slice(0, 3).map((i) => i.title),
      branch_name:
        (cached.raw_findings as any)?.context?.branch_name || `Branch ${branchId}`,
    };
  }
  const run = await runStructuralChecks(branchId);
  const diagnosis = buildFallbackDiagnosis(run.findings, run.context);
  return {
    health_score: diagnosis.health_score,
    top_issues: diagnosis.issues.slice(0, 3).map((i) => i.title),
    branch_name: run.context.branch_name,
  };
}

export async function getLinaDailyFoodControl(
  branchId: number,
  date: string,
  shift: string | null,
  forceRefresh = false
): Promise<LinaDailyFoodControlResult> {
  const cacheKey = `${branchId}:${date}:${shift || 'ALL'}`;
  if (!forceRefresh) {
    const cached = briefingCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
  }

  // The daily payload is the heavy part; run each stage on its own so the
  // stages don't compete with each other (or the auth middleware) for the
  // limited DB pool on slow links. Retry the payload once on a pool timeout —
  // the first attempt often loses the race for a connection to live traffic.
  let daily: Record<string, any>;
  try {
    daily = (await buildDailyControlPayload(branchId, date, shift)) as Record<string, any>;
  } catch (err) {
    if (!/timed out/i.test((err as Error).message)) throw err;
    logger.warn('lina-daily-food-control: daily payload timed out — retrying once', { branchId });
    daily = (await buildDailyControlPayload(branchId, date, shift)) as Record<string, any>;
  }
  const crossChecks = await gatherDailyCrossChecks(branchId, date, shift);
  const structural = await getStructuralContext(branchId);

  const compactDaily = compactDailyData(daily as Record<string, any>);
  const prompt = buildBriefingPrompt(
    compactDaily,
    crossChecks,
    { health_score: structural.health_score, top_issues: structural.top_issues },
    structural.branch_name,
    date,
    shift
  );

  const aiBriefing = await callClaudeForBriefing(prompt, branchId);
  const briefing =
    aiBriefing ?? buildFallbackBriefing(compactDaily, structural, crossChecks);

  const result: LinaDailyFoodControlResult = {
    branch_id: branchId,
    date,
    shift,
    briefing,
    is_ai_interpreted: aiBriefing != null,
    day_summary: {
      ...compactDaily.summary,
      has_kitchen_session: compactDaily.has_kitchen_session,
      items_sold_without_recipe: compactDaily.items_sold_without_recipe,
    },
    cross_checks: crossChecks,
    structural_health: {
      health_score: structural.health_score,
      top_issues: structural.top_issues,
    },
    generated_at: new Date().toISOString(),
  };

  briefingCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
}
