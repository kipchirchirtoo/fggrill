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

// Resolve staff_profiles.id from users.id
async function resolveStaffProfileId(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

// Resolve staff_profiles.id from staff_profiles.id directly (already the right ID)
async function resolveStaffProfileIdDirect(profileId: string | null): Promise<string | null> {
  if (!profileId) return null;
  const { data } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle();
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

  let minPossible: number | null = null;
  for (const row of recipeRows) {
    const issued = issues.find((i) => i.item_sku === row.item_sku);
    if (!issued || Number(row.quantity_required) <= 0) continue;
    const possible = (issued.quantity_issued / Number(row.quantity_required)) * Number(row.output_quantity);
    if (minPossible === null || possible < minPossible) minPossible = possible;
  }
  return minPossible ?? 0;
}

// Select strings — FULL includes tables added by migration 91; BASE works
// even before the migration has been applied.
const SESSION_SELECT_FULL = `
  *,
  entries:kitchen_production_entries(*),
  issues:kitchen_session_issues(*),
  session_staff:kitchen_session_staff(*),
  closing_stock:kitchen_session_closing_stock(*)
`;
const SESSION_SELECT_BASE = `
  *,
  entries:kitchen_production_entries(*),
  issues:kitchen_session_issues(*)
`;

function isSchemaError(err: any): boolean {
  const msg: string = err?.message ?? '';
  return msg.includes('relationship') || msg.includes('schema cache');
}

// ── GET /api/kitchen/production-sessions ───────────────────────────────────

export const listProductionSessions = async (req: Request, res: Response) => {
  try {
    const { branch_id, status, shift_type, date_from, date_to, limit = '50' } = req.query;
    if (!branch_id) return res.status(400).json({ success: false, message: 'branch_id required' });

    // Try full select with new relation tables; fall back to base select if
    // migration 91 hasn't run yet (tables won't exist → PostgREST 500).
    const applyFilters = (q: any) => {
      if (status) q = q.eq('status', status as string);
      if (shift_type) q = q.eq('shift_type', shift_type as string);
      if (date_from) q = q.gte('session_date', date_from as string);
      if (date_to) q = q.lte('session_date', date_to as string);
      return q;
    };

    const base = supabase
      .from('kitchen_production_sessions')
      .eq('branch_id', Number(branch_id))
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    let { data, error } = await applyFilters(base.select(SESSION_SELECT_FULL));
    if (isSchemaError(error)) {
      ({ data, error } = await applyFilters(base.select(SESSION_SELECT_BASE)));
    }

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/kitchen/production-sessions/handover ────────────────────────
// Returns the last completed session for the opposite shift (for handover display)

export const getShiftHandover = async (req: Request, res: Response) => {
  try {
    const { branch_id, shift_type } = req.query;
    if (!branch_id || !shift_type) {
      return res.status(400).json({ success: false, message: 'branch_id and shift_type required' });
    }

    // Opposite shift
    const oppositeShift = shift_type === 'shift_a' ? 'shift_b' : 'shift_a';

    let { data, error } = await supabase
      .from('kitchen_production_sessions')
      .select(`
        id, session_number, shift_type, session_date, status, completed_at,
        staff_name, total_penalty,
        closing_stock:kitchen_session_closing_stock(*),
        session_staff:kitchen_session_staff(*)
      `)
      .eq('branch_id', Number(branch_id))
      .eq('shift_type', oppositeShift)
      .in('status', ['completed', 'closed'])
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error?.message?.includes('relationship') || error?.message?.includes('schema cache')) {
      const fallback = await supabase
        .from('kitchen_production_sessions')
        .select('id, session_number, shift_type, session_date, status, completed_at, staff_name, total_penalty')
        .eq('branch_id', Number(branch_id))
        .eq('shift_type', oppositeShift)
        .in('status', ['completed', 'closed'])
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/kitchen/production-sessions ──────────────────────────────────
// Storekeeper creates session + issues stock to kitchen shift

export const createProductionSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const {
      branch_id,
      shift_type = 'shift_a',
      staff_id,
      staff_name,
      session_staff,   // [{ staff_profile_id, staff_name, role, is_accountable }]
      notes,
      issues,          // [{ item_sku, item_name, quantity_issued, unit, unit_cost }]
      planned_items,   // [{ menu_item_id, menu_item_name, expected_quantity }]
    } = req.body;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: 'branch_id required' });
    }
    if (!issues?.length) {
      return res.status(400).json({ success: false, message: 'At least one stock issue required' });
    }

    // Derive primary staff name from session_staff list if not explicitly provided
    const primaryStaff = (session_staff as any[])?.[0];
    const resolvedStaffName = staff_name || primaryStaff?.staff_name || 'Kitchen Staff';
    const resolvedStaffId = staff_id || primaryStaff?.staff_profile_id || null;

    const sessionNumber = await generateSessionNumber(Number(branch_id));

    // Create session
    const { data: session, error: sErr } = await supabase
      .from('kitchen_production_sessions')
      .insert({
        branch_id: Number(branch_id),
        session_number: sessionNumber,
        shift_type,
        staff_id: resolvedStaffId,
        staff_name: resolvedStaffName,
        notes,
        status: 'in_production',
        created_by: userId,
      })
      .select()
      .single();
    if (sErr) throw sErr;

    // Insert all session staff members
    if (session_staff?.length) {
      const staffRows = (session_staff as any[]).map((s) => ({
        session_id: session.id,
        staff_profile_id: s.staff_profile_id || null,
        staff_name: s.staff_name,
        role: s.role || 'cook',
        is_accountable: s.is_accountable !== false,
      }));
      const { error: ssErr } = await supabase
        .from('kitchen_session_staff')
        .insert(staffRows);
      if (ssErr) console.warn('[KitchenSession] session_staff insert warning:', ssErr.message);
    }

    // Insert issued items
    const issueRows = (issues as any[]).map((i) => ({
      session_id: session.id,
      item_sku: i.item_sku,
      item_name: i.item_name,
      quantity_issued: Number(i.quantity_issued),
      unit: i.unit || 'kg',
      unit_cost: Number(i.unit_cost || 0),
    }));
    const { error: iErr } = await supabase
      .from('kitchen_session_issues')
      .insert(issueRows);
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

    // Create planned production entries
    if (planned_items?.length) {
      const entryRows: any[] = [];
      for (const pi of planned_items as any[]) {
        // Use pre-calculated expected_quantity from client (yield preview) if provided,
        // otherwise recalculate from recipe on server
        let expectedQty = Number(pi.expected_quantity || 0);
        if (!expectedQty && pi.menu_item_id) {
          expectedQty = Math.round(
            await calcExpectedYield(Number(branch_id), pi.menu_item_id, issueRows)
          );
        }
        const { rows: priceRows } = await db.query(
          `SELECT selling_price FROM public.restaurant_menu_items WHERE id=$1::uuid LIMIT 1`,
          [pi.menu_item_id]
        );
        entryRows.push({
          session_id: session.id,
          menu_item_id: pi.menu_item_id,
          menu_item_name: pi.menu_item_name,
          expected_quantity: expectedQty,
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

    // Return full session with related data
    let { data: full } = await supabase
      .from('kitchen_production_sessions')
      .select(SESSION_SELECT_FULL)
      .eq('id', session.id)
      .single();
    if (!full) {
      ({ data: full } = await supabase
        .from('kitchen_production_sessions')
        .select(SESSION_SELECT_BASE)
        .eq('id', session.id)
        .single());
    }

    res.json({ success: true, data: full });
  } catch (err: any) {
    console.error('createProductionSession error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/kitchen/production-sessions/:id ──────────────────────────────

export const getProductionSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let { data, error } = await supabase
      .from('kitchen_production_sessions')
      .select(SESSION_SELECT_FULL)
      .eq('id', id)
      .single();
    if (isSchemaError(error)) {
      ({ data, error } = await supabase
        .from('kitchen_production_sessions')
        .select(SESSION_SELECT_BASE)
        .eq('id', id)
        .single());
    }
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/kitchen/production-sessions/:id/complete ─────────────────────
// Records actual production + closing stock → calculates variance → credit bills
// for ALL accountable staff on the shift

export const completeProductionSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { entries, closing_stock } = req.body;
    // entries:       [{ entry_id, actual_quantity }]
    // closing_stock: [{ item_sku, item_name, issued_quantity, closing_quantity, unit }]

    if (!entries?.length) {
      return res.status(400).json({ success: false, message: 'entries required' });
    }

    // Fetch session + all related data
    let { data: session, error: sErr } = await supabase
      .from('kitchen_production_sessions')
      .select(`*, entries:kitchen_production_entries(*), session_staff:kitchen_session_staff(*)`)
      .eq('id', id)
      .single();
    if (isSchemaError(sErr)) {
      ({ data: session, error: sErr } = await supabase
        .from('kitchen_production_sessions')
        .select(`*, entries:kitchen_production_entries(*)`)
        .eq('id', id)
        .single());
    }
    if (sErr || !session) throw sErr ?? new Error('Session not found');
    if (session.status === 'completed' || session.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Session already completed' });
    }

    // Save closing stock ledger
    if (closing_stock?.length) {
      const stockRows = (closing_stock as any[]).map((cs) => ({
        session_id: id,
        item_sku: cs.item_sku,
        item_name: cs.item_name || null,
        issued_quantity: Number(cs.issued_quantity || 0),
        closing_quantity: Number(cs.closing_quantity || 0),
        unit: cs.unit || 'kg',
        recorded_by: userId,
      }));
      // Delete any previous closing stock records then re-insert
      await supabase.from('kitchen_session_closing_stock').delete().eq('session_id', id);
      const { error: csErr } = await supabase
        .from('kitchen_session_closing_stock')
        .insert(stockRows);
      if (csErr) console.warn('[KitchenSession] closing_stock insert warning:', csErr.message);
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

      // Create credit bills for EACH accountable staff member
      if (penalty > 0) {
        const accountableStaff = (session.session_staff as any[]).filter(
          (s: any) => s.is_accountable
        );

        // If no session_staff records, fall back to session.staff_id
        if (!accountableStaff.length) {
          const staffProfileId = await resolveStaffProfileId(session.staff_id);
          if (staffProfileId) {
            accountableStaff.push({
              staff_profile_id: staffProfileId,
              staff_name: session.staff_name,
            });
          }
        }

        const perStaffPenalty =
          accountableStaff.length > 0
            ? Math.round((penalty / accountableStaff.length) * 100) / 100
            : penalty;

        let firstBillId: string | null = null;
        for (const staffMember of accountableStaff) {
          // session_staff.staff_profile_id is already staff_profiles.id
          const profileId =
            (await resolveStaffProfileIdDirect(staffMember.staff_profile_id)) ??
            (await resolveStaffProfileId(staffMember.staff_profile_id));

          if (!profileId) {
            console.warn(
              `[KitchenVariance] No staff_profiles found for ${staffMember.staff_name}. Skipping.`
            );
            continue;
          }

          const billNumber = await generateCreditBillNumber(session.branch_id);
          const { data: bill, error: bErr } = await supabase
            .from('staff_credit_bills')
            .insert({
              staff_id: profileId,
              branch_id: session.branch_id,
              bill_number: billNumber,
              description:
                `Kitchen Variance Penalty | Session: ${session.session_number} | ` +
                `Shift: ${session.shift_type === 'shift_a' ? 'Shift A' : 'Shift B'} | ` +
                `Item: ${existing.menu_item_name} | ` +
                `Expected: ${expected}, Actual: ${actual}, Variance: ${variance} | ` +
                `Staff share: ${accountableStaff.length > 1 ? `1/${accountableStaff.length}` : 'full'} | ` +
                VARIANCE_REASON_CONSTANT,
              amount: perStaffPenalty,
              balance: perStaffPenalty,
              paid_amount: 0,
              status: 'pending',
              bill_date: new Date().toISOString().split('T')[0],
            })
            .select()
            .single();
          if (bErr) {
            console.error('[KitchenVariance] Credit bill error:', bErr.message);
          } else {
            if (!firstBillId) firstBillId = bill.id;
          }
        }

        await supabase
          .from('kitchen_production_entries')
          .update({ penalty_credit_bill_id: firstBillId })
          .eq('id', entry.entry_id);
      }

      totalExpected += expected;
      totalActual += actual;
      totalVariance += variance;
      totalPenalty += penalty;
    }

    // Mark session completed
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

    let { data: updated } = await supabase
      .from('kitchen_production_sessions')
      .select(SESSION_SELECT_FULL)
      .eq('id', id)
      .single();
    if (!updated) {
      ({ data: updated } = await supabase
        .from('kitchen_production_sessions')
        .select(SESSION_SELECT_BASE)
        .eq('id', id)
        .single());
    }

    res.json({
      success: true,
      data: updated,
      total_penalty: totalPenalty,
      credit_bill_raised: totalPenalty > 0,
    });
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
