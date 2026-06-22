import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

// Bar stocktake (migration 20260622_kitchen_storekeeper_integration.sql,
// section 4) — storekeeper records physical counts for main_bar/executive_bar
// against the system quantity from stock_balance_ledger; the branch
// accountant reviews/approves/rejects.

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const BAR_LOCATIONS = ['main_bar', 'executive_bar'];

const loadRecord = async (id: string): Promise<Record<string, any> | null> => {
    const { data, error } = await supabase
        .from('bar_stocktake_records')
        .select('*, item:inventory_items(id, name, unit)')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data || null;
};

const systemQuantityFor = async (branchId: number, itemId: string, date: string): Promise<number> => {
    const { data } = await supabase
        .from('stock_balance_ledger')
        .select('closing_balance')
        .eq('branch_id', branchId)
        .eq('item_id', itemId)
        .lte('ledger_date', date)
        .order('ledger_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    return num(data?.closing_balance);
};

/**
 * @desc    List bar stocktake records for a branch/date.
 * @route   GET /api/storekeeping/bar-stocktake?branch_id=&bar_location=&date=&status=
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const listBarStocktakes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, bar_location, date, status } = req.query;
        if (!branch_id) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }

        let query = supabase
            .from('bar_stocktake_records')
            .select('*, item:inventory_items(id, name, unit)')
            .eq('branch_id', branchId)
            .order('stocktake_date', { ascending: false });

        query = query.eq('stocktake_date', (date as string) || new Date().toISOString().split('T')[0]);
        if (bar_location) query = query.eq('bar_location', bar_location as string);
        if (status) query = query.eq('status', status as string);

        const { data, error } = await query.limit(500);
        if (error) throw error;

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        logger.error('listBarStocktakes failed:', error);
        next(error);
    }
};

/**
 * @desc    Record physical counts for a bar stocktake. System quantity is
 *          read from stock_balance_ledger for each item/branch/date.
 * @route   POST /api/storekeeping/bar-stocktake
 *          body: { branch_id, bar_location, stocktake_date?, items: [{ item_id, physical_quantity }] }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const recordBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, bar_location, items } = req.body || {};
        const stocktakeDate = req.body?.stocktake_date || new Date().toISOString().split('T')[0];
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }
        if (!BAR_LOCATIONS.includes(bar_location)) {
            res.status(400).json({ success: false, message: `bar_location must be one of ${BAR_LOCATIONS.join(', ')}` });
            return;
        }
        if (!Array.isArray(items) || !items.length) {
            res.status(400).json({ success: false, message: 'items must be a non-empty array' });
            return;
        }

        const now = new Date().toISOString();
        const rows = await Promise.all(items.map(async (it: any) => ({
            branch_id: branchId,
            bar_location,
            stocktake_date: stocktakeDate,
            shift_id: req.body?.shift_id || null,
            item_id: String(it.item_id),
            system_quantity: await systemQuantityFor(branchId, String(it.item_id), stocktakeDate),
            physical_quantity: num(it.physical_quantity),
            recorded_by: req.user?.id || null,
            recorded_at: now,
            status: 'pending'
        })));

        const { data, error } = await supabase
            .from('bar_stocktake_records')
            .upsert(rows, { onConflict: 'branch_id,bar_location,stocktake_date,item_id' })
            .select('*, item:inventory_items(id, name, unit)');
        if (error) throw error;

        res.status(201).json({ success: true, data: data || [] });
    } catch (error) {
        logger.error('recordBarStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant marks a bar stocktake record reviewed.
 * @route   PATCH /api/storekeeping/bar-stocktake/:id/review
 *          body: { notes? }
 * @access  Branch Accountant, Super Admin
 */
export const reviewBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadRecord(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Stocktake record not found' });
            return;
        }
        if (existing.status !== 'pending') {
            res.status(400).json({ success: false, message: `Cannot review a record that is ${existing.status}` });
            return;
        }

        const { data, error } = await supabase
            .from('bar_stocktake_records')
            .update({
                status: 'reviewed',
                reviewed_by: req.user?.id || null,
                reviewed_at: new Date().toISOString(),
                notes: req.body?.notes ?? existing.notes
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, name, unit)')
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('reviewBarStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant approves a bar stocktake record. Writes the physical
 *          count back into stock_balance_ledger as actual_closing/variance
 *          (feeding the get_branch_profit_loss() bar_stock_variance line —
 *          see migration 20260622_kitchen_storekeeper_integration.sql).
 * @route   PATCH /api/storekeeping/bar-stocktake/:id/approve
 * @access  Branch Accountant, Super Admin
 */
export const approveBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadRecord(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Stocktake record not found' });
            return;
        }
        if (!['pending', 'reviewed'].includes(existing.status)) {
            res.status(400).json({ success: false, message: `Cannot approve a record that is ${existing.status}` });
            return;
        }

        const { data, error } = await supabase
            .from('bar_stocktake_records')
            .update({
                status: 'approved',
                reviewed_by: existing.reviewed_by || req.user?.id || null,
                reviewed_at: existing.reviewed_at || new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, name, unit)')
            .single();
        if (error) throw error;

        // Best-effort: sync the ledger row for this item/branch/date with the
        // approved physical count, so future ledger reads reflect reality.
        await supabase
            .from('stock_balance_ledger')
            .update({ actual_closing: num(existing.physical_quantity), variance: num(existing.variance) })
            .eq('branch_id', existing.branch_id)
            .eq('item_id', existing.item_id)
            .eq('ledger_date', existing.stocktake_date);

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('approveBarStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant rejects a bar stocktake record — requires notes.
 * @route   PATCH /api/storekeeping/bar-stocktake/:id/reject
 *          body: { notes }
 * @access  Branch Accountant, Super Admin
 */
export const rejectBarStocktake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadRecord(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Stocktake record not found' });
            return;
        }
        if (!String(req.body?.notes || '').trim()) {
            res.status(400).json({ success: false, message: 'notes are required when rejecting a stocktake record' });
            return;
        }
        if (['approved', 'rejected'].includes(existing.status)) {
            res.status(400).json({ success: false, message: `Cannot reject a record that is ${existing.status}` });
            return;
        }

        const { data, error } = await supabase
            .from('bar_stocktake_records')
            .update({
                status: 'rejected',
                reviewed_by: req.user?.id || null,
                reviewed_at: new Date().toISOString(),
                notes: req.body.notes
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, name, unit)')
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('rejectBarStocktake failed:', error);
        next(error);
    }
};

/**
 * @desc    Daily bar variance summary (total variance value per bar/day) —
 *          used by the accountant P&L view.
 * @route   GET /api/storekeeping/bar-stocktake/summary?branch_id=&from_date=&to_date=
 * @access  Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const getBarStocktakeSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;
        if (!branch_id) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }

        let query = supabase
            .from('bar_stocktake_records')
            .select('bar_location, stocktake_date, variance, status, item:inventory_items(unit_cost)')
            .eq('branch_id', branchId)
            .eq('status', 'approved');
        if (from_date) query = query.gte('stocktake_date', String(from_date));
        if (to_date) query = query.lte('stocktake_date', String(to_date));

        const { data, error } = await query.limit(2000);
        if (error) throw error;

        const byBarDate = new Map<string, { bar_location: string; date: string; variance_value: number }>();
        (data || []).forEach((row: any) => {
            const key = `${row.bar_location}|${row.stocktake_date}`;
            const unitCost = num(row.item?.unit_cost);
            const entry = byBarDate.get(key) || { bar_location: row.bar_location, date: row.stocktake_date, variance_value: 0 };
            entry.variance_value += num(row.variance) * unitCost;
            byBarDate.set(key, entry);
        });

        res.status(200).json({ success: true, data: Array.from(byBarDate.values()) });
    } catch (error) {
        logger.error('getBarStocktakeSummary failed:', error);
        next(error);
    }
};
