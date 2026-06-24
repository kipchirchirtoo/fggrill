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
            .select('*, item:inventory_items(id, item_name, unit)')
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
 * @desc    Record a pastry production batch.
 * @route   POST /api/storekeeping/pastry-production
 *          body: { branch_id, shift_id?, item_id, quantity_produced }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const recordPastryProduction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, shift_id, item_id, quantity_produced } = req.body || {};
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
                shift_id: shift_id || null,
                item_id: String(item_id),
                quantity_produced: qty,
                produced_by: req.user?.id || null,
            })
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        logger.error('recordPastryProduction failed:', error);
        next(error);
    }
};

/**
 * @desc    Issue a previously produced pastry batch to the kitchen.
 * @route   PUT /api/storekeeping/pastry-production/:id/issue
 *          body: { issued_quantity }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const issuePastryToKitchen = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { data: existing, error: loadError } = await supabase
            .from('pastry_production_log')
            .select('*')
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

        const issuedQuantity = num(req.body?.issued_quantity ?? existing.quantity_produced);
        if (issuedQuantity <= 0 || issuedQuantity > num(existing.quantity_produced)) {
            res.status(400).json({ success: false, message: 'issued_quantity must be between 0 and quantity_produced' });
            return;
        }

        const { data, error } = await supabase
            .from('pastry_production_log')
            .update({
                issued_to_kitchen: true,
                issued_quantity: issuedQuantity,
                issued_at: new Date().toISOString(),
            })
            .eq('id', req.params.id)
            .select('*, item:inventory_items(id, item_name, unit)')
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('issuePastryToKitchen failed:', error);
        next(error);
    }
};
