import { z } from 'zod';
import db from '../db';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Daily Food Control Report — digital replacement for the manual
 * "STORE STOCKSHEET" / "CONTROLS" spreadsheet (one tab per day).
 *
 * LEFT PANEL  (STORE STOCKSHEET): pure store inventory ledger per item —
 *   O.P/STOCK, ADD, TOTALS, ISSUED, C.L/STOCK plus valuations. Derived from
 *   branch_stock_movements (previous_stock/new_stock give exact system
 *   opening/closing) and inventory_items costs.
 *
 * RIGHT PANEL (CONTROLS): the yield-variance view per tracked item —
 *   EXPECTED  = TOTALS − C.STOCK − REJECTS        (physical consumption)
 *   SYSTEM SALES = POS sales converted to raw units via
 *                  kitchen_production_recipes ratios (the live yield-
 *                  definition table), or raw POS qty for directly-tracked
 *                  finished items
 *   VAR.      = SYSTEM SALES − EXPECTED           (negative ⇒ shortage/loss)
 *   Shorts.v  = VAR. × s.p
 *
 * All formulas are deterministic and computed here — the AI's only role is
 * the optional plain-language summary appended below the panels.
 *
 * Opening stock auto-rolls over from the prior day's closing; a manual
 * opening that differs from the rollover beyond tolerance is flagged as a
 * warning instead of silently accepted (fixes the known manual-sheet gap).
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface StocksheetRow {
  item_sku: string;
  item_name: string;
  unit: string;
  opening: number;
  added: number;
  totals: number;
  issued: number;
  closing: number;
  cost_price: number;
  opening_value: number;
  add_value: number;
  closing_value: number;
  rollover_warning: string | null;
}

export interface ControlsRow {
  item_name: string;
  item_sku: string | null;
  kind: 'direct' | 'yield';
  opening: number;
  added: number;
  totals: number;
  closing: number;
  rejects: number;
  expected: number;
  system_sales: number;
  variance: number;
  selling_price: number;
  shorts_value: number;
  rollover_warning: string | null;
}

export interface ReportAISummary {
  summary: string;
  flags: string[];
}

export interface DailyFoodControlReport {
  branch_id: number;
  date: string;
  is_provisional: boolean;
  left_panel: StocksheetRow[];
  right_panel: ControlsRow[];
  totals: {
    stocksheet_closing_value: number;
    controls_shorts_value: number;
    controls_shortage_items: number;
  };
  warnings: string[];
  ai_summary: ReportAISummary | null;
  generated_at: string;
}

// ── Pure formula functions (unit-tested against the verified sheet examples) ─

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Opening rollover check: warn when a recorded opening deviates from the
 *  prior day's closing beyond tolerance instead of silently accepting it. */
export function rolloverWarning(
  opening: number,
  priorClosing: number | null,
  itemName: string,
  tolerance = 0.01
): string | null {
  if (priorClosing == null) return null;
  if (Math.abs(opening - priorClosing) <= tolerance) return null;
  return `${itemName}: opening ${round2(opening)} does not match prior day's closing ${round2(priorClosing)}`;
}

/** RIGHT-PANEL formulas, exactly as on the paper sheet.
 *  Verified: SAMOSA O.P 38 + ADDED 62 = 100, C.STOCK 17, REJECTS 2 ⇒
 *  EXPECTED 81, SYSTEM SALES 79 ⇒ VAR −2, s.p 60 ⇒ Shorts.v −120. */
export function computeControlsRow(input: {
  item_name: string;
  item_sku?: string | null;
  kind: 'direct' | 'yield';
  opening: number;
  added: number;
  closing: number;
  rejects: number;
  system_sales: number;
  selling_price: number;
  prior_closing?: number | null;
}): ControlsRow {
  const totals = round2(input.opening + input.added);
  const expected = round2(totals - input.closing - input.rejects);
  const variance = round2(input.system_sales - expected);
  return {
    item_name: input.item_name,
    item_sku: input.item_sku ?? null,
    kind: input.kind,
    opening: round2(input.opening),
    added: round2(input.added),
    totals,
    closing: round2(input.closing),
    rejects: round2(input.rejects),
    expected,
    system_sales: round2(input.system_sales),
    variance,
    selling_price: round2(input.selling_price),
    shorts_value: round2(variance * input.selling_price),
    rollover_warning: rolloverWarning(input.opening, input.prior_closing ?? null, input.item_name),
  };
}

