/**
 * Multi-Branch Inventory Service
 * Handles stock requests, dispatch notes, and branch stock management
 */

import { supabase } from '../config/database';
import { logger } from '../utils/logger';

// ============================================================
// TYPES
// ============================================================

export interface StockRequestItem {
  item_sku: string;
  requested_quantity: number;
  current_branch_stock?: number;
}

export interface DispatchItem {
  item_sku: string;
  dispatched_quantity: number;
  batch_number?: string;
  expiry_date?: string;
  bin_location?: string;
}

// ============================================================
// BRANCH STOCK MANAGEMENT
// ============================================================

/**
 * Get stock for a specific branch
 */
export async function getBranchStock(branchId: number) {
  const { data: stock, error } = await supabase
    .from('branch_stock')
    .select('*')
    .eq('branch_id', branchId)
    .order('quantity', { ascending: true });

  if (error) throw error;
  if (!stock || stock.length === 0) return [];

  // Manual join with simple_items
  const skus = stock.map(s => s.item_sku);
  const { data: items } = await supabase
    .from('simple_items')
    .select('sku, item_name, description, category, unit_of_measure, retail_price, cost_price')
    .in('sku', skus);

  return stock.map(s => ({
    ...s,
    item: items?.find(i => i.sku === s.item_sku)
  }));
}

/**
 * Get low stock items for a branch
 */
export async function getLowStockItems(branchId: number) {
  const { data: stock, error } = await supabase
    .from('branch_stock')
    .select('*')
    .eq('branch_id', branchId)
    .lte('quantity', 10) // Fallback static value if RPC fails or simplifies query
    .order('quantity', { ascending: true });

  if (error) throw error;
  if (!stock || stock.length === 0) return [];

  // Manual join with simple_items
  const skus = stock.map(s => s.item_sku);
  const { data: items } = await supabase
    .from('simple_items')
    .select('sku, item_name, description, category, unit_of_measure, retail_price')
    .in('sku', skus);

  return stock.map(s => ({
    ...s,
    item: items?.find(i => i.sku === s.item_sku)
  }));
}

/**
 * Initialize branch stock for a new item (when central creates item)
 */
export async function initializeBranchStock(itemSku: string, branches: number[]) {
  const stockRecords = branches.map(branchId => ({
    branch_id: branchId,
    item_sku: itemSku,
    quantity: 0,
    reorder_level: 10,
    max_stock_level: 100
  }));

  const { error } = await supabase
    .from('branch_stock')
    .upsert(stockRecords, { onConflict: 'branch_id,item_sku' });

  if (error) throw error;
}

/**
 * Update branch stock quantity
 */
export async function updateBranchStock(
  branchId: number,
  itemSku: string,
  quantityChange: number,
  movementType: string,
  userId: string,
  referenceType?: string,
  referenceId?: string,
  referenceNumber?: string,
  notes?: string
) {
  // Get current stock
  const { data: current, error: fetchError } = await supabase
    .from('branch_stock')
    .select('quantity')
    .eq('branch_id', branchId)
    .eq('item_sku', itemSku)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

  const previousStock = current?.quantity || 0;
  const newStock = previousStock + quantityChange;

  // Update or insert stock
  const { error: updateError } = await supabase
    .from('branch_stock')
    .upsert({
      branch_id: branchId,
      item_sku: itemSku,
      quantity: Math.max(0, newStock),
      last_stock_in: quantityChange > 0 ? new Date().toISOString() : undefined,
      last_stock_out: quantityChange < 0 ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString()
    }, { onConflict: 'branch_id,item_sku' });

  if (updateError) throw updateError;

  // Log movement
  await supabase.from('branch_stock_movements').insert({
    branch_id: branchId,
    item_sku: itemSku,
    movement_type: movementType,
    quantity: Math.abs(quantityChange),
    previous_stock: previousStock,
    new_stock: Math.max(0, newStock),
    reference_type: referenceType,
    reference_id: referenceId,
    reference_number: referenceNumber,
    notes,
    performed_by: userId
  });

  return { previousStock, newStock: Math.max(0, newStock) };
}

// ============================================================
// STOCK REQUESTS
// ============================================================

/**
 * Generate stock request number
 */
export async function generateStockRequestNumber(branchCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_stock_request_number', {
    p_branch_code: branchCode
  });

  if (error) {
    // Fallback: generate manually
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `FGH-SR-${branchCode.toUpperCase()}-${date}-${random}`;
  }

  return data;
}

/**
 * Create a new stock request
 */
