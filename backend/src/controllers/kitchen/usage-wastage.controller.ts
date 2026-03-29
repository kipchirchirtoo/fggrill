import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { createLedgerEntry } from './stock.controller';
import { applyBranchFilter } from '../../utils/branchIsolation';

/**
 * Record manual usage
 * POST /api/kitchen/usage
 */
export const recordUsage = async (req: Request, res: Response) => {
    try {
        const { item_sku, item_name, quantity, unit_of_measure, usage_type, notes, shift } = req.body;
        const userId = (req as any).user?.id;
        const branchId = (req as any).user?.branch_id;

        if (!item_sku || !quantity || !usage_type) {
            return res.status(400).json({ success: false, message: 'Item SKU, quantity, and usage type are required' });
        }

        // Create usage entry
        const { data: usage, error: usageError } = await supabase
            .from('kitchen_usage')
            .insert({
                branch_id: branchId,
                usage_date: new Date().toISOString().split('T')[0],
                usage_type,
                item_sku,
                item_name,
                quantity,
                unit_of_measure,
                shift,
                chef_on_duty: userId,
                status: 'pending_review',
                notes
            })
            .select()
            .single();

        if (usageError) throw usageError;

        // Create ledger entry
        await createLedgerEntry({
            branch_id: branchId,
            item_sku,
            item_name,
            transaction_type: 'USAGE',
            reference_type: 'MANUAL',
            reference_id: usage.id.toString(),
            quantity_out: quantity,
            unit_of_measure,
            shift,
            user_id: userId,
            notes: `${usage_type}: ${notes || ''}`
        });

        res.json({ success: true, data: usage });
    } catch (error: any) {
        console.error('Error recording usage:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get usage entries
 * GET /api/kitchen/usage
 */
export const getUsageEntries = async (req: Request, res: Response) => {
    try {
        const { branch_id, start_date, end_date, usage_type } = req.query;

        let query = supabase
            .from('kitchen_usage')
            .select(`
                *,
                branch:branches(name)
            `)
            .order('created_at', { ascending: false });

        query = applyBranchFilter(query, req);

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (usage_type) {
            query = query.eq('usage_type', usage_type);
        }

        if (start_date) {
            query = query.gte('usage_date', start_date);
        }

        if (end_date) {
            query = query.lte('usage_date', end_date);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching usage entries:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Record wastage
 * POST /api/kitchen/wastage
 */
export const recordWastage = async (req: Request, res: Response) => {
    try {
        const { item_sku, item_name, quantity, unit_of_measure, reason, estimated_value, photo_url, shift } = req.body;
        const userId = (req as any).user?.id;
        const branchId = (req as any).user?.branch_id;

        if (!item_sku || !quantity || !reason) {
            return res.status(400).json({ success: false, message: 'Item SKU, quantity, and reason are required' });
        }

        // Create wastage entry
        const { data: wastage, error: wastageError } = await supabase
            .from('kitchen_wastage')
            .insert({
                branch_id: branchId,
                wastage_date: new Date().toISOString().split('T')[0],
                item_sku,
                item_name,
                quantity,
                unit_of_measure,
                reason,
                estimated_value,
                photo_url,
                shift,
                reported_by: userId,
                status: 'pending_review'
            })
            .select()
            .single();

        if (wastageError) throw wastageError;

        // Create ledger entry
        await createLedgerEntry({
            branch_id: branchId,
            item_sku,
            item_name,
            transaction_type: 'WASTAGE',
            reference_type: 'WASTAGE',
            reference_id: wastage.id.toString(),
            quantity_out: quantity,
            unit_of_measure,
            shift,
            user_id: userId,
            notes: `Wastage: ${reason}`
        });

        res.json({ success: true, data: wastage });
    } catch (error: any) {
        console.error('Error recording wastage:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get wastage records
 * GET /api/kitchen/wastage
 */
export const getWastageRecords = async (req: Request, res: Response) => {
    try {
        const { branch_id, start_date, end_date, reason } = req.query;

        let query = supabase
            .from('kitchen_wastage')
            .select(`
                *,
                branch:branches(name)
            `)
            .order('created_at', { ascending: false });

        query = applyBranchFilter(query, req);

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (reason) {
            query = query.eq('reason', reason);
        }

        if (start_date) {
            query = query.gte('wastage_date', start_date);
        }

        if (end_date) {
            query = query.lte('wastage_date', end_date);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching wastage records:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update wastage record
 * PUT /api/kitchen/wastage/:id
 */
export const updateWastage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { quantity, reason, estimated_value, photo_url } = req.body;

        const { error } = await supabase
            .from('kitchen_wastage')
            .update({ quantity, reason, estimated_value, photo_url })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Wastage record updated' });
    } catch (error: any) {
        console.error('Error updating wastage:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete wastage record
 * DELETE /api/kitchen/wastage/:id
 */
export const deleteWastage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('kitchen_wastage')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Wastage record deleted' });
    } catch (error: any) {
        console.error('Error deleting wastage:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Review wastage record (Branch Accountant)
 * PUT /api/kitchen/wastage/:id/review
 */
export const reviewWastage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        const { data, error } = await supabase
            .from('kitchen_wastage')
            .update({
                status: 'reviewed',
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                review_notes: notes
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error reviewing wastage:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Audit wastage record (Auditor)
 * PUT /api/kitchen/wastage/:id/audit
 */
export const auditWastage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body; // status should be 'approved' or 'rejected'
        const userId = (req as any).user?.id;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status. Must be approved or rejected' });
        }

        const { data, error } = await supabase
            .from('kitchen_wastage')
            .update({
                status,
                auditor_id: userId,
                audited_at: new Date().toISOString(),
                review_notes: notes
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error auditing wastage:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Review usage record (Branch Accountant)
 * PUT /api/kitchen/usage/:id/review
 */
export const reviewUsage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = (req as any).user?.id;

        const { data, error } = await supabase
            .from('kitchen_usage')
            .update({
                status: 'reviewed',
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                review_notes: notes
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error reviewing usage:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Audit usage record (Auditor)
 * PUT /api/kitchen/usage/:id/audit
 */
export const auditUsage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body; // status should be 'approved' or 'rejected'
        const userId = (req as any).user?.id;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status. Must be approved or rejected' });
        }

        const { data, error } = await supabase
            .from('kitchen_usage')
            .update({
                status,
                auditor_id: userId,
                audited_at: new Date().toISOString(),
                review_notes: notes
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error auditing usage:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