export interface YieldRule {
  raw_item_sku: string;
  raw_quantity: number;
  produced_item_name: string;
  produced_quantity: number;
  pos_outlet_item_id?: string | null;
}

const normalizeName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** SYSTEM SALES for a raw commodity: sum over its yield rules of
 *  (menu qty sold ÷ produced_quantity) × raw_quantity.
 *  Verified: MBUZI portions/specials sold ⇒ 5 kg-equivalent. */
export function computeRawSystemSales(
  rawSku: string,
  rules: YieldRule[],
  soldQtyByOutletItemId: Map<string, number>,
  soldQtyByName: Map<string, number>
): number {
  let total = 0;
  for (const rule of rules) {
    if (rule.raw_item_sku !== rawSku) continue;
    if (rule.produced_quantity <= 0 || rule.raw_quantity <= 0) continue;
    let sold = 0;
    if (rule.pos_outlet_item_id && soldQtyByOutletItemId.has(rule.pos_outlet_item_id)) {
      sold = soldQtyByOutletItemId.get(rule.pos_outlet_item_id) || 0;
    } else {
      sold = soldQtyByName.get(normalizeName(rule.produced_item_name)) || 0;
    }
    total += (sold / rule.produced_quantity) * rule.raw_quantity;
  }
  return round2(total);
}

// ── Data assembly ────────────────────────────────────────────────────────────

const IN_MOVEMENT_TYPES = ['DISPATCH_RECEIVE', 'INITIAL_STOCK', 'PASTRY_PRODUCTION', 'MANUAL_ADJUSTMENT'];
const OUT_MOVEMENT_TYPES = ['DISPATCH_OUT', 'KITCHEN_SHIFT_OPEN', 'KITCHEN_SHIFT_ADD_STOCK', 'PASTRY_ISSUE_TO_KITCHEN'];

function dayBounds(date: string): { start: string; end: string } {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: `${date}T00:00:00.000Z`, end: next.toISOString() };
}

async function q(label: string, sql: string, params: any[]): Promise<any[]> {
  try {
    const { rows } = await db.query(sql, params);
    return rows || [];
  } catch (err) {
    // Retry once — first attempt may lose the pool race to live traffic.
    if (/timed out/i.test((err as Error).message)) {
      const { rows } = await db.query(sql, params);
      return rows || [];
    }
    logger.warn(`food-control-report: query "${label}" failed`, { error: (err as Error).message });
    throw err;
  }
}

const num = (v: any): number => (typeof v === 'number' ? v : Number(v) || 0);

