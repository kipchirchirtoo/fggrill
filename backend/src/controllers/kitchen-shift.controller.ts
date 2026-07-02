import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { creditOutletItemStock, updateBranchStock } from '../services/branch-inventory.service';

const asyncWrap = (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const n = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;
const absMoney = (v: any) => Math.abs(n(v));

export async function resolveStaffProfileId(value: any): Promise<string | null> {
    if (!value) return null;
    const id = String(value);
    const { data: direct } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('id', id)
        .maybeSingle();
    if (direct?.id) return direct.id;

    const { data: byUser } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('user_id', id)
        .maybeSingle();
    return byUser?.id || null;
}

// ── WASTAGE THRESHOLDS / ALERTS ──────────────────────────────
// Branch-level defaults (kitchen_wastage_thresholds, migration
// 20260622_kitchen_storekeeper_integration.sql). A recipe's own
// allowed_variance_percent, where set, overrides the branch-level
// recipe_variance_critical_pct for that recipe specifically.
const DEFAULT_WASTAGE_THRESHOLDS = {
    recipe_variance_warning_pct: 5,
    recipe_variance_critical_pct: 15,
    spoilage_warning_pct: 5,
    spoilage_critical_pct: 10,
    shortage_warning_kes: 500,
    shortage_critical_kes: 2000,
    production_shortfall_warning_pct: 5,
    production_shortfall_critical_pct: 15,
    bar_variance_warning_kes: 500,
    bar_variance_critical_kes: 2000
};

async function getWastageThresholds(branchId: number): Promise<typeof DEFAULT_WASTAGE_THRESHOLDS> {
    const { data } = await supabase
        .from('kitchen_wastage_thresholds')
        .select('*')
        .eq('branch_id', branchId)
        .maybeSingle();
    return data ? { ...DEFAULT_WASTAGE_THRESHOLDS, ...data } : DEFAULT_WASTAGE_THRESHOLDS;
}

async function createWastageAlert(payload: {
    shift_id: string;
    branch_id: number;
    alert_type: 'recipe_variance' | 'spoilage_spike' | 'unexplained_shortage' | 'production_shortfall';
    severity: 'warning' | 'critical';
    item_sku?: string | null;
    item_name?: string | null;
    expected_value?: number | null;
    actual_value?: number | null;
    variance_value?: number | null;
    variance_cost?: number | null;
    message?: string | null;
}): Promise<void> {
    const { error } = await supabase.from('kitchen_wastage_alerts').insert(payload);
    if (error) logger.error('createWastageAlert insert failed', error);
}

export async function staffProfileSummaries(userIds: string[]) {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return [];
    const [{ data: users }, { data: profiles }] = await Promise.all([
        supabase.from('users').select('id,first_name,last_name,role').in('id', ids),
        supabase.from('staff_profiles').select('id,user_id,first_name,last_name,role,department,employee_number').in('user_id', ids)
    ]);
    const profileByUser = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    return (users || []).map((u: any) => {
        const profile = profileByUser.get(u.id) || {};
        const first = profile.first_name || u.first_name || '';
        const last = profile.last_name || u.last_name || '';
        return {
            user_id: u.id,
            staff_profile_id: profile.id || null,
            name: `${first} ${last}`.trim() || u.id,
            role: profile.role || u.role || 'staff',
            department: profile.department || null,
            employee_number: profile.employee_number || null
        };
    });
}

async function syncKitchenShiftToStockCounts(shiftId: string): Promise<void> {
    // 1. Fetch kitchen shift
    const { data: shift, error: shiftError } = await supabase
        .from('kitchen_shifts')
        .select('*')
        .eq('id', shiftId)
        .single();
    if (shiftError || !shift) {
        logger.error(`[syncKitchenShiftToStockCounts] Shift not found: ${shiftId}`, shiftError);
        return;
    }

    // Map shift status to stock_counts status
    let status = 'draft';
    if (shift.status === 'pending_chef_confirmation' || shift.status === 'pending_accountant_review') {
        status = 'submitted';
    } else if (shift.status === 'approved') {
        status = 'approved';
    } else if (shift.status === 'rejected') {
        status = 'rejected';
    }

    const shiftLocation = `kitchen_${String(shift.shift_type || 'morning').toLowerCase()}`;
    const stocktakeDate = shift.shift_date;

    // 2. Fetch existing stock_counts header
    const { data: existing } = await supabase
        .from('stock_counts')
        .select('id')
        .eq('branch_id', shift.branch_id)
        .eq('count_date', stocktakeDate)
        .eq('location', shiftLocation)
        .eq('store_type', 'kitchen')
        .maybeSingle();

    let stockCountId: string;
    const now = new Date().toISOString();
    const headerData: any = {
        branch_id: shift.branch_id,
        count_date: stocktakeDate,
        count_type: 'daily',
        store_type: 'kitchen',
        location: shiftLocation,
        status,
        counted_by: shift.store_keeper_id || shift.opened_by || null,
        approved_by: shift.accountant_approved_by || null,
        approved_at: shift.accountant_approved_at || null,
        updated_at: now
    };

    if (existing?.id) {
        stockCountId = existing.id;
        const { error: updateError } = await supabase
            .from('stock_counts')
            .update(headerData)
            .eq('id', stockCountId);
        if (updateError) throw updateError;
    } else {
        const { data: created, error: insertError } = await supabase
            .from('stock_counts')
            .insert({ ...headerData, id: shiftId, created_at: now })
            .select('id')
            .single();
        if (insertError) {
            const { data: created2, error: insertError2 } = await supabase
                .from('stock_counts')
                .insert({ ...headerData, created_at: now })
                .select('id')
                .single();
            if (insertError2) throw insertError2;
            stockCountId = created2!.id;
        } else {
            stockCountId = created!.id;
        }
    }

    // 3. Fetch all kitchen shift stock take records for this shift
    const { data: records, error: recordsError } = await supabase
        .from('kitchen_shift_stock_take')
        .select('*')
        .eq('shift_id', shiftId);

    if (recordsError) throw recordsError;

    // 4. Delete existing items under this header
    await supabase.from('stock_count_items').delete().eq('stock_count_id', stockCountId);

    // 5. Insert new items
    if (records && records.length > 0) {
        const skus = records.map((r: any) => r.item_sku).filter(Boolean);
        const { data: invItems } = skus.length > 0
            ? await supabase.from('inventory_items').select('id, sku').in('sku', skus)
            : { data: [] };

        const items = records.map((r: any) => {
            const matchedInv = (invItems || []).find((i: any) => i.sku === r.item_sku);
            return {
                stock_count_id: stockCountId,
                item_id: matchedInv?.id || null,
                item_sku: r.item_sku,
                item_name: r.item_name,
                system_quantity: n(r.system_closing_stock),
                physical_quantity: n(r.physical_count),
                counted_quantity: n(r.physical_count),
                variance: n(r.variance),
                variance_value: n(r.variance_value),
                reason: r.variance_reason || null,
                status,
                created_at: now,
                updated_at: now
            };
        });

        const { error: itemsError } = await supabase.from('stock_count_items').insert(items);
        if (itemsError) throw itemsError;
    }
}

// ── OPEN SHIFT ──────────────────────────────────────────────
// sub_shift_type ('A'/'B') + department ('KITCHEN'/'PASTRY') are the new
// storekeeper-facing slot the shift opens into. cashier_shift_id is always
// resolved server-side from the branch's currently open commercial day —
// never trusted from the client — so the one-A-one-B-per-day DB constraint
// (uq_one_subshift_per_cashier_shift) actually means what it says.
export const openKitchenShift = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, shift_type, shift_date, opening_items, assigned_chef_ids, sub_shift_type, department } = req.body;
    const userId = (req as any).user?.id;
    if (!branch_id || !shift_type) throw new AppError('branch_id, shift_type required', 400);

    let cashierShiftId: string | null = null;
    // Set only for Shift B once Shift A's handover ledger is found — its
    // closing_counts become Shift B's opening_stock, replacing whatever the
    // client sent in opening_items (see "seeded directly from Shift A's
    // confirmed closing count" in the Phase 4 spec).
    let seededOpeningItems: any[] | null = null;
    let handoverRecord: any = null;
    if (sub_shift_type) {
        if (!['A', 'B'].includes(sub_shift_type)) {
            throw new AppError('INVALID_SUB_SHIFT_TYPE: sub_shift_type must be A or B', 400);
        }
        const { data: cashierShift } = await supabase
            .from('cashier_shift_logs')
            .select('id')
            .eq('branch_id', branch_id)
            .eq('status', 'open')
            .order('shift_start', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!cashierShift) {
            throw new AppError('NO_ACTIVE_CASHIER_SHIFT: no open cashier shift for this branch — open the cashier/POS shift before opening a kitchen shift', 400);
        }
        cashierShiftId = cashierShift.id;

        const dept = department || 'KITCHEN';
        const { data: existingSameType } = await supabase
            .from('kitchen_shifts')
            .select('id, status')
            .eq('branch_id', branch_id)
            .eq('cashier_shift_id', cashierShiftId)
            .eq('sub_shift_type', sub_shift_type)
            .eq('department', dept)
            .maybeSingle();
        if (existingSameType) {
            throw new AppError(`KITCHEN_SHIFT_ALREADY_OPEN: Shift ${sub_shift_type} (${dept}) has already been opened for this commercial day`, 409);
        }

        if (sub_shift_type === 'B') {
            const { data: shiftA } = await supabase
                .from('kitchen_shifts')
                .select('id, status')
                .eq('branch_id', branch_id)
                .eq('cashier_shift_id', cashierShiftId)
                .eq('sub_shift_type', 'A')
                .eq('department', dept)
                .maybeSingle();
            if (!shiftA) {
                throw new AppError('SHIFT_A_NOT_OPENED: Shift A must be opened (and closed) before Shift B can start', 400);
            }
            if (shiftA.status === 'open') {
                throw new AppError('SHIFT_A_NOT_CLOSED: Shift A is still open — close it before opening Shift B', 400);
            }

            const { data: handover } = await supabase
                .from('kitchen_shift_handovers')
                .select('*')
                .eq('outgoing_shift_id', shiftA.id)
                .maybeSingle();
            if (!handover) {
                throw new AppError('SHIFT_A_NOT_HANDED_OVER: Shift A has not been handed over yet — the handover ledger (witnessed closing counts) must be confirmed before Shift B can open', 400);
            }
            handoverRecord = handover;
            seededOpeningItems = (handover.closing_counts || []).map((c: any) => ({
                sku: c.item_sku, name: c.item_name, unit: c.unit_of_measure,
                cost_price: c.cost_price, quantity: c.physical_count
            }));
        }
    }

    const effectiveOpeningItems = seededOpeningItems || opening_items;
    if (!effectiveOpeningItems || !Array.isArray(effectiveOpeningItems) || effectiveOpeningItems.length === 0) {
        throw new AppError('opening_items required', 400);
    }

    const { data: sn } = await supabase.rpc('generate_kitchen_shift_number', {
        p_branch_id: branch_id, p_date: shift_date || new Date().toISOString().split('T')[0]
    });
    const { data: shift, error: e1 } = await supabase.from('kitchen_shifts').insert({
        shift_number: sn || `KS-${Date.now()}`, branch_id, shift_type: shift_type.toLowerCase(),
        shift_date: shift_date || new Date().toISOString().split('T')[0],
        opened_by: userId, store_keeper_id: userId, assigned_chef_ids: assigned_chef_ids || [], status: 'open',
        sub_shift_type: sub_shift_type || null, cashier_shift_id: cashierShiftId, department: department || 'KITCHEN'
    }).select().single();
    if (e1) {
        if (e1.code === '23505') {
            throw new AppError(`KITCHEN_SHIFT_ALREADY_OPEN: Shift ${sub_shift_type} has already been opened for this commercial day`, 409);
        }
        throw new AppError(e1.message, 500);
    }

    if (handoverRecord) {
        await supabase.from('kitchen_shift_handovers').update({
            incoming_shift_id: shift.id, seeded_at: new Date().toISOString()
        }).eq('id', handoverRecord.id);
    }

    // Opening a shift with stock is a real issue from branch store to the
    // kitchen line — debit branch-wide stock the same way Outlet Production
    // already does for raw consumption, so the two systems stay consistent
    // instead of the shift's opening_stock being an arbitrary self-reported
    // number with no link to actual branch stock. For a seeded Shift B this
    // is a carry-forward of stock already debited when Shift A opened, not
    // a fresh issue, so it's skipped here.
    if (!seededOpeningItems) {
        for (const it of effectiveOpeningItems) {
            if (n(it.quantity) > 0) {
                await updateBranchStock(
                    Number(branch_id), it.sku, -n(it.quantity), 'KITCHEN_SHIFT_OPEN', userId,
                    'kitchen_shift', shift.id, shift.shift_number,
                    `Kitchen shift ${shift.shift_number} opened with ${it.name || it.sku}`
                );
            }
        }
    }

    const items = effectiveOpeningItems.map((it: any) => ({
        shift_id: shift.id, branch_id, item_sku: it.sku, item_name: it.name,
        unit_of_measure: it.unit, cost_price: n(it.cost_price), opening_stock: n(it.quantity), additions: 0, sold_quantity: 0, spoilage_quantity: 0
    }));
    const { error: e2 } = await supabase.from('kitchen_shift_items').insert(items);
    if (e2) logger.error('shift items insert', e2);
    res.status(201).json({ success: true, data: shift });
});

