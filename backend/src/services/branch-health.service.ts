import { z } from 'zod';
import db from '../db';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Branch Data-Health Checker.
 *
 * Detection is 100% deterministic SQL (runStructuralChecks). The AI (Claude)
 * is called exactly once per run and ONLY interprets/prioritizes the
 * pre-computed findings — it never detects issues or touches the database.
 * If the AI response fails schema validation the run falls back to a
 * deterministic issues list with is_ai_interpreted=false.
 */

// ── Types ───────────────────────────────────────────────────────────────────────

export interface OutletTypeItemStats {
  outlet_type: string;
  total_items: number;
  active_items: number;
  missing_source_link: number;
}

export interface StructuralFindings {
  outlet_items_by_type: OutletTypeItemStats[];
  bar_items_linked_to_restaurant_menu: number;
  bar_drinks_total: number;
  bar_drinks_missing_inventory_link: number;
  recipes_active_count: number;
  recipe_items_missing_inventory_link: number;
  kitchen_stocktake_items_missing_inventory_link_30d: number;
  bar_stock_zero_par_level: number;
  dispatch_out_without_receive: number;
  menu_items_active_total: number;
  menu_items_missing_cost_price: number;
}

export interface BranchContext {
  branch_id: number;
  branch_name: string;
  configured_outlet_types: string[];
  days_live: number | null; // null = no orders yet
  total_orders: number;
}

export interface HealthIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  plain_explanation: string;
  suggested_action: string;
  affected_area: 'Bar' | 'Kitchen' | 'Menu' | 'Store';
}

export interface HealthCheckResult {
  branch_id: number;
  health_score: number;
  issues: HealthIssue[];
  raw_findings: { findings: StructuralFindings; context: BranchContext };
  is_ai_interpreted: boolean;
  checked_at: string;
}

// ── Deterministic structural checks (SQL only, no AI) ───────────────────────────

/**
 * Runs the check queries in batches of 4 rather than all at once: the shared
 * pool caps at 10 connections and firing 12 concurrent queries can starve two
 * of them past db.query's 8s timeout when connections are cold.
 */
async function runQueriesBatched(
  queries: Array<{ sql: string; params: any[] }>
): Promise<any[]> {
  // Retry once on the pool's 8s timeout: the first attempt often pays for a
  // cold connection; the retry runs on the now-warm connection.
  const queryWithRetry = async (q: { sql: string; params: any[] }): Promise<any> => {
    try {
      return await db.query(q.sql, q.params);
    } catch (err) {
      if (!/timed out/i.test((err as Error).message)) throw err;
      return db.query(q.sql, q.params);
    }
  };

  const results: any[] = [];
  const BATCH_SIZE = 4;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(queryWithRetry));
    results.push(...batchResults);
  }
  return results;
}