export async function createStockRequest(
  branchId: number,
  branchCode: string,
  userId: string,
  items: StockRequestItem[],
  requestType: string = 'ROUTINE',
  priority: string = 'NORMAL',
  reason?: string,
  neededByDate?: string
) {
  // Generate request number
  const requestNumber = await generateStockRequestNumber(branchCode);

  // Create request
  const { data: request, error: requestError } = await supabase
    .from('stock_requests')
    .insert({
      request_number: requestNumber,
      requesting_branch_id: branchId,
      requested_by: userId,
      request_type: requestType,
      priority,
      reason,
      needed_by_date: neededByDate,
      status: 'PENDING'
    })
    .select()
    .single();

  if (requestError) throw requestError;

  // Add items
  const requestItems = items.map(item => ({
    request_id: request.id,
    item_sku: item.item_sku,
    requested_quantity: item.requested_quantity,
    current_branch_stock: item.current_branch_stock || 0,
    status: 'PENDING'
  }));

  const { error: itemsError } = await supabase
    .from('stock_request_items')
    .insert(requestItems);

  if (itemsError) throw itemsError;

  logger.info(`Stock request created: ${requestNumber} by branch ${branchCode}`);

  return { ...request, items: requestItems };
}

/**
 * Get stock requests for a branch (or all branches if branchId is null)
 */