// ── ADD STOCK (mid-session issuance) ─────────────────────────
// Each addition is now type-detected, BOM-linked (Type A requires a
// recipe_id), staff-tagged and timestamped into kitchen_shift_additions —
// the audit trail that was missing before. kitchen_shift_items.additions
// (a running total) is still updated in the same call so existing
// close/reconciliation/stock_counts sync logic is untouched.
export const addShiftStock = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { items } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'open') throw new AppError('Shift not open', 400);

    const results: any[] = [];
    for (const it of items || []) {
        if (n(it.quantity) <= 0) continue;

        const staffIds: string[] = Array.isArray(it.responsible_staff_ids) ? it.responsible_staff_ids : [];
        if (staffIds.length === 0) {
            throw new AppError(`RESPONSIBLE_STAFF_REQUIRED: select at least one responsible staff member for ${it.name || it.sku}`, 400);
        }

        const { data: typeResult } = await supabase.rpc('get_stock_item_food_control_type', {
            p_branch_id: Number(shift.branch_id), p_item_sku: it.sku
        });
        const foodControlType: string = typeResult || 'UNREGISTERED';

        let recipeId: string | null = it.recipe_id || null;
        if (foodControlType === 'A_RECIPE_BOM' && !recipeId) {
            throw new AppError(`BOM_DECLARATION_REQUIRED: ${it.name || it.sku} is a recipe item — select which recipe this batch is for`, 400);
        }
        if (foodControlType !== 'A_RECIPE_BOM') {
            recipeId = null; // never persist a recipe_id for non-recipe types, even if the client sent one
        }

        await updateBranchStock(
            Number(shift.branch_id), it.sku, -n(it.quantity), 'KITCHEN_SHIFT_ADD_STOCK', userId,
            'kitchen_shift', shift_id, undefined,
            `Added to kitchen shift ${shift_id} mid-shift: ${it.name || it.sku}`
        );

        const { error: ledgerError } = await supabase.from('kitchen_shift_additions').insert({
            shift_id, branch_id: shift.branch_id, item_sku: it.sku, item_name: it.name || null,
            quantity: n(it.quantity), unit: it.unit || null,
            food_control_type: foodControlType, recipe_id: recipeId,
            responsible_staff_ids: staffIds, notes: it.notes || null, added_by: userId
        });
        if (ledgerError) throw new AppError(ledgerError.message, 500);

        const { data: ex } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', it.sku).maybeSingle();
        if (ex) {
            const { data: upd } = await supabase.from('kitchen_shift_items').update({
                additions: n(ex.additions) + n(it.quantity), updated_at: new Date().toISOString()
            }).eq('id', ex.id).select().single();
            results.push({ ...upd, food_control_type: foodControlType });
        } else {
            const { data: cr } = await supabase.from('kitchen_shift_items').insert({
                shift_id, branch_id: shift.branch_id, item_sku: it.sku, item_name: it.name,
                unit_of_measure: it.unit, cost_price: n(it.cost_price), opening_stock: 0, additions: n(it.quantity), sold_quantity: 0, spoilage_quantity: 0
            }).select().single();
            results.push({ ...cr, food_control_type: foodControlType });
        }
    }
    res.json({ success: true, data: results });
});

