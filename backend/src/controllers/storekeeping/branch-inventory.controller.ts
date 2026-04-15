/**
 * Multi-Branch Inventory Controller
 * Handles stock requests, dispatch notes, and branch stock management
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import * as BranchInventoryService from '../../services/branch-inventory.service';
import { isGlobalRole } from '../../utils/branchIsolation';

// ============================================================
// BRANCH STOCK MANAGEMENT
// ============================================================

/**
 * Get stock for user's branch
 */
export const getBranchStock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const isCentral = isGlobalRole(req.user?.role);

    // Strict override
    if (!isCentral) {
      branchId = req.user?.branch_id;
    }

    if (!branchId) {
      if (isCentral) {
        // Central roles can see empty state if no branch selected
        res.status(200).json({ success: true, count: 0, data: [] });
        return;
      }
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    const data = await BranchInventoryService.getBranchStock(branchId);

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get low stock items for branch
 */
export const getLowStockItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const isCentral = isGlobalRole(req.user?.role);

    if (!isCentral) {
        branchId = req.user?.branch_id;
    }

    if (!branchId) {
      if (isCentral) {
        res.status(200).json({ success: true, count: 0, data: [] });
        return;
      }
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    const lowStock = await BranchInventoryService.getLowStockItems(branchId);

    res.status(200).json({
      success: true,
      count: lowStock.length,
      data: lowStock
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record stock out (usage, damage, etc.)
 */
export const recordStockOut = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.user?.branch_id;
    const { item_sku, quantity, movement_type, reason, notes } = req.body;

    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    if (!item_sku || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, message: 'Item SKU and quantity required' });
      return;
    }

    const result = await BranchInventoryService.updateBranchStock(
      branchId,
      item_sku,
      -quantity,
      movement_type || 'STOCK_OUT',
      req.user?.id,
      'MANUAL',
      undefined,
      undefined,
      notes || reason
    );

    res.status(200).json({
      success: true,
      message: `Stock out recorded: ${quantity} units`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Adjust branch stock (Morning count / manual adjustment)
 */
export const updateBranchStock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.user?.branch_id;
    const { item_sku, quantity, movement_type, notes, reorder_level } = req.body;

    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    if (!item_sku) {
      res.status(400).json({ success: false, message: 'Item SKU required' });
      return;
    }

    // For updateBranchStock, quantity is the NEW quantity if some flag is set, 
    // or the CHANGE if it's an adjustment.
    // Based on service: updateBranchStock(..., quantityChange, ...)
    // Let's assume the frontend sends the change.

    const result = await BranchInventoryService.updateBranchStock(
      branchId,
      item_sku,
      quantity || 0,
      movement_type || 'MANUAL_ADJUSTMENT',
      req.user?.id,
      'MANUAL',
      undefined,
      undefined,
      notes || 'Manual stock adjustment',
      reorder_level ? parseInt(reorder_level) : undefined
    );

    res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// STOCK REQUESTS (Branch → Central)
// ============================================================

/**
 * Create new stock request
 */
export const createStockRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.user?.branch_id;
    const { items, request_type, priority, reason, needed_by_date } = req.body;

    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    if (!items || items.length === 0) {
      res.status(400).json({ success: false, message: 'At least one item required' });
      return;
    }

    // Get branch code
    const { data: branch } = await supabase
      .from('branches')
      .select('code')
      .eq('id', branchId)
      .single();

    if (!branch?.code) {
      res.status(400).json({ success: false, message: 'Branch not found' });
      return;
    }

    const request = await BranchInventoryService.createStockRequest(
      branchId,
      branch.code,
      req.user?.id,
      items,
      request_type,
      priority,
      reason,
      needed_by_date
    );

    res.status(201).json({
      success: true,
      message: `Stock request ${request.request_number} created`,
      data: request
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stock requests for branch
 */
export const getBranchRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryBranchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
    let branchId = queryBranchId;
    const status = req.query.status as string;

    const isCentralRole = isGlobalRole(req.user?.role);

    // Strict override
    if (!isCentralRole) {
      branchId = req.user?.branch_id || null;
      if (!branchId) {
        res.status(400).json({ success: false, message: 'Branch ID required' });
        return;
      }
    }

    // console.log('Final branchId for service call:', branchId);

    const data = await BranchInventoryService.getRequests(branchId, status);
    // console.log('Data returned from service:', data?.length);

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending requests for central review
 */
export const getPendingRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await BranchInventoryService.getPendingRequests();

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Review/approve stock request (Central only)
 */
export const reviewStockRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { approved_items, review_notes } = req.body;

    if (!approved_items || approved_items.length === 0) {
      res.status(400).json({ success: false, message: 'Approved items required' });
      return;
    }

    const result = await BranchInventoryService.approveStockRequest(
      id,
      req.user?.id,
      approved_items,
      review_notes
    );

    res.status(200).json({
      success: true,
      message: `Request ${result.status}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DISPATCH NOTES (Central → Branch)
// ============================================================

/**
 * Create dispatch note from approved request
 */
export const createDispatch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      request_id,
      to_branch_id,
      items,
      vehicle_number,
      driver_name,
      driver_phone,
      estimated_delivery,
      notes
    } = req.body;

    // Validate required fields
    if (!request_id) {
      res.status(400).json({ success: false, message: 'Stock request ID is required' });
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'At least one item is required for dispatch' });
      return;
    }

    // Validate items
    const invalidItems = items.filter(item => !item.item_sku || !item.dispatched_quantity || item.dispatched_quantity <= 0);
    if (invalidItems.length > 0) {
      res.status(400).json({
        success: false,
        message: 'All items must have a valid SKU and positive quantity',
        invalidItems
      });
      return;
    }

    // Validate user
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: 'User authentication required' });
      return;
    }

    // Get central warehouse
    const central = await BranchInventoryService.getCentralWarehouse();
    if (!central) {
      res.status(400).json({ success: false, message: 'Central warehouse not configured' });
      return;
    }

    // Check if user has permission to create dispatch from central warehouse
    if (req.user.branch_id !== central.id && !['super_admin', 'general_manager', 'central_storekeeper', 'auditor'].includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to create dispatches from central warehouse'
      });
      return;
    }

    // Verify the request exists and is in a valid status
    const { data: request, error: requestError } = await supabase
      .from('stock_requests')
      .select('status, requesting_branch_id')
      .eq('id', request_id)
      .single();

    if (requestError || !request) {
      res.status(404).json({ success: false, message: 'Stock request not found' });
      return;
    }

    // If to_branch_id is missing, derive it from the request
    let finalToBranchId = to_branch_id;
    if (!finalToBranchId) {
      finalToBranchId = request.requesting_branch_id;
    }

    if (!finalToBranchId) {
      res.status(400).json({ success: false, message: 'Destination branch ID is required' });
      return;
    }

    // Get destination branch code
    const { data: toBranch, error: branchError } = await supabase
      .from('branches')
      .select('code, name')
      .eq('id', finalToBranchId)
      .single();

    if (branchError || !toBranch?.code) {
      res.status(400).json({ success: false, message: 'Destination branch not found' });
      return;
    }

    if (!['APPROVED', 'PARTIALLY_APPROVED'].includes(request.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot create dispatch for request with status: ${request.status}. Request must be approved first.`
      });
      return;
    }

    // Verify the request is for the correct destination branch
    if (request.requesting_branch_id !== finalToBranchId) {
      res.status(400).json({
        success: false,
        message: 'Destination branch does not match the branch that made the request'
      });
      return;
    }

    try {
      const dispatch = await BranchInventoryService.createDispatchFromRequest(
        request_id,
        central.id,
        finalToBranchId,
        toBranch.code,
        req.user.id,
        items,
        vehicle_number,
        driver_name,
        driver_phone,
        estimated_delivery,
        notes
      );

      logger.info(`Dispatch note ${dispatch.dispatch_number} created by ${req.user.email} for branch ${toBranch.name}`);

      res.status(201).json({
        success: true,
        message: `Dispatch note ${dispatch.dispatch_number} created for ${toBranch.name}`,
        data: dispatch
      });
    } catch (serviceError: any) {
      logger.error(`Error creating dispatch for request ${request_id}:`, serviceError);
      res.status(500).json({
        success: false,
        message: `Failed to create dispatch: ${serviceError.message}`
      });
    }
  } catch (error: any) {
    logger.error('Unexpected error in createDispatch controller:', error);
    next(error);
  }
};

/**
 * Dispatch items (deduct from central, mark in-transit)
 */
export const dispatchItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Dispatch ID is required'
      });
      return;
    }

    // Validate user
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
      return;
    }

    // Get central warehouse
    const central = await BranchInventoryService.getCentralWarehouse();
    if (!central) {
      res.status(400).json({ success: false, message: 'Central warehouse not configured' });
      return;
    }

    // Check if user has permission to dispatch from this branch
    if (req.user.branch_id !== central.id && !['super_admin', 'general_manager', 'central_storekeeper', 'auditor'].includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to dispatch from central warehouse'
      });
      return;
    }

    try {
      const { vehicle_number, driver_name, driver_phone, estimated_delivery, notes, vehicle_id, driver_id } = req.body;

      // Resolve vehicle and driver names from IDs if text fields not provided
      let resolvedVehicleNumber = vehicle_number || '';
      let resolvedDriverName = driver_name || '';
      let resolvedDriverPhone = driver_phone || '';

      if (vehicle_id && !resolvedVehicleNumber) {
        const { data: vehicle , error } = await supabase.from('vehicles')
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
          .select('registration_number').eq('id', vehicle_id).single();
        if (vehicle) resolvedVehicleNumber = vehicle.registration_number;
      }

      if (driver_id && !resolvedDriverName) {
        if (driver_id.startsWith('staff-')) {
          const staffId = driver_id.replace('staff-', '');
          const { data: staff , error } = await supabase.from('staff_profiles')
          const { data: staff, error: staffError } = await supabase.from('staff_profiles')
            .select('first_name, last_name, phone').eq('id', staffId).single();
          
          if (staffError) {
            console.error('Database error:', staffError);
            throw staffError;
          }
          
          if (staff) {
            resolvedDriverName = `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
            if (!resolvedDriverPhone) resolvedDriverPhone = staff.phone || '';
          }
        } else {
          const { data: driver, error: driverError } = await supabase.from('drivers')
            .select('name, phone').eq('id', driver_id).single();
          
          if (driverError) {
            console.error('Database error:', driverError);
            throw driverError;
          }
          
          if (driver) {
            resolvedDriverName = driver.name;
            if (!resolvedDriverPhone) resolvedDriverPhone = driver.phone || '';
          }
        }
      }

      const dispatch = await BranchInventoryService.dispatchItems(id, req.user.id, {
        vehicle_number: resolvedVehicleNumber,
        driver_name: resolvedDriverName,
        driver_phone: resolvedDriverPhone,
        estimated_delivery,
        notes
      });

      logger.info(`Dispatch ${dispatch.dispatch_number} successfully sent by ${req.user.email}`);

      res.status(200).json({
        success: true,
        message: `Dispatch ${dispatch.dispatch_number} sent`,
        data: dispatch
      });
    } catch (serviceError: any) {
      logger.error(`Dispatch error for ID ${id}:`, serviceError);

      // Return appropriate status code based on error type
      if (serviceError.message.includes('not found') || serviceError.message.includes('couldn\'t be accessed')) {
        res.status(404).json({
          success: false,
          message: serviceError.message
        });
      } else if (serviceError.message.includes('already')) {
        res.status(409).json({
          success: false,
          message: serviceError.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to dispatch items: ${serviceError.message}`
        });
      }
    }
  } catch (error: any) {
    logger.error('Unexpected error in dispatchItems controller:', error);
    next(error);
  }
};

