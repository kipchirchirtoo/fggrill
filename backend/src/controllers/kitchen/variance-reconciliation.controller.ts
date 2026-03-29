import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { applyBranchFilter } from '../../utils/branchIsolation';

/**
 * Get all variance reasons
 * GET /api/kitchen/variance-reasons
 */
export const getVarianceReasons = async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('kitchen_variance_reasons')
            .select('*')
            .eq('is_active', true)
            .order('reason');

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching variance reasons:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get daily variance records
 * GET /api/kitchen/variance
 */
export const getDailyVariance = async (req: Request, res: Response) => {
    try {
        const { branch_id, date, item_sku } = req.query;

        let query = supabase
            .from('kitchen_daily_variance')
            .select(`
                *,
                reason:kitchen_variance_reasons(reason, requires_approval),
                approver:users!approved_by(first_name, last_name)
            `);

        query = applyBranchFilter(query, req);

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (date) {
            query = query.eq('variance_date', date);
        }

        if (item_sku) {
            query = query.eq('item_sku', item_sku);
        }

        const { data, error } = await query.order('variance_date', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching daily variance:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Submit reason for variance
 * POST /api/kitchen/variance/:id/reason
 */
export const submitVarianceReason = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason_id, notes } = req.body;

        const { data: variance, error: fetchError } = await supabase
            .from('kitchen_daily_variance')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !variance) {
            return res.status(404).json({ success: false, message: 'Variance record not found' });
        }

        if (variance.is_locked) {
            return res.status(400).json({ success: false, message: 'This record is locked and cannot be modified' });
        }

        const { error } = await supabase
            .from('kitchen_daily_variance')
            .update({
                reason_id,
                notes,
                cost_value: (variance.variance || 0) * (variance.item_cost || 0),
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Variance reason submitted' });
    } catch (error: any) {
        console.error('Error submitting variance reason:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Approve variance
 * POST /api/kitchen/variance/:id/approve
 */
export const approveVariance = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body; // status: 'approved' | 'rejected'
        const userId = (req as any).user?.id;

        const { data: variance, error: fetchError } = await supabase
            .from('kitchen_daily_variance')
            .select(`
                *,
                reason:kitchen_variance_reasons(*)
            `)
            .eq('id', id)
            .single();

        if (fetchError || !variance) {
            return res.status(404).json({ success: false, message: 'Variance record not found' });
        }

        const updateData: any = {
            approval_notes: notes,
            updated_at: new Date().toISOString()
        };

        if (status === 'approved') {
            updateData.approved_by = userId;
            updateData.approved_at = new Date().toISOString();
            updateData.is_locked = true;
        } else {
            // If rejected, clear the reason to force re-submission?
            updateData.reason_id = null;
        }

        const { error } = await supabase
            .from('kitchen_daily_variance')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: `Variance ${status} successfully` });
    } catch (error: any) {
        console.error('Error approving variance:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Kitchen Portion Stock
 * GET /api/kitchen/portion-stock
 */
export const getPortionStock = async (req: Request, res: Response) => {
    try {
        const { branch_id } = req.query;

        let query = supabase
            .from('kitchen_portion_stock')
            .select('*')
            .order('portion_name');

        query = applyBranchFilter(query, req);

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching portion stock:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Portion Ledger
 * GET /api/kitchen/portion-ledger
 */
export const getPortionLedger = async (req: Request, res: Response) => {
    try {
        const { branch_id, item_sku } = req.query;

        let query = supabase
            .from('kitchen_portion_ledger')
            .select('*');

        query = applyBranchFilter(query, req);

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (item_sku) {
            query = query.eq('item_sku', item_sku);
        }

        const { data, error } = await query.order('transaction_date', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching portion ledger:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