/** LEFT PANEL: store stock ledger from movements + costs. */
async function buildStocksheetPanel(
  branchId: number,
  date: string
): Promise<{ rows: StocksheetRow[]; warnings: string[] }> {
  const { start, end } = dayBounds(date);

  // Per-item daily movement aggregation with exact system opening/closing:
  // first movement's previous_stock = opening, last movement's new_stock =
  // closing. Items without movements today carry yesterday's closing flat.
  const moved = await q(
    'stocksheet_movements',
    `WITH day_moves AS (
       SELECT item_sku, movement_type, quantity, previous_stock, new_stock,
              ROW_NUMBER() OVER (PARTITION BY item_sku ORDER BY created_at ASC)  AS rn_first,
              ROW_NUMBER() OVER (PARTITION BY item_sku ORDER BY created_at DESC) AS rn_last
         FROM branch_stock_movements
        WHERE branch_id = $1 AND created_at >= $2 AND created_at < $3
          AND item_sku IS NOT NULL
     ),
     prior AS (
       SELECT DISTINCT ON (item_sku) item_sku, new_stock AS prior_closing
         FROM branch_stock_movements
        WHERE branch_id = $1 AND created_at < $2 AND item_sku IS NOT NULL
        ORDER BY item_sku, created_at DESC
     )
     SELECT d.item_sku,
            COALESCE(SUM(d.quantity) FILTER (WHERE d.movement_type = ANY($4)), 0) AS added,
            COALESCE(SUM(d.quantity) FILTER (WHERE d.movement_type = ANY($5)), 0) AS issued,
            MAX(d.previous_stock) FILTER (WHERE d.rn_first = 1) AS opening,
            MAX(d.new_stock) FILTER (WHERE d.rn_last = 1) AS closing,
            MAX(p.prior_closing) AS prior_closing
       FROM day_moves d
       LEFT JOIN prior p ON p.item_sku = d.item_sku
      GROUP BY d.item_sku
      ORDER BY d.item_sku`,
    [branchId, start, end, IN_MOVEMENT_TYPES, OUT_MOVEMENT_TYPES]
  );

  const skus = moved.map((r: any) => r.item_sku);
  const meta = skus.length
    ? await q(
        'stocksheet_item_meta',
        `SELECT DISTINCT ON (bs.item_sku) bs.item_sku, bs.item_name,
                COALESCE(ii.unit, ii.unit_of_measure, '') AS unit,
                COALESCE(NULLIF(bs.unit_cost, 0), ii.cost_price, ii.default_unit_cost, 0) AS cost_price
           FROM branch_stock bs
           LEFT JOIN inventory_items ii ON ii.sku = bs.item_sku
          WHERE bs.branch_id = $1 AND bs.item_sku = ANY($2)
          ORDER BY bs.item_sku`,
        [branchId, skus]
      )
    : [];
  const metaBySku = new Map<string, any>(meta.map((m: any) => [m.item_sku, m]));

  const warnings: string[] = [];
  const rows: StocksheetRow[] = moved.map((r: any) => {
    const m = metaBySku.get(r.item_sku) || {};
    const opening = num(r.opening);
    const added = num(r.added);
    const issued = num(r.issued);
    const priorClosing = r.prior_closing == null ? null : num(r.prior_closing);
    const closing = r.closing == null ? round2(opening + added - issued) : num(r.closing);
    const costPrice = num(m.cost_price);
    const warning = rolloverWarning(opening, priorClosing, m.item_name || r.item_sku);
    if (warning) warnings.push(`Store: ${warning}`);
    return {
      item_sku: r.item_sku,
      item_name: m.item_name || r.item_sku,
      unit: m.unit || '',
      opening: round2(opening),
      added: round2(added),
      totals: round2(opening + added),
      issued: round2(issued),
      closing: round2(closing),
      cost_price: round2(costPrice),
      opening_value: round2(opening * costPrice),
      add_value: round2(added * costPrice),
      closing_value: round2(closing * costPrice),
      rollover_warning: warning,
    };
  });

  rows.sort((a, b) => a.item_name.localeCompare(b.item_name));
  return { rows, warnings };
}

interface StocktakeAgg {
  item_name: string;
  opening: number;
  added: number;
  closing: number;
}

/** Aggregates the day's kitchen stocktake shifts (A then B) into one row per
 *  item: opening from the earliest shift, added summed, closing from the
 *  latest shift — matching how the paper sheet reads a full day. */
async function loadKitchenStocktakeDay(branchId: number, date: string): Promise<Map<string, StocktakeAgg>> {
  const rows = await q(
    'controls_stocktake',
    `SELECT ki.item_name, ki.opening_qty, ki.added_qty, ki.closing_qty,
            ks.shift, ks.created_at
       FROM kitchen_stocktake_items ki
       JOIN kitchen_stocktake_shifts ks ON ks.id = ki.shift_id
      WHERE ks.branch_id = $1 AND ks.stocktake_date = $2::date
      ORDER BY ks.created_at ASC`,
    [branchId, date]
  );

  const agg = new Map<string, StocktakeAgg & { firstSeen: boolean }>();
  for (const r of rows) {
    const key = normalizeName(r.item_name || '');
    if (!key) continue;
    const existing = agg.get(key);
    if (!existing) {
      agg.set(key, {
        item_name: r.item_name,
        opening: num(r.opening_qty),
        added: num(r.added_qty),
        closing: num(r.closing_qty),
        firstSeen: true,
      });
    } else {
      existing.added += num(r.added_qty);
      existing.closing = num(r.closing_qty); // latest shift wins
    }
  }
  return agg;
}