// Issuance ledger for a shift — the storekeeper-facing "running log" view,
// each row showing exactly what addShiftStock recorded: type, recipe (if
// any), staff, timestamp.
export const listShiftAdditions = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { data, error } = await supabase
        .from('kitchen_shift_additions')
        .select('*, recipe:kitchen_production_recipes(id,recipe_name,produced_item_name)')
        .eq('shift_id', shift_id)
        .order('added_at', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

// ── PRODUCTION SUMMARY / PENDING LOGS (Phase 3) ──────────────
// "Unlogged Type A issuance" = a kitchen_shift_additions row tagged
// A_RECIPE_BOM whose recipe was never actually produced this shift (no
// kitchen_shift_production row referencing that recipe_id) — i.e. raw
// stock was issued against a recipe but nobody ever logged the output.
// Shared by getProductionSummary (so the storekeeper sees it coming) and
// closeKitchenShift (so it's actually enforced, not just advisory).
async function getPendingProductionLogs(shiftId: string) {
    const [{ data: additions }, { data: productions }] = await Promise.all([
        supabase
            .from('kitchen_shift_additions')
            .select('*, recipe:kitchen_production_recipes(id,recipe_name,produced_item_name)')
            .eq('shift_id', shiftId)
            .eq('food_control_type', 'A_RECIPE_BOM'),
        supabase.from('kitchen_shift_production').select('recipe_id').eq('shift_id', shiftId)
    ]);
    const loggedRecipeIds = new Set((productions || []).map((p: any) => p.recipe_id).filter(Boolean));
    return (additions || []).filter((a: any) => !loggedRecipeIds.has(a.recipe_id));
}

export const getProductionSummary = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id').eq('id', shift_id).maybeSingle();
    if (!shift) throw new AppError('Shift not found', 404);

    const { data: productions } = await supabase
        .from('kitchen_shift_production')
        .select('*')
        .eq('shift_id', shift_id)
        .order('produced_at', { ascending: false });

    const byRecipe = new Map<string, any>();
    for (const p of productions || []) {
        const key = p.recipe_id || `name:${p.produced_item_name}`;
        const existing = byRecipe.get(key) || {
            recipe_id: p.recipe_id, produced_item_name: p.produced_item_name, produced_unit: p.produced_unit,
            raw_item_name: p.raw_item_name, raw_unit: p.raw_unit,
            total_raw_quantity_used: 0, total_produced_quantity: 0, entries: 0, variance_flagged_count: 0
        };
        existing.total_raw_quantity_used += n(p.raw_quantity_used);
        existing.total_produced_quantity += n(p.produced_quantity);
        existing.entries += 1;
        if (p.variance_flagged) existing.variance_flagged_count += 1;
        byRecipe.set(key, existing);
    }

    const pendingLogs = await getPendingProductionLogs(shift_id as string);

    res.json({
        success: true,
        data: {
            by_recipe: Array.from(byRecipe.values()),
            pending_logs: pendingLogs,
            can_close: pendingLogs.length === 0
        }
    });
});

// The digital kitchen ledger document for a shift — found whether the shift
// was the outgoing (Shift A, closing) or incoming (Shift B, seeded) side of
// the handover, so either shift's detail view can display it.
export const getKitchenShiftHandover = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { data, error } = await supabase
        .from('kitchen_shift_handovers')
        .select('*')
        .or(`outgoing_shift_id.eq.${shift_id},incoming_shift_id.eq.${shift_id}`)
        .maybeSingle();
    if (error) throw new AppError(error.message, 500);
    if (!data) {
        res.json({ success: true, data: null });
        return;
    }
    const staff = await staffProfileSummaries([
        ...(data.outgoing_witness_ids || []),
        ...(data.incoming_witness_ids || [])
    ]);
    res.json({ success: true, data: { ...data, witness_staff: staff } });
});

// Active commercial day for a branch — used by the Kitchen Sessions screen
// to know whether Shift A/B can be opened at all before the user tries.
export const getActiveCashierShift = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const { data, error } = await supabase
        .from('cashier_shift_logs')
        .select('id, shift_number, shift_start, status')
        .eq('branch_id', Number(branch_id))
        .eq('status', 'open')
        .order('shift_start', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || null });
});

// ── RECORD PRODUCTION ───────────────────────────────────────
// Recipe variance enforcement: when a production line references a recipe
// (kitchen_production_recipes), the raw quantity used is checked against the
// recipe's yield ratio. A variance beyond the critical threshold (the
// recipe's own allowed_variance_percent, falling back to the branch-level
// kitchen_wastage_thresholds.recipe_variance_critical_pct) blocks the save
// unless a variance_reason is supplied on that production line.
export const recordProduction = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { productions } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'open') throw new AppError('Shift not open', 400);

    const thresholds = await getWastageThresholds(shift.branch_id);
    const results: any[] = [];
    for (const p of productions || []) {
        const { data: raw } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', p.raw_item_sku).single();
        if (!raw) throw new AppError(`Raw ${p.raw_item_sku} not in shift`, 400);
        const avail = n(raw.opening_stock) + n(raw.additions) - n(raw.sold_quantity) - n(raw.spoilage_quantity);
        if (n(p.raw_quantity_used) > avail) throw new AppError(`Insufficient ${p.raw_item_name}: ${avail} available`, 400);

        let recipe: any = null;
        let maxRawAllowed: number | null = null;
        let variancePct: number | null = null;
        let varianceFlagged = false;
        let severity: 'warning' | 'critical' | null = null;

        if (p.recipe_id) {
            const { data: recipeRow } = await supabase.from('kitchen_production_recipes').select('*').eq('id', p.recipe_id).maybeSingle();
            recipe = recipeRow;
            if (recipe && n(recipe.produced_quantity) > 0 && n(p.produced_quantity) > 0) {
                maxRawAllowed = (n(p.produced_quantity) / n(recipe.produced_quantity)) * n(recipe.raw_quantity);
                if (maxRawAllowed > 0) {
                    variancePct = ((n(p.raw_quantity_used) - maxRawAllowed) / maxRawAllowed) * 100;
                    const criticalPct = n(recipe.allowed_variance_percent) > 0 ? n(recipe.allowed_variance_percent) : thresholds.recipe_variance_critical_pct;
                    const warningPct = thresholds.recipe_variance_warning_pct;

                    if (variancePct > criticalPct && !p.variance_reason) {
                        res.status(400).json({
                            success: false,
                            code: 'RECIPE_VARIANCE_EXCEEDED',
                            message: `Recipe allows ${maxRawAllowed.toFixed(3)}${recipe.raw_unit} for ${p.produced_quantity} ${recipe.produced_unit || 'portions'}. You used ${p.raw_quantity_used}${recipe.raw_unit} (${variancePct.toFixed(1)}% over). Please provide a variance explanation.`,
                            data: { recipe, maxRawAllowed, actualUsed: n(p.raw_quantity_used), variancePct }
                        });
                        return;
                    }

                    if (variancePct > criticalPct) severity = 'critical';
                    else if (variancePct > warningPct) severity = 'warning';
                    varianceFlagged = variancePct > warningPct;
                }
            }
        }

        const { data: prod } = await supabase.from('kitchen_shift_production').insert({
            shift_id, branch_id: shift.branch_id, recipe_id: p.recipe_id, food_control_id: p.food_control_id,
            raw_item_sku: p.raw_item_sku, raw_item_name: p.raw_item_name, raw_quantity_used: n(p.raw_quantity_used), raw_unit: p.raw_unit,
            produced_item_name: p.produced_item_name, produced_item_sku: p.produced_item_sku, pos_outlet_item_id: p.pos_outlet_item_id,
            produced_quantity: n(p.produced_quantity), produced_unit: p.produced_unit || 'portion', conversion_ratio: n(p.conversion_ratio),
            conversion_notes: p.conversion_notes, produced_by: p.produced_by || userId,
            variance_pct: variancePct, recipe_max_raw_allowed: maxRawAllowed, variance_flagged: varianceFlagged,
            variance_reason: p.variance_reason ?? null
        }).select().single();
        results.push(prod);

        if (severity && maxRawAllowed !== null) {
            await createWastageAlert({
                shift_id, branch_id: shift.branch_id, alert_type: 'recipe_variance', severity,
                item_sku: p.raw_item_sku, item_name: p.raw_item_name,
                expected_value: maxRawAllowed, actual_value: n(p.raw_quantity_used),
                variance_value: n(p.raw_quantity_used) - maxRawAllowed,
                variance_cost: Math.round((n(p.raw_quantity_used) - maxRawAllowed) * n(raw.cost_price) * 100) / 100,
                message: `Recipe variance ${variancePct?.toFixed(1)}% on ${p.raw_item_name} for shift ${shift_id}`
            });
        }

        await supabase.from('kitchen_shift_items').update({ sold_quantity: n(raw.sold_quantity) + n(p.raw_quantity_used) }).eq('id', raw.id);
        if (p.pos_outlet_item_id) await creditOutletItemStock(p.pos_outlet_item_id, n(p.produced_quantity));
    }
    res.json({ success: true, data: results });
});

