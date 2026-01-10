import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import * as BranchInventoryService from '../../services/branch-inventory.service';

// @desc    Get all stock requests
// @route   GET /api/stock-requests
// @access  Private
// @desc    Get all stock requests
// @route   GET /api/stock-requests
// @access  Private
// @desc    Get branch performance data for Auditor
// @route   GET /api/stock-requests/branch-performance/:branchId
// @access  Private (Auditor, Admin)
export const getBranchPerformance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branchId } = req.params;
        const days = parseInt(req.query.days as string) || 1;

        // Get sales data for the last X days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const { data: sales, error: salesError } = await supabase
            .from('restaurant_orders')
            .select('id, total_amount, created_at')
            .eq('branch_id', branchId)
            .gte('created_at', startDate.toISOString())
            .eq('status', 'PAID');

        if (salesError) throw salesError;

        const totalSales = sales?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        const orderCount = sales?.length || 0;
        const averageOrder = orderCount > 0 ? totalSales / orderCount : 0;

        res.status(200).json({
            success: true,
            data: {
                branchId,
                period: `${days} day(s)`,
                totalSales,
                orderCount,
                averageOrder,
                startDate: startDate.toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getStockRequests = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const queryBranchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
        let branchId = queryBranchId;
        const status = req.query.status as string;

        // Allow central roles to fetch all requests (branchId is optional)
        const isCentralRole = ['super_admin', 'general_manager', 'central_storekeeper', 'auditor'].includes(req.user?.role || '');

        if (branchId === null) {
            if (!isCentralRole) {
                // Non-central roles must use their assigned branch
                branchId = req.user?.branch_id || null;

                if (!branchId) {
                    res.status(400).json({ success: false, message: 'Branch ID required' });
                    return;
                }
            }
            // Central roles keep branchId as null to fetch all
        }

        const data = await BranchInventoryService.getBranchRequests(branchId, status);

        res.status(200).json({
            success: true,
            count: data?.length || 0,
            data: data || []
        });
    } catch (error) {
        logger.error('Error fetching stock requests:', error);
        // Return empty list instead of crashing
        res.status(200).json({
            success: true,
            count: 0,
            data: []
        });
    }
};

// @desc    Get single stock request
// @route   GET /api/stock-requests/:id
// @access  Private
export const getStockRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: request, error } = await supabase
            .from('stock_requests')
            .select(`
        *,
        requesting_branch:branches!requesting_branch_id(id, name, code, contact_person),
        requested_by_user:users!requested_by(id, first_name, last_name, email),
        reviewed_by_user:users!reviewed_by(id, first_name, last_name, email),
        items:stock_request_items(
          *,
          item:simple_items!item_sku(sku, item_name, description, unit, category)
        )
      `)
            .eq('id', id)
            .single();

        if (error || !request) {
            throw new AppError('Stock request not found', 404);
        }

        res.status(200).json({
            success: true,
            data: request
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new stock request
// @route   POST /api/stock-requests
// @access  Private
export const createStockRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            requesting_branch_id,
            request_type,
            priority,
            reason,
            needed_by_date,
            items
        } = req.body;

        const userId = req.user?.id;

        if (!requesting_branch_id || !items || items.length === 0) {
            throw new AppError('Branch ID and items are required', 400);
        }

        // Get branch code for request number generation
        const { data: branch } = await supabase
            .from('branches')
            .select('code')
            .eq('id', requesting_branch_id)
            .single();

        if (!branch) {
            throw new AppError('Branch not found', 404);
        }

        // Generate request number using database function
        const { data: requestNumberData, error: numberError } = await supabase
            .rpc('get_next_stock_request_number', { p_branch_code: branch.code });

        if (numberError) {
            logger.error('Error generating request number:', numberError);
            throw new AppError('Failed to generate request number', 500);
        }

        const request_number = requestNumberData;

        // Create stock request
        const { data: newRequest, error: requestError } = await supabase
            .from('stock_requests')
            .insert({
                request_number,
                requesting_branch_id,
                requested_by: userId,
                request_type: request_type || 'ROUTINE',
                priority: priority || 'NORMAL',
                reason,
                needed_by_date,
                status: 'PENDING'
            })
            .select()
            .single();

        if (requestError) throw requestError;

        // Get current branch stock for each item
        const itemsWithStock = await Promise.all(
            items.map(async (item: any) => {
                const { data: stock } = await supabase
                    .from('branch_stock')
                    .select('quantity')
                    .eq('branch_id', requesting_branch_id)
                    .eq('item_sku', item.item_sku)
                    .single();

                return {
                    request_id: newRequest.id,
                    item_sku: item.item_sku,
                    requested_quantity: item.requested_quantity,
                    current_branch_stock: stock?.quantity || 0,
                    status: 'PENDING'
                };
            })
        );

        // Insert request items
        const { error: itemsError } = await supabase
            .from('stock_request_items')
            .insert(itemsWithStock);

        if (itemsError) throw itemsError;

        // Fetch complete request with items
        const { data: completeRequest } = await supabase
            .from('stock_requests')
            .select(`
        *,
        requesting_branch:branches!requesting_branch_id(id, name, code),
        items:stock_request_items(
          *,
          item:simple_items!item_sku(sku, item_name, description, unit)
        )
      `)
            .eq('id', newRequest.id)
            .single();

        res.status(201).json({
            success: true,
            data: completeRequest
        });
    } catch (error) {
        logger.error('Error creating stock request:', error);
        next(error);
    }
};

