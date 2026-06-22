import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

// Non-sale stock-out / operational expense tracking (migration
// 20260622_famousgate_major_redesign.sql, section 13) — branch_stock_movements
// rows for items where inventory_items.is_for_sale = false (e.g. cleaning
// supplies, office stationery) are auto-flagged is_operational_expense=true
// with a computed line_cost by fn_flag_operational_expense(). This surfaces
// that flagged set as its own report, separate from regular sale-item COGS.

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * @desc    List non-sale stock-out movements flagged as operational
 *          expenses for a branch over a date range.
 * @route   GET /api/storekeeping/non-sale-stock-out?branch_id=&from_date=&to_date=
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const listNonSaleStockOut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
            .from('branch_stock_movements')
            .select('*')
            .eq('branch_id', branchId)
            .eq('is_operational_expense', true)
            .order('created_at', { ascending: false });

        if (from_date) query = query.gte('created_at', `${from_date}T00:00:00`);
        if (to_date) query = query.lte('created_at', `${to_date}T23:59:59`);

        const { data, error } = await query.limit(500);
        if (error) throw error;

        const totalCost = (data || []).reduce((s, row: any) => s + num(row.line_cost), 0);

        res.status(200).json({
            success: true,
            data: data || [],
            summary: { count: (data || []).length, total_cost: totalCost },
        });
    } catch (error) {
        logger.error('listNonSaleStockOut failed:', error);
        next(error);
    }
};

/**
 * @desc    Manual correction — flag or unflag a stock movement as a
 *          non-sale operational expense (for cases the automatic
 *          is_for_sale-based trigger doesn't catch).
 * @route   PUT /api/storekeeping/non-sale-stock-out/:id
 *          body: { is_operational_expense: boolean, line_cost?: number }
 * @access  Branch Manager, Branch Accountant, Super Admin
 */
export const setOperationalExpenseFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { is_operational_expense, line_cost } = req.body || {};
        if (typeof is_operational_expense !== 'boolean') {
            res.status(400).json({ success: false, message: 'is_operational_expense must be a boolean' });
            return;
        }

        const update: Record<string, any> = { is_operational_expense };
        if (line_cost !== undefined) update.line_cost = num(line_cost);

        const { data, error } = await supabase
            .from('branch_stock_movements')
            .update(update)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('setOperationalExpenseFlag failed:', error);
        next(error);
    }
};
