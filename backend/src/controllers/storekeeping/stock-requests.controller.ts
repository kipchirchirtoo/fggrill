import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import notificationService from '../../services/notification.service';
import * as BranchInventoryService from '../../services/branch-inventory.service';
import { isGlobalRole } from '../../utils/branchIsolation';
import { randomUUID } from 'crypto';
import {
    KYOGONG_BRANCH_STORE_CUTOVER_AT,
    shouldUseKyogongBranchCutover,
} from '../../services/kyogong-branch-cutover.service';

const SIMPLE_ITEM_SELECT = 'sku, item_name, description, quantity, store_type, is_active';

const normalizeSku = (sku: unknown): string => {
    if (sku === null || sku === undefined) return '';
    return String(sku).trim();
};

const fetchSimpleItemsBySku = async (skus: unknown[]): Promise<Map<string, any>> => {
    const uniqueSkus = [...new Set(skus.map(normalizeSku).filter(Boolean))];
    if (uniqueSkus.length === 0) return new Map();

    const { data, error } = await supabase
        .from('simple_items')
        .select(SIMPLE_ITEM_SELECT)
        .in('sku', uniqueSkus);

    if (error) throw error;

    return new Map((data || []).map((item: any) => [normalizeSku(item.sku), item]));
};

const attachCatalogItem = (row: any, itemMap: Map<string, any>): any => {
    const sku = normalizeSku(row.item_sku);
    const item = itemMap.get(sku);

    return {
        ...row,
        // Flatten the display name too — several screens (e.g. the central
        // store Issue Stock dialog) read item_name off the line itself and
        // rendered "—" when it only existed nested under item.
        item_name: row.item_name || item?.item_name || sku || 'Unknown item',
        item: item ? {
            ...item,
            category: item.store_type || null,
            unit: 'Unit',
            unit_of_measure: 'Unit'
        } : {
            sku,
            item_name: sku || 'Unknown item',
            description: null,
            category: null,
            unit: 'Unit',
            unit_of_measure: 'Unit',
            quantity: null
        }
    };
};

const fetchRequestItemsWithCatalog = async (requestIds: unknown[]): Promise<Record<string, any[]>> => {
    const ids = [...new Set(requestIds.map(id => id ? String(id) : '').filter(Boolean))];
    if (ids.length === 0) return {};

    const { data: items, error } = await supabase
        .from('stock_request_items')
        .select('*')
        .in('request_id', ids)
        .order('created_at', { ascending: true });

    if (error) throw error;

    const itemMap = await fetchSimpleItemsBySku((items || []).map((item: any) => item.item_sku));
    const grouped: Record<string, any[]> = {};

    (items || []).forEach((item: any) => {
        const requestId = String(item.request_id);
        if (!grouped[requestId]) grouped[requestId] = [];
        grouped[requestId].push(attachCatalogItem(item, itemMap));
    });

    return grouped;
};

