import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { createLedgerEntry } from './stock.controller';

/**
 * Create kitchen requisition
 * POST /api/kitchen/requisitions
 */
export const createRequisition = async (req: Request, res: Response) => {
    try {
        const { items, priority, reason, notes } = req.body;
        const userId = (req as any).user?.id;
        const branchId = (req as any).user?.branch_id;

        if (!branchId) {
            return res.status(400).json({ success: false, message: 'Branch ID is required' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }

        // Create requisition
        const { data: requisition, error: reqError } = await supabase
            .from('kitchen_requisitions')
            .insert({
                branch_id: branchId,
                requested_by: userId,
                status: 'PENDING',
                priority: priority || 'NORMAL',
                reason,
                notes
            })
            .select()
            .single();

        if (reqError) throw reqError;

        // Create requisition items
        const requisitionItems = items.map((item: any) => ({
            requisition_id: requisition.id,
            item_sku: item.item_sku,
            item_name: item.item_name,
            requested_quantity: item.requested_quantity,
            unit_of_measure: item.unit_of_measure,
            notes: item.notes
        }));

        const { error: itemsError } = await supabase
            .from('kitchen_requisition_items')
            .insert(requisitionItems);

        if (itemsError) throw itemsError;

        res.json({ success: true, data: requisition });
    } catch (error: any) {
        console.error('Error creating requisition:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get requisitions
 * GET /api/kitchen/requisitions
 */
export const getRequisitions = async (req: Request, res: Response) => {
    try {
        const { branch_id, status } = req.query;
        const userBranchId = (req as any).user?.branch_id;
        const effectiveBranchId = branch_id || userBranchId;

        if (!effectiveBranchId) {
            return res.status(400).json({ success: false, message: 'Branch ID is required' });
        }

        let query = supabase
            .from('kitchen_requisitions')
            .select(`
        *,
        items:kitchen_requisition_items(*),
        requester:requested_by(first_name, last_name),
        approver:approved_by(first_name, last_name)
      `)
            .eq('branch_id', effectiveBranchId)
            .order('requested_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching requisitions:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get single requisition
 * GET /api/kitchen/requisitions/:id
 */
export const getRequisition = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('kitchen_requisitions')
            .select(`
        *,
        items:kitchen_requisition_items(*),
        requester:requested_by(first_name, last_name),
        approver:approved_by(first_name, last_name)
      `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching requisition:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Approve requisition
 * PUT /api/kitchen/requisitions/:id/approve
 */
export const approveRequisition = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { approved_quantities } = req.body; // Array of { item_id, approved_quantity }
        const userId = (req as any).user?.id;

        // Update requisition status
        const { error: reqError } = await supabase
            .from('kitchen_requisitions')
            .update({
                status: 'APPROVED',
                approved_by: userId,
                approved_at: new Date().toISOString()
            })
            .eq('id', id);

        if (reqError) throw reqError;

        // Update approved quantities for items
        if (approved_quantities && Array.isArray(approved_quantities)) {
            for (const item of approved_quantities) {
                await supabase
                    .from('kitchen_requisition_items')
                    .update({ approved_quantity: item.approved_quantity })
                    .eq('id', item.item_id);
            }
        }

        res.json({ success: true, message: 'Requisition approved' });
    } catch (error: any) {
        console.error('Error approving requisition:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Reject requisition
 * PUT /api/kitchen/requisitions/:id/reject
 */
export const rejectRequisition = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { rejection_reason } = req.body;
        const userId = (req as any).user?.id;

        const { error } = await supabase
            .from('kitchen_requisitions')
            .update({
                status: 'REJECTED',
                rejected_by: userId,
                rejected_at: new Date().toISOString(),
                rejection_reason
            })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Requisition rejected' });
    } catch (error: any) {
        console.error('Error rejecting requisition:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Fulfill requisition (issue stock from store)
 * POST /api/kitchen/requisitions/:id/fulfill
 */
export const fulfillRequisition = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { issued_quantities, notes } = req.body; // Array of { item_id, issued_quantity }
        const userId = (req as any).user?.id;

        // Get requisition details
        const { data: requisition, error: reqError } = await supabase
            .from('kitchen_requisitions')
            .select('*, items:kitchen_requisition_items(*)')
            .eq('id', id)
            .single();

        if (reqError) throw reqError;

        if (requisition.status !== 'APPROVED') {
            return res.status(400).json({ success: false, message: 'Requisition must be approved first' });
        }

        // Create GRN
        const { data: grn, error: grnError } = await supabase
            .from('kitchen_grn')
            .insert({
                branch_id: requisition.branch_id,
                requisition_id: requisition.id,
                issued_by: userId,
                notes
            })
            .select()
            .single();

        if (grnError) throw grnError;

        // Create GRN items and ledger entries
        for (const issuedItem of issued_quantities) {
            const reqItem = requisition.items.find((i: any) => i.id === issuedItem.item_id);
            if (!reqItem) continue;

            // Create ledger entry
            const ledgerEntry = await createLedgerEntry({
                branch_id: requisition.branch_id,
                item_sku: reqItem.item_sku,
                item_name: reqItem.item_name,
                transaction_type: 'RECEIPT',
                reference_type: 'GRN',
                reference_id: grn.grn_number,
                quantity_in: issuedItem.issued_quantity,
                unit_of_measure: reqItem.unit_of_measure,
                user_id: userId,
                notes: `From requisition ${requisition.requisition_number}`
            });

            // Create GRN item
            await supabase
                .from('kitchen_grn_items')
                .insert({
                    grn_id: grn.id,
                    item_sku: reqItem.item_sku,
                    item_name: reqItem.item_name,
                    quantity: issuedItem.issued_quantity,
                    unit_of_measure: reqItem.unit_of_measure,
                    ledger_entry_id: ledgerEntry.id
                });

            // Update requisition item with issued quantity
            await supabase
                .from('kitchen_requisition_items')
                .update({ issued_quantity: issuedItem.issued_quantity })
                .eq('id', issuedItem.item_id);
        }

        // Update requisition status
        await supabase
            .from('kitchen_requisitions')
            .update({ status: 'FULFILLED' })
            .eq('id', id);

        res.json({ success: true, data: grn });
    } catch (error: any) {
        console.error('Error fulfilling requisition:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
