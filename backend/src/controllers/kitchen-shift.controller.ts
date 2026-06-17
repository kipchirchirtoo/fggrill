import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const asyncWrap = (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const n = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;

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
export const recordProduction = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { productions } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'open') throw new AppError('Shift not open', 400);

    const results: any[] = [];
    for (const p of productions || []) {
        const { data: raw } = await supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).eq('item_sku', p.raw_item_sku).single();
        if (!raw) throw new AppError(`Raw ${p.raw_item_sku} not in shift`, 400);
        const avail = n(raw.opening_stock) + n(raw.additions) - n(raw.sold_quantity) - n(raw.spoilage_quantity);
        if (n(p.raw_quantity_used) > avail) throw new AppError(`Insufficient ${p.raw_item_name}: ${avail} available`, 400);

        const { data: prod } = await supabase.from('kitchen_shift_production').insert({
            shift_id, branch_id: shift.branch_id, recipe_id: p.recipe_id, food_control_id: p.food_control_id,
            raw_item_sku: p.raw_item_sku, raw_item_name: p.raw_item_name, raw_quantity_used: n(p.raw_quantity_used), raw_unit: p.raw_unit,
            produced_item_name: p.produced_item_name, produced_item_sku: p.produced_item_sku, pos_outlet_item_id: p.pos_outlet_item_id,
            produced_quantity: n(p.produced_quantity), produced_unit: p.produced_unit || 'portion', conversion_ratio: n(p.conversion_ratio),
            conversion_notes: p.conversion_notes, produced_by: userId
        }).select().single();
        results.push(prod);

        await supabase.from('kitchen_shift_items').update({ sold_quantity: n(raw.sold_quantity) + n(p.raw_quantity_used) }).eq('id', raw.id);
        if (p.pos_outlet_item_id) await addToPos(p.pos_outlet_item_id, n(p.produced_quantity));
    }
    res.json({ success: true, data: results });
});

async function addToPos(outletItemId: string, qty: number) {
    const { data: oi } = await supabase.from('pos_outlet_items').select('current_stock').eq('id', outletItemId).single();
    if (oi) await supabase.from('pos_outlet_items').update({ current_stock: n(oi.current_stock) + qty, updated_at: new Date().toISOString() }).eq('id', outletItemId);
}

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
    const { approved, notes } = req.body;
    const userId = (req as any).user?.id;
    const { data: shift } = await supabase.from('kitchen_shifts').select('id,branch_id,status').eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'pending_accountant_review') throw new AppError('Not pending review', 400);
    const next = approved ? 'approved' : 'rejected';
    const { data: upd } = await supabase.from('kitchen_shifts').update({
        status: next, accountant_reviewed_by: userId, accountant_reviewed_at: new Date().toISOString(),
        accountant_approved_by: approved ? userId : null, accountant_approved_at: approved ? new Date().toISOString() : null,
        accountant_rejection_reason: approved ? null : notes, updated_at: new Date().toISOString()
    }).eq('id', shift_id).select().single();
    await supabase.from('kitchen_shift_approvals').insert({ shift_id, branch_id: shift.branch_id, approval_stage: approved ? 'accountant_approved' : 'accountant_rejected', approved_by: userId, notes: notes || `Accountant ${approved ? 'approved' : 'rejected'}` });
    res.json({ success: true, data: upd });
});

// ── GET SHIFT ───────────────────────────────────────────────
export const getKitchenShift = asyncWrap(async (req: Request, res: Response) => {
    const { shift_id } = req.params;
    const { data: shift } = await supabase.from('kitchen_shifts').select(`*, store_keeper:users!store_keeper_id(first_name,last_name)`).eq('id', shift_id).single();
    if (!shift) throw new AppError('Shift not found', 404);
    const [{ data: items }, { data: prods }, { data: st }, { data: aprv }] = await Promise.all([
        supabase.from('kitchen_shift_items').select('*').eq('shift_id', shift_id).order('item_name'),
        supabase.from('kitchen_shift_production').select('*').eq('shift_id', shift_id).order('produced_at', { ascending: false }),
        supabase.from('kitchen_shift_stock_take').select('*').eq('shift_id', shift_id).order('item_name'),
        supabase.from('kitchen_shift_approvals').select('*').eq('shift_id', shift_id).order('approved_at', { ascending: false })
    ]);
    const summary = (items || []).reduce((a: any, it: any) => ({
        opening_value: a.opening_value + n(it.opening_value), additions_value: a.additions_value + n(it.additions_value),
        sold_value: a.sold_value + n(it.sold_value), spoilage_value: a.spoilage_value + n(it.spoilage_value),
        variance_value: a.variance_value + n(it.variance_value), shortage: a.shortage + (n(it.variance) < 0 ? 1 : 0),
        overage: a.overage + (n(it.variance) > 0 ? 1 : 0), ok: a.ok + (n(it.variance) === 0 ? 1 : 0)
    }), { opening_value: 0, additions_value: 0, sold_value: 0, spoilage_value: 0, variance_value: 0, shortage: 0, overage: 0, ok: 0 });
    res.json({ success: true, data: { shift, items: items || [], productions: prods || [], stock_take: st || [], approvals: aprv || [], summary } });
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

// ── RECIPES ─────────────────────────────────────────────────
export const createProductionRecipe = asyncWrap(async (req: Request, res: Response) => {
    const { branch_id, recipe_name, raw_item_sku, raw_item_name, raw_quantity, raw_unit, produced_item_name, produced_item_sku, produced_quantity, produced_unit, pos_outlet_item_id } = req.body;
    const userId = (req as any).user?.id;
    const { data, error } = await supabase.from('kitchen_production_recipes').insert({
        branch_id, recipe_name, raw_item_sku, raw_item_name, raw_quantity: n(raw_quantity), raw_unit,
        produced_item_name, produced_item_sku, produced_quantity: n(produced_quantity), produced_unit: produced_unit || 'portion', pos_outlet_item_id, created_by: userId
    }).select().single();
    if (error) throw new AppError(error.message, 500);
    res.status(201).json({ success: true, data });
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
