/**
 * Multi-Branch Inventory Controller
 * Handles stock requests, dispatch notes, and branch stock management
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import * as BranchInventoryService from '../../services/branch-inventory.service';

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
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    
    if (!branchId) {
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
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    
    if (!branchId) {
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
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const status = req.query.status as string;

    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    let query = supabase
      .from('stock_requests')
      .select(`
        *,
        items:stock_request_items(
          *,
          item:simple_items(sku, item_name, description, category, unit_of_measure)
        ),
        reviewer:users!stock_requests_reviewed_by_fkey(id, full_name)
      `)
      .eq('requesting_branch_id', branchId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
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

    // Get central warehouse
    const central = await BranchInventoryService.getCentralWarehouse();
    if (!central) {
      res.status(400).json({ success: false, message: 'Central warehouse not configured' });
      return;
    }

    // Get destination branch code
    const { data: toBranch } = await supabase
      .from('branches')
      .select('code')
      .eq('id', to_branch_id)
      .single();

    if (!toBranch?.code) {
      res.status(400).json({ success: false, message: 'Destination branch not found' });
      return;
    }

    const dispatch = await BranchInventoryService.createDispatchFromRequest(
      request_id,
      central.id,
      to_branch_id,
      toBranch.code,
      req.user?.id,
      items,
      vehicle_number,
      driver_name,
      driver_phone,
      estimated_delivery,
      notes
    );

    res.status(201).json({
      success: true,
      message: `Dispatch note ${dispatch.dispatch_number} created`,
      data: dispatch
    });
  } catch (error) {
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

    const dispatch = await BranchInventoryService.dispatchItems(id, req.user?.id);

    res.status(200).json({
      success: true,
      message: `Dispatch ${dispatch.dispatch_number} sent`,
      data: dispatch
    });
  } catch (error) {
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
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;

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
    const { received_items, delivery_notes } = req.body;

    if (!received_items || received_items.length === 0) {
      res.status(400).json({ success: false, message: 'Received items required' });
      return;
    }

    const result = await BranchInventoryService.confirmDelivery(
      id,
      req.user?.id,
      received_items,
      delivery_notes
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
    const stats = await BranchInventoryService.getCentralDashboardStats();
    const central = await BranchInventoryService.getCentralWarehouse();
    const branches = await BranchInventoryService.getAllBranches();

    // Get central stock
    let centralStock: any[] = [];
    if (central) {
      const { data } = await supabase
        .from('simple_items')
        .select('*')
        .eq('is_active', true)
        .order('quantity', { ascending: true })
        .limit(20);
      centralStock = data || [];
    }

    res.status(200).json({
      success: true,
      data: {
        stats,
        centralWarehouse: central,
        branches: branches?.filter(b => !b.is_central_warehouse),
        lowStockItems: centralStock.filter(i => (i.quantity || 0) <= (i.reorder_level || 10))
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

    if (!branchId) {
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
    const limit = parseInt(req.query.limit as string) || 50;

    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    const { data, error } = await supabase
      .from('branch_stock_movements')
      .select(`
        *,
        item:simple_items(sku, item_name, category)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit);

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