export async function getBranchRequests(branchId: number | null, status?: string) {
  let query = supabase
    .from('stock_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (branchId) {
    query = query.eq('requesting_branch_id', branchId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data: requests, error } = await query;
  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  // Get request items
  const requestIds = requests.map(r => r.id);
  const { data: items } = await supabase
    .from('stock_request_items')
    .select('*')
    .in('request_id', requestIds);

  // Get item details
  const skus = [...new Set((items || []).map(i => i.item_sku))];
  const { data: itemDetails } = await supabase
    .from('simple_items')
    .select('sku, item_name, description, category, unit_of_measure')
    .in('sku', skus);

  // Get reviewer details (if any)
  const reviewerIds = [...new Set(requests.map(r => r.reviewed_by).filter(id => id))];
  let reviewers: any[] = [];
  if (reviewerIds.length > 0) {
    const { data: r } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', reviewerIds);
    reviewers = r || [];
  }

  // Get branch details if fetching for all branches
  let branches: any[] = [];
  if (!branchId) {
    const branchIds = [...new Set(requests.map(r => r.requesting_branch_id))];
    const { data: b } = await supabase
      .from('branches')
      .select('id, name, code')
      .in('id', branchIds);
    branches = b || [];
  }

  return requests.map(req => ({
    ...req,
    branch_name: branchId ? undefined : branches.find(b => b.id === req.requesting_branch_id)?.name,
    items: (items || [])
      .filter(i => i.request_id === req.id)
      .map(i => ({
        ...i,
        item: itemDetails?.find(d => d.sku === i.item_sku)
      })),
    reviewer: reviewers.find(r => r.id === req.reviewed_by)
  }));
}

/**
 * Get stock requests for central review
 */
export async function getPendingRequests() {
  // Get requests
  const { data: requests, error } = await supabase
    .from('stock_requests')
    .select('*')
    .in('status', ['PENDING', 'UNDER_REVIEW'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  // Get branches for these requests
  const branchIds = [...new Set(requests.map(r => r.branch_id))];
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, code, location')
    .in('id', branchIds);

  // Get items for these requests
  const requestIds = requests.map(r => r.id);
  const { data: items } = await supabase
    .from('stock_request_items')
    .select('*')
    .in('request_id', requestIds);

  // Get item details
  const itemSkus = [...new Set((items || []).map(i => i.item_sku))];
  const { data: itemDetails } = await supabase
    .from('simple_items')
    .select('sku, item_name, description, category, unit_of_measure')
    .in('sku', itemSkus);

  // Combine data
  return requests.map(request => ({
    ...request,
    branch: branches?.find(b => b.id === request.branch_id) || { id: request.branch_id, name: 'Unknown', code: 'UNK', location: '' },
    items: (items || [])
      .filter(i => i.request_id === request.id)
      .map(item => ({
        ...item,
        item: itemDetails?.find(d => d.sku === item.item_sku)
      }))
  }));
}

/**
 * Approve stock request (by central)
 */
export async function approveStockRequest(
  requestId: string,
  reviewerId: string,
  approvedItems: { id: string; approved_quantity: number; status: string; rejection_reason?: string }[],
  reviewNotes?: string
) {
  // Update request
  const allApproved = approvedItems.every(i => i.status === 'APPROVED');
  const allRejected = approvedItems.every(i => i.status === 'REJECTED');

  const newStatus = allRejected ? 'REJECTED' : allApproved ? 'APPROVED' : 'PARTIALLY_APPROVED';

  const { error: requestError } = await supabase
    .from('stock_requests')
    .update({
      status: newStatus,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (requestError) throw requestError;

  // Update items
  for (const item of approvedItems) {
    await supabase
      .from('stock_request_items')
      .update({
        approved_quantity: item.approved_quantity,
        status: item.status,
        rejection_reason: item.rejection_reason
      })
      .eq('id', item.id);
  }

  logger.info(`Stock request ${requestId} reviewed: ${newStatus}`);

  return { status: newStatus };
}

// ============================================================
// DISPATCH NOTES
// ============================================================

/**
 * Generate dispatch note number
 */
export async function generateDispatchNumber(branchCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_next_dispatch_number', {
    p_branch_code: branchCode
  });

  if (error) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `FGH-DN-${branchCode.toUpperCase()}-${date}-${random}`;
  }

  return data;
}

/**
 * Create dispatch note from approved request
 */
export async function createDispatchFromRequest(
  requestId: string,
  fromBranchId: number,
  toBranchId: number,
  toBranchCode: string,
  userId: string,
  items: DispatchItem[],
  vehicleNumber?: string,
  driverName?: string,
  driverPhone?: string,
  estimatedDelivery?: string,
  notes?: string
) {
  // Generate dispatch number
  const dispatchNumber = await generateDispatchNumber(toBranchCode);

  // Create dispatch note
  const { data: dispatch, error: dispatchError } = await supabase
    .from('dispatch_notes')
    .insert({
      dispatch_number: dispatchNumber,
      stock_request_id: requestId,
      from_branch_id: fromBranchId,
      to_branch_id: toBranchId,
      created_by: userId,
      status: 'PENDING', // Changed from DRAFT to PENDING to match status check in frontend
      vehicle_number: vehicleNumber,
      driver_name: driverName,
      driver_phone: driverPhone,
      estimated_delivery: estimatedDelivery,
      dispatch_notes: notes
    })
    .select()
    .single();

  if (dispatchError) throw dispatchError;

  // Add items
  const dispatchItems = items.map(item => ({
    dispatch_id: dispatch.id,
    item_sku: item.item_sku,
    dispatched_quantity: item.dispatched_quantity,
    batch_number: item.batch_number,
    expiry_date: item.expiry_date,
    bin_location: item.bin_location,
    status: 'PENDING'
  }));

  const { error: itemsError } = await supabase
    .from('dispatch_items')
    .insert(dispatchItems);

  if (itemsError) throw itemsError;

  // Update request status
  await supabase
    .from('stock_requests')
    .update({ status: 'DISPATCHED', updated_at: new Date().toISOString() })
    .eq('id', requestId);

  logger.info(`Dispatch note created: ${dispatchNumber} for request ${requestId}`);

  return { ...dispatch, items: dispatchItems };
}

/**
 * Dispatch items (deduct from central, move to in-transit)
 */
export async function dispatchItems(
  dispatchId: string,
  dispatcherId: string
) {
  try {
    // Validate dispatch ID
    if (!dispatchId) {
      throw new Error('Dispatch ID is required');
    }

    // Get dispatch details
    const { data: dispatch, error: fetchError } = await supabase
      .from('dispatch_notes')
      .select(`
        *,
        items:dispatch_items(*)
      `)
      .eq('id', dispatchId)
      .single();

    if (fetchError) {
      logger.error(`Error fetching dispatch ${dispatchId}:`, fetchError);
      throw new Error(`Dispatch not found or couldn't be accessed: ${fetchError.message}`);
    }

    if (!dispatch) {
      throw new Error('Dispatch note not found');
    }

    // Check if dispatch has already been processed
    if (dispatch.status !== 'PENDING') {
      throw new Error(`Dispatch is already ${dispatch.status.toLowerCase()}`);
    }

    // Check if dispatch has items
    if (!dispatch.items || dispatch.items.length === 0) {
      throw new Error('No items found in dispatch note');
    }

    // Deduct from central warehouse stock
    for (const item of dispatch.items) {
      try {
        await updateBranchStock(
          dispatch.from_branch_id,
          item.item_sku,
          -item.dispatched_quantity,
          'DISPATCH_OUT',
          dispatcherId,
          'DISPATCH',
          dispatchId,
          dispatch.dispatch_number
        );

        // Add to in-transit
        const { error: transitError } = await supabase.from('in_transit_stock').insert({
          dispatch_id: dispatchId,
          item_sku: item.item_sku,
          quantity: item.dispatched_quantity
        });

        if (transitError) {
          logger.error(`Error adding item ${item.item_sku} to in-transit:`, transitError);
          throw transitError;
        }
      } catch (itemError: any) {
        logger.error(`Error processing item ${item.item_sku}:`, itemError);
        throw new Error(`Error processing item ${item.item_sku}: ${itemError.message}`);
      }
    }

    // Update dispatch status
    const { data: updatedDispatch, error: updateError } = await supabase
      .from('dispatch_notes')
      .update({
        status: 'IN_TRANSIT',
        dispatcher_id: dispatcherId,
        dispatched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', dispatchId)
      .select()
      .single();

    if (updateError) {
      logger.error(`Error updating dispatch status:`, updateError);
      throw updateError;
    }

    logger.info(`Dispatch ${dispatch.dispatch_number} sent to transit`);

    return updatedDispatch || dispatch;
  } catch (error) {
    // Rollback logic could be implemented here for transactional integrity
    logger.error(`Failed to dispatch items:`, error);
    throw error;
  }
}

/**
 * Confirm delivery at branch
 */
export async function confirmDelivery(
  dispatchId: string,
  receiverId: string,
  receivedItems: { id: string; received_quantity: number; damaged_quantity?: number; missing_quantity?: number; discrepancy_reason?: string }[],
  deliveryNotes?: string
) {
  // Get dispatch details
  const { data: dispatch, error: fetchError } = await supabase
    .from('dispatch_notes')
    .select('*, items:dispatch_items(*)')
    .eq('id', dispatchId)
    .single();

  if (fetchError) throw fetchError;

  // Update each item and add to branch stock
  for (const receivedItem of receivedItems) {
    const dispatchItem = dispatch.items.find((i: any) => i.id === receivedItem.id);
    if (!dispatchItem) continue;

    // Update dispatch item
    await supabase
      .from('dispatch_items')
      .update({
        received_quantity: receivedItem.received_quantity,
        damaged_quantity: receivedItem.damaged_quantity || 0,
        missing_quantity: receivedItem.missing_quantity || 0,
        discrepancy_reason: receivedItem.discrepancy_reason,
        status: receivedItem.received_quantity === dispatchItem.dispatched_quantity ? 'RECEIVED' : 'PARTIAL'
      })
      .eq('id', receivedItem.id);

    // Add to branch stock
    await updateBranchStock(
      dispatch.to_branch_id,
      dispatchItem.item_sku,
      receivedItem.received_quantity,
      'DISPATCH_RECEIVE',
      receiverId,
      'DISPATCH',
      dispatchId,
      dispatch.dispatch_number
    );
  }

  // Clear in-transit
  await supabase
    .from('in_transit_stock')
    .delete()
    .eq('dispatch_id', dispatchId);

  // Check if any discrepancies
  const hasDiscrepancies = receivedItems.some(
    i => (i.damaged_quantity || 0) > 0 || (i.missing_quantity || 0) > 0
  );

  // Update dispatch status
  const { error: updateError } = await supabase
    .from('dispatch_notes')
    .update({
      status: hasDiscrepancies ? 'DISPUTED' : 'CONFIRMED',
      receiver_id: receiverId,
      delivered_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      delivery_notes: deliveryNotes,
      discrepancy_notes: hasDiscrepancies ? 'Discrepancies reported' : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', dispatchId);

  if (updateError) throw updateError;

  // Update original request
  if (dispatch.stock_request_id) {
    await supabase
      .from('stock_requests')
      .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
      .eq('id', dispatch.stock_request_id);
  }

  logger.info(`Dispatch ${dispatch.dispatch_number} confirmed at branch`);

  return { status: hasDiscrepancies ? 'DISPUTED' : 'CONFIRMED' };
}

/**
 * Get incoming dispatches for a branch
 */
export async function getIncomingDispatches(branchId: number) {
  // Get dispatches
  const { data: dispatches, error } = await supabase
    .from('dispatch_notes')
    .select('*')
    .eq('to_branch_id', branchId)
    .in('status', ['IN_TRANSIT', 'DELIVERED', 'CONFIRMED', 'DISPUTED'])
    .order('dispatched_at', { ascending: false });

  if (error) throw error;
  if (!dispatches || dispatches.length === 0) return [];

  // Get from branches
  const branchIds = [...new Set(dispatches.map(d => d.from_branch_id))];
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, code')
    .in('id', branchIds);

  // Get dispatch items
  const dispatchIds = dispatches.map(d => d.id);
  const { data: items } = await supabase
    .from('dispatch_items')
    .select('*')
    .in('dispatch_id', dispatchIds);

  // Get item details
  const itemSkus = [...new Set((items || []).map(i => i.item_sku))];
  const { data: itemDetails } = await supabase
    .from('simple_items')
    .select('sku, item_name, description, unit_of_measure')
    .in('sku', itemSkus.length > 0 ? itemSkus : ['']);

  // Combine
  const data = dispatches.map(dispatch => ({
    ...dispatch,
    from_branch: branches?.find(b => b.id === dispatch.from_branch_id),
    items: (items || [])
      .filter(i => i.dispatch_id === dispatch.id)
      .map(item => ({
        ...item,
        item: itemDetails?.find(d => d.sku === item.item_sku)
      }))
  }));
  return data;
}

/**
 * Get dispatch history from central
 */
export async function getDispatchHistory(fromBranchId: number, status?: string) {
  let query = supabase
    .from('dispatch_notes')
    .select('*')
    .eq('from_branch_id', fromBranchId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data: dispatches, error } = await query;
  if (error) throw error;
  if (!dispatches || dispatches.length === 0) return [];

  // Get to branches
  const branchIds = [...new Set(dispatches.map(d => d.to_branch_id))];
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, code')
    .in('id', branchIds);

  // Get item counts
  const dispatchIds = dispatches.map(d => d.id);
  const { data: items } = await supabase
    .from('dispatch_items')
    .select('dispatch_id')
    .in('dispatch_id', dispatchIds);

  return dispatches.map(dispatch => ({
    ...dispatch,
    to_branch: branches?.find(b => b.id === dispatch.to_branch_id),
    items_count: (items || []).filter(i => i.dispatch_id === dispatch.id).length
  }));
}

// ============================================================
// CENTRAL WAREHOUSE HELPERS
// ============================================================

/**
 * Get central warehouse branch
 */
export async function getCentralWarehouse() {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('is_central_warehouse', true)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check if user is central storekeeper
 */
export async function isCentralStorekeeper(userId: string, branchId: number): Promise<boolean> {
  const { data: branch } = await supabase
    .from('branches')
    .select('is_central_warehouse')
    .eq('id', branchId)
    .single();

  return branch?.is_central_warehouse === true;
}

/**
 * Get all branches (for central to dispatch to)
 */
export async function getAllBranches() {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('status', 'active')
    .order('name');

  if (error) throw error;
  return data;
}

/**
 * Get dashboard stats for central
 */
export async function getCentralDashboardStats() {
  const [pendingRequests, inTransit, lowStock, recentDispatches] = await Promise.all([
    supabase.from('stock_requests').select('id', { count: 'exact', head: true }).in('status', ['PENDING', 'UNDER_REVIEW']),
    supabase.from('dispatch_notes').select('id', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT'),
    supabase.from('branch_stock').select('id', { count: 'exact', head: true }).lte('quantity', 10), // Low stock items
    supabase.from('dispatch_notes').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  ]);

  return {
    pendingRequests: pendingRequests.count || 0,
    inTransit: inTransit.count || 0,
    lowStockBranches: lowStock.count || 0,
    weeklyDispatches: recentDispatches.count || 0
  };
}

/**
 * Get dashboard stats for branch
 */
export async function getBranchDashboardStats(branchId: number) {
  const [totalItems, lowStock, pendingRequests, incomingDispatches] = await Promise.all([
    supabase.from('branch_stock').select('id', { count: 'exact' }).eq('branch_id', branchId),
    supabase.from('branch_stock').select('id', { count: 'exact' }).eq('branch_id', branchId).lte('quantity', 10), // Simplified
    supabase.from('stock_requests').select('id', { count: 'exact' }).eq('requesting_branch_id', branchId).in('status', ['PENDING', 'APPROVED']),
    supabase.from('dispatch_notes').select('id', { count: 'exact' }).eq('to_branch_id', branchId).eq('status', 'IN_TRANSIT')
  ]);

  return {
    totalItems: totalItems.count || 0,
    lowStock: lowStock.count || 0,
    pendingRequests: pendingRequests.count || 0,
    incomingDispatches: incomingDispatches.count || 0
  };
}