// @desc    Review stock request
// @route   PUT /api/stock-requests/:id/review
// @access  Private (Central Ops)
export const reviewStockRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { review_notes, item_approvals } = req.body;
        const userId = req.user?.id;

        // Update request status
        const { data: request, error: updateError } = await supabase
            .from('stock_requests')
            .update({
                status: 'UNDER_REVIEW',
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                review_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Update item approvals if provided
        if (item_approvals && Array.isArray(item_approvals)) {
            for (const approval of item_approvals) {
                await supabase
                    .from('stock_request_items')
                    .update({
                        approved_quantity: approval.approved_quantity,
                        status: approval.status,
                        rejection_reason: approval.rejection_reason
                    })
                    .eq('id', approval.item_id);
            }
        }

        res.status(200).json({
            success: true,
            data: request
        });
    } catch (error) {
        logger.error('Error reviewing stock request:', error);
        next(error);
    }
};

// @desc    Approve stock request
// @route   PUT /api/stock-requests/:id/approve
// @access  Private (Central Ops)
export const approveStockRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { approved_quantity_notes } = req.body;
        const userId = req.user?.id;

        const { data: request, error } = await supabase
            .from('stock_requests')
            .update({
                status: 'APPROVED',
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                approved_quantity_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Stock request approved',
            data: request
        });
    } catch (error) {
        logger.error('Error approving stock request:', error);
        next(error);
    }
};

// @desc    Reject stock request
// @route   PUT /api/stock-requests/:id/reject
// @access  Private (Central Ops)
export const rejectStockRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { review_notes } = req.body;
        const userId = req.user?.id;

        const { data: request, error } = await supabase
            .from('stock_requests')
            .update({
                status: 'REJECTED',
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                review_notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Stock request rejected',
            data: request
        });
    } catch (error) {
        logger.error('Error rejecting stock request:', error);
        next(error);
    }
};

// @desc    Cancel stock request
// @route   PUT /api/stock-requests/:id/cancel
// @access  Private
export const cancelStockRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: request, error } = await supabase
            .from('stock_requests')
            .update({
                status: 'CANCELLED',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Stock request cancelled',
            data: request
        });
    } catch (error) {
        logger.error('Error cancelling stock request:', error);
        next(error);
    }
};