// ── CONFIRM ACTUAL PRODUCTION YIELD ──────────────────────────
// For yield-uncertain (baking) Food Controls: the expected quantity was
// already pushed to POS at recordProduction time. This records what was
// actually produced and, on a shortfall, bills the cost to the producer.
export const confirmProductionActual = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id, production_id } = req.params;
    const { actual_quantity } = req.body;
    const userId = (req as any).user?.id;
    if (actual_quantity === undefined || actual_quantity === null) throw new AppError('actual_quantity required', 400);

    const { data: prod } = await supabase.from('kitchen_shift_production').select('*').eq('id', production_id).eq('shift_id', shift_id).maybeSingle();
    if (!prod) throw new AppError('Production record not found', 404);
    if (prod.actual_quantity !== null) throw new AppError('Actual yield already confirmed for this production record', 400);

    const actual = n(actual_quantity);
    const expected = n(prod.produced_quantity);
    const shortfall = expected - actual;

    let unitCost = 0;
    if (prod.recipe_id) {
        const { data: recipe } = await supabase.from('kitchen_production_recipes').select('cost_per_output').eq('id', prod.recipe_id).maybeSingle();
        unitCost = n(recipe?.cost_per_output);
    }
    if (unitCost <= 0) {
        const { data: rawItem } = await supabase.from('kitchen_shift_items').select('cost_price').eq('shift_id', shift_id).eq('item_sku', prod.raw_item_sku).maybeSingle();
        const rawCost = n(rawItem?.cost_price) * n(prod.raw_quantity_used);
        unitCost = expected > 0 ? rawCost / expected : 0;
    }

    const varianceCost = shortfall > 0 ? Math.round(shortfall * unitCost * 100) / 100 : 0;

    let creditBill: any = null;
    if (varianceCost > 0 && prod.produced_by) {
        const staffId = await resolveStaffProfileId(prod.produced_by);
        if (staffId) {
            const { data: bill, error: billError } = await supabase.from('staff_credit_bills').insert({
                staff_id: staffId,
                amount: varianceCost,
                description: `Production shortfall — ${prod.produced_item_name} (expected ${expected}, actual ${actual})`,
                bill_date: new Date().toISOString().split('T')[0],
                status: 'accountant_confirmed',
                balance: varianceCost,
                paid_amount: 0,
                shift_id,
                branch_id: prod.branch_id,
                approved_at: new Date().toISOString(),
                approved_by: userId
            }).select().maybeSingle();
            if (billError) logger.error('production shortfall credit bill insert', billError);
            creditBill = bill;
        }
    }

    const { data: updated } = await supabase.from('kitchen_shift_production').update({
        actual_quantity: actual,
        actual_recorded_by: userId,
        actual_recorded_at: new Date().toISOString(),
        variance_cost: varianceCost,
        credit_bill_id: creditBill?.id || null
    }).eq('id', production_id).select().single();

    res.json({ success: true, data: { production: updated, credit_bill: creditBill } });
});

// ── RECORD SPOILAGE ─────────────────────────────────────────
export const recordSpoilage = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { items, notes } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    const results: any[] = [];
    for (const it of items || []) {
        const { data: si } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', it.sku).single();
        if (!si) continue;
        const { data: upd } = await supabase.from('kitchen_shift_items').update({
            spoilage_quantity: n(si.spoilage_quantity) + n(it.quantity), spoilage_reason: it.reason || si.spoilage_reason, updated_at: new Date().toISOString()
        }).eq('id', si.id).select().single();
        results.push(upd);
        await supabase.from('wastage_records').insert({
            branch_id: shift.branch_id, item_name: si.item_name, item_id: it.sku, item_type: 'raw_material',
            quantity: n(it.quantity), unit: si.unit_of_measure, reason: it.reason_category || 'other', description: it.reason || notes, logged_by: userId
        });
    }
    res.json({ success: true, data: results });
});

