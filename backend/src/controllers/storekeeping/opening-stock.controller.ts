import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

// Opening stock gate (migration 20260622_famousgate_major_redesign.sql,
// section 9) — before a cashier_shifts row can be treated as fully opened,
// each of these three physical stock locations must submit its opening
// count for the shift.
const STOCK_LOCATIONS = ['branch_store', 'main_bar', 'executive_bar'] as const;
type StockLocation = typeof STOCK_LOCATIONS[number];

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const loadShift = async (shiftId: string): Promise<{ id: string; branch_id: number } | null> => {
    const { data, error } = await supabase
        .from('cashier_shifts')
        .select('id, branch_id')
        .eq('id', shiftId)
        .maybeSingle();
    if (error) throw error;
    return data || null;
};

/**
 * @desc    Opening stock gate status for a shift — per-location completion
 *          flags and the submitted item counts.
 * @route   GET /api/storekeeping/opening-stock/:shiftId
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const getOpeningStockStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const shift = await loadShift(req.params.shiftId);
        if (!shift) {
            res.status(404).json({ success: false, message: 'Shift not found' });
            return;
        }

        const [{ data: status, error: statusErr }, { data: items, error: itemsErr }] = await Promise.all([
            supabase.from('shift_opening_stock_status').select('*').eq('shift_id', shift.id).maybeSingle(),
            supabase.from('shift_opening_stock').select('*').eq('shift_id', shift.id).order('stock_location', { ascending: true }),
        ]);
        if (statusErr) throw statusErr;
        if (itemsErr) throw itemsErr;

        const { data: gateOpen } = await supabase.rpc('check_opening_stock_complete', { p_shift_id: shift.id });

        res.status(200).json({
            success: true,
            data: {
                shift_id: shift.id,
                branch_id: shift.branch_id,
                gate_open: !!gateOpen,
                status: status || { branch_store_complete: false, main_bar_complete: false, executive_bar_complete: false },
                items: items || [],
            },
        });
    } catch (error) {
        logger.error('getOpeningStockStatus failed:', error);
        next(error);
    }
};

/**
 * @desc    Submit opening stock counts for one location of a shift. Marks
 *          that location complete; once all three locations are complete
 *          the opening-stock gate opens (check_opening_stock_complete()).
 * @route   POST /api/storekeeping/opening-stock/:shiftId
 *          body: { stock_location: 'branch_store'|'main_bar'|'executive_bar',
 *                  items: [{ item_id: uuid, system_quantity, actual_quantity }] }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const submitOpeningStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const shift = await loadShift(req.params.shiftId);
        if (!shift) {
            res.status(404).json({ success: false, message: 'Shift not found' });
            return;
        }

        const { stock_location, items } = req.body || {};
        if (!STOCK_LOCATIONS.includes(stock_location)) {
            res.status(400).json({ success: false, message: `stock_location must be one of ${STOCK_LOCATIONS.join(', ')}` });
            return;
        }
        if (!Array.isArray(items) || !items.length) {
            res.status(400).json({ success: false, message: 'items must be a non-empty array' });
            return;
        }

        const now = new Date().toISOString();
        const rows = items.map((it: any) => ({
            shift_id: shift.id,
            branch_id: Number(shift.branch_id),
            stock_location,
            item_id: String(it.item_id),
            system_quantity: num(it.system_quantity),
            actual_quantity: num(it.actual_quantity),
            submitted_by: req.user?.id || null,
            submitted_at: now,
        }));

        const { data: savedItems, error: upsertErr } = await supabase
            .from('shift_opening_stock')
            .upsert(rows, { onConflict: 'shift_id,stock_location,item_id' })
            .select();
        if (upsertErr) throw upsertErr;

        const location = stock_location as StockLocation;
        const completeColumn = `${location}_complete`;
        const { data: existingStatus } = await supabase
            .from('shift_opening_stock_status')
            .select('*')
            .eq('shift_id', shift.id)
            .maybeSingle();

        const nextStatus = {
            shift_id: shift.id,
            branch_id: Number(shift.branch_id),
            branch_store_complete: existingStatus?.branch_store_complete || false,
            main_bar_complete: existingStatus?.main_bar_complete || false,
            executive_bar_complete: existingStatus?.executive_bar_complete || false,
            [completeColumn]: true,
        } as Record<string, any>;
        // Only Kyogong (branch 1) has a separate Executive Bar outlet — every
        // other branch has just one bar, so it can never submit an
        // executive_bar count and must not be required to.
        const requiresExecutiveBar = Number(shift.branch_id) === 1;
        const allComplete = nextStatus.branch_store_complete
            && nextStatus.main_bar_complete
            && (!requiresExecutiveBar || nextStatus.executive_bar_complete);
        if (allComplete) nextStatus.completed_at = now;

        const { data: statusRow, error: statusErr } = await supabase
            .from('shift_opening_stock_status')
            .upsert(nextStatus, { onConflict: 'shift_id' })
            .select()
            .single();
        if (statusErr) throw statusErr;

        res.status(201).json({
            success: true,
            data: { items: savedItems || [], status: statusRow, gate_open: allComplete },
        });
    } catch (error) {
        logger.error('submitOpeningStock failed:', error);
        next(error);
    }
};