/** Prior-day closings for rollover checks, keyed by normalized item name. */
async function loadPriorClosings(branchId: number, date: string): Promise<Map<string, number>> {
  const rows = await q(
    'controls_prior_closing',
    `SELECT DISTINCT ON (LOWER(ki.item_name)) ki.item_name, ki.closing_qty
       FROM kitchen_stocktake_items ki
       JOIN kitchen_stocktake_shifts ks ON ks.id = ki.shift_id
      WHERE ks.branch_id = $1 AND ks.stocktake_date = ($2::date - INTERVAL '1 day')
      ORDER BY LOWER(ki.item_name), ks.created_at DESC`,
    [branchId, date]
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(normalizeName(r.item_name || ''), num(r.closing_qty));
  return map;
}

/** REJECTS per item from the spoilage log (kitchen area, not rejected). */
async function loadRejects(branchId: number, date: string): Promise<Map<string, number>> {
  const rows = await q(
    'controls_rejects',
    `SELECT item_name, COALESCE(SUM(quantity), 0) AS qty
       FROM branch_spoilage_log
      WHERE branch_id = $1 AND spoilage_date = $2::date
        AND LOWER(COALESCE(status, '')) NOT IN ('rejected', 'voided', 'cancelled')
      GROUP BY item_name`,
    [branchId, date]
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(normalizeName(r.item_name || ''), num(r.qty));
  return map;
}

/** POS sales for the day: active qty (quantity − voided) and revenue-weighted
 *  average selling price per item, keyed by outlet_item_id and by name. */
async function loadPosSales(branchId: number, date: string): Promise<{
  byOutletItemId: Map<string, number>;
  byName: Map<string, number>;
  priceByName: Map<string, number>;
  priceByOutletItemId: Map<string, number>;
}> {
  const { start, end } = dayBounds(date);
  const rows = await q(
    'controls_pos_sales',
    `SELECT itm->>'outlet_item_id' AS outlet_item_id,
            itm->>'name' AS name,
            COALESCE(SUM(GREATEST(COALESCE((itm->>'quantity')::numeric, 0)
                      - COALESCE((itm->>'voided_qty')::numeric, 0), 0)), 0) AS qty,
            MAX(COALESCE((itm->>'unit_price')::numeric, 0)) AS unit_price
       FROM pos_shift_orders o
      CROSS JOIN LATERAL jsonb_array_elements(o.items) itm
      WHERE o.branch_id = $1 AND o.created_at >= $2 AND o.created_at < $3
        AND (o.status IN ('paid','credit_bill') OR o.payment_status IN ('paid','credit_bill'))
      GROUP BY 1, 2`,
    [branchId, start, end]
  );

  const byOutletItemId = new Map<string, number>();
  const byName = new Map<string, number>();
  const priceByName = new Map<string, number>();
  const priceByOutletItemId = new Map<string, number>();
  for (const r of rows) {
    const qty = num(r.qty);
    const price = num(r.unit_price);
    if (r.outlet_item_id) {
      byOutletItemId.set(r.outlet_item_id, (byOutletItemId.get(r.outlet_item_id) || 0) + qty);
      if (price > 0) priceByOutletItemId.set(r.outlet_item_id, price);
    }
    const key = normalizeName(r.name || '');
    if (key) {
      byName.set(key, (byName.get(key) || 0) + qty);
      if (price > 0 && !priceByName.has(key)) priceByName.set(key, price);
    }
  }
  return { byOutletItemId, byName, priceByName, priceByOutletItemId };
}

async function loadYieldRules(branchId: number): Promise<Array<YieldRule & { raw_item_name: string }>> {
  const rows = await q(
    'controls_yield_rules',
    `SELECT raw_item_sku, raw_item_name, raw_quantity, produced_item_name,
            produced_item_sku, produced_quantity, pos_outlet_item_id
       FROM kitchen_production_recipes
      WHERE branch_id = $1 AND is_active = true`,
    [branchId]
  );
  return rows.map((r: any) => ({
    raw_item_sku: r.raw_item_sku,
    raw_item_name: r.raw_item_name,
    raw_quantity: num(r.raw_quantity),
    produced_item_name: r.produced_item_name,
    produced_quantity: num(r.produced_quantity),
    pos_outlet_item_id: r.pos_outlet_item_id,
  }));
}

/** RIGHT PANEL: yield-tracked raw commodities + directly-tracked finished items. */
async function buildControlsPanel(
  branchId: number,
  date: string
): Promise<{ rows: ControlsRow[]; warnings: string[] }> {
  const [stocktake, priorClosings, rejects, pos, yieldRules] = [
    await loadKitchenStocktakeDay(branchId, date),
    await loadPriorClosings(branchId, date),
    await loadRejects(branchId, date),
    await loadPosSales(branchId, date),
    await loadYieldRules(branchId),
  ];

  const warnings: string[] = [];
  const rows: ControlsRow[] = [];
  const consumedKeys = new Set<string>();

  // Raw commodities that have yield rules — physical row from the stocktake,
  // SYSTEM SALES converted from linked menu item sales.
  const rawSkus = new Map<string, string>(); // sku -> raw_item_name
  for (const rule of yieldRules) rawSkus.set(rule.raw_item_sku, rule.raw_item_name);

  for (const [sku, rawName] of rawSkus) {
    const key = normalizeName(rawName);
    const st = stocktake.get(key);
    if (!st) continue; // not physically tracked today
    consumedKeys.add(key);

    const systemSales = computeRawSystemSales(sku, yieldRules, pos.byOutletItemId, pos.byName);
    // s.p: the primary linked menu item's selling price (first rule with a
    // resolvable POS price).
    let sellingPrice = 0;
    for (const rule of yieldRules) {
      if (rule.raw_item_sku !== sku) continue;
      const byId = rule.pos_outlet_item_id
        ? pos.priceByOutletItemId.get(rule.pos_outlet_item_id)
        : undefined;
      const byName = pos.priceByName.get(normalizeName(rule.produced_item_name));
      if (byId || byName) {
        sellingPrice = byId || byName || 0;
        break;
      }
    }

    const row = computeControlsRow({
      item_name: st.item_name,
      item_sku: sku,
      kind: 'yield',
      opening: st.opening,
      added: st.added,
      closing: st.closing,
      rejects: rejects.get(key) || 0,
      system_sales: systemSales,
      selling_price: sellingPrice,
      prior_closing: priorClosings.get(key) ?? null,
    });
    if (row.rollover_warning) warnings.push(`Controls: ${row.rollover_warning}`);
    rows.push(row);
  }

  // Directly-tracked finished items: every remaining stocktake row —
  // SYSTEM SALES is simply the POS active qty for the same item name.
  for (const [key, st] of stocktake) {
    if (consumedKeys.has(key)) continue;
    const row = computeControlsRow({
      item_name: st.item_name,
      item_sku: null,
      kind: 'direct',
      opening: st.opening,
      added: st.added,
      closing: st.closing,
      rejects: rejects.get(key) || 0,
      system_sales: pos.byName.get(key) || 0,
      selling_price: pos.priceByName.get(key) || 0,
      prior_closing: priorClosings.get(key) ?? null,
    });
    if (row.rollover_warning) warnings.push(`Controls: ${row.rollover_warning}`);
    rows.push(row);
  }

  rows.sort((a, b) => a.shorts_value - b.shorts_value); // biggest losses first
  return { rows, warnings };
}

/** Persist the day's variance results into food_control_variance (the
 *  existing results table) so trends can be queried without recompute. */
async function persistVarianceResults(branchId: number, date: string, rows: ControlsRow[]): Promise<void> {
  try {
    await supabase
      .from('food_control_variance')
      .delete()
      .eq('branch_id', branchId)
      .eq('variance_date', date);
    const payload = rows
      .filter((r) => r.item_sku || r.item_name)
      .map((r) => ({
        branch_id: branchId,
        item_sku: r.item_sku || r.item_name,
        variance_date: date,
        theoretical_qty: r.system_sales,
        actual_qty: r.expected,
        variance_qty: r.variance,
        variance_pct: r.expected !== 0 ? round2((r.variance / r.expected) * 100) : null,
        variance_value: r.shorts_value,
        // Existing table constraint allows open|investigating|approved|rejected;
        // freshly computed rows start their lifecycle as 'open'.
        status: 'open',
      }));
    if (payload.length) {
      const { error } = await supabase.from('food_control_variance').insert(payload);
      if (error) throw error;
    }
  } catch (err) {
    logger.warn('food-control-report: variance persist failed (non-fatal)', {
      branchId,
      date,
      error: (err as Error).message,
    });
  }
}

// ── AI summary (optional, separate, degrades gracefully) ────────────────────

const AISummarySchema = z.object({
  summary: z.string().min(1),
  flags: z.array(z.string()).max(5),
});

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export async function generateReportSummary(
  report: DailyFoodControlReport,
  trailingDays: Array<{ variance_date: string; total_shorts_value: number }>,
  anomalies: Array<{
    item: string;
    anomaly_type: string;
    z_score: number | null;
    trend_days: number | null;
    confidence: string;
  }> = []
): Promise<ReportAISummary | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) return null;

  const worst = report.right_panel.slice(0, 6).map((r) => ({
    item: r.item_name,
    variance: r.variance,
    shorts_value: r.shorts_value,
    rejects: r.rejects,
  }));

  const prompt = [
    `Summarize one day's food-control report for a restaurant branch (${report.date}). All numbers are pre-computed; do not invent any.`,
    'Sign convention: negative VAR/Shorts.v = physical usage exceeded what sales justify (a loss); positive = sales imply more usage than recorded.',
    '',
    'Largest Shorts.v items today: ' + JSON.stringify(worst),
    'Total Shorts.v today: KES ' + report.totals.controls_shorts_value,
    'Trailing daily Shorts.v totals: ' + JSON.stringify(trailingDays),
    anomalies.length
      ? 'Statistical anomaly context (each item judged against its OWN history): ' +
        JSON.stringify(anomalies) +
        ' — sustained_trend on one item suggests a miscalibrated yield ratio rather than one-off loss; treat low confidence as insufficient history, not evidence.'
      : 'Statistical anomaly context: none flagged today.',
    '',
    'In 2-4 sentences: name the largest shortage-value items today; note any recurring negative pattern across the trailing days that suggests a yield-ratio recalibration rather than one-off loss. Separately, list flags (max 5, may be empty) ONLY for items with negative variance AND zero rejects — phrase these as "possible unlogged spoilage" hypotheses, never accusations or conclusions.',
    'Respond with ONLY valid JSON: {"summary": "<2-4 sentences>", "flags": ["<flag>", ...]}',
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
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
        max_tokens: 700,
        system: 'You summarize pre-computed food-control numbers. JSON only, concise, no accusations.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API ${response.status}`);
    const payload: any = await response.json();
    if (payload?.stop_reason === 'max_tokens') throw new Error('truncated');
    let text: string = payload?.content?.[0]?.text ?? '';
    text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    logger.info('food-control-report: AI summary complete', {
      branch_id: report.branch_id,
      input_tokens: payload?.usage?.input_tokens,
      output_tokens: payload?.usage?.output_tokens,
    });
    return AISummarySchema.parse(JSON.parse(text));
  } catch (err) {
    logger.warn('food-control-report: AI summary unavailable (report still served)', {
      branch_id: report.branch_id,
      error: (err as Error).message,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Main entry ───────────────────────────────────────────────────────────────

export async function generateDailyFoodControlReport(
  branchId: number,
  date: string,
  { withAiSummary = true }: { withAiSummary?: boolean } = {}
): Promise<DailyFoodControlReport> {
  // Sequential stages — pool-friendly on slow links.
  const left = await buildStocksheetPanel(branchId, date);
  const right = await buildControlsPanel(branchId, date);

  // Commercial-day status: previous closed days have a snapshot; the current
  // Nairobi day (or any day without a snapshot) is Live/Provisional.
  const nairobiToday = new Date(Date.now() + 3 * 3_600_000).toISOString().split('T')[0];
  let isProvisional = date >= nairobiToday;
  if (!isProvisional) {
    const snap = await q(
      'report_snapshot_check',
      `SELECT 1 FROM daily_control_snapshots WHERE branch_id = $1 AND shift_date = $2::date LIMIT 1`,
      [branchId, date]
    );
    if (!snap.length) isProvisional = true;
  }

  const report: DailyFoodControlReport = {
    branch_id: branchId,
    date,
    is_provisional: isProvisional,
    left_panel: left.rows,
    right_panel: right.rows,
    totals: {
      stocksheet_closing_value: round2(left.rows.reduce((s, r) => s + r.closing_value, 0)),
      controls_shorts_value: round2(right.rows.reduce((s, r) => s + r.shorts_value, 0)),
      controls_shortage_items: right.rows.filter((r) => r.variance < 0).length,
    },
    warnings: [...left.warnings, ...right.warnings],
    ai_summary: null,
    generated_at: new Date().toISOString(),
  };

  await persistVarianceResults(branchId, date, right.rows);

  if (withAiSummary) {
    const trailing = await q(
      'report_trailing_shorts',
      `SELECT variance_date::text, COALESCE(SUM(variance_value), 0) AS total_shorts_value
         FROM food_control_variance
        WHERE branch_id = $1 AND variance_date >= ($2::date - INTERVAL '7 days') AND variance_date < $2::date
        GROUP BY variance_date ORDER BY variance_date`,
      [branchId, date]
    ).catch(() => []);
    report.ai_summary = await generateReportSummary(
      report,
      trailing.map((t: any) => ({
        variance_date: t.variance_date,
        total_shorts_value: num(t.total_shorts_value),
      }))
    );
  }

  return report;
}