// ── CLOSE SHIFT ───────────────────────────────────────────
export const closeKitchenShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { physical_counts, closing_notes, outgoing_witness_ids, incoming_witness_ids } = req.body;
    const userId = (req as any).user?.id;
    if (!physical_counts) throw new AppError('physical_counts required', 400);

    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status,shift_date,opened_at,sub_shift_type,cashier_shift_id,department').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'open') throw new AppError('Shift must be open', 400);

    // Digital kitchen ledger (Phase 4): a Shift A/B kitchen shift cannot close
    // until both the outgoing and incoming teams are named as witnesses to
    // the closing physical counts. Legacy/ad-hoc shifts (no sub_shift_type)
    // predate this requirement and are unaffected.
    const requiresHandover = !!shift.sub_shift_type;
    const outgoingWitnesses: string[] = Array.isArray(outgoing_witness_ids) ? outgoing_witness_ids : [];
    const incomingWitnesses: string[] = Array.isArray(incoming_witness_ids) ? incoming_witness_ids : [];
    if (requiresHandover && (outgoingWitnesses.length === 0 || incomingWitnesses.length === 0)) {
        res.status(400).json({
            success: false,
            code: 'HANDOVER_WITNESSES_REQUIRED',
            message: 'Both the outgoing shift team and the incoming shift team must be named as witnesses before this shift can close.'
        });
        return;
    }

    const pendingLogs = await getPendingProductionLogs(shift_id as string);
    if (pendingLogs.length > 0) {
        res.status(400).json({
            success: false,
            code: 'PENDING_PRODUCTION_LOGS',
            message: `${pendingLogs.length} recipe issuance(s) have no production output logged yet. Enter output for each before closing this shift.`,
            data: { pending_logs: pendingLogs }
        });
        return;
    }

    const thresholds = await getWastageThresholds(shift.branch_id);
    const records: any[] = [];
    let spoilageCost = 0, varianceCost = 0, revenue = 0, cogs = 0;

    for (const c of physical_counts) {
        const { data: si } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', c.sku).single();
        if (!si) continue;
        const open = n(si.opening_stock), adds = n(si.additions), sold = n(si.sold_quantity), spoil = n(si.spoilage_quantity);
        const sysClose = open + adds - sold - spoil;
        const phys = n(c.quantity);
        const varQty = phys - sysClose;
        const cp = n(si.cost_price);
        const varVal = varQty * cp;

        await supabase.from('kitchen_shift_items').update({ physical_count: phys, variance_notes: c.notes || si.variance_notes, updated_at: new Date().toISOString() }).eq('id', si.id);

        const { data: st } = await supabase.from('kitchen_shift_stock_take').insert({
            shift_id, branch_id: shift.branch_id, item_sku: c.sku, item_name: si.item_name, unit_of_measure: si.unit_of_measure, cost_price: cp,
            opening_stock: open, additions: adds, total_available: open + adds, system_sales: sold, spoilage: spoil,
            system_closing_stock: sysClose, physical_count: phys, variance: varQty, variance_value: varVal,
            variance_category: varQty < 0 ? 'shortage' : varQty > 0 ? 'overage' : 'ok', variance_reason: c.notes, counted_by: userId, counted_at: new Date().toISOString()
        }).select().single();
        records.push(st);

        // Unexplained shortage alert — a real-time-visible counterpart to the
        // kitchen_shift_stock_take row above, surfaced via /api/kitchen/wastage-alerts.
        if (varQty < 0) {
            const shortageCost = Math.abs(varVal);
            const severity: 'warning' | 'critical' | null =
                shortageCost > thresholds.shortage_critical_kes ? 'critical'
                : shortageCost > thresholds.shortage_warning_kes ? 'warning'
                : null;
            if (severity) {
                await createWastageAlert({
                    shift_id, branch_id: shift.branch_id, alert_type: 'unexplained_shortage', severity,
                    item_sku: c.sku, item_name: si.item_name,
                    expected_value: sysClose, actual_value: phys, variance_value: varQty, variance_cost: Math.round(shortageCost * 100) / 100,
                    message: `${severity === 'critical' ? 'Critical' : 'Warning'} shortage on ${si.item_name}: KES ${shortageCost.toFixed(2)} unexplained`
                });
            }
        }

        spoilageCost += spoil * cp;
        varianceCost += varVal;
        cogs += (sold + spoil) * cp;
    }

    // Revenue from cashier transactions during shift
    const { data: txns } = await supabase.from('cashier_transactions').select('amount')
        .eq('branch_id', shift.branch_id).gte('transaction_date', shift.opened_at).lte('transaction_date', new Date().toISOString())
        .eq('status', 'posted').neq('transaction_type', 'refund');
    revenue = (txns || []).reduce((s: number, t: any) => s + n(t.amount), 0);

    // Write the handover ledger before marking the shift closed — closing is
    // the act of confirming handover for Shift A/B shifts, so if this insert
    // fails the shift stays open rather than closing with no witnessed record.
    let handover: any = null;
    if (requiresHandover) {
        const { data: ho, error: hoError } = await supabase.from('kitchen_shift_handovers').insert({
            outgoing_shift_id: shift_id, branch_id: shift.branch_id, cashier_shift_id: shift.cashier_shift_id,
            department: shift.department, outgoing_witness_ids: outgoingWitnesses, incoming_witness_ids: incomingWitnesses,
            closing_counts: records, notes: closing_notes, confirmed_by: userId
        }).select().single();
        if (hoError) throw new AppError(hoError.message, 500);
        handover = ho;
    }

    const { data: closed } = await supabase.from('kitchen_shifts').update({
        status: 'closed', closed_at: new Date().toISOString(), total_revenue: revenue, total_cogs: cogs,
        total_spoilage_cost: spoilageCost, total_variance_cost: varianceCost, closing_notes, updated_at: new Date().toISOString()
    }).eq('id', shift_id).select().single();

    try {
        await syncKitchenShiftToStockCounts(shift_id);
    } catch (err: any) {
        logger.error(`[closeKitchenShift] syncKitchenShiftToStockCounts failed for shift ${shift_id}:`, err);
    }

    res.json({ success: true, data: { shift: closed, stock_take: records, handover, summary: { revenue, cogs, spoilage_cost: spoilageCost, variance_cost: varianceCost } } });
});

// ── SUBMIT FOR APPROVAL ─────────────────────────────────────
export const submitForApproval = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'closed') throw new AppError('Shift must be closed', 400);
    const { data: upd } = await supabase.from('kitchen_shifts').update({ status: 'pending_chef_confirmation', updated_at: new Date().toISOString() }).eq('id', shift_id).select().single();
    await supabase.from('kitchen_shift_approvals').insert({ shift_id, branch_id: shift.branch_id, approval_stage: 'store_keeper_submitted', approved_by: userId, notes: 'Submitted for chef confirmation' });
    
    try {
        await syncKitchenShiftToStockCounts(shift_id);
    } catch (err: any) {
        logger.error(`[submitForApproval] syncKitchenShiftToStockCounts failed for shift ${shift_id}:`, err);
    }

    res.json({ success: true, data: upd });
});

// ── CHEF CONFIRM ────────────────────────────────────────────
export const chefConfirmShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { confirmed, notes } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'pending_chef_confirmation') throw new AppError('Not pending chef', 400);
    const next = confirmed ? 'pending_accountant_review' : 'open';
    const { data: upd } = await supabase.from('kitchen_shifts').update({
        status: next, chef_confirmed_by: confirmed ? userId : null, chef_confirmed_at: confirmed ? new Date().toISOString() : null, updated_at: new Date().toISOString()
    }).eq('id', shift_id).select().single();
    await supabase.from('kitchen_shift_approvals').insert({ shift_id, branch_id: shift.branch_id, approval_stage: confirmed ? 'chef_confirmed' : 'chef_rejected', approved_by: userId, notes: notes || `Chef ${confirmed ? 'confirmed' : 'rejected'}` });
    
    try {
        await syncKitchenShiftToStockCounts(shift_id);
    } catch (err: any) {
        logger.error(`[chefConfirmShift] syncKitchenShiftToStockCounts failed for shift ${shift_id}:`, err);
    }

    res.json({ success: true, data: upd });
});

// ── ACCOUNTANT REVIEW ─────────────────────────────────────
export const accountantReviewShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { approved, notes, liability_action, allocations, write_off_reason } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase
        .from('kitchen_shifts')
        .select('id,branch_id,status,shift_number,total_variance_cost')
        .eq('id', shift_id)
        .single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'pending_accountant_review') throw new AppError('Not pending review', 400);
    const next = approved ? 'approved' : 'rejected';
    const action = liability_action || (approved ? 'approve_only' : 'rejected');

    if (approved && action === 'write_off' && !String(write_off_reason || notes || '').trim()) {
        throw new AppError('Write-off reason is required', 400);
    }

    // Deliberate-allocation guard: when the accountant explicitly chooses
    // liability_action='staff_liability', credit bills must never be
    // auto-created from a blank allocation list — the accountant must name
    // who is being billed and how much.
    if (approved && action === 'staff_liability' && absMoney(shift.total_variance_cost) > 0) {
        if (!Array.isArray(allocations) || allocations.length === 0) {
            res.status(400).json({
                success: false,
                code: 'ALLOCATIONS_REQUIRED',
                message: 'Staff liability allocations must be explicitly provided by the accountant before credit bills are created.'
            });
            return;
        }
    }

    const { data: upd } = await supabase.from('kitchen_shifts').update({
        status: next, accountant_reviewed_by: userId, accountant_reviewed_at: new Date().toISOString(),
        accountant_approved_by: approved ? userId : null, accountant_approved_at: approved ? new Date().toISOString() : null,
        accountant_rejection_reason: approved ? null : notes, updated_at: new Date().toISOString()
    }).eq('id', shift_id).select().single();

    let liabilityCase: any = null;
    let creditBills: any[] = [];
    const varianceCost = absMoney(shift.total_variance_cost);
    const normalizedAllocations = Array.isArray(allocations) ? allocations : [];

    if (approved && varianceCost > 0) {
        const { data: lc } = await supabase.from('kitchen_shift_liability_cases').insert({
            shift_id,
            branch_id: shift.branch_id,
            liability_action: action,
            total_variance_cost: varianceCost,
            status: action === 'write_off' ? 'written_off' : normalizedAllocations.length ? 'billed' : 'approved_no_charge',
            write_off_reason: action === 'write_off' ? (write_off_reason || notes) : null,
            allocations: normalizedAllocations,
            approved_by: userId,
            approved_at: new Date().toISOString(),
            notes
        }).select().maybeSingle();
        liabilityCase = lc;

        if (action !== 'write_off') {
            for (const allocation of normalizedAllocations) {
                const amount = absMoney(allocation.amount);
                if (amount <= 0) continue;
                const staffId = await resolveStaffProfileId(
                    allocation.staff_profile_id || allocation.staff_id || allocation.user_id
                );
                if (!staffId) continue;
                const { data: bill, error: billError } = await supabase
                    .from('staff_credit_bills')
                    .insert({
                        staff_id: staffId,
                        amount,
                        description: allocation.description || `Kitchen variance liability - ${shift.shift_number}`,
                        bill_date: new Date().toISOString().split('T')[0],
                        status: 'accountant_confirmed',
                        balance: amount,
                        paid_amount: 0,
                        shift_id,
                        branch_id: shift.branch_id,
                        approved_at: new Date().toISOString(),
                        approved_by: userId
                    })
                    .select()
                    .maybeSingle();
                if (billError) logger.error('kitchen liability credit bill insert', billError);
                if (bill) creditBills.push(bill);
            }
        }
    }

    await supabase.from('kitchen_shift_approvals').insert({
        shift_id,
        branch_id: shift.branch_id,
        approval_stage: approved ? 'accountant_approved' : 'accountant_rejected',
        approved_by: userId,
        notes: notes || `Accountant ${approved ? 'approved' : 'rejected'} (${action})`
    });

    try {
        await syncKitchenShiftToStockCounts(shift_id);
    } catch (err: any) {
        logger.error(`[accountantReviewShift] syncKitchenShiftToStockCounts failed for shift ${shift_id}:`, err);
    }

    res.json({ success: true, data: { shift: upd, liability_case: liabilityCase, credit_bills: creditBills } });
});

