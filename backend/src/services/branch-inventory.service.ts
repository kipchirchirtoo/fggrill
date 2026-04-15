/**
 * Multi-Branch Inventory Service
 * Handles stock requests, dispatch notes, and branch stock management
 */

import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import notificationService from './notification.service';

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
  notes?: string,
  reorderLevel?: number
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
      reorder_level: reorderLevel !== undefined ? reorderLevel : undefined,
      last_stock_in: quantityChange > 0 ? new Date().toISOString() : undefined,
      last_stock_out: quantityChange < 0 ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString()
    }, { onConflict: 'branch_id,item_sku' });

  if (updateError) throw updateError;

  // Log movement
  const { error } = await supabase.from('branch_stock_movements').insert({
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

  if (error) {

    console.error('Database error:', error);

    throw error;

  }

  // Notify Auditor for specific movement types
  if (movementType === 'STOCK_OUT') {
    try {
      // Get item and branch names for the notification
      const [itemRes, branchRes] = await Promise.all([
        supabase.from('simple_items').select('item_name').eq('sku', itemSku).single(),
        supabase.from('branches').select('name').eq('id', branchId).single()
      ]);

      const itemName = itemRes.data?.item_name || itemSku;
      const branchName = branchRes.data?.name || `Branch #${branchId}`;

      await notificationService.notifyRole(
        'auditor',
        'Stock Issued (Stock Out)',
        `${branchName} has issued ${Math.abs(quantityChange)} units of ${itemName}. Reason: ${notes || 'Not specified'}`,
        {
          type: 'warning',
          category: 'stock',
          priority: 'medium',
          branchId: branchId,
          actionUrl: `/dashboard/branch-store/stock-out?branch_id=${branchId}`,
          metadata: {
            branch_id: branchId,
            item_sku: itemSku,
            quantity: Math.abs(quantityChange),
            reason: notes
          }
        }
      );
    } catch (notifyError) {
      logger.error('Failed to notify auditor of stock out', notifyError);
    }
  }

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
      status: 'PENDING_AUDIT'
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
    status: 'PENDING_AUDIT'
  }));

  const { error: itemsError } = await supabase
    .from('stock_request_items')
    .insert(requestItems);

  if (itemsError) throw itemsError;

  logger.info(`Stock request created: ${requestNumber} by branch ${branchCode}`);

  // Notify Auditor
  try {
    // Fetch branch name for notification
    const { data: branchData } = await supabase
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single();

    const branchName = branchData?.name || branchCode;

    await notificationService.notifyRole(
      'auditor',
      'New Stock Request for Review',
      `${branchName} branch has submitted a new stock request (${requestNumber}). Approval required.`,
      {
        type: 'info',
        category: 'stock',
        priority: priority === 'URGENT' ? 'urgent' : 'medium',
        branchId: branchId,
        actionUrl: '/dashboard/auditor/approvals',
        metadata: {
          request_id: request.id,
          branch_code: branchCode,
          branch_name: branchName
        }
      }
    );
  } catch (error) {
    logger.error('Failed to send stock request notification', error);
  }

  return { ...request, items: requestItems };
}

/**
 * Get stock requests for a branch (or all branches if branchId is null)
 */