export async function runStructuralChecks(branchId: number): Promise<{
  findings: StructuralFindings;
  context: BranchContext;
}> {
  const [
    branchRow,
    outletTypes,
    outletItems,
    wrongBarLinks,
    barDrinks,
    recipes,
    recipeItems,
    stocktakeItems,
    barStockPar,
    dispatches,
    menuCost,
    orders,
  ] = await runQueriesBatched([
    { sql: 'SELECT id, name FROM branches WHERE id = $1', params: [branchId] },
    {
      sql: `SELECT DISTINCT outlet_type FROM pos_outlets WHERE branch_id = $1 AND is_active = true`,
      params: [branchId],
    },
    {
      sql: `SELECT o.outlet_type,
              COUNT(i.id)::int AS total_items,
              COUNT(i.id) FILTER (WHERE i.is_active)::int AS active_items,
              COUNT(i.id) FILTER (WHERE i.is_active AND i.source_item_id IS NULL)::int AS missing_source_link
         FROM pos_outlets o
         LEFT JOIN pos_outlet_items i ON i.outlet_id = o.id
        WHERE o.branch_id = $1 AND o.is_active = true
        GROUP BY o.outlet_type
        ORDER BY o.outlet_type`,
      params: [branchId],
    },
    {
      sql: `SELECT COUNT(*)::int AS n
         FROM pos_outlet_items i
         JOIN pos_outlets o ON o.id = i.outlet_id
        WHERE o.branch_id = $1
          AND o.outlet_type = 'main_bar'
          AND i.is_active = true
          AND i.source_table = 'restaurant_menu_items'`,
      params: [branchId],
    },
    {
      sql: `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE inventory_item_id IS NULL)::int AS missing_link
         FROM bar_drinks
        WHERE branch_id = $1 AND is_active = true`,
      params: [branchId],
    },
    {
      sql: `SELECT COUNT(*)::int AS n FROM recipes WHERE branch_id = $1 AND is_active = true`,
      params: [branchId],
    },
    {
      sql: `SELECT COUNT(*)::int AS n
         FROM recipe_items ri
         JOIN recipes r ON r.id = ri.recipe_id
        WHERE r.branch_id = $1 AND r.is_active = true AND ri.inventory_item_id IS NULL`,
      params: [branchId],
    },
    {
      sql: `SELECT COUNT(*)::int AS n
         FROM kitchen_stocktake_items ki
         JOIN kitchen_stocktake_shifts ks ON ks.id = ki.shift_id
        WHERE ks.branch_id = $1
          AND ki.created_at >= NOW() - INTERVAL '30 days'
          AND ki.inventory_item_id IS NULL`,
      params: [branchId],
    },
    {
      sql: `SELECT COUNT(*)::int AS n
         FROM bar_stock
        WHERE branch_id = $1 AND (par_level IS NULL OR par_level = 0)`,
      params: [branchId],
    },
    {
      sql: `SELECT COUNT(DISTINCT o.reference_id)::int AS n
         FROM branch_stock_movements o
        WHERE o.branch_id = $1
          AND o.movement_type = 'DISPATCH_OUT'
          AND o.reference_id IS NOT NULL
          AND NOT EXISTS (
                SELECT 1 FROM branch_stock_movements r
                 WHERE r.movement_type = 'DISPATCH_RECEIVE'
                   AND r.reference_id = o.reference_id
              )`,
      params: [branchId],
    },
    {
      sql: `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE cost_price IS NULL OR cost_price = 0)::int AS missing_cost
         FROM restaurant_menu_items
        WHERE branch_id = $1 AND is_active = true`,
      params: [branchId],
    },
    {
      sql: `SELECT COUNT(*)::int AS total,
              MIN(created_at) AS first_order_at
         FROM pos_shift_orders
        WHERE branch_id = $1`,
      params: [branchId],
    },
  ]);

  if (branchRow.rows.length === 0) {
    throw new BranchNotFoundError(branchId);
  }

  const firstOrderAt = orders.rows[0].first_order_at as Date | null;
  const daysLive = firstOrderAt
    ? Math.floor((Date.now() - new Date(firstOrderAt).getTime()) / 86_400_000)
    : null;

  const findings: StructuralFindings = {
    outlet_items_by_type: outletItems.rows,
    bar_items_linked_to_restaurant_menu: wrongBarLinks.rows[0].n,
    bar_drinks_total: barDrinks.rows[0].total,
    bar_drinks_missing_inventory_link: barDrinks.rows[0].missing_link,
    recipes_active_count: recipes.rows[0].n,
    recipe_items_missing_inventory_link: recipeItems.rows[0].n,
    kitchen_stocktake_items_missing_inventory_link_30d: stocktakeItems.rows[0].n,
    bar_stock_zero_par_level: barStockPar.rows[0].n,
    dispatch_out_without_receive: dispatches.rows[0].n,
    menu_items_active_total: menuCost.rows[0].total,
    menu_items_missing_cost_price: menuCost.rows[0].missing_cost,
  };

  const context: BranchContext = {
    branch_id: branchId,
    branch_name: branchRow.rows[0].name,
    configured_outlet_types: outletTypes.rows.map((r: any) => r.outlet_type),
    days_live: daysLive,
    total_orders: orders.rows[0].total,
  };

  return { findings, context };
}

export class BranchNotFoundError extends Error {
  constructor(branchId: number) {
    super(`Branch ${branchId} not found`);
    this.name = 'BranchNotFoundError';
  }
}

// ── AI interpretation (Claude, one call per run) ────────────────────────────────

const AIIssueSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string().min(1),
  plain_explanation: z.string().min(1),
  suggested_action: z.string().min(1),
  affected_area: z.enum(['Bar', 'Kitchen', 'Menu', 'Store']),
});

const AIResponseSchema = z.object({
  health_score: z.number().int().min(0).max(100),
  issues: z.array(AIIssueSchema),
});

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_TIMEOUT_MS = 45_000;

function computeBaselineScore(issues: HealthIssue[]): number {
  const weight = { critical: 25, high: 10, medium: 5, low: 2 } as const;
  const penalty = issues.reduce((sum, i) => sum + weight[i.severity], 0);
  return Math.max(0, 100 - penalty);
}

function buildAIPrompt(findings: StructuralFindings, context: BranchContext): string {
  return [
    'You are interpreting pre-computed data-health findings for one branch of a multi-branch restaurant/hotel POS and food-control system. All detection has already been done with deterministic SQL — your job is ONLY to interpret, prioritize, and explain the findings below. Do not invent findings that are not in the data.',
    '',
    `BRANCH CONTEXT:`,
    `- Branch name: ${context.branch_name}`,
    `- Configured outlet types (the ONLY outlets this branch has): ${context.configured_outlet_types.join(', ') || '(none)'}`,
    `- Days since first sale ("days live"): ${context.days_live === null ? 'no sales recorded yet (pre-launch or just launched)' : context.days_live}`,
    `- Total orders recorded: ${context.total_orders}`,
    '',
    'RAW FINDINGS (deterministic SQL results):',
    JSON.stringify(findings, null, 2),
    '',
    'FINDING DEFINITIONS:',
    '- outlet_items_by_type: POS items seeded per outlet; missing_source_link = active POS items not linked to a source record (their sales cannot deduct stock or compute cost).',
    "- bar_items_linked_to_restaurant_menu: main_bar POS items wrongly linked to the restaurant menu instead of bar drinks (bar sales will deduct from the wrong place).",
    '- bar_drinks_missing_inventory_link: bar drinks with no inventory item link (sales cannot deduct stock).',
    '- recipes_active_count: active kitchen recipes (0 means food cost per dish cannot be computed).',
    '- recipe_items_missing_inventory_link: recipe ingredients not linked to inventory (recipe cost incomplete).',
    '- kitchen_stocktake_items_missing_inventory_link_30d: kitchen stocktake lines in the last 30 days not linked to inventory (variance cannot be valued).',
    '- bar_stock_zero_par_level: bar stock records with no par level (no low-stock alerts).',
    '- dispatch_out_without_receive: stock dispatched out of this branch never confirmed received anywhere (stock in limbo).',
    '- menu_items_missing_cost_price: active menu items with no/zero cost price (profit per item unknown).',
    '',
    'RULES:',
    '1. Do NOT flag gaps for outlet types this branch does not have. If the branch has no bar-type outlet (main_bar, sports_bar, executive_bar), bar findings with zero counts are non-issues — and even nonzero bar counts should be weighed against whether a bar outlet is configured.',
    '2. If the branch is newly launched (days live under ~30, or no sales yet), incomplete setup is expected — reduce severities accordingly and frame actions as setup steps, not failures.',
    '3. Rank issues by real financial/operational impact (untracked costs and wrong stock deductions matter most).',
    '4. Write for a non-technical branch manager: plain language, no SQL/table/column names, no jargon.',
    '5. Only report real issues supported by the findings. Zero/empty findings for configured features are healthy — do not pad the list.',
    '',
    'Respond with ONLY valid JSON (no markdown fences, no commentary) in exactly this shape:',
    '{',
    '  "health_score": <integer 0-100>,',
    '  "issues": [',
    '    {',
    '      "severity": "critical" | "high" | "medium" | "low",',
    '      "title": "<short staff-readable title>",',
    '      "plain_explanation": "<1-2 sentences, no jargon>",',
    '      "suggested_action": "<what to do>",',
    '      "affected_area": "Bar" | "Kitchen" | "Menu" | "Store"',
    '    }',
    '  ]',
    '}',
  ].join('\n');
}