// ── GET SHIFT ───────────────────────────────────────────────
export const getKitchenShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { data: shift } = await supabase.from('kitchen_shifts').select(`*, store_keeper:users!store_keeper_id(first_name,last_name)`).eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    const [{ data: items }, { data: prods }, { data: st }, { data: aprv }, { data: liabilityCases }] = await Promise.all([
        supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).order('item_name'),
        supabase.from('kitchen_shift_production').select('*').eq('shift_id', shift_id).order('produced_at', { ascending: false }),
        supabase.from('kitchen_shift_stock_take').select('*').eq('shift_id', shift_id).order('item_name'),
        supabase.from('kitchen_shift_approvals').select('*').eq('shift_id', shift_id).order('approved_at', { ascending: false }),
        supabase.from('kitchen_shift_liability_cases').select('*').eq('shift_id', shift_id).order('created_at', { ascending: false })
    ]);
    const staff = await staffProfileSummaries([
        shift.store_keeper_id,
        ...((shift.assigned_chef_ids || []) as string[])
    ]);
    const summary = (items || []).reduce((a: any, it: any) => ({
        opening_value: a.opening_value + n(it.opening_value), additions_value: a.additions_value + n(it.additions_value),
        sold_value: a.sold_value + n(it.sold_value), spoilage_value: a.spoilage_value + n(it.spoilage_value),
        variance_value: a.variance_value + n(it.variance_value), shortage: a.shortage + (n(it.variance) < 0 ? 1 : 0),
        overage: a.overage + (n(it.variance) > 0 ? 1 : 0), ok: a.ok + (n(it.variance) === 0 ? 1 : 0)
    }), { opening_value: 0, additions_value: 0, sold_value: 0, spoilage_value: 0, variance_value: 0, shortage: 0, overage: 0, ok: 0 });
    res.json({ success: true, data: { shift, items: items || [], productions: prods || [], stock_take: st || [], approvals: aprv || [], liability_cases: liabilityCases || [], shift_staff: staff, summary } });
});

// ── LIST SHIFTS ─────────────────────────────────────────────
export const listKitchenShifts = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, status, shift_date, from_date, to_date } = req.query;
    let q = supabase.from('kitchen_shifts').select('*, store_keeper:users!store_keeper_id(first_name,last_name)').order('opened_at', { ascending: false });
    if (branch_id) q = q.eq('branch_id', branch_id);
    if (status) q = q.eq('status', status);
    if (shift_date) q = q.eq('shift_date', shift_date);
    if (from_date) q = q.gte('shift_date', from_date);
    if (to_date) q = q.lte('shift_date', to_date);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

// ── PRODUCTION SESSION VIEW (compatibility) ──────────────────
// Returns kitchen_shifts data in the shape expected by old
// kitchen_production_sessions consumers — read-only, additive.
export const getProductionSessionView = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, status, shift_type, date_from, date_to } = req.query;
    let query = supabase
        .from('kitchen_shifts')
        .select(`
            *,
            kitchen_shift_items(*),
            kitchen_shift_production(*),
            opened_by_user:users!opened_by(first_name,last_name)
        `)
        .order('opened_at', { ascending: false });

    if (branch_id) query = query.eq('branch_id', Number(branch_id));
    if (status) query = query.eq('status', status as string);
    if (shift_type) query = query.eq('shift_type', shift_type as string);
    if (date_from) query = query.gte('shift_date', date_from as string);
    if (date_to) query = query.lte('shift_date', date_to as string);

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500);

    const formatted = (data || []).map((s: any) => {
        const first = s.opened_by_user?.first_name || '';
        const last = s.opened_by_user?.last_name || '';
        return {
            ...s,
            session_number: s.shift_number,
            session_date: s.shift_date,
            staff_name: `${first} ${last}`.trim() || 'Staff',
            staff_id: s.opened_by,
        };
    });

    res.json({ success: true, data: formatted });
});

// Links a POS item to a shared stock pool — used by Food Controls whose
// output is a fraction of a base item (e.g. Half/Quarter Chicken sharing
// the Full Chicken pool).
async function applyPoolLink(posOutletItemId: string | null | undefined, poolItemId: string | null | undefined, poolFraction: any) {
    if (!posOutletItemId || !poolItemId) return;
    await supabase.from('pos_outlet_items').update({
        stock_pool_item_id: poolItemId,
        pool_fraction: n(poolFraction) > 0 ? n(poolFraction) : 1,
        updated_at: new Date().toISOString()
    }).eq('id', posOutletItemId);
}

// ── RECIPES ─────────────────────────────────────────────────
export const createProductionRecipe = asyncWrap(async (req: Request, res: Response) => {
    const {
        branch_id,
        recipe_name,
        raw_item_sku,
        raw_item_name,
        raw_quantity,
        raw_unit,
        produced_item_name,
        produced_item_sku,
        produced_quantity,
        produced_unit,
        pos_outlet_item_id,
        allowed_variance_percent,
        spoilage_threshold_percent,
        cost_per_output,
        requires_yield_confirmation,
        pool_item_id,
        pool_fraction
    } = req.body;
    const userId = (req as any).user?.id;
    const outputs = Array.isArray(req.body.outputs) ? req.body.outputs : [];
    const normalizedOutputs = outputs.length > 0
        ? outputs
        : [{
            produced_item_name,
            produced_item_sku,
            produced_quantity,
            produced_unit,
            pos_outlet_item_id,
            pool_item_id,
            pool_fraction
        }];

    if (!branch_id || !raw_item_sku || !raw_item_name || !raw_quantity || !raw_unit || normalizedOutputs.length === 0) {
        throw new AppError('branch_id, raw item, raw quantity, produced item, and yield are required', 400);
    }
    const invalidOutput = normalizedOutputs.find((output: any) =>
        !output?.produced_item_name || n(output?.produced_quantity) <= 0
    );
    if (invalidOutput) {
        throw new AppError('Every produced menu item must have a name and yield quantity greater than zero', 400);
    }

    const insertRows = normalizedOutputs.map((output: any) => ({
        branch_id,
        recipe_name: output.recipe_name || recipe_name || `${raw_item_name} to ${output.produced_item_name}`,
        raw_item_sku,
        raw_item_name,
        raw_quantity: n(raw_quantity),
        raw_unit,
        produced_item_name: output.produced_item_name,
        produced_item_sku: output.produced_item_sku || null,
        produced_quantity: n(output.produced_quantity),
        produced_unit: output.produced_unit || produced_unit || 'portion',
        pos_outlet_item_id: output.pos_outlet_item_id || null,
        allowed_variance_percent: n(allowed_variance_percent || 2),
        spoilage_threshold_percent: n(spoilage_threshold_percent || 1),
        cost_per_output: n(output.cost_per_output ?? cost_per_output),
        requires_yield_confirmation: requires_yield_confirmation !== false,
        created_by: userId
    }));

    const { data, error } = await supabase
        .from('kitchen_production_recipes')
        .insert(insertRows)
        .select();
    if (error) throw new AppError(error.message, 500);
    await Promise.all(normalizedOutputs.map((output: any) =>
        applyPoolLink(output.pos_outlet_item_id, output.pool_item_id, output.pool_fraction)
    ));
    res.status(201).json({ success: true, data: outputs.length > 0 ? data : data?.[0] });
});

