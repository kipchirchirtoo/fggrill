import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

/**
 * @desc    Get all stock requests (filtered by role)
 * @route   GET /api/bar/stock-requests
 * @access  Private
 */
export const getStockRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, branch_id, date_from, date_to } = req.query;
    const userRole = req.user?.role;
    const userBranchId = req.user?.branch_id;

    let query = supabase
      .from('bar_stock_requests')
      .select(`
        *,
        requested_by_user:users!bar_stock_requests_requested_by_fkey(id, first_name, last_name, email),
        reviewed_by_user:users!bar_stock_requests_reviewed_by_fkey(id, first_name, last_name),
        fulfilled_by_user:users!bar_stock_requests_fulfilled_by_fkey(id, first_name, last_name),
        items:bar_stock_request_items(
          *,
          item:restaurant_bar_inventory(name, category)
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by user role and branch — enforce strict branch isolation
    if (userBranchId) {
      // All branch-scoped roles (bartender, branch_storekeeper, branch_accountant, auditor, etc.)
      // must only see requests for their own branch
      const globalRoles = ['super_admin', 'general_manager', 'central_storekeeper'];
      if (!globalRoles.includes(userRole || '')) {
        query = query.eq('bar_branch_id', userBranchId);
      }
    }

    // Apply filters
    if (status) query = query.eq('status', status);
    if (branch_id) query = query.eq('bar_branch_id', branch_id);
    if (date_from) query = query.gte('requested_at', date_from);
    if (date_to) query = query.lte('requested_at', date_to);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data: data || []
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single stock request
 * @route   GET /api/bar/stock-requests/:id
 * @access  Private
 */
export const getStockRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('bar_stock_requests')
      .select(`
        *,
        requested_by_user:users!bar_stock_requests_requested_by_fkey(id, first_name, last_name, email),
        reviewed_by_user:users!bar_stock_requests_reviewed_by_fkey(id, first_name, last_name),
        fulfilled_by_user:users!bar_stock_requests_fulfilled_by_fkey(id, first_name, last_name),
        items:bar_stock_request_items(
          *,
          item:restaurant_bar_inventory(name, category, bottle_size_ml)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new stock request
 * @route   POST /api/bar/stock-requests
 * @access  Private (Bartender)
 */
export const createStockRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bar_branch_id, store_branch_id, priority, notes, items } = req.body;
    const userId = req.user?.id;

    // Validate items
    if (!items || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
      return;
    }

    // Create the request
    const { data: request, error: requestError } = await supabase
      .from('bar_stock_requests')
      .insert({
        bar_branch_id,
        store_branch_id: store_branch_id || bar_branch_id, // Default to same branch
        requested_by: userId,
        priority: priority || 'normal',
        notes,
        status: 'pending'
      })
      .select()
      .single();

    if (requestError) throw requestError;

    // Create request items
    const requestItems = items.map((item: any) => ({
      request_id: request.id,
      inventory_item_id: item.inventory_item_id || item.drink_id, // Handle legacy format if frontend sends drink_id
      item_name: item.item_name,
      requested_quantity: item.requested_quantity,
      unit: item.unit,
      current_stock: item.current_stock || 0,
      min_stock: item.min_stock || 0,
      notes: item.notes
    }));

    const { error: itemsError } = await supabase
      .from('bar_stock_request_items')
      .insert(requestItems);

    if (itemsError) throw itemsError;

    // Fetch complete request with items
    const { data: completeRequest } = await supabase
      .from('bar_stock_requests')
      .select(`
        *,
        items:bar_stock_request_items(
          *,
          item:restaurant_bar_inventory(name, category)
        )
      `)
      .eq('id', request.id)
      .single();

    logger.info(`Stock request ${request.request_number} created by user ${userId}`);

    res.status(201).json({
      success: true,
      message: `Stock request ${request.request_number} created successfully`,
      data: completeRequest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update stock request status (Approve/Reject)
 * @route   PUT /api/bar/stock-requests/:id/status
 * @access  Private (Storekeeper/Manager)
 */
export const updateRequestStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, review_notes, approved_quantities } = req.body;
    const userId = req.user?.id;

    // Validate status
    const validStatuses = ['approved', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Must be approved, rejected, or cancelled'
      });
      return;
    }

    // Update request
    const { data: request, error: updateError } = await supabase
      .from('bar_stock_requests')
      .update({
        status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // If approved, update item approved quantities
    if (status === 'approved' && approved_quantities) {
      for (const itemUpdate of approved_quantities) {
        await supabase
          .from('bar_stock_request_items')
          .update({
            approved_quantity: itemUpdate.approved_quantity
          })
          .eq('id', itemUpdate.item_id);
      }
    }

    logger.info(`Stock request ${request.request_number} ${status} by user ${userId}`);

    res.status(200).json({
      success: true,
      message: `Stock request ${status} successfully`,
      data: request
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Fulfill stock request (mark items as delivered)
 * @route   PUT /api/bar/stock-requests/:id/fulfill
 * @access  Private (Storekeeper)
 */
export const fulfillStockRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { fulfilled_quantities } = req.body;
    const userId = req.user?.id;

    // Get request
    const { data: request, error: fetchError } = await supabase
      .from('bar_stock_requests')
      .select('*, items:bar_stock_request_items(*)')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (request.status !== 'approved' && request.status !== 'partial') {
      res.status(400).json({
        success: false,
        message: 'Only approved requests can be fulfilled'
      });
      return;
    }

    // Update fulfilled quantities for items
    if (fulfilled_quantities && fulfilled_quantities.length > 0) {
      for (const itemUpdate of fulfilled_quantities) {
        const { data: item } = await supabase
          .from('bar_stock_request_items')
          .update({
            fulfilled_quantity: itemUpdate.fulfilled_quantity
          })
          .eq('id', itemUpdate.item_id)
          .select()
          .single();

        // Update bar stock if item has inventory_item_id
        if (item && item.inventory_item_id) {
          // Increment Bar Stock
          // Note: using direct update instead of RPC for simplicity unless concurrent updates are high
          const { data: currentStock } = await supabase
            .from('restaurant_bar_inventory')
            .select('current_bottles')
            .eq('id', item.inventory_item_id)
            .single();

          if (currentStock) {
            await supabase
              .from('restaurant_bar_inventory')
              .update({
                current_bottles: (currentStock.current_bottles || 0) + itemUpdate.fulfilled_quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.inventory_item_id);
          }

          // Log to bar_stock_records
          // Using try-catch to ignore error if bar_stock_records setup is incomplete or table missing FK
          try {
            await supabase.from('bar_stock_records').insert({
              branch_id: request.bar_branch_id,
              drink_id: item.inventory_item_id, // Assuming we mapped this FK to match or use text link
              record_type: 'received',
              quantity: itemUpdate.fulfilled_quantity,
              unit: 'bottles',
              recorded_by: userId,
              notes: `Received from Request ${request.request_number}`
            });
          } catch (logError) {
            logger.warn('Failed to log bar stock record', logError);
          }
        }
      }
    }

    // Update request to fulfilled
    await supabase
      .from('bar_stock_requests')
      .update({
        status: 'fulfilled',
        fulfilled_by: userId,
        fulfilled_at: new Date().toISOString()
      })
      .eq('id', id);

    logger.info(`Stock request ${request.request_number} fulfilled by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Stock request fulfilled successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get low stock items for bar
 * @route   GET /api/bar/stock-requests/low-stock
 * @access  Private (Bartender)
 */
export const getLowStockItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id } = req.query;

    // Use restaurant_bar_inventory directly
    const { data: allStock, error } = await supabase
      .from('restaurant_bar_inventory')
      .select('*')
      .order('name');
    // Filter by branch if we had branch_id column

    // Filter for low stock items (current_bottles <= par_level)
    const data = allStock?.filter(item => item.current_bottles <= item.par_level) || [];

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data: data || []
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete stock request (only if pending)
 * @route   DELETE /api/bar/stock-requests/:id
 * @access  Private
 */
export const deleteStockRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if request is pending
    const { data: request } = await supabase
      .from('bar_stock_requests')
      .select('status, request_number')
      .eq('id', id)
      .single();

    if (request?.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: 'Only pending requests can be deleted'
      });
      return;
    }

    const { error } = await supabase
      .from('bar_stock_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;

    logger.info(`Stock request ${request.request_number} deleted`);

    res.status(200).json({
      success: true,
      message: 'Stock request deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