/**
 * Update dispatch logistics (vehicle/driver)
 */
export const updateDispatchLogistics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Dispatch ID is required'
      });
      return;
    }

    // Validate user
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
      return;
    }

    try {
      const { vehicle_number, driver_name, driver_phone, estimated_delivery, notes } = req.body;

      const dispatch = await BranchInventoryService.updateDispatchLogistics(id, req.user.id, {
        vehicle_number,
        driver_name,
        driver_phone,
        estimated_delivery,
        notes
      });

      logger.info(`Dispatch ${dispatch.dispatch_number} logistics updated by ${req.user.email}`);

      res.status(200).json({
        success: true,
        message: 'Dispatch logistics updated successfully',
        data: dispatch
      });
    } catch (serviceError: any) {
      logger.error(`Dispatch update error for ID ${id}:`, serviceError);

      if (serviceError.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: serviceError.message
        });
      } else if (serviceError.message.includes('Cannot update')) {
        res.status(409).json({
          success: false,
          message: serviceError.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to update dispatch: ${serviceError.message}`
        });
      }
    }
  } catch (error: any) {
    logger.error('Unexpected error in updateDispatchLogistics controller:', error);
    next(error);
  }
};

/**
 * Get dispatch history from central
 */
export const getDispatchHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const central = await BranchInventoryService.getCentralWarehouse();
    if (!central) {
      res.status(400).json({ success: false, message: 'Central warehouse not configured' });
      return;
    }

    const status = req.query.status as string;
    const data = await BranchInventoryService.getDispatchHistory(central.id, status);

    if (data?.length > 0) {
      // Debug logging for PDF generation issues
      logger.info(`Fetched ${data.length} dispatches. First dispatch ${data[0].dispatch_number} has ${data[0].items?.length} items.`);
      if (data[0].items?.length > 0) {
        logger.info(`First Item Sample: ${JSON.stringify(data[0].items[0])}`);
      }
    }

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get incoming dispatches for branch
 */
export const getIncomingDispatches = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const isCentral = isGlobalRole(req.user?.role);

    if (!isCentral) {
      branchId = req.user?.branch_id;
    }

    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    const data = await BranchInventoryService.getIncomingDispatches(branchId);

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm delivery at branch
 */
export const confirmDelivery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { received_items, items_received, delivery_notes, discrepancy_notes } = req.body;
    const items = items_received || received_items;
    const notes = discrepancy_notes || delivery_notes;

    if (!items || items.length === 0) {
      res.status(400).json({ success: false, message: 'Received items required' });
      return;
    }

    const result = await BranchInventoryService.confirmDelivery(
      id,
      req.user?.id,
      items,
      notes
    );

    res.status(200).json({
      success: true,
      message: `Delivery ${result.status}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DASHBOARD & STATS
// ============================================================

/**
 * Get central dashboard stats
 */
export const getCentralDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let central = null;
    try {
      central = await BranchInventoryService.getCentralWarehouse();
    } catch (e) {
      logger.warn('Central warehouse not found in branches table');
    }
    
    const stats = await BranchInventoryService.getCentralDashboardStats();
    const branches = await BranchInventoryService.getAllBranches();

    // Get central stock or just some recent items if no warehouse
    let centralStock: any[] = [];
    try {
      const { data } = await supabase
        .from('simple_items')
        .select('*')
        .eq('is_active', true)
        .order('last_updated', { ascending: false })
        .limit(10);
      centralStock = data || [];
    } catch (e) {
      logger.error('Error fetching recent items for dashboard:', e);
    }

    res.status(200).json({
      success: true,
      count: centralStock.length,
      data: {
        stats,
        centralWarehouse: central,
        branches: branches?.filter(b => !b.is_central_warehouse) || [],
        totalItems: stats.totalMasterItems || 0,
        lowStockItems: stats.totalLowStockItems || 0,
        // Compat with frontend expectations
        totalMasterItems: stats.totalMasterItems || 0,
        inTransit: stats.inTransit || 0,
        lowStockCount: stats.totalLowStockItems || 0,
        recentItems: centralStock
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get branch dashboard stats
 */
export const getBranchDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const isCentral = ['super_admin', 'general_manager', 'auditor', 'central_storekeeper'].includes(req.user?.role || '');

    if (!branchId) {
      if (isCentral) {
        res.status(200).json({ success: true, data: { stats: {}, branch: null, recentMovements: [] } });
        return;
      }
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    const stats = await BranchInventoryService.getBranchDashboardStats(branchId);

    // Get branch info
    const { data: branch } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single();

    // Get recent movements
    const { data: movements } = await supabase
      .from('branch_stock_movements')
      .select(`
        *,
        item:simple_items(sku, item_name)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        stats,
        branch,
        recentMovements: movements
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all branches with stock summary
 */
export const getBranchesWithStock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: branches, error } = await supabase
      .from('branches')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (error) throw error;

    // Get stock counts per branch
    const branchesWithStock = await Promise.all(
      (branches || []).map(async (branch) => {
        const { count } = await supabase
          .from('branch_stock')
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', branch.id);

        const { count: lowCount } = await supabase
          .from('branch_stock')
          .select('*', { count: 'exact', head: true })
          .eq('branch_id', branch.id)
          .lte('quantity', 10);

        return {
          ...branch,
          totalItems: count || 0,
          lowStockItems: lowCount || 0
        };
      })
    );

    res.status(200).json({
      success: true,
      data: branchesWithStock
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get master product catalog (for all branches to view)
 */
export const getMasterCatalog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category, search } = req.query;

    let query = supabase
      .from('simple_items')
      .select('*')
      .eq('is_active', true)
      .order('item_name');

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`item_name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stock movements for a branch
 */
export const getStockMovements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const isCentral = ['super_admin', 'general_manager', 'auditor', 'central_storekeeper'].includes(req.user?.role || '');
    const limit = parseInt(req.query.limit as string) || 50;

    if (!branchId) {
      if (isCentral) {
        res.status(200).json({ success: true, count: 0, data: [] });
        return;
      }
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    // Fetch movements first
    const { data: movements, error: moveError } = await supabase
      .from('branch_stock_movements')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (moveError) throw moveError;

    if (!movements || movements.length === 0) {
      res.status(200).json({ success: true, count: 0, data: [] });
      return;
    }

    // Get unique SKUs
    const skus = Array.from(new Set(movements.map(m => m.item_sku).filter(Boolean)));

    // Fetch items for these SKUs
    const { data: items, error: itemsError } = await supabase
      .from('simple_items')
      .select('sku, item_name, category')
      .in('sku', skus);

    if (itemsError) throw itemsError;

    // Create lookup map
    const itemMap = (items || []).reduce((acc: any, item: any) => {
      acc[item.sku] = item;
      return acc;
    }, {});

    // Get unique performer IDs and resolve to names
    const performerIds = Array.from(new Set(movements.map(m => m.performed_by).filter(Boolean)));
    let userMap: Record<string, string> = {};
    if (performerIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', performerIds);
      userMap = (users || []).reduce((acc: any, u: any) => {
        // Safe concatenation of names
        const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ');
        acc[u.id] = fullName || u.email || u.id;
        return acc;
      }, {});
    }

    // Join manually
    const data = movements.map(m => ({
      ...m,
      performed_by: m.performed_by ? (userMap[m.performed_by] || m.performed_by) : null,
      item: itemMap[m.item_sku] || null
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    next(error);
  }
};