export const updateProductionRecipe = asyncWrap(async (req: Request, res: Response) => {
    const { recipe_id } = req.params;
    const payload: any = {};
    for (const key of [
        'recipe_name',
        'raw_item_sku',
        'raw_item_name',
        'raw_unit',
        'produced_item_name',
        'produced_item_sku',
        'produced_unit',
        'pos_outlet_item_id',
        'is_active'
    ]) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) payload[key] = req.body[key];
    }
    for (const key of [
        'raw_quantity',
        'produced_quantity',
        'allowed_variance_percent',
        'spoilage_threshold_percent',
        'cost_per_output'
    ]) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) payload[key] = n(req.body[key]);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'requires_yield_confirmation')) {
        payload.requires_yield_confirmation = req.body.requires_yield_confirmation !== false;
    }
    payload.updated_at = new Date().toISOString();
    const { data, error } = await supabase
        .from('kitchen_production_recipes')
        .update(payload)
        .eq('id', recipe_id)
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    await applyPoolLink(data?.pos_outlet_item_id, req.body.pool_item_id, req.body.pool_fraction);
    res.json({ success: true, data });
});

export const deactivateProductionRecipe = asyncWrap(async (req: Request, res: Response) => {
    const { recipe_id } = req.params;
    const { data, error } = await supabase
        .from('kitchen_production_recipes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', recipe_id)
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
});

export const listProductionRecipes = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    let q = supabase.from('kitchen_production_recipes').select('*').eq('is_active', true).order('recipe_name');
    if (branch_id) q = q.eq('branch_id', branch_id);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

// POS menu items a Food Control recipe can be linked to. Sourced from
// pos_outlet_items (the real sales catalog — pos_shift_orders.items[].outlet_item_id
// references this table's id) rather than restaurant_menu_items, which is a
// separate, unrelated catalog with no populated FK back to pos_outlet_items.
// Recipes linked against the wrong table's id would never match a real sale.
export const listRecipeLinkableMenuItems = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const { data, error } = await supabase
        .from('pos_outlet_items')
        .select('id, name, sku, unit, item_group, track_stock')
        .eq('branch_id', branch_id)
        .eq('is_active', true)
        .order('name', { ascending: true });
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

// ── FOOD CONTROL TYPE CONFIG (Phase 1) ───────────────────────
// Type A (recipe BOM) = kitchen_production_recipes, above.
// Type B (yield/pool split) = pos_outlet_items.stock_pool_item_id + pool_fraction,
// already live for real POS sales (see applyPoolLink above). The endpoints
// below just expose that same mechanism as its own config screen.
// Type C (direct) and EXEMPT are genuinely new — registered in
// food_control_direct_items / food_control_exempt_items
// (migration 20260629_food_control_type_config.sql).

const BAR_KEYWORDS = ['beer', 'spirit', 'wine', 'whisky', 'whiskey', 'vodka', 'gin', 'rum', 'brandy', 'liqueur', 'soda', 'alcohol', 'bar'];
function isBarItem(item: { category?: string | null; sku?: string | null; name?: string | null }): boolean {
    const haystack = `${item.category || ''} ${item.sku || ''} ${item.name || ''}`.toLowerCase();
    return BAR_KEYWORDS.some((kw) => haystack.includes(kw));
}

export const getStockItemFoodControlType = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, item_sku } = req.query;
    if (!branch_id || !item_sku) throw new AppError('branch_id and item_sku are required', 400);
    const { data, error } = await supabase.rpc('get_stock_item_food_control_type', {
        p_branch_id: Number(branch_id),
        p_item_sku: String(item_sku)
    });
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: { item_sku, food_control_type: data } });
});

export const listDirectItems = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const { data, error } = await supabase
        .from('food_control_direct_items')
        .select('*, pos_outlet_item:pos_outlet_items(id,name,sku,unit)')
        .eq('branch_id', Number(branch_id))
        .eq('is_active', true)
        .order('stock_item_name');
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

export const createDirectItem = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, stock_item_sku, stock_item_name, pos_outlet_item_id } = req.body;
    if (!branch_id || !stock_item_sku || !pos_outlet_item_id) {
        throw new AppError('branch_id, stock_item_sku and pos_outlet_item_id are required', 400);
    }
    const userId = (req as any).user?.id;
    const { data, error } = await supabase
        .from('food_control_direct_items')
        .insert({
            branch_id,
            stock_item_sku,
            stock_item_name: stock_item_name || null,
            pos_outlet_item_id,
            created_by: userId
        })
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.status(201).json({ success: true, data });
});

export const deactivateDirectItem = asyncWrap(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('food_control_direct_items')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
});

export const listExemptItems = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const { data, error } = await supabase
        .from('food_control_exempt_items')
        .select('*, pos_outlet_item:pos_outlet_items(id,name,sku,unit,category)')
        .eq('branch_id', Number(branch_id))
        .order('created_at', { ascending: false });
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

export const createExemptItem = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, pos_outlet_item_id, reason } = req.body;
    if (!branch_id || !pos_outlet_item_id) {
        throw new AppError('branch_id and pos_outlet_item_id are required', 400);
    }
    const userId = (req as any).user?.id;
    const { data, error } = await supabase
        .from('food_control_exempt_items')
        .insert({ branch_id, pos_outlet_item_id, reason: reason || null, exempted_by: userId })
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.status(201).json({ success: true, data });
});

export const deleteExemptItem = asyncWrap(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { error } = await supabase.from('food_control_exempt_items').delete().eq('id', id);
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: { id } });
});

// Pool (Type B) links — thin config wrapper around the same applyPoolLink
// mechanism used by recipe creation, so a pool relationship can be set up
// independently of any recipe (e.g. a whole chicken split into POS fractions
// with no cooking step in between).
export const listPoolLinks = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const { data, error } = await supabase
        .from('pos_outlet_items')
        .select('id, name, sku, unit, pool_fraction, stock_pool_item_id, pool_parent:pos_outlet_items!stock_pool_item_id(id,name,sku)')
        .eq('branch_id', Number(branch_id))
        .not('stock_pool_item_id', 'is', null)
        .order('name');
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
});