export async function getAIHealthDiagnosis(
  findings: StructuralFindings,
  context: BranchContext
): Promise<{ health_score: number; issues: HealthIssue[]; is_ai_interpreted: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    logger.warn('branch-health: ANTHROPIC_API_KEY not configured — using deterministic fallback');
    return buildFallbackDiagnosis(findings, context);
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
        max_tokens: 2000,
        system:
          'You are a data-quality interpreter for a restaurant POS system. You only interpret pre-computed findings; you never detect issues yourself. You always respond with valid JSON only.',
        messages: [{ role: 'user', content: buildAIPrompt(findings, context) }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Anthropic API ${response.status}: ${errBody.slice(0, 300)}`);
    }

    const payload: any = await response.json();
    const latencyMs = Date.now() - startedAt;
    logger.info('branch-health: Claude call complete', {
      branch_id: context.branch_id,
      latency_ms: latencyMs,
      input_tokens: payload?.usage?.input_tokens,
      output_tokens: payload?.usage?.output_tokens,
    });

    let text: string = payload?.content?.[0]?.text ?? '';
    // Tolerate accidental markdown fences despite the instruction not to use them.
    text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    const parsed = AIResponseSchema.parse(JSON.parse(text));
    const issues = parsed.issues as HealthIssue[];

    const baseline = computeBaselineScore(issues);
    if (Math.abs(parsed.health_score - baseline) > 15) {
      logger.warn('branch-health: AI health_score deviates >15 from severity baseline', {
        branch_id: context.branch_id,
        ai_score: parsed.health_score,
        baseline_score: baseline,
      });
    }

    return { health_score: parsed.health_score, issues, is_ai_interpreted: true };
  } catch (err) {
    logger.warn('branch-health: AI interpretation failed — falling back to raw findings', {
      branch_id: context.branch_id,
      error: (err as Error).message,
    });
    return buildFallbackDiagnosis(findings, context);
  } finally {
    clearTimeout(timer);
  }
}

// ── Deterministic fallback (no AI text) ─────────────────────────────────────────

const BAR_OUTLET_TYPES = ['main_bar', 'sports_bar', 'executive_bar'];

export function buildFallbackDiagnosis(
  findings: StructuralFindings,
  context: BranchContext
): { health_score: number; issues: HealthIssue[]; is_ai_interpreted: false } {
  const issues: HealthIssue[] = [];
  const hasBar = context.configured_outlet_types.some((t) => BAR_OUTLET_TYPES.includes(t));
  const hasRestaurant = context.configured_outlet_types.includes('restaurant');
  // Under 30 days live (or no sales yet) = still being set up; soften severities.
  const isNew = context.days_live === null || context.days_live < 30;
  const soften = (s: HealthIssue['severity']): HealthIssue['severity'] => {
    if (!isNew) return s;
    if (s === 'critical') return 'high';
    if (s === 'high') return 'medium';
    return 'low';
  };

  if (hasBar && findings.bar_items_linked_to_restaurant_menu > 0) {
    issues.push({
      severity: soften('critical'),
      title: `${findings.bar_items_linked_to_restaurant_menu} bar item(s) linked to the food menu`,
      plain_explanation:
        'Some items sold at the bar are linked to the restaurant menu instead of the bar drinks list, so bar sales reduce the wrong stock.',
      suggested_action: 'Relink these bar POS items to the correct bar drink records.',
      affected_area: 'Bar',
    });
  }

  if (hasBar && findings.bar_drinks_missing_inventory_link > 0) {
    issues.push({
      severity: soften('high'),
      title: `${findings.bar_drinks_missing_inventory_link} bar drink(s) not linked to inventory`,
      plain_explanation:
        'These drinks can be sold but their stock is not deducted, so bar stock counts and costs will be wrong.',
      suggested_action: 'Link each bar drink to its inventory item in bar management.',
      affected_area: 'Bar',
    });
  }

  for (const ot of findings.outlet_items_by_type) {
    if (ot.missing_source_link > 0) {
      issues.push({
        severity: soften('high'),
        title: `${ot.missing_source_link} POS item(s) in ${ot.outlet_type.replace(/_/g, ' ')} missing a source link`,
        plain_explanation:
          'These POS items are not connected to a menu or drinks record, so their sales cannot be costed or tracked against stock.',
        suggested_action: 'Open POS item management for this outlet and link each item to its source record.',
        affected_area: BAR_OUTLET_TYPES.includes(ot.outlet_type) ? 'Bar' : 'Menu',
      });
    }
  }

  if (hasRestaurant && findings.recipes_active_count === 0) {
    issues.push({
      severity: soften('high'),
      title: 'No active recipes set up',
      plain_explanation:
        'Without recipes, the kitchen cannot calculate what each dish costs to make, so food profit cannot be tracked.',
      suggested_action: 'Create recipes for the menu items sold at this branch.',
      affected_area: 'Kitchen',
    });
  }

  if (findings.recipe_items_missing_inventory_link > 0) {
    issues.push({
      severity: soften('medium'),
      title: `${findings.recipe_items_missing_inventory_link} recipe ingredient(s) not linked to inventory`,
      plain_explanation:
        'Ingredients without an inventory link are left out of the dish cost, making food costs look lower than they are.',
      suggested_action: 'Edit these recipes and link each ingredient to its inventory item.',
      affected_area: 'Kitchen',
    });
  }

  if (findings.kitchen_stocktake_items_missing_inventory_link_30d > 0) {
    issues.push({
      severity: soften('medium'),
      title: `${findings.kitchen_stocktake_items_missing_inventory_link_30d} recent stocktake line(s) not linked to inventory`,
      plain_explanation:
        'Stocktake entries from the last 30 days are not linked to inventory items, so stock variances cannot be valued in money.',
      suggested_action: 'Match these stocktake items to inventory items in kitchen stocktake.',
      affected_area: 'Kitchen',
    });
  }

  if (hasRestaurant && findings.menu_items_missing_cost_price > 0) {
    issues.push({
      severity: soften('high'),
      title: `${findings.menu_items_missing_cost_price} menu item(s) missing a cost price`,
      plain_explanation:
        'Menu items without a cost price show zero cost, so profit reports for these items are overstated.',
      suggested_action: 'Set a cost price for each of these items in menu management.',
      affected_area: 'Menu',
    });
  }

  if (findings.dispatch_out_without_receive > 0) {
    issues.push({
      severity: soften('medium'),
      title: `${findings.dispatch_out_without_receive} dispatch(es) sent but never confirmed received`,
      plain_explanation:
        'Stock left this branch but no one confirmed receiving it, so that stock is unaccounted for.',
      suggested_action: 'Follow up on these dispatches and have the receiving side confirm them.',
      affected_area: 'Store',
    });
  }

  if (hasBar && findings.bar_stock_zero_par_level > 0) {
    issues.push({
      severity: 'low',
      title: `${findings.bar_stock_zero_par_level} bar stock item(s) without a reorder level`,
      plain_explanation:
        'Without a reorder (par) level, the system cannot warn when these drinks are running low.',
      suggested_action: 'Set a par level for each bar stock item.',
      affected_area: 'Bar',
    });
  }

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return { health_score: computeBaselineScore(issues), issues, is_ai_interpreted: false };
}

// ── Fleet-wide checks (all branches, one aggregate query per check) ─────────────

export interface FleetBranchHealth {
  branch_id: number;
  branch_name: string;
  configured_outlet_types: string[];
  days_live: number | null;
  total_orders: number;
  health_score: number; // deterministic severity-formula score (no AI)
  issue_counts: { critical: number; high: number; medium: number; low: number };
  top_issues: string[];
  findings: StructuralFindings;
  last_ai_check: {
    health_score: number;
    checked_at: string;
    is_ai_interpreted: boolean;
  } | null;
}

/**
 * Same deterministic checks as runStructuralChecks, but aggregated across all
 * active branches with GROUP BY branch_id — 12 queries total regardless of
 * branch count. Scores use the documented severity formula (no AI call), so
 * this is cheap enough for dashboards and for Lina chat evidence.
 */
export async function runFleetStructuralChecks(): Promise<{
  branches: FleetBranchHealth[];
  generated_at: string;
}> {
  const [
    branchRows,
    outletTypes,
    outletItems,
    wrongBarLinks,
    barDrinks,
    recipes,
    recipeItems,
    stocktakeItems,
    barStockPar,
    dispatches,
    menuCost,
    orders,
  ] = await runQueriesBatched([
    {
      sql: `SELECT id, name FROM branches WHERE COALESCE(is_active, true) = true ORDER BY id`,
      params: [],
    },
    {
      sql: `SELECT branch_id, ARRAY_AGG(DISTINCT outlet_type) AS types
              FROM pos_outlets WHERE is_active = true GROUP BY branch_id`,
      params: [],
    },
    {
      sql: `SELECT o.branch_id, o.outlet_type,
                   COUNT(i.id)::int AS total_items,
                   COUNT(i.id) FILTER (WHERE i.is_active)::int AS active_items,
                   COUNT(i.id) FILTER (WHERE i.is_active AND i.source_item_id IS NULL)::int AS missing_source_link
              FROM pos_outlets o
              LEFT JOIN pos_outlet_items i ON i.outlet_id = o.id
             WHERE o.is_active = true
             GROUP BY o.branch_id, o.outlet_type`,
      params: [],
    },
    {
      sql: `SELECT o.branch_id, COUNT(*)::int AS n
              FROM pos_outlet_items i
              JOIN pos_outlets o ON o.id = i.outlet_id
             WHERE o.outlet_type = 'main_bar'
               AND i.is_active = true
               AND i.source_table = 'restaurant_menu_items'
             GROUP BY o.branch_id`,
      params: [],
    },
    {
      sql: `SELECT branch_id, COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE inventory_item_id IS NULL)::int AS missing_link
              FROM bar_drinks WHERE is_active = true GROUP BY branch_id`,
      params: [],
    },
    {
      sql: `SELECT branch_id, COUNT(*)::int AS n
              FROM recipes WHERE is_active = true AND branch_id IS NOT NULL GROUP BY branch_id`,
      params: [],
    },
    {
      sql: `SELECT r.branch_id, COUNT(*)::int AS n
              FROM recipe_items ri
              JOIN recipes r ON r.id = ri.recipe_id
             WHERE r.is_active = true AND r.branch_id IS NOT NULL AND ri.inventory_item_id IS NULL
             GROUP BY r.branch_id`,
      params: [],
    },
    {
      sql: `SELECT ks.branch_id, COUNT(*)::int AS n
              FROM kitchen_stocktake_items ki
              JOIN kitchen_stocktake_shifts ks ON ks.id = ki.shift_id
             WHERE ki.created_at >= NOW() - INTERVAL '30 days'
               AND ki.inventory_item_id IS NULL
             GROUP BY ks.branch_id`,
      params: [],
    },
    {
      sql: `SELECT branch_id, COUNT(*)::int AS n
              FROM bar_stock WHERE par_level IS NULL OR par_level = 0 GROUP BY branch_id`,
      params: [],
    },
    {
      sql: `SELECT o.branch_id, COUNT(DISTINCT o.reference_id)::int AS n
              FROM branch_stock_movements o
             WHERE o.movement_type = 'DISPATCH_OUT'
               AND o.reference_id IS NOT NULL
               AND NOT EXISTS (
                     SELECT 1 FROM branch_stock_movements r
                      WHERE r.movement_type = 'DISPATCH_RECEIVE'
                        AND r.reference_id = o.reference_id
                   )
             GROUP BY o.branch_id`,
      params: [],
    },
    {
      sql: `SELECT branch_id, COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE cost_price IS NULL OR cost_price = 0)::int AS missing_cost
              FROM restaurant_menu_items WHERE is_active = true GROUP BY branch_id`,
      params: [],
    },
    {
      sql: `SELECT branch_id, COUNT(*)::int AS total, MIN(created_at) AS first_order_at
              FROM pos_shift_orders GROUP BY branch_id`,
      params: [],
    },
  ]);

  const byBranch = <T extends { branch_id: number }>(rows: T[]): Map<number, T[]> => {
    const map = new Map<number, T[]>();
    for (const row of rows) {
      const list = map.get(row.branch_id) || [];
      list.push(row);
      map.set(row.branch_id, list);
    }
    return map;
  };

  const outletTypesBy = byBranch<any>(outletTypes.rows);
  const outletItemsBy = byBranch<any>(outletItems.rows);
  const wrongLinksBy = byBranch<any>(wrongBarLinks.rows);
  const barDrinksBy = byBranch<any>(barDrinks.rows);
  const recipesBy = byBranch<any>(recipes.rows);
  const recipeItemsBy = byBranch<any>(recipeItems.rows);
  const stocktakeBy = byBranch<any>(stocktakeItems.rows);
  const barStockBy = byBranch<any>(barStockPar.rows);
  const dispatchesBy = byBranch<any>(dispatches.rows);
  const menuCostBy = byBranch<any>(menuCost.rows);
  const ordersBy = byBranch<any>(orders.rows);

  const lastAiByBranch = await getLatestHealthChecksForAllBranches();

  const branches: FleetBranchHealth[] = branchRows.rows.map((b: any) => {
    const one = <T>(map: Map<number, T[]>): T | undefined => map.get(b.id)?.[0];

    const barDrinkRow: any = one(barDrinksBy);
    const menuRow: any = one(menuCostBy);
    const orderRow: any = one(ordersBy);

    const findings: StructuralFindings = {
      outlet_items_by_type: (outletItemsBy.get(b.id) || []).map((r: any) => ({
        outlet_type: r.outlet_type,
        total_items: r.total_items,
        active_items: r.active_items,
        missing_source_link: r.missing_source_link,
      })),
      bar_items_linked_to_restaurant_menu: (one(wrongLinksBy) as any)?.n ?? 0,
      bar_drinks_total: barDrinkRow?.total ?? 0,
      bar_drinks_missing_inventory_link: barDrinkRow?.missing_link ?? 0,
      recipes_active_count: (one(recipesBy) as any)?.n ?? 0,
      recipe_items_missing_inventory_link: (one(recipeItemsBy) as any)?.n ?? 0,
      kitchen_stocktake_items_missing_inventory_link_30d: (one(stocktakeBy) as any)?.n ?? 0,
      bar_stock_zero_par_level: (one(barStockBy) as any)?.n ?? 0,
      dispatch_out_without_receive: (one(dispatchesBy) as any)?.n ?? 0,
      menu_items_active_total: menuRow?.total ?? 0,
      menu_items_missing_cost_price: menuRow?.missing_cost ?? 0,
    };

    const firstOrderAt = orderRow?.first_order_at ?? null;
    const context: BranchContext = {
      branch_id: b.id,
      branch_name: b.name,
      configured_outlet_types: (one(outletTypesBy) as any)?.types ?? [],
      days_live: firstOrderAt
        ? Math.floor((Date.now() - new Date(firstOrderAt).getTime()) / 86_400_000)
        : null,
      total_orders: orderRow?.total ?? 0,
    };

    const diagnosis = buildFallbackDiagnosis(findings, context);
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const issue of diagnosis.issues) counts[issue.severity] += 1;

    return {
      branch_id: b.id,
      branch_name: b.name,
      configured_outlet_types: context.configured_outlet_types,
      days_live: context.days_live,
      total_orders: context.total_orders,
      health_score: diagnosis.health_score,
      issue_counts: counts,
      top_issues: diagnosis.issues.slice(0, 3).map((i) => i.title),
      findings,
      last_ai_check: lastAiByBranch.get(b.id) || null,
    };
  });

  return { branches, generated_at: new Date().toISOString() };
}

async function getLatestHealthChecksForAllBranches(): Promise<
  Map<number, { health_score: number; checked_at: string; is_ai_interpreted: boolean }>
> {
  const map = new Map<number, { health_score: number; checked_at: string; is_ai_interpreted: boolean }>();
  const { data, error } = await supabase
    .from('branch_health_checks')
    .select('branch_id, health_score, checked_at, is_ai_interpreted')
    .order('checked_at', { ascending: false })
    .limit(100);
  if (error) {
    logger.warn('branch-health: failed to read cached fleet results', { error: error.message });
    return map;
  }
  for (const row of data || []) {
    if (!map.has(row.branch_id)) {
      map.set(row.branch_id, {
        health_score: row.health_score,
        checked_at: row.checked_at,
        is_ai_interpreted: row.is_ai_interpreted,
      });
    }
  }
  return map;
}

/**
 * Curated, verified description of the three-tier food-control system.
 * Given to Lina as grounding whenever a food-control question is asked, so
 * answers reflect how the system actually works instead of guesses.
 */
export const FOOD_CONTROL_SYSTEM_MODEL = {
  tier_1_bar: 'Bar: POS sale → pos_outlet_items.source_item_id → bar_drinks.id → bar_stock_ledger (transaction_type=sale) → bar_stock.current_stock decremented. End of day the bartender physically counts into bar_stocktake_records (system_qty = opening + additions − sales; variance = physical − system; nonzero variance requires reason_for_variance). Accountant reviews: pending → reviewed → approved/rejected.',
  tier_2_kitchen: 'Kitchen: sales live ONLY in pos_shift_orders.items[] (JSONB; use active_qty = quantity − voided_qty). Storekeeper records opening_qty/added_qty/closing_qty per shift into kitchen_stocktake_items (variance = closing − opening − added; negative = consumption). kitchen_stocktake_shifts status: draft → submitted → approved/rejected. Expected cost only where recipes exist: recipe output_quantity portions, recipe_items quantity_required per ingredient.',
  tier_3_store: 'Store: stock_requests → branch accountant approval (workflow_status=branch_accountant_approved) → dispatch_notes → DISPATCHED (in transit) → DELIVERED → branch_stock updated via DISPATCH_RECEIVE movement, trail in branch_stock_movements (match DISPATCH_OUT to DISPATCH_RECEIVE by reference_id).',
  table_truths: [
    'pos_shift_orders (4k+ rows, JSONB items[]) is the ONLY live sales table; restaurant_orders and restaurant_order_items have zero rows and are dead — never use them for sales analysis.',
    'pos_outlet_items.source_table must be bar_drinks for bar outlets and restaurant_menu_items for restaurant outlets; source_item_id is the stock item UUID.',
    'recipe_items links ingredients by item_sku (inventory_item_id is currently NULL on all rows — cost joins must go through item_sku).',
    'Bar cost % = Σ(approved bar_stocktake_records.physical_quantity × bar_drinks.cost_price) ÷ Σ(bar_stock_ledger sale quantity × selling_price). Kitchen cost % = Σ((opening+added−closing) × inventory_items.default_unit_cost) ÷ restaurant POS revenue.',
  ],
};

// ── Orchestration + cache ───────────────────────────────────────────────────────

const CACHE_TTL_HOURS = 24;

export async function getLatestHealthCheck(branchId: number): Promise<HealthCheckResult | null> {
  const { data, error } = await supabase
    .from('branch_health_checks')
    .select('branch_id, health_score, issues, raw_findings, is_ai_interpreted, checked_at')
    .eq('branch_id', branchId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('branch-health: failed to read cached result', { branchId, error: error.message });
    return null;
  }
  return (data as HealthCheckResult) || null;
}

export function isCacheFresh(result: HealthCheckResult | null): result is HealthCheckResult {
  if (!result) return false;
  return Date.now() - new Date(result.checked_at).getTime() < CACHE_TTL_HOURS * 3_600_000;
}

export async function runHealthCheck(branchId: number): Promise<HealthCheckResult> {
  const { findings, context } = await runStructuralChecks(branchId);
  const diagnosis = await getAIHealthDiagnosis(findings, context);

  const result: HealthCheckResult = {
    branch_id: branchId,
    health_score: diagnosis.health_score,
    issues: diagnosis.issues,
    raw_findings: { findings, context },
    is_ai_interpreted: diagnosis.is_ai_interpreted,
    checked_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('branch_health_checks').insert({
    branch_id: result.branch_id,
    health_score: result.health_score,
    issues: result.issues,
    raw_findings: result.raw_findings,
    is_ai_interpreted: result.is_ai_interpreted,
    checked_at: result.checked_at,
  });

  if (error) {
    // Persisting is best-effort; still return the computed result.
    logger.error('branch-health: failed to save health check result', {
      branchId,
      error: error.message,
    });
  }

  return result;
}