export async function getRequests(branchId: number | null, status?: string) {
  let query = supabase
    .from('stock_requests')
    .select('*, requesting_branch:branches!requesting_branch_id(name)')
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

  // Get dispatch notes linked to these requests (to show distributed quantities)
  const { data: dispatches } = await supabase
    .from('dispatch_notes')
    .select('id, stock_request_id, status, dispatch_number, dispatched_at')
    .in('stock_request_id', requestIds);

  let dispatchItems: any[] = [];
  if (dispatches && dispatches.length > 0) {
    const dispatchIds = dispatches.map(d => d.id);
    const { data: dItems } = await supabase
      .from('dispatch_items')
      .select('dispatch_id, item_sku, dispatched_quantity, status')
      .in('dispatch_id', dispatchIds);
    dispatchItems = dItems || [];
  }

  // Map items and reviewers back to requests
  return requests.map(request => {
    // Find dispatch(es) for this request
    const requestDispatches = (dispatches || []).filter(d => d.stock_request_id === request.id);
    const requestDispatchIds = requestDispatches.map(d => d.id);
    const requestDispatchItems = dispatchItems.filter(di => requestDispatchIds.includes(di.dispatch_id));

    // Latest dispatch info
    const latestDispatch = requestDispatches[0] || null;

    return {
      ...request,
      branch: request.requesting_branch || { name: 'Unknown' },
      branch_name: request.requesting_branch?.name || 'Unknown',
      dispatch_number: latestDispatch?.dispatch_number || null,
      dispatch_status: latestDispatch?.status || null,
      dispatched_at: latestDispatch?.dispatched_at || null,
      items: (items || []).filter(i => i.request_id === request.id).map(i => {
        const details = itemDetails?.find(id => id.sku === i.item_sku);
        // Sum dispatched quantity across all dispatches for this item
        const dispatched_quantity = requestDispatchItems
          .filter(di => di.item_sku === i.item_sku)
          .reduce((sum: number, di: any) => sum + (di.dispatched_quantity || 0), 0);
        return {
          ...i,
          item: details,
          item_name: details?.item_name || i.item_sku,
          unit: details?.unit_of_measure || '',
          dispatched_quantity: dispatched_quantity || null
        };
      }),
      reviewed_by_user: reviewers.find(r => r.id === request.reviewed_by)
    };
  });
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
  const branchIds = [...new Set(requests.map(r => r.requesting_branch_id))];
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
    branch: branches?.find(b => b.id === request.requesting_branch_id) || { id: request.requesting_branch_id, name: 'Unknown', code: 'UNK', location: '' },
    branch_name: branches?.find(b => b.id === request.requesting_branch_id)?.name || 'Unknown',
    items: (items || [])
      .filter(i => i.request_id === request.id)
      .map(item => {
        const details = itemDetails?.find(d => d.sku === item.item_sku);
        return {
          ...item,
          item: details,
          item_name: details?.item_name || item.item_sku,
          unit: details?.unit_of_measure || ''
        };
      })
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

  // Notify Central Ops Manager if Approved
  if (newStatus === 'APPROVED') {
    try {
      // Fetch request details for notification
      const { data: requestDetails } = await supabase
        .from('stock_requests')
        .select('request_number, requesting_branch_id')
        .eq('id', requestId)
        .single();

      if (requestDetails) {
        // Notify Central Storekeeper to start packing
        await notificationService.notifyRole(
          'central_storekeeper',
          'Stock Request Approved',
          `Stock Request ${requestDetails.request_number} has been approved. Please proceed to packing.`,
          {
            type: 'info',
            category: 'stock',
            priority: 'high',
            actionUrl: '/dashboard/central-store/packing',
            metadata: { request_id: requestId, branch_id: requestDetails.requesting_branch_id }
          }
        );

        // Also notify general manager as per current flow
        await notificationService.notifyRole(
          'general_manager',
          'Stock Request Approved',
          `Stock Request ${requestDetails.request_number} approved by Auditor. Ready for fulfillment.`,
          {
            type: 'info',
            category: 'stock',
            priority: 'high',
            actionUrl: '/dashboard/central-store/dispatch',
            metadata: { request_id: requestId, branch_id: requestDetails.requesting_branch_id }
          }
        );

        // Also notify requesting branch
        await notificationService.notifyBranch(
          requestDetails.requesting_branch_id,
          `Stock Request ${newStatus}`,
          `Your stock request ${requestDetails.request_number} has been ${newStatus.toLowerCase()} by the Auditor.`,
          {
            type: 'success',
            category: 'stock',
            priority: 'high',
            actionUrl: '/dashboard/branch-store/request-history',
            metadata: { request_id: requestId, status: newStatus }
          }
        );
      }
    } catch (e) {
      logger.error('Failed to notify central ops of stock request approval', e);
    }
  }

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
      status: 'READY', // Changed from PENDING to READY as per user workflow
      packed_at: new Date().toISOString(), // Set packed_at since it is created as READY
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
  dispatcherId: string,
  updates?: {
    vehicle_number?: string;
    driver_name?: string;
    driver_phone?: string;
    estimated_delivery?: string;
    notes?: string;
  }
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
    if (dispatch.status !== 'READY') {
      throw new Error(`Dispatch is already ${dispatch.status.toLowerCase()}`);
    }

    // Check if dispatch has items
    if (!dispatch.items || dispatch.items.length === 0) {
      throw new Error('No items found in dispatch note');
    }

    // Validate stock before processing any deductions
    for (const item of dispatch.items) {
      const { data: currentStock, error: currentStockError } = await supabase
        .from('branch_stock')
        .select('quantity')
        .eq('branch_id', dispatch.from_branch_id)
        .eq('item_sku', item.item_sku)
        .single();
        
      if (currentStockError && currentStockError.code !== 'PGRST116') {
        throw new Error(`Failed to verify stock for item ${item.item_sku}: ${currentStockError.message}`);
      }

      const available = currentStock?.quantity || 0;
      if (available < item.dispatched_quantity) {
         throw new Error(`Insufficient stock for item ${item.item_sku}. Available: ${available}, Dispatched: ${item.dispatched_quantity}`);
      }
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
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
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

    // Prepare update data
    const updateData: any = {
      status: 'IN_TRANSIT',
      dispatcher_id: dispatcherId,
      dispatched_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add optional fields if provided
    if (updates) {
      if (updates.vehicle_number) updateData.vehicle_number = updates.vehicle_number;
      if (updates.driver_name) updateData.driver_name = updates.driver_name;
      if (updates.driver_phone) updateData.driver_phone = updates.driver_phone;
      if (updates.estimated_delivery) updateData.estimated_delivery = updates.estimated_delivery;
      if (updates.notes) updateData.notes = updates.notes;
    }

    // Update dispatch status and details
    const { data: updatedDispatch, error: updateError } = await supabase
      .from('dispatch_notes')
      .update(updateData)
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
    logger.error(`Error in dispatchItems:`, error);
    throw error;
  }
}

/**
 * Update dispatch logistics (vehicle/driver) after dispatch
 */
export async function updateDispatchLogistics(
  dispatchId: string,
  userId: string,
  updates: {
    vehicle_number?: string;
    driver_name?: string;
    driver_phone?: string;
    estimated_delivery?: string;
    notes?: string;
  }
) {
  // Validate dispatch ID
  if (!dispatchId) {
    throw new Error('Dispatch ID is required');
  }

  // Get dispatch details to verify existence and status
  const { data: dispatch, error: fetchError } = await supabase
    .from('dispatch_notes')
    .select('id, status, dispatch_number')
    .eq('id', dispatchId)
    .single();

  if (fetchError) {
    logger.error(`Error fetching dispatch ${dispatchId}:`, fetchError);
    throw new Error(`Dispatch not found: ${fetchError.message}`);
  }

  // Allow updates only if IN_TRANSIT (or READY, though READY is usually handled by dispatchItems)
  if (!['READY', 'IN_TRANSIT'].includes(dispatch.status)) {
    throw new Error(`Cannot update logistics for dispatch in ${dispatch.status} status`);
  }

  // Update fields
  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  if (updates.vehicle_number !== undefined) updateData.vehicle_number = updates.vehicle_number;
  if (updates.driver_name !== undefined) updateData.driver_name = updates.driver_name;
  if (updates.driver_phone !== undefined) updateData.driver_phone = updates.driver_phone;
  if (updates.estimated_delivery !== undefined) updateData.estimated_delivery = updates.estimated_delivery;
  if (updates.notes !== undefined) updateData.dispatch_notes = updates.notes; // Note mapping to dispatch_notes col

  const { data: updatedDispatch, error: updateError } = await supabase
    .from('dispatch_notes')
    .update(updateData)
    .eq('id', dispatchId)
    .select()
    .single();

  if (updateError) {
    logger.error(`Error updating dispatch logistics:`, updateError);
    throw updateError;
  }

  logger.info(`Dispatch ${dispatch.dispatch_number} logistics updated by ${userId}`);

  return updatedDispatch;
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
    const itemId = receivedItem.id || (receivedItem as any).item_id;
    if (!itemId) continue;

    const dispatchItem = dispatch.items.find((i: any) => i.id === itemId);
    if (!dispatchItem) continue;

    // Normalize quantity - support both field naming conventions from frontend
    const receivedQty = Math.max(0, Math.round(
      Number((receivedItem as any).received_quantity ?? (receivedItem as any).quantity ?? 0)
    ));
    if (isNaN(receivedQty)) {
      logger.warn(`Invalid quantity for item ${itemId}, skipping stock update`);
      continue;
    }
    const damagedQty = Math.max(0, Number((receivedItem as any).damaged_quantity ?? (receivedItem as any).damaged ?? 0)) || 0;
    const missingQty = Math.max(0, Number((receivedItem as any).missing_quantity ?? (receivedItem as any).missing ?? 0)) || 0;

    // Update dispatch item
    await supabase
      .from('dispatch_items')
      .update({
        received_quantity: receivedQty,
        damaged_quantity: damagedQty,
        missing_quantity: missingQty,
        discrepancy_reason: (receivedItem as any).discrepancy_reason || (receivedItem as any).note,
        status: receivedQty === dispatchItem.dispatched_quantity ? 'RECEIVED' : 'PARTIAL'
      })
      .eq('id', itemId);

    await updateBranchStock(
      dispatch.to_branch_id,
      dispatchItem.item_sku,
      receivedQty,
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
    // Update main request status
    await supabase
      .from('stock_requests')
      .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
      .eq('id', dispatch.stock_request_id);

    // Update individual request items status to DELIVERED
    // We match by request_id and item_sku from the dispatch items
    const { data: updatedDispatchItems } = await supabase
      .from('dispatch_items')
      .select('*')
      .eq('dispatch_id', dispatchId);

    if (updatedDispatchItems) {
      for (const dItem of updatedDispatchItems) {
        await supabase
          .from('stock_request_items')
          .update({
            status: 'DELIVERED',
            approved_quantity: dItem.received_quantity, // Update to what was actually delivered
            updated_at: new Date().toISOString()
          })
          .match({
            request_id: dispatch.stock_request_id,
            item_sku: dItem.item_sku
          });
      }
    }
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

  // Get vehicle and driver details
  const vehicleIds = dispatches.map(d => d.vehicle_id).filter(Boolean);
  const driverIds = dispatches.map(d => d.driver_id).filter(Boolean);

  const { data: vehicles } = vehicleIds.length > 0 ? await supabase
    .from('vehicles')
    .select('id, registration_number, model')
    .in('id', vehicleIds) : { data: [] };

  const { data: drivers } = driverIds.length > 0 ? await supabase
    .from('drivers')
    .select('id, name, license_number, phone')
    .in('id', driverIds) : { data: [] };

  // Combine
  const data = dispatches.map(dispatch => ({
    ...dispatch,
    from_branch: branches?.find(b => b.id === dispatch.from_branch_id),
    vehicle: vehicles?.find(v => v.id === dispatch.vehicle_id),
    vehicle_registration: vehicles?.find(v => v.id === dispatch.vehicle_id)?.registration_number
      || (dispatch as any).vehicle_number
      || null,
    driver: drivers?.find(d => d.id === dispatch.driver_id),
    driver_name: drivers?.find(d => d.id === dispatch.driver_id)?.name
      || (dispatch as any).driver_name
      || null,
    items: (items || [])
      .filter(i => i.dispatch_id === dispatch.id)
      .map(item => {
        const details = itemDetails?.find(d => d.sku === item.item_sku);
        return {
          ...item,
          item_item: details,
          item_name: details?.item_name || item.item_sku,
          unit: details?.unit_of_measure || 'units'
        };
      })
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

  // Get metadata for enrichment
  const toBranchIds = [...new Set(dispatches.map(d => d.to_branch_id))];
  const vehicleIds = [...new Set(dispatches.map(d => d.vehicle_id).filter(id => id))];
  const driverIds = [...new Set(dispatches.map(d => d.driver_id).filter(id => id))];
  const dispatchIds = dispatches.map(d => d.id);

  // Fetch all enrichment data in parallel (no FK join for dispatch_items → simple_items)
  const [branchesRes, vehiclesRes, driversRes, itemsRes] = await Promise.all([
    supabase.from('branches').select('id, name, code').in('id', toBranchIds),
    vehicleIds.length > 0 ? supabase.from('vehicles').select('id, registration_number, model').in('id', vehicleIds) : Promise.resolve({ data: [] }),
    driverIds.length > 0 ? supabase.from('drivers').select('id, name, license_number, phone').in('id', driverIds) : Promise.resolve({ data: [] }),
    supabase.from('dispatch_items').select('*').in('dispatch_id', dispatchIds)
  ]);

  const branches = branchesRes.data || [];
  const vehicles = vehiclesRes.data || [];
  const drivers = driversRes.data || [];
  const dispatchItems = itemsRes.data || [];

  // Fetch item details separately (no FK exists between dispatch_items and simple_items)
  const allSkus = [...new Set(dispatchItems.map(i => i.item_sku).filter(Boolean))];
  let itemDetails: any[] = [];
  if (allSkus.length > 0) {
    const { data: details } = await supabase
      .from('simple_items')
      .select('sku, item_name, description, unit_of_measure, cost_price')
      .in('sku', allSkus);
    itemDetails = details || [];
  }

  return dispatches.map(dispatch => {
    const toBranch = branches.find(b => b.id === dispatch.to_branch_id);
    const vehicle = vehicles.find(v => v.id === dispatch.vehicle_id);
    const driver = drivers.find(d => d.id === dispatch.driver_id);

    return {
      ...dispatch,
      to_branch: toBranch,
      to_branch_name: toBranch?.name || 'Unknown Branch',
      vehicle,
      vehicle_registration: dispatch.vehicle_number || vehicle?.registration_number,
      driver,
      driver_name: dispatch.driver_name || driver?.name,
      items: dispatchItems
        .filter(i => i.dispatch_id === dispatch.id)
        .map(i => {
          const detail = itemDetails.find(d => d.sku === i.item_sku);
          return {
            id: i.id,
            item_sku: i.item_sku,
            item_name: detail?.item_name || i.item_sku,
            quantity: i.dispatched_quantity,
            cost_price: detail?.cost_price || 0,
            unit: detail?.unit_of_measure || 'units'
          };
        })
    };
  });
}

// ============================================================
// CENTRAL WAREHOUSE HELPERS
// ============================================================

/**
 * Get central warehouse branch
 */
export async function getCentralWarehouse() {
  // Try to find branch explicitly marked as central warehouse
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('is_central_warehouse', true)
    .maybeSingle();

  if (error) throw error;

  if (data) return data;

  // Fallback: use the main branch if no central warehouse is designated
  logger.warn('No central warehouse found, falling back to is_main_branch=true');
  const { data: mainBranch, error: mainError } = await supabase
    .from('branches')
    .select('*')
    .eq('is_main_branch', true)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (mainError) throw mainError;
  return mainBranch;
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
  try {
    const [pendingRequests, inTransit, lowStock, recentDispatches, totalMaster] = await Promise.all([
      supabase.from('stock_requests').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'UNDER_REVIEW']),
      supabase.from('dispatch_notes').select('*', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT'),
      supabase.from('branch_stock').select('*', { count: 'exact', head: true }).lte('quantity', 10), // Threshold default
      supabase.from('dispatch_notes').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('simple_items').select('*', { count: 'exact', head: true }).eq('is_active', true)
    ]);

    // For better low stock accuracy across catalog
    // We try to get this from simple_items where quantity <= reorder_level
    // This is hard to do in one PostgREST call without RPC, so we'll use a count of those that fall below 
    // BUT since we can't compare columns easily, we'll use a conservative threshold for now or 
    // a separate query for those explicitly marked.
    const { count: globalLowStock } = await supabase
      .from('simple_items')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .filter('quantity', 'lte', 10); // Still using numeric for reliability

    return {
      pendingRequests: pendingRequests?.count || 0,
      inTransit: inTransit?.count || 0,
      lowStockBranches: lowStock?.count || 0,
      weeklyDispatches: recentDispatches?.count || 0,
      totalMasterItems: totalMaster?.count || 0,
      totalLowStockItems: globalLowStock || 0
    };
  } catch (error) {
    logger.error('Error fetching central dashboard stats:', error);
    return {
      pendingRequests: 0,
      inTransit: 0,
      lowStockBranches: 0,
      weeklyDispatches: 0,
      totalMasterItems: 0,
      totalLowStockItems: 0
    };
  }
}

/**
 * Get dashboard stats for branch
 */
export async function getBranchDashboardStats(branchId: number) {
  const [totalItemsRes, allStockRes, pendingRequestsRes, incomingDispatchesRes] = await Promise.all([
    supabase.from('branch_stock').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
    supabase.from('branch_stock').select('id, quantity, reorder_level').eq('branch_id', branchId),
    supabase.from('stock_requests').select('id', { count: 'exact', head: true }).eq('requesting_branch_id', branchId).in('status', ['PENDING', 'APPROVED', 'UNDER_REVIEW']),
    supabase.from('dispatch_notes').select('id', { count: 'exact', head: true }).eq('to_branch_id', branchId).eq('status', 'IN_TRANSIT')
  ]);

  // Low stock = items where quantity <= reorder_level
  const allStock = allStockRes.data || [];
  const lowStockCount = allStock.filter(item => Number(item.quantity || 0) <= Number(item.reorder_level || 10)).length;

  return {
    totalItems: totalItemsRes.count || 0,
    lowStock: lowStockCount,
    lowStockItems: lowStockCount,
    pendingRequests: pendingRequestsRes.count || 0,
    incomingDispatches: incomingDispatchesRes.count || 0
  };
}

/**
 * Record stock conversion (Yield Control)
 */
export async function recordConversion(
  branchId: number,
  userId: string,
  rawSku: string,
  rawQty: number,
  producedSku: string,
  producedQty: number,
  notes?: string
) {
  // 1. Validate Raw Item Stock
  const { data: rawStock, error: rawError } = await supabase
    .from('branch_stock')
    .select('quantity')
    .eq('branch_id', branchId)
    .eq('item_sku', rawSku)
    .single();

  if (rawError && rawError.code !== 'PGRST116') throw rawError;
  const currentRawQty = rawStock?.quantity || 0;

  if (currentRawQty < rawQty) {
    throw new Error(`Insufficient stock for ${rawSku}. Current: ${currentRawQty}, Required: ${rawQty}`);
  }

  // 2. Validate Produced Item exists in catalog (optional but good)
  const { data: producedItem, error: prodError } = await supabase
    .from('simple_items')
    .select('item_name')
    .eq('sku', producedSku)
    .single();

  const producedItemName = producedItem?.item_name || producedSku;

  // 3. Deduct Raw Item
  await updateBranchStock(
    branchId,
    rawSku,
    -rawQty,
    'CONVERSION_OUT',
    userId,
    'CONVERSION',
    undefined,
    undefined,
    `Converted to ${producedQty} of ${producedItemName}. ${notes || ''}`
  );

  // 4. Add Produced Item
  await updateBranchStock(
    branchId,
    producedSku,
    producedQty,
    'CONVERSION_IN',
    userId,
    'CONVERSION',
    undefined,
    undefined,
    `Converted from ${rawQty} of ${rawSku}. ${notes || ''}`
  );

  return {
    success: true,
    message: `Converted ${rawQty} ${rawSku} to ${producedQty} ${producedSku}`
  };
}
