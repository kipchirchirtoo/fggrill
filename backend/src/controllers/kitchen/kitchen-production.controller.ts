import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import db from '../../db';

const VARIANCE_REASON_CONSTANT =
  'Kitchen Production Variance — Cook issued stock but actual output was less than standard yield. Penalty = |Variance| × Menu Selling Price.';

// ── Helpers ────────────────────────────────────────────────────────────────

async function generateSessionNumber(branchId: number): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM public.kitchen_production_sessions
     WHERE branch_id=$1 AND session_date=CURRENT_DATE`,
    [branchId]
  );
  const seq = String(Number(rows[0].cnt) + 1).padStart(3, '0');
  return `KPS-${branchId}-${today}-${seq}`;
}

async function generateCreditBillNumber(branchId: number): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const { rows } = await db.query(
    `SELECT COUNT(*) AS cnt FROM public.staff_credit_bills
     WHERE branch_id=$1 AND created_at::date=CURRENT_DATE`,
    [branchId]
  );
  const seq = String(Number(rows[0].cnt) + 1).padStart(3, '0');
  return `KV-${branchId}-${today}-${seq}`;
}

// Resolve staff_profiles.id from users.id (sessions store users.id, credit bills need staff_profiles.id)
async function resolveStaffProfileId(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase.from('staff_profiles').select('id').eq('user_id', userId).maybeSingle();
  return data?.id ?? null;
}

// Expected yield from issued ingredients using recipe ratios
async function calcExpectedYield(
  branchId: number,
  menuItemId: string,
  issues: Array<{ item_sku: string; quantity_issued: number }>
): Promise<number> {
  const { rows: recipeRows } = await db.query(
    `SELECT ri.item_sku, ri.quantity_required, r.output_quantity
     FROM public.recipes r
     JOIN public.recipe_items ri ON ri.recipe_id = r.id
     WHERE r.menu_item_id = $1::uuid
       AND COALESCE(r.status,'active') = 'active'
       AND r.branch_id = $2
     ORDER BY r.created_at DESC`,
    [menuItemId, branchId]
  );
  if (!recipeRows.length) return 0;

  // For each ingredient in the recipe, find how many output portions the issued qty yields
  // possible = issued_qty / qty_required_per_portion
  // Take minimum across all ingredients (limiting factor)
  let minPossible: number | null = null;
  for (const row of recipeRows) {
    const issued = issues.find((i) => i.item_sku === row.item_sku);
    if (!issued || Number(row.quantity_required) <= 0) continue;
    const possible = issued.quantity_issued / Number(row.quantity_required);
    if (minPossible === null || possible < minPossible) minPossible = possible;
  }
  return minPossible ?? 0;
}

// ── GET /api/kitchen/production-sessions ───────────────────────────────────

export const listProductionSessions = async (req: Request, res: Response) => {
  try {
    const { branch_id, status, date_from, date_to, limit = '50' } = req.query;
    if (!branch_id) return res.status(400).json({ success: false, message: 'branch_id required' });

    let q = supabase
      .from('kitchen_production_sessions')
      .select(`*, entries:kitchen_production_entries(*), issues:kitchen_session_issues(*)`)
      .eq('branch_id', Number(branch_id))
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (status) q = q.eq('status', status);
    if (date_from) q = q.gte('session_date', date_from as string);
    if (date_to) q = q.lte('session_date', date_to as string);

    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/kitchen/production-sessions ──────────────────────────────────
// Storekeeper creates session + issues stock to cook

export const createProductionSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { branch_id, staff_id, staff_name, notes, issues, planned_items } = req.body;
    // issues: [{ item_sku, item_name, quantity_issued, unit, unit_cost }]
    // planned_items: [{ menu_item_id, menu_item_name }]

    if (!branch_id || !staff_name) {
      return res.status(400).json({ success: false, message: 'branch_id and staff_name required' });
    }
    if (!issues?.length) {
      return res.status(400).json({ success: false, message: 'At least one stock issue required' });
    }

    const sessionNumber = await generateSessionNumber(Number(branch_id));

    // Create session
    const { data: session, error: sErr } = await supabase
      .from('kitchen_production_sessions')
      .insert({
        branch_id: Number(branch_id),
        session_number: sessionNumber,
        staff_id: staff_id || null,
        staff_name,
        notes,
        status: 'in_production',
        created_by: userId,
      })
      .select()
      .single();
    if (sErr) throw sErr;

    // Insert issued items
    const issueRows = (issues as any[]).map((i) => ({
      session_id: session.id,
      item_sku: i.item_sku,
      item_name: i.item_name,
      quantity_issued: Number(i.quantity_issued),
      unit: i.unit || 'kg',
      unit_cost: Number(i.unit_cost || 0),
    }));
    const { error: iErr } = await supabase.from('kitchen_session_issues').insert(issueRows);
    if (iErr) throw iErr;

    // Deduct stock from branch_stock
    for (const issue of issueRows) {
      await db.query(
        `UPDATE public.branch_stock
         SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
         WHERE branch_id = $2 AND item_sku = $3`,
        [issue.quantity_issued, branch_id, issue.item_sku]
      );
    }

    // Create planned production entries with expected yield (calculated from recipe)
    if (planned_items?.length) {
      const entryRows: any[] = [];
      for (const pi of planned_items as any[]) {
        const expected = await calcExpectedYield(
          Number(branch_id),
          pi.menu_item_id,
          issueRows
        );
        const { rows: priceRows } = await db.query(
          `SELECT selling_price FROM public.restaurant_menu_items WHERE id=$1::uuid LIMIT 1`,
          [pi.menu_item_id]
        );
        entryRows.push({
          session_id: session.id,
          menu_item_id: pi.menu_item_id,
          menu_item_name: pi.menu_item_name,
          expected_quantity: Math.round(expected),
          actual_quantity: 0,
          variance: 0,
          menu_selling_price: Number(priceRows[0]?.selling_price || 0),
        });
      }
      if (entryRows.length) {
        const { error: eErr } = await supabase
          .from('kitchen_production_entries')
          .insert(entryRows);
        if (eErr) throw eErr;
      }
    }

    res.json({ success: true, data: session });
  } catch (err: any) {
    console.error('createProductionSession error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/kitchen/production-sessions/:id ──────────────────────────────

export const getProductionSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('kitchen_production_sessions')
      .select(`*, entries:kitchen_production_entries(*), issues:kitchen_session_issues(*)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/kitchen/production-sessions/:id/complete ─────────────────────
