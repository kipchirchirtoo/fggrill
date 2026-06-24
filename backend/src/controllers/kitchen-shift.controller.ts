import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { creditOutletItemStock, updateBranchStock } from '../services/branch-inventory.service';

const asyncWrap = (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const n = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;
const absMoney = (v: any) => Math.abs(n(v));

async function resolveStaffProfileId(value: any): Promise<string | null> {
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

async function staffProfileSummaries(userIds: string[]) {
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

// ── OPEN SHIFT ──────────────────────────────────────────────
export const openKitchenShift = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, shift_type, shift_date, opening_items, assigned_chef_ids } = req.body;
    const userId = (req as any).user?.id;
    if (!branch_id || !shift_type || !opening_items) throw new AppError('branch_id, shift_type, opening_items required', 400);

    const { data: sn } = await supabase.rpc('generate_kitchen_shift_number', {
        p_branch_id: branch_id, p_date: shift_date || new Date().toISOString().split('T')[0]
    });
    const { data: shift, error: e1 } = await supabase.from('kitchen_shifts').insert({
        shift_number: sn || `KS-${Date.now()}`, branch_id, shift_type: shift_type.toLowerCase(),
        shift_date: shift_date || new Date().toISOString().split('T')[0],
        opened_by: userId, store_keeper_id: userId, assigned_chef_ids: assigned_chef_ids || [], status: 'open'
    }).select().single();
    if (e1) throw new AppError(e1.message, 500);

    // Opening a shift with stock is a real issue from branch store to the
    // kitchen line — debit branch-wide stock the same way Outlet Production
    // already does for raw consumption, so the two systems stay consistent
    // instead of the shift's opening_stock being an arbitrary self-reported
    // number with no link to actual branch stock.
    for (const it of opening_items) {
        if (n(it.quantity) > 0) {
            await updateBranchStock(
                Number(branch_id), it.sku, -n(it.quantity), 'KITCHEN_SHIFT_OPEN', userId,
                'kitchen_shift', shift.id, shift.shift_number,
                `Kitchen shift ${shift.shift_number} opened with ${it.name || it.sku}`
            );
        }
    }

    const items = opening_items.map((it: any) => ({
        shift_id: shift.id, branch_id, item_sku: it.sku, item_name: it.name,
        unit_of_measure: it.unit, cost_price: n(it.cost_price), opening_stock: n(it.quantity), additions: 0, sold_quantity: 0, spoilage_quantity: 0
    }));
    const { error: e2 } = await supabase.from('kitchen_shift_items').insert(items);
    if (e2) logger.error('shift items insert', e2);
    res.status(201).json({ success: true, data: shift });
});

// ── ADD STOCK ───────────────────────────────────────────────
export const addShiftStock = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { items } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'open') throw new AppError('Shift not open', 400);

    const results: any[] = [];
    for (const it of items || []) {
        if (n(it.quantity) > 0) {
            await updateBranchStock(
                Number(shift.branch_id), it.sku, -n(it.quantity), 'KITCHEN_SHIFT_ADD_STOCK', userId,
                'kitchen_shift', shift_id, undefined,
                `Added to kitchen shift ${shift_id} mid-shift: ${it.name || it.sku}`
            );
        }
        const { data: ex } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', it.sku).maybeSingle();
        if (ex) {
            const { data: upd } = await supabase.from('kitchen_shift_items').update({
                additions: n(ex.additions) + n(it.quantity), updated_at: new Date().toISOString()
            }).eq('id', ex.id).select().single();
            results.push(upd);
        } else {
            const { data: cr } = await supabase.from('kitchen_shift_items').insert({
                shift_id, branch_id: shift.branch_id, item_sku: it.sku, item_name: it.name,
                unit_of_measure: it.unit, cost_price: n(it.cost_price), opening_stock: 0, additions: n(it.quantity), sold_quantity: 0, spoilage_quantity: 0
            }).select().single();
            results.push(cr);
        }
    }
    res.json({ success: true, data: results });
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
    const { physical_counts, closing_notes } = req.body;
    const userId = (req as any).user?.id;
    if (!physical_counts) throw new AppError('physical_counts required', 400);

    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status,shift_date,opened_at').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'open') throw new AppError('Shift must be open', 400);

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

    const { data: closed } = await supabase.from('kitchen_shifts').update({
        status: 'closed', closed_at: new Date().toISOString(), total_revenue: revenue, total_cogs: cogs,
        total_spoilage_cost: spoilageCost, total_variance_cost: varianceCost, closing_notes, updated_at: new Date().toISOString()
    }).eq('id', shift_id).select().single();

    res.json({ success: true, data: { shift: closed, stock_take: records, summary: { revenue, cogs, spoilage_cost: spoilageCost, variance_cost: varianceCost } } });
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
    const { branch_id, status, shift_type } = req.query;
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

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: data || [] });
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
    if (!branch_id || !raw_item_sku || !raw_item_name || !raw_quantity || !raw_unit || !produced_item_name || !produced_quantity) {
        throw new AppError('branch_id, raw item, raw quantity, produced item, and yield are required', 400);
    }
    const { data, error } = await supabase.from('kitchen_production_recipes').insert({
        branch_id, recipe_name, raw_item_sku, raw_item_name, raw_quantity: n(raw_quantity), raw_unit,
        produced_item_name, produced_item_sku, produced_quantity: n(produced_quantity), produced_unit: produced_unit || 'portion',
        pos_outlet_item_id: pos_outlet_item_id || null,
        allowed_variance_percent: n(allowed_variance_percent || 2),
        spoilage_threshold_percent: n(spoilage_threshold_percent || 1),
        cost_per_output: n(cost_per_output),
        requires_yield_confirmation: requires_yield_confirmation !== false,
        created_by: userId
    }).select().single();
    if (error) throw new AppError(error.message, 500);
    await applyPoolLink(pos_outlet_item_id, pool_item_id, pool_fraction);
    res.status(201).json({ success: true, data });
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