const attachRequestItems = async <T extends { id: unknown }>(requests: T[]): Promise<Array<T & { items: any[] }>> => {
    const itemsByRequest = await fetchRequestItemsWithCatalog(requests.map(request => request.id));
    return requests.map(request => ({
        ...request,
        items: itemsByRequest[String(request.id)] || []
    }));
};

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

        // Use standard global role check
        const isCentralRole = isGlobalRole(req.user?.role);

        // Strict branch isolation: override any query parameter if not a central role
        if (!isCentralRole) {
            branchId = req.user?.branch_id || null;
            if (!branchId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Branch ID required. Your user profile does not have a branch assigned. Please contact your administrator.',
                    error: 'MISSING_BRANCH_ID',
                    user_role: req.user?.role,
                    user_id: req.user?.id
                });
                return;
            }
        }

        const applyCutover = shouldUseKyogongBranchCutover({
            branchId,
            role: req.user?.role,
        });
        const data = await BranchInventoryService.getRequests(
            branchId,
            status,
            applyCutover ? { createdFrom: KYOGONG_BRANCH_STORE_CUTOVER_AT } : undefined,
        );

        res.status(200).json({
            success: true,
            count: data?.length || 0,
            data: data || []
        });
    } catch (error) {
        logger.error('Error fetching stock requests:', error);
        next(error);
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
        requested_by_user:users!requested_by(id, first_name, last_name, email),
        reviewed_by_user:users!reviewed_by(id, first_name, last_name, email)
      `)
            .eq('id', id)
            .single();

        if (error || !request) {
            throw new AppError('Stock request not found', 404);
        }

        const [requestWithItems] = await attachRequestItems([request]);

        res.status(200).json({
            success: true,
            data: requestWithItems
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
        let requesting_branch_id = req.body?.requesting_branch_id;
        const {
            request_type,
            priority,
            reason,
            needed_by_date,
            items
        } = req.body;

        const userId = req.user?.id;

        // Fallback to user's branch if not provided
        if (!requesting_branch_id && req.user?.branch_id) {
            requesting_branch_id = req.user.branch_id;
        }

        if (!requesting_branch_id || !Array.isArray(items) || items.length === 0) {
            throw new AppError('Branch ID and items are required', 400);
        }

        const normalizedItems = items.map((item: any, index: number) => {
            const itemSku = normalizeSku(item.item_sku || item.sku);
            const requestedQuantity = Number(
                item.requested_quantity ?? item.quantity_requested ?? item.quantity ?? item.qty
            );

            if (!itemSku) {
                throw new AppError(`Item ${index + 1} is missing a SKU`, 400);
            }
            if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
                throw new AppError(`Item ${index + 1} (${itemSku}) must have a quantity greater than zero`, 400);
            }

            return {
                ...item,
                item_sku: itemSku,
                requested_quantity: requestedQuantity
            };
        });

        // Generate request number using database function
        const { data: requestNumberData, error: numberError } = await supabase
            .rpc('get_next_stock_request_number', { p_branch_id: requesting_branch_id });

        if (numberError) {
            logger.error('Error generating request number:', numberError);
            throw new AppError('Failed to generate request number', 500);
        }

        const request_number = requestNumberData;

        // Create stock request
        const requestId = randomUUID();
        const now = new Date().toISOString();

        const { data: newRequest, error: requestError } = await supabase
            .from('stock_requests')
            .insert({
                id: requestId,
                request_number,
                branch_id: requesting_branch_id,
                requesting_branch_id,
                // Only requested_by: the stock_requests view aliases
                // requested_by AS created_by, so writing both through the
                // view assigns the same base column twice (error 42601:
                // "multiple assignments to same column").
                requested_by: userId,
                request_type: request_type || 'ROUTINE',
                priority: (priority || 'normal').toLowerCase(),
                reason,
                needed_by_date,
                status: 'PENDING_BRANCH_ACCOUNTANT_APPROVAL',
                workflow_status: 'submitted_to_branch_accountant',
                submitted_to_auditor_at: now,
                document_number: request_number,
                barcode_value: request_number,
                created_at: now,
                updated_at: now
            })
            .select()
            .single();

        if (requestError) throw requestError;

        // Get current branch stock and resolve item UUIDs for each item
        const itemsWithStock = await Promise.all(
            normalizedItems.map(async (item: any) => {
                const [stockResult, itemResult] = await Promise.all([
                    supabase
                        .from('branch_stock')
                        .select('quantity')
                        .eq('branch_id', requesting_branch_id)
                        .eq('item_sku', item.item_sku)
                        .maybeSingle(),
                    supabase
                        .from('inventory_items')
                        .select('id, unit')
                        .eq('sku', item.item_sku)
                        .maybeSingle()
                ]);

                const requestedQuantity = Number(item.requested_quantity);

                return {
                    id: randomUUID(),
                    branch_requisition_id: newRequest.id,
                    request_id: newRequest.id,
                    item_id: itemResult.data?.id || null,
                    item_sku: item.item_sku,
                    unit: itemResult.data?.unit || 'units',
                    // Only requested_quantity: the stock_request_items view
                    // aliases requested_quantity AS quantity_requested AND AS
                    // quantity — writing more than one assigns the same base
                    // column twice ("multiple assignments to same column").
                    requested_quantity: requestedQuantity,
                    current_branch_stock: stockResult.data?.quantity || 0,
                    status: 'PENDING_BRANCH_ACCOUNTANT_APPROVAL',
                    // line_status has a lowercase check constraint on the base
                    // table (pending/approved/packed/…) — the uppercase
                    // workflow value lives on status only.
                    line_status: 'pending',
                    workflow_status: 'submitted_to_branch_accountant',
                    reason: item.reason || reason || null,
                    created_at: now
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
            .select('*')
            .eq('id', newRequest.id)
            .single();

        const completeRequestWithItems = completeRequest
            ? (await attachRequestItems([completeRequest]))[0]
            : { ...newRequest, items: [] };

        // Notify Branch Accountant for approval before central store.
        notificationService.notifyRole(
            'branch_accountant',
            'New Stock Request',
            `Branch ${requesting_branch_id} has submitted a new stock request (${request_number}).`,
            {
                type: 'info',
                category: 'stock_request',
                priority: priority === 'URGENT' ? 'high' : 'medium',
                actionUrl: `/dashboard/branch-accounting/stock-requests/${newRequest.id}`,
                branchId: requesting_branch_id,
                metadata: { request_id: newRequest.id, branch_id: requesting_branch_id }
            }
        ).catch(e => logger.error('Failed to notify branch accountant of stock request', e));

        res.status(201).json({
            success: true,
            data: completeRequestWithItems
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
        const { action, review_notes, item_approvals, approved_items } = req.body;
        const items_to_approve = approved_items || item_approvals;
        const userId = req.user?.id;

        if (action === 'APPROVE') {
            let finalApprovals = items_to_approve;

            // If no specific item approvals provided, approve all pending items in full
            if (!finalApprovals || finalApprovals.length === 0) {
                const { data: pendingItems } = await supabase
                    .from('stock_request_items')
                    .select('id, requested_quantity')
                    .eq('request_id', id);

                finalApprovals = (pendingItems || []).map(item => ({
                    id: item.id,
                    approved_quantity: item.requested_quantity,
                    status: 'APPROVED'
                }));
            }

            if (!finalApprovals || finalApprovals.length === 0) {
                res.status(400).json({ success: false, message: 'No items found to approve' });
                return;
            }

            const allRejected = finalApprovals.every((i: any) => i.status === 'REJECTED');
            const result = await BranchInventoryService.approveStockRequest(
                id,
                userId!,
                finalApprovals,
                review_notes,
                {
                    workflowStatus: allRejected ? 'branch_accountant_rejected' : 'branch_accountant_approved',
                    itemWorkflowStatus: allRejected ? 'branch_accountant_rejected' : 'branch_accountant_approved',
                    reviewerRole: 'Branch Accountant'
                }
            );

            // Fetch request details for notification
            const { data: request } = await supabase
                .from('stock_requests')
                .select('requested_by, request_number, requesting_branch_id')
                .eq('id', id)
                .single();

            // Resolve reviewer's name dynamically from user ID
            let reviewerName = 'the branch accountant';
            if (userId) {
                const { data: revProfile } = await supabase
                    .from('users')
                    .select('first_name, last_name')
                    .eq('id', userId)
                    .maybeSingle();
                if (revProfile && (revProfile.first_name || revProfile.last_name)) {
                    reviewerName = `Branch Accountant ${revProfile.first_name || ''} ${revProfile.last_name || ''}`.trim().replace(/\s+/g, ' ');
                }
            }

            res.status(200).json({
                success: true,
                message: 'Stock request approved successfully',
                data: result
            });

            // Notify Requester
            if (request && request.requested_by) {
                notificationService.notifyUser(
                    request.requested_by,
                    'Stock Request Approved',
                    `${reviewerName} has approved your stock request ${request.request_number}. It is now queued for packing and dispatch from central store.`,
                    {
                        type: 'success',
                        category: 'stock_request',
                        priority: 'medium',
                        actionUrl: `/dashboard/branch-store/requests/${id}`,
                        metadata: { request_id: id, status: 'APPROVED' }
                    }
                ).catch(e => logger.error('Failed to notify requester of stock request approval', e));
            }

            // Notify Central Storekeeper — new item ready to pack and dispatch
            notificationService.notifyRole(
                'central_storekeeper',
                'New Request Ready to Pack',
                `Stock request ${request?.request_number ?? id} has been branch-accountant-approved and is waiting for packing and dispatch. Open the Packing Station to proceed.`,
                {
                    type: 'info',
                    category: 'stock_request',
                    priority: 'high',
                    actionUrl: `/dashboard/central-store/packing`,
                    metadata: { request_id: id, status: 'APPROVED', branch_id: request?.requesting_branch_id }
                }
            ).catch(e => logger.error('Failed to notify central_storekeeper of approved request', e));

            return;
        }

        if (action === 'REJECT') {
            // Fetch items to reject all
            const { data: items } = await supabase
                .from('stock_request_items')
                .select('id')
                .eq('request_id', id);

            const rejectedItems = (items || []).map(item => ({
                id: item.id,
                approved_quantity: 0,
                status: 'REJECTED'
            }));

            const result = await BranchInventoryService.approveStockRequest(
                id,
                userId!,
                rejectedItems,
                review_notes,
                {
                    workflowStatus: 'branch_accountant_rejected',
                    itemWorkflowStatus: 'branch_accountant_rejected',
                    reviewerRole: 'Branch Accountant'
                }
            );

            // Fetch request details for notification
            const { data: request } = await supabase
                .from('stock_requests')
                .select('requested_by, request_number')
                .eq('id', id)
                .single();

            res.status(200).json({
                success: true,
                message: 'Stock request rejected',
                data: result
            });

            // Notify Requester
            if (request && request.requested_by) {
                notificationService.notifyUser(
                    request.requested_by,
                    'Stock Request Rejected',
                    `Your stock request ${request.request_number} was rejected. Reason: ${review_notes || 'No reason provided.'}`,
                    {
                        type: 'error',
                        category: 'stock_request',
                        priority: 'high',
                        actionUrl: `/dashboard/branch-store/requests/${id}`,
                        metadata: { request_id: id, status: 'REJECTED' }
                    }
                ).catch(e => logger.error('Failed to notify requester of stock request rejection', e));
            }
            return;
        }

        // Default: Set to UNDER_REVIEW
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
        const { approved_quantity_notes, item_approvals } = req.body;
        const userId = req.user?.id;

        const allRejected = (item_approvals || []).length > 0 && (item_approvals || []).every((i: any) => i.status === 'REJECTED');
        const result = await BranchInventoryService.approveStockRequest(
            id,
            userId!,
            item_approvals || [],
            approved_quantity_notes,
            {
                workflowStatus: allRejected ? 'branch_accountant_rejected' : 'branch_accountant_approved',
                itemWorkflowStatus: allRejected ? 'branch_accountant_rejected' : 'branch_accountant_approved',
                reviewerRole: 'Branch Accountant'
            }
        );

        // Fetch request details for notification
        const { data: request } = await supabase
            .from('stock_requests')
            .select('requested_by, request_number, requesting_branch_id')
            .eq('id', id)
            .single();

        // Resolve reviewer's name dynamically from user ID
        let reviewerName = 'the branch accountant';
        if (userId) {
            const { data: revProfile } = await supabase
                .from('users')
                .select('first_name, last_name')
                .eq('id', userId)
                .maybeSingle();
            if (revProfile && (revProfile.first_name || revProfile.last_name)) {
                reviewerName = `Branch Accountant ${revProfile.first_name || ''} ${revProfile.last_name || ''}`.trim().replace(/\s+/g, ' ');
            }
        }

        res.status(200).json({
            success: true,
            message: 'Stock request approved successfully',
            data: result
        });

        // Notify Requester
        if (request && request.requested_by) {
            notificationService.notifyUser(
                request.requested_by,
                'Stock Request Approved',
                `${reviewerName} has approved your stock request ${request.request_number}. It is now queued for packing and dispatch from central store.`,
                {
                    type: 'success',
                    category: 'stock_request',
                    priority: 'medium',
                    actionUrl: `/dashboard/branch-store/requests/${id}`,
                    metadata: { request_id: id, status: 'APPROVED' }
                }
            ).catch(e => logger.error('Failed to notify requester of stock request approval', e));
        }

        // Notify Central Storekeeper — new item ready to pack and dispatch
        notificationService.notifyRole(
            'central_storekeeper',
            'New Request Ready to Pack',
            `Stock request ${request?.request_number ?? id} has been branch-accountant-approved and is waiting for packing and dispatch. Open the Packing Station to proceed.`,
            {
                type: 'info',
                category: 'stock_request',
                priority: 'high',
                actionUrl: `/dashboard/central-store/packing`,
                metadata: { request_id: id, status: 'APPROVED', branch_id: request?.requesting_branch_id }
            }
        ).catch(e => logger.error('Failed to notify central_storekeeper of approved request', e));
    } catch (error) {
        logger.error('Error approving stock request:', error);
        next(error);
    }
};

// @desc    Bulk approve stock requests
// @route   POST /api/stock-requests/bulk-approve
// @access  Private (Auditor, Super Admin)
export const bulkApproveStockRequests = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { request_ids, approved_quantity_notes } = req.body;
        const userId = req.user?.id;

        if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
            res.status(400).json({
                success: false,
                message: 'request_ids array is required and must not be empty'
            });
            return;
        }

        console.log(`🔍 [Bulk Approve] Starting bulk approval for ${request_ids.length} requests by user ${userId}`);

        const results = [];
        const errors = [];

        // Process each request
        for (const requestId of request_ids) {
            try {
                console.log(`🔍 [Bulk Approve] Processing request ${requestId}...`);
                
                // Fetch request items to approve with full requested quantities
                const { data: items, error: itemsError } = await supabase
                    .from('stock_request_items')
                    .select('id, requested_quantity')
                    .eq('request_id', requestId);

                if (itemsError) {
                    console.error(`❌ [Bulk Approve] Error fetching items for request ${requestId}:`, itemsError);
                    errors.push({ requestId, error: itemsError.message });
                    continue;
                }

                // Approve with full requested quantities
                const item_approvals = (items || []).map(item => ({
                    id: item.id,
                    approved_quantity: item.requested_quantity,
                    status: 'approved' as const
                }));

                await BranchInventoryService.approveStockRequest(
                    requestId,
                    userId!,
                    item_approvals,
                    approved_quantity_notes || 'Bulk approved by branch accountant',
                    {
                        workflowStatus: 'branch_accountant_approved',
                        itemWorkflowStatus: 'branch_accountant_approved',
                        reviewerRole: 'Branch Accountant'
                    }
                );

                // Fetch request details for notification
                const { data: request } = await supabase
                    .from('stock_requests')
                    .select('requested_by, request_number')
                    .eq('id', requestId)
                    .single();

                // Resolve reviewer's name dynamically from user ID
                let reviewerName = 'The branch accountant';
                if (userId) {
                    const { data: revProfile } = await supabase
                        .from('users')
                        .select('first_name, last_name')
                        .eq('id', userId)
                        .maybeSingle();
                    if (revProfile && (revProfile.first_name || revProfile.last_name)) {
                        reviewerName = `Branch Accountant ${revProfile.first_name || ''} ${revProfile.last_name || ''}`.trim().replace(/\s+/g, ' ');
                    }
                }

                results.push({ requestId, success: true, request_number: request?.request_number });
                console.log(`✅ [Bulk Approve] Request ${requestId} (${request?.request_number}) approved successfully`);

                // Notify Requester
                if (request && request.requested_by) {
                    notificationService.notifyUser(
                        request.requested_by,
                        'Stock Request Approved',
                        `${reviewerName} has approved your stock request ${request.request_number}.`,
                        {
                            type: 'success',
                            category: 'stock_request',
                            priority: 'medium',
                            actionUrl: `/dashboard/branch-store/requests/${requestId}`,
                            metadata: { request_id: requestId, status: 'APPROVED' }
                        }
                    ).catch(e => logger.error('Failed to notify requester of stock request approval', e));
                }
            } catch (error: any) {
                console.error(`❌ [Bulk Approve] Error approving request ${requestId}:`, error);
                errors.push({ requestId, error: error.message || 'Unknown error' });
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`✅ [Bulk Approve] Completed: ${successCount}/${request_ids.length} requests approved successfully`);

        res.status(200).json({
            success: true,
            message: `Bulk approval completed: ${successCount}/${request_ids.length} requests approved`,
            data: {
                approved: results,
                errors: errors,
                total: request_ids.length,
                successful: successCount,
                failed: errors.length
            }
        });
    } catch (error) {
        console.error('❌ [Bulk Approve] Error in bulk approval:', error);
        logger.error('Error in bulk approve stock requests:', error);
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

        // Fetch items to reject all
        const { data: items } = await supabase
            .from('stock_request_items')
            .select('id')
            .eq('request_id', id);

        const rejectedItems = (items || []).map(item => ({
            id: item.id,
            approved_quantity: 0,
            status: 'REJECTED'
        }));

        const result = await BranchInventoryService.approveStockRequest(
            id,
            userId!,
            rejectedItems,
            review_notes,
            {
                workflowStatus: 'branch_accountant_rejected',
                itemWorkflowStatus: 'branch_accountant_rejected',
                reviewerRole: 'Branch Accountant'
            }
        );

        // Fetch request details for notification
        const { data: request } = await supabase
            .from('stock_requests')
            .select('requested_by, request_number')
            .eq('id', id)
            .single();

        res.status(200).json({
            success: true,
            message: 'Stock request rejected successfully',
            data: result
        });

        // Notify Requester
        if (request && request.requested_by) {
            notificationService.notifyUser(
                request.requested_by,
                'Stock Request Rejected',
                `Your stock request ${request.request_number} was rejected. Reason: ${review_notes || 'No reason provided.'}`,
                {
                    type: 'error',
                    category: 'stock_request',
                    priority: 'high',
                    actionUrl: `/dashboard/branch-store/requests/${id}`,
                    metadata: { request_id: id, status: 'REJECTED' }
                }
            ).catch(e => logger.error('Failed to notify requester of stock request rejection', e));
        }
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

// @desc    Set issued quantity and status per line item (central storekeeper)
// @route   PATCH /api/storekeeping/stock-requests/:id/items/:itemId/issue
// @access  Private (Central Store)
export const setItemIssueQty = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id, itemId } = req.params;
        const { issued_qty, issue_status, issue_notes } = req.body;

        // Validate issued_qty
        if (issued_qty === undefined || issued_qty === null || isNaN(Number(issued_qty)) || Number(issued_qty) < 0) {
            throw new AppError('issued_qty must be a non-negative number', 400);
        }

        const validStatuses = ['issued', 'partially_issued', 'backordered'];
        if (!issue_status || !validStatuses.includes(issue_status)) {
            throw new AppError(`issue_status must be one of: ${validStatuses.join(', ')}`, 400);
        }

        const issuedQty = Number(issued_qty);

        // Fetch the item to confirm it belongs to this request
        const { data: existingItem, error: fetchError } = await supabase
            .from('stock_request_items')
            .select('*')
            .eq('id', itemId)
            .eq('request_id', id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!existingItem) {
            throw new AppError('Stock request item not found', 404);
        }

        // Update the item
        const { data: updatedItem, error: updateError } = await supabase
            .from('stock_request_items')
            .update({
                issued_qty: issuedQty,
                issue_status,
                issue_notes: issue_notes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', itemId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Auto-update parent stock_request workflow_status based on all items
        const { data: allItems, error: allItemsError } = await supabase
            .from('stock_request_items')
            .select('issue_status, issued_qty')
            .eq('request_id', id);

        if (!allItemsError && allItems && allItems.length > 0) {
            const hasIssued = allItems.some((i: any) => i.issue_status === 'issued' || i.issue_status === 'partially_issued');
            const allIssuedFully = allItems.every((i: any) => i.issue_status === 'issued');
            const hasBackordered = allItems.some((i: any) => i.issue_status === 'backordered');

            let newWorkflowStatus: string | null = null;
            if (allIssuedFully) {
                newWorkflowStatus = 'fully_issued';
            } else if (hasIssued || hasBackordered) {
                newWorkflowStatus = 'partially_issued';
            }

            if (newWorkflowStatus) {
                await supabase
                    .from('stock_requests')
                    .update({ workflow_status: newWorkflowStatus, updated_at: new Date().toISOString() })
                    .eq('id', id);
            }
        }

        res.status(200).json({
            success: true,
            data: updatedItem
        });
    } catch (error) {
        logger.error('Error setting item issue quantity:', error);
        next(error);
    }
};

// @desc    Confirm dispatch — lock items, deduct stock, create dispatch record
// @route   POST /api/storekeeping/stock-requests/:id/confirm-dispatch
// @access  Private (Central Store)
export const confirmDispatch = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { driver_name, vehicle_number, notes } = req.body;
        const userId = req.user?.id;

        // Fetch the stock request
        const { data: request, error: requestError } = await supabase
            .from('stock_requests')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (requestError) throw requestError;
        if (!request) {
            throw new AppError('Stock request not found', 404);
        }

        // Fetch all items for this request
        const { data: items, error: itemsError } = await supabase
            .from('stock_request_items')
            .select('*')
            .eq('request_id', id);

        if (itemsError) throw itemsError;
        if (!items || items.length === 0) {
            throw new AppError('No items found for this stock request', 400);
        }

        const now = new Date().toISOString();

        // Deduct stock from simple_items for each issued item
        const deductionErrors: string[] = [];
        let totalIssuedItems = 0;

        for (const item of items) {
            const issuedQty = Number(item.issued_qty || 0);
            if (issuedQty <= 0) continue;

            totalIssuedItems++;

            // Deduct from central store stock
            const { error: deductError } = await supabase.rpc('decrement_simple_item_qty', {
                p_sku: item.item_sku,
                p_qty: issuedQty
            }).then(async (rpcResult) => {
                if (rpcResult.error) {
                    // Fallback: direct update if RPC not available
                    const { data: currentItem } = await supabase
                        .from('simple_items')
                        .select('quantity')
                        .eq('sku', item.item_sku)
                        .maybeSingle();

                    if (currentItem) {
                        const newQty = Math.max(0, Number(currentItem.quantity || 0) - issuedQty);
                        return supabase
                            .from('simple_items')
                            .update({ quantity: newQty, updated_at: now })
                            .eq('sku', item.item_sku);
                    }
                }
                return rpcResult;
            });

            if (deductError) {
                logger.warn(`Failed to deduct stock for SKU ${item.item_sku}:`, deductError);
                deductionErrors.push(item.item_sku);
            }
        }

        // Mark backordered items that don't have an explicit issue_status yet
        await supabase
            .from('stock_request_items')
            .update({ issue_status: 'backordered', updated_at: now })
            .eq('request_id', id)
            .is('issue_status', null);

        // Update stock_request to dispatched
        const { data: updatedRequest, error: updateError } = await supabase
            .from('stock_requests')
            .update({
                workflow_status: 'dispatched',
                status: 'DISPATCHED',
                dispatched_at: now,
                updated_at: now
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Resolve destination branch code for dispatch number
        const destBranchId = request.requesting_branch_id || request.branch_id;
        const { data: branchData } = await supabase
            .from('branches')
            .select('code, name')
            .eq('id', destBranchId)
            .maybeSingle();

        const branchCode = branchData?.code || `BR${destBranchId}`;

        // Generate dispatch number
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const timestamp = Date.now().toString().slice(-4);
        const dispatch_number = `DN-${branchCode}-${dateStr}-${timestamp}`;

        // Get central warehouse
        const centralBranch = await BranchInventoryService.getCentralWarehouse();
        const fromBranchId = centralBranch?.id || null;

        // Create dispatch note record
        const { data: dispatchNote, error: dispatchError } = await supabase
            .from('dispatch_notes')
            .insert({
                dispatch_number,
                stock_request_id: id,
                from_branch_id: fromBranchId,
                to_branch_id: destBranchId,
                created_by: userId,
                vehicle_number: vehicle_number || null,
                driver_name: driver_name || null,
                dispatch_notes: notes || null,
                status: 'IN_TRANSIT',
                dispatched_at: now
            })
            .select()
            .single();

        if (dispatchError) {
            logger.warn('Failed to create dispatch note record:', dispatchError);
        }

        // Insert dispatch items for the dispatch note
        if (dispatchNote && items.length > 0) {
            const dispatchItems = items
                .filter((item: any) => Number(item.issued_qty || 0) > 0)
                .map((item: any) => ({
                    dispatch_id: dispatchNote.id,
                    item_sku: item.item_sku,
                    dispatched_quantity: Number(item.issued_qty),
                    status: 'DISPATCHED'
                }));

            if (dispatchItems.length > 0) {
                const { error: diError } = await supabase.from('dispatch_items').insert(dispatchItems);
                if (diError) {
                    logger.warn('Failed to insert dispatch_items for dispatch note', dispatchNote.id, ':', diError);
                }
            }
        }

        // Build summary
        const issuedItems = items.filter((i: any) => Number(i.issued_qty || 0) > 0);
        const backorderedItems = items.filter((i: any) => i.issue_status === 'backordered' || (!i.issue_status && Number(i.issued_qty || 0) === 0));
        const totalIssuedQty = issuedItems.reduce((sum: number, i: any) => sum + Number(i.issued_qty || 0), 0);

        // Notify branch storekeeper
        notificationService.notifyRole(
            'branch_storekeeper',
            'Stock Dispatched — En Route',
            `Stock request ${request.request_number} has been confirmed and dispatched (${dispatch_number}). Please prepare to receive.`,
            {
                type: 'success',
                category: 'dispatch',
                priority: 'high',
                actionUrl: `/dashboard/branch-store/requests`,
                branchId: destBranchId ?? null,
                metadata: { request_id: id, dispatch_id: dispatchNote?.id }
            }
        ).catch(e => logger.error('Failed to notify branch_storekeeper of confirmed dispatch', e));

        res.status(200).json({
            success: true,
            data: {
                request: updatedRequest,
                dispatch_note: dispatchNote || null,
                dispatch_number,
                summary: {
                    total_items: items.length,
                    issued_items: issuedItems.length,
                    backordered_items: backorderedItems.length,
                    total_issued_qty: totalIssuedQty,
                    deduction_errors: deductionErrors
                }
            }
        });
    } catch (error) {
        logger.error('Error confirming dispatch:', error);
        next(error);
    }
};

// @desc    Get approved stock requests (for central store dispatch)
// @route   GET /api/storekeeping/stock-requests/approved
// @access  Private (Central Store)
export const getApprovedRequests = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const queryBranchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
        let branchId = queryBranchId;

        // Use standard global role check
        const isCentralRole = isGlobalRole(req.user?.role);

        // Strict branch isolation: override any query parameter if not a central role
        if (!isCentralRole) {
            branchId = req.user?.branch_id || null;
            if (!branchId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Branch ID required. Your user profile does not have a branch assigned. Please contact your administrator.',
                    error: 'MISSING_BRANCH_ID',
                    user_role: req.user?.role,
                    user_id: req.user?.id
                });
                return;
            }
        }

        let query = supabase
            .from('stock_requests')
            .select(`
                *,
                requested_by_user:users!requested_by(id, first_name, last_name, email),
                reviewed_by_user:users!reviewed_by(id, first_name, last_name, email)
            `)
            .in('status', ['APPROVED', 'PARTIALLY_APPROVED']);

        if (branchId) {
            query = query.eq('requesting_branch_id', branchId);
        }

        if (shouldUseKyogongBranchCutover({ branchId, role: req.user?.role })) {
            query = query.gte('created_at', KYOGONG_BRANCH_STORE_CUTOVER_AT);
        }

        const { data: requests, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        const requestsWithItems = await attachRequestItems(requests || []);

        // Attach branch names — the packing queue and Issue Stock dialog
        // display requesting_branch_name, which the raw row doesn't carry.
        const branchIds = [...new Set(
            requestsWithItems
                .map((r: any) => r.requesting_branch_id ?? r.branch_id)
                .filter((id: any) => id !== null && id !== undefined)
        )];
        const { data: branchRows } = branchIds.length
            ? await supabase.from('branches').select('id, name').in('id', branchIds)
            : { data: [] as any[] };
        const branchNameById = new Map((branchRows || []).map((b: any) => [String(b.id), b.name]));

        const enriched = requestsWithItems.map((r: any) => ({
            ...r,
            requesting_branch_name:
                branchNameById.get(String(r.requesting_branch_id ?? r.branch_id)) || null
        }));

        res.status(200).json({
            success: true,
            count: enriched.length,
            data: enriched
        });
    } catch (error) {
        logger.error('Error fetching approved requests:', error);
        next(error);
    }
};