// Kitchen logs actual production → system calculates variance → credit bills

export const completeProductionSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { entries } = req.body;
    // entries: [{ entry_id, actual_quantity }]

    if (!entries?.length) {
      return res.status(400).json({ success: false, message: 'entries required' });
    }

    // Fetch session
    const { data: session, error: sErr } = await supabase
      .from('kitchen_production_sessions')
      .select('*, entries:kitchen_production_entries(*)')
      .eq('id', id)
      .single();
    if (sErr || !session) throw sErr ?? new Error('Session not found');
    if (session.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Session already closed' });
    }

    let totalExpected = 0;
    let totalActual = 0;
    let totalVariance = 0;
    let totalPenalty = 0;

    for (const entry of entries as any[]) {
      const existing = (session.entries as any[]).find((e: any) => e.id === entry.entry_id);
      if (!existing) continue;

      const actual = Number(entry.actual_quantity);
      const expected = Number(existing.expected_quantity);
      const variance = actual - expected;
      const price = Number(existing.menu_selling_price || 0);
      const penalty = variance < 0 ? Math.abs(variance) * price : 0;

      // Update entry
      await supabase
        .from('kitchen_production_entries')
        .update({ actual_quantity: actual, variance, variance_penalty: penalty })
        .eq('id', entry.entry_id);

      // Create credit bill for negative variance → staff_credit_bills (visible to branch accountant)
      let creditBillId: string | null = null;
      if (penalty > 0) {
        // session.staff_id is users.id; staff_credit_bills needs staff_profiles.id
        const staffProfileId = await resolveStaffProfileId(session.staff_id);
        if (!staffProfileId) {
          // Cook has no staff_profiles record — skip credit bill, log warning
          console.warn(`[KitchenVariance] No staff_profiles found for user ${session.staff_id} (${session.staff_name}). Credit bill not created.`);
        } else {
          const billNumber = await generateCreditBillNumber(session.branch_id);
          const { data: bill, error: bErr } = await supabase
            .from('staff_credit_bills')
            .insert({
              staff_id: staffProfileId,
              branch_id: session.branch_id,
              bill_number: billNumber,
              description: `Kitchen Variance Penalty | Session: ${session.session_number} | Item: ${existing.menu_item_name} | Expected: ${expected}, Actual: ${actual}, Variance: ${variance} | ${VARIANCE_REASON_CONSTANT}`,
              amount: penalty,
              balance: penalty,
              paid_amount: 0,
              status: 'pending',
              bill_date: new Date().toISOString().split('T')[0],
            })
            .select()
            .single();
          if (bErr) throw bErr;
          creditBillId = bill.id;
        }

        await supabase
          .from('kitchen_production_entries')
          .update({ penalty_credit_bill_id: creditBillId })
          .eq('id', entry.entry_id);
      }

      totalExpected += expected;
      totalActual += actual;
      totalVariance += variance;
      totalPenalty += penalty;
    }

    // Update session totals + mark completed
    await supabase
      .from('kitchen_production_sessions')
      .update({
        status: 'completed',
        total_expected: totalExpected,
        total_actual: totalActual,
        total_variance: totalVariance,
        total_penalty: totalPenalty,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    const { data: updated } = await supabase
      .from('kitchen_production_sessions')
      .select('*, entries:kitchen_production_entries(*), issues:kitchen_session_issues(*)')
      .eq('id', id)
      .single();

    res.json({ success: true, data: updated, total_penalty: totalPenalty, credit_bill_raised: totalPenalty > 0 });
  } catch (err: any) {
    console.error('completeProductionSession error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/kitchen/production-sessions/recipes ──────────────────────────
// Returns active recipes with ingredients — used by Flutter to build session form

export const getRecipesWithIngredients = async (req: Request, res: Response) => {
  try {
    const { branch_id } = req.query;
    if (!branch_id) return res.status(400).json({ success: false, message: 'branch_id required' });

    const { rows } = await db.query(
      `SELECT
         r.id, r.name AS recipe_name, r.output_quantity, r.output_unit,
         rmi.id AS menu_item_id, rmi.name AS menu_item_name, rmi.selling_price,
         COALESCE(json_agg(
           jsonb_build_object(
             'item_sku', ri.item_sku,
             'item_name', ri.item_name,
             'quantity_required', ri.quantity_required,
             'unit', ri.unit
           ) ORDER BY ri.item_name
         ) FILTER (WHERE ri.id IS NOT NULL), '[]') AS ingredients
       FROM public.recipes r
       JOIN public.restaurant_menu_items rmi ON rmi.id = r.menu_item_id
       LEFT JOIN public.recipe_items ri ON ri.recipe_id = r.id
       WHERE r.branch_id = $1 AND COALESCE(r.status,'active') = 'active'
       GROUP BY r.id, rmi.id
       ORDER BY rmi.name`,
      [Number(branch_id)]
    );

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