// Pool parents must physically be a pos_outlet_items row — the live POS
// deduction code (outlet-pos.controller.ts, decrement_pos_outlet_item_stock)
// only ever decrements pos_outlet_items.current_stock by id. But storekeepers
// think of the pool parent as the raw branch_stock item in the central store
// (e.g. "FULL CHICKEN"), not a POS catalog row. This resolves that
// branch_stock SKU to its pos_outlet_items proxy, creating one if none exists
// yet — tagged is_available: false so it never appears as a sellable item on
// the cashier's POS screen (those list queries filter on is_available), while
// still being a normal, active pos_outlet_items row for stock/pool purposes.
async function resolveOrCreateStockPoolItem(
    branchId: number,
    sku: string,
    name?: string | null,
    unit?: string | null
): Promise<string> {
    // The pool parent must actually be a stocked branch_stock item — a pool
    // split with nothing behind it to deduct from is meaningless. Read the
    // real quantity from branch_stock ourselves rather than trust the
    // client, and require it to be > 0.
    const { data: stockRow, error: stockError } = await supabase
        .from('branch_stock')
        .select('quantity')
        .eq('branch_id', branchId)
        .eq('item_sku', sku)
        .maybeSingle();
    if (stockError) throw new AppError(stockError.message, 500);
    const stockQuantity = Number(stockRow?.quantity ?? 0);
    if (!stockRow || stockQuantity <= 0) {
        throw new AppError(
            `${name || sku} has no stock recorded in branch stock yet — receive it into branch stock before using it as a pool parent`,
            400
        );
    }

    const { data: existing, error: lookupError } = await supabase
        .from('pos_outlet_items')
        .select('id')
        .eq('branch_id', branchId)
        .eq('sku', sku)
        .maybeSingle();
    if (lookupError) throw new AppError(lookupError.message, 500);
    if (existing) {
        // Re-sync the proxy's stock to the real branch_stock balance every
        // time the link is (re)confirmed, so it doesn't drift stale.
        const { error: syncError } = await supabase
            .from('pos_outlet_items')
            .update({ current_stock: stockQuantity, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        if (syncError) throw new AppError(syncError.message, 500);
        return existing.id;
    }

    const { data: created, error: createError } = await supabase
        .from('pos_outlet_items')
        .insert({
            branch_id: branchId,
            sku,
            name: name || sku,
            unit: unit || null,
            track_stock: true,
            is_active: true,
            is_available: false,
            current_stock: stockQuantity,
            source_table: 'branch_stock'
        })
        .select('id')
        .single();
    if (createError) {
        throw new AppError(`Could not register ${name || sku} as a stock pool item: ${createError.message}`, 500);
    }
    return created.id;
}

export const setPoolLink = asyncWrap(async (req: Request, res: Response) => {
    const {
        pos_outlet_item_id, pool_item_id,
        pool_item_sku, pool_item_name, pool_item_unit,
        branch_id, pool_fraction
    } = req.body;
    if (!pos_outlet_item_id || (!pool_item_id && !pool_item_sku) || n(pool_fraction) <= 0 || n(pool_fraction) > 1) {
        throw new AppError(
            'pos_outlet_item_id, (pool_item_id or pool_item_sku) and a pool_fraction between 0 and 1 are required',
            400
        );
    }
    let resolvedPoolItemId = pool_item_id;
    if (!resolvedPoolItemId) {
        if (!branch_id) throw new AppError('branch_id is required when linking by pool_item_sku', 400);
        resolvedPoolItemId = await resolveOrCreateStockPoolItem(
            Number(branch_id), String(pool_item_sku), pool_item_name, pool_item_unit
        );
    }
    await applyPoolLink(pos_outlet_item_id, resolvedPoolItemId, pool_fraction);
    const { data, error } = await supabase
        .from('pos_outlet_items')
        .select('id, name, sku, pool_fraction, stock_pool_item_id')
        .eq('id', pos_outlet_item_id)
        .single();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
});

export const clearPoolLink = asyncWrap(async (req: Request, res: Response) => {
    const { itemId } = req.params;
    const { data, error } = await supabase
        .from('pos_outlet_items')
        .update({ stock_pool_item_id: null, pool_fraction: null, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select()
        .single();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data });
});

// Sold/issuable POS items with no food control classification at all —
// the "gap finder" storekeepers and accountants use to close out config.
export const listUnregisteredItems = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const { data: items, error } = await supabase
        .from('pos_outlet_items')
        .select('id, name, sku, category, unit, stock_pool_item_id')
        .eq('branch_id', Number(branch_id))
        .eq('is_active', true);
    if (error) throw new AppError(error.message, 500);

    const candidates = (items || []).filter((item) => !isBarItem(item) && !item.stock_pool_item_id);
    const skus = Array.from(new Set(candidates.map((item) => item.sku).filter(Boolean)));
    const types = new Map<string, string>();
    await Promise.all(skus.map(async (sku) => {
        const { data } = await supabase.rpc('get_stock_item_food_control_type', {
            p_branch_id: Number(branch_id),
            p_item_sku: sku
        });
        types.set(sku as string, data || 'UNREGISTERED');
    }));

    const unregistered = candidates.filter((item) => !item.sku || types.get(item.sku) === 'UNREGISTERED');
    res.json({ success: true, data: unregistered });
});

// ── DASHBOARD STATS ───────────────────────────────────────
export const getKitchenShiftStats = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, from_date, to_date } = req.query;
    if (!branch_id) throw new AppError('branch_id required', 400);
    const start = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const end = to_date || new Date().toISOString().split('T')[0];

    const { data: shifts } = await supabase.from('kitchen_shifts').select('*').eq('branch_id', branch_id).gte('shift_date', start).lte('shift_date', end);
    const open = (shifts || []).filter((s: any) => s.status === 'open').length;
    const closed = (shifts || []).filter((s: any) => s.status === 'closed').length;
    const approved = (shifts || []).filter((s: any) => s.status === 'approved').length;
    const rev = (shifts || []).reduce((s: number, sh: any) => s + n(sh.total_revenue), 0);
    const cogs = (shifts || []).reduce((s: number, sh: any) => s + n(sh.total_cogs), 0);
    const spoil = (shifts || []).reduce((s: number, sh: any) => s + n(sh.total_spoilage_cost), 0);
    const varc = (shifts || []).reduce((s: number, sh: any) => s + n(sh.total_variance_cost), 0);

    const { data: prods } = await supabase.from('kitchen_shift_production').select('produced_item_name,produced_quantity')
        .eq('branch_id', branch_id).gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`);
    const top: Record<string, number> = {};
    (prods || []).forEach((p: any) => { top[p.produced_item_name] = (top[p.produced_item_name] || 0) + n(p.produced_quantity); });
    const sorted = Object.entries(top).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, quantity]) => ({ name, quantity }));

    res.json({
        success: true,
        data: {
            summary: { total: (shifts || []).length, open, closed, approved },
            financials: { revenue: rev, cogs, gross_profit: rev - cogs, spoilage: spoil, variance: varc },
            top_items: sorted
        }
    });
});

export const getKitchenShiftPosConsumption = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    
    // 1. Fetch consumption records
    const { data: consumption, error: consError } = await supabase
        .from('kitchen_shift_pos_consumption')
        .select(`
            *,
            pos_shift:pos_outlet_shifts(
                id,
                shift_number,
                status,
                opened_at,
                closed_at,
                cashier:users!cashier_id(first_name,last_name),
                outlet:pos_outlets(id,name,outlet_type)
            )
        `)
        .eq('shift_id', shift_id)
        .order('created_at', { ascending: false });

    if (consError) throw new AppError(consError.message, 500);

    // Sales recorded here but never issued to this kitchen shift (e.g. a
    // pastry sold before the storekeeper ran "Issue to Kitchen") cannot be
    // deducted from system_closing_stock at close time — flag them so the
    // storekeeper can issue the stock (or investigate) before closing.
    const { data: issuedSkuRows } = await supabase
        .from('kitchen_shift_items')
        .select('item_sku')
        .eq('shift_id', shift_id);
    const issuedSkus = new Set((issuedSkuRows || []).map((r: any) => r.item_sku));

    let unmatchedCount = 0;
    let unmatchedValue = 0;

    // 2. Group by cashier shift (pos_shift_id) to summarize sales per cashier shift
    const shiftsMap = new Map<string, any>();
    for (const item of (consumption || [])) {
        const matched = issuedSkus.has(item.raw_item_sku);
        item.matched_to_shift_stock = matched;
        if (!matched) {
            unmatchedCount += 1;
            unmatchedValue += Number(item.portions_sold || 0) * Number(item.cost_price || 0);
        }

        const ps = item.pos_shift as any;
        if (!ps) continue;
        const psId = ps.id;
        if (!shiftsMap.has(psId)) {
            const first = ps.cashier?.first_name || '';
            const last = ps.cashier?.last_name || '';
            shiftsMap.set(psId, {
                id: psId,
                shift_number: ps.shift_number,
                status: ps.status,
                opened_at: ps.opened_at,
                closed_at: ps.closed_at,
                cashier_name: `${first} ${last}`.trim() || 'Cashier',
                outlet_name: ps.outlet?.name || 'POS Outlet',
                total_portions: 0,
                total_cost: 0,
                unmatched_count: 0,
                items: []
            });
        }
        const grp = shiftsMap.get(psId);
        grp.total_portions += Number(item.portions_sold || 0);
        grp.total_cost += Number(item.portions_sold || 0) * Number(item.cost_price || 0);
        if (!matched) grp.unmatched_count += 1;
        grp.items.push(item);
    }

    res.json({
        success: true,
        data: {
            consumption: consumption || [],
            cashier_shifts: Array.from(shiftsMap.values()),
            unmatched_summary: { count: unmatchedCount, value: Number(unmatchedValue.toFixed(2)) }
        }
    });
});
