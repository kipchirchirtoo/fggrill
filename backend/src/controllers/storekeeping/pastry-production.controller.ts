import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

// Pastry production log (migration 20260622_famousgate_major_redesign.sql,
// section 12) — tracks pastry items baked in-house and their issuance to
// the kitchen for sale/use, separate from goods-receipt-based stock.

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * @desc    List pastry production log entries for a branch.
 * @route   GET /api/storekeeping/pastry-production?branch_id=&from_date=&to_date=&issued_to_kitchen=
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const listPastryProduction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, from_date, to_date, issued_to_kitchen } = req.query;
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
            .from('pastry_production_log')
            .select('*, item:inventory_items(id, sku, item_name, unit)')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });

        if (from_date) query = query.gte('created_at', `${from_date}T00:00:00`);
        if (to_date) query = query.lte('created_at', `${to_date}T23:59:59`);
        if (issued_to_kitchen === 'true' || issued_to_kitchen === 'false') {
            query = query.eq('issued_to_kitchen', issued_to_kitchen === 'true');
        }

        const { data, error } = await query.limit(500);
        if (error) throw error;

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        logger.error('listPastryProduction failed:', error);
        next(error);
    }
};

/**
 * @desc    Record a pastry production batch. Logging production doesn't need
 *          a shift — that's only chosen when the batch is later issued to a
 *          specific open Kitchen Shift.
 * @route   POST /api/storekeeping/pastry-production
 *          body: { branch_id, item_id, quantity_produced }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const recordPastryProduction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, item_id, quantity_produced } = req.body || {};
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }
        if (!item_id) {
            res.status(400).json({ success: false, message: 'item_id is required' });
            return;
        }
        const qty = num(quantity_produced);
        if (qty <= 0) {
            res.status(400).json({ success: false, message: 'quantity_produced must be greater than zero' });
            return;
        }

        const { data, error } = await supabase
            .from('pastry_production_log')
            .insert({
                branch_id: branchId,
                item_id: String(item_id),
                quantity_produced: qty,
                produced_by: req.user?.id || null,
            })
            .select('*, item:inventory_items(id, sku, item_name, unit)')
            .single();
        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        logger.error('recordPastryProduction failed:', error);
        next(error);
    }
};

/**
 * @desc    Issue a previously produced pastry batch to an open Kitchen
 *          Shift. This is the point where the batch becomes real, visible
 *          stock — it's added into that shift's kitchen_shift_items ledger
 *          (as an "additions" entry), the same ledger Kitchen Sessions
 *          already tracks raw/produced stock in.
 * @route   PUT /api/storekeeping/pastry-production/:id/issue
 *          body: { shift_id, issued_quantity }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const issuePastryToKitchen = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { data: existing, error: loadError } = await supabase
            .from('pastry_production_log')
            .select('*, item:inventory_items(id, sku, item_name, unit)')
            .eq('id', req.params.id)
            .maybeSingle();
        if (loadError) throw loadError;
        if (!existing) {
            res.status(404).json({ success: false, message: 'Pastry production entry not found' });
            return;
        }
        if (existing.issued_to_kitchen) {
            res.status(400).json({ success: false, message: 'Batch already issued to kitchen' });
            return;
        }

        const shiftId = req.body?.shift_id;
        if (!shiftId) {
            res.status(400).json({ success: false, message: 'shift_id is required — pick the open Kitchen Shift receiving this batch' });
            return;
        }

        const { data: shift, error: shiftError } = await supabase
            .from('kitchen_shifts')
            .select('id, branch_id, status')
            .eq('id', shiftId)
            .maybeSingle();
        if (shiftError) throw shiftError;
        if (!shift) {
            res.status(404).json({ success: false, message: 'Kitchen shift not found' });
            return;
        }
        if (Number(shift.branch_id) !== Number(existing.branch_id)) {
            res.status(400).json({ success: false, message: 'Kitchen shift belongs to a different branch' });
            return;
        }
        if (shift.status !== 'open') {
            res.status(400).json({ success: false, message: 'Kitchen shift is not open' });
            return;
        }

        const issuedQuantity = num(req.body?.issued_quantity ?? existing.quantity_produced);
        if (issuedQuantity <= 0 || issuedQuantity > num(existing.quantity_produced)) {
            res.status(400).json({ success: false, message: 'issued_quantity must be between 0 and quantity_produced' });
            return;
        }

        const itemSku = String(existing.item?.sku ?? existing.item_id);
        const itemName = existing.item?.item_name || itemSku;
        const { data: shiftItem, error: shiftItemError } = await supabase
            .from('kitchen_shift_items')
            .select('*')
            .eq('shift_id', shiftId)
            .eq('item_sku', itemSku)
            .maybeSingle();
        if (shiftItemError) throw shiftItemError;

        if (shiftItem) {
            const { error: updateError } = await supabase
                .from('kitchen_shift_items')
                .update({ additions: num(shiftItem.additions) + issuedQuantity, updated_at: new Date().toISOString() })
                .eq('id', shiftItem.id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase
                .from('kitchen_shift_items')
                .insert({
                    shift_id: shiftId,
                    branch_id: shift.branch_id,
                    item_sku: itemSku,
                    item_name: itemName,
                    unit_of_measure: existing.item?.unit || 'units',
                    cost_price: 0,
                    opening_stock: 0,
                    additions: issuedQuantity,
                    sold_quantity: 0,
                    spoilage_quantity: 0,
                });
            if (insertError) throw insertError;
        }

        const { data, error } = await supabase
            .from('pastry_production_log')
            .update({
                shift_id: shiftId,
                issued_to_kitchen: true,
                issued_quantity: issuedQuantity,
                issued_at: new Date().toISOString(),
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, sku, item_name, unit)')
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('issuePastryToKitchen failed:', error);
        next(error);
    }
};
