import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Create a new stock request
// @route   POST /api/stock-requests
// @access  Private (Branch Manager)
export const createRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, items, notes } = req.body;
        const userId = (req as any).user?.id;

        // Start transaction (simulated with sequential inserts as Supabase doesn't support multi-table transactions via client easily without stored procedures)
        // 1. Create Request Header
        const { data: request, error: requestError } = await supabase
            .from('stock_requests')
            .insert({
                branch_id,
                requested_by: userId,
                status: 'pending',
                notes,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (requestError) throw requestError;

        // 2. Create Request Items
        if (items && items.length > 0) {
            const requestItems = items.map((item: any) => ({
                request_id: request.id,
                item_id: item.item_id,
                quantity_requested: item.quantity,
                created_at: new Date().toISOString()
            }));

            const { error: itemsError } = await supabase
                .from('stock_request_items')
                .insert(requestItems);

            if (itemsError) {
                // Rollback header (best effort)
                await supabase.from('stock_requests').delete().eq('id', request.id);
                throw itemsError;
            }
        }

        res.status(201).json({ success: true, data: request });
        logger.info(`Stock request created: ${request.id} by user ${userId}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all stock requests
// @route   GET /api/stock-requests
// @access  Private (Auditor, Manager)
export const getRequests = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, status, start_date, end_date } = req.query;

        let query = supabase
            .from('stock_requests')
            .select(`
        *,
        branch:branches(id, name),
        requester:users!requested_by(id, first_name, last_name),
        approver:users!approved_by(id, first_name, last_name),
        items:stock_request_items(
          *,
          item:inventory_items(id, name, sku, unit)
        )
      `)
            .order('created_at', { ascending: false });

        if (branch_id) query = query.eq('branch_id', branch_id);
        if (status) query = query.eq('status', status);
        if (start_date) query = query.gte('created_at', start_date);
        if (end_date) query = query.lte('created_at', end_date);

        const { data, error } = await query;
        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve stock request
// @route   PUT /api/stock-requests/:id/approve
// @access  Private (Auditor, Central Storekeeper)
export const approveRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { items, notes } = req.body; // items: [{ id: 'item_row_id', quantity_approved: 10 }]
        const userId = (req as any).user?.id;

        // 1. Update items with approved quantities
        if (items && items.length > 0) {
            for (const item of items) {
                const { error: itemError } = await supabase
                    .from('stock_request_items')
                    .update({ quantity_approved: item.quantity_approved })
                    .eq('id', item.id);

                if (itemError) throw itemError;
            }
        }

        // 2. Update Request Header
        const { data: request, error: requestError } = await supabase
            .from('stock_requests')
            .update({
                status: 'approved',
                approved_by: userId,
                approved_at: new Date().toISOString(),
                notes: notes // Append or replace notes? Assuming replace or handle in frontend
            })
            .eq('id', id)
            .select()
            .single();

        if (requestError) throw requestError;

        res.json({ success: true, data: request });
        logger.info(`Stock request approved: ${id} by user ${userId}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Reject stock request
// @route   PUT /api/stock-requests/:id/reject
// @access  Private (Auditor, Central Storekeeper)
export const rejectRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = (req as any).user?.id;

        const { data: request, error } = await supabase
            .from('stock_requests')
            .update({
                status: 'rejected',
                approved_by: userId,
                approved_at: new Date().toISOString(),
                notes: reason
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data: request });
        logger.info(`Stock request rejected: ${id} by user ${userId}`);
    } catch (error) {
        next(error);
    }
};
