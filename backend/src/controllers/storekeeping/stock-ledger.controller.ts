import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

// Daily per-item stock balance ledger (migration
// 20260622_famousgate_major_redesign.sql, section 10) — opening_balance,
// additional_stock (from goods receipts) and issued_stock (from
// branch_stock_movements out-rows) are kept up to date by DB triggers;
// actual_closing/variance are recorded here after a physical count.

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * @desc    List stock balance ledger rows for a branch, optionally
 *          filtered by item and date range.
 * @route   GET /api/storekeeping/stock-ledger?branch_id=&item_id=&from_date=&to_date=
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const getStockLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, item_id, from_date, to_date } = req.query;
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
            .from('stock_balance_ledger')
            .select('*, item:inventory_items(id, item_name, unit)')
            .eq('branch_id', branchId)
            .order('ledger_date', { ascending: false });

        if (item_id) query = query.eq('item_id', String(item_id));
        if (from_date) query = query.gte('ledger_date', String(from_date));
        if (to_date) query = query.lte('ledger_date', String(to_date));

        const { data, error } = await query.limit(500);
        if (error) throw error;

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        logger.error('getStockLedger failed:', error);
        next(error);
    }
};

/**
 * @desc    Record the physically-counted actual closing balance for a
 *          ledger row and compute its variance against the system
 *          closing_balance (opening + additional - issued).
 * @route   PUT /api/storekeeping/stock-ledger/:id/actual-closing
 *          body: { actual_closing: number }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const recordActualClosing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { data: row, error: loadError } = await supabase
            .from('stock_balance_ledger')
            .select('*')
            .eq('id', req.params.id)
            .maybeSingle();
        if (loadError) throw loadError;
        if (!row) {
            res.status(404).json({ success: false, message: 'Ledger row not found' });
            return;
        }

        const actualClosing = num(req.body?.actual_closing);
        const variance = actualClosing - num(row.closing_balance);

        const { data, error } = await supabase
            .from('stock_balance_ledger')
            .update({ actual_closing: actualClosing, variance })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('recordActualClosing failed:', error);
        next(error);
    }
};
