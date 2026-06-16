import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import * as BranchInventoryService from '../../services/branch-inventory.service';

// ============================================================
// GET RECEIVED ITEMS FOR TRACKING
// ============================================================

/**
 * Get items received at branch that need usage tracking
 * These are items from confirmed dispatches
 */
export const getReceivedItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.user?.branch_id;
    const { from_date, to_date, status } = req.query;

    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    let query = supabase
      .from('kitchen_usage_records')
      .select(`
        *,
        branches!inner(name)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (from_date) {
      query = query.gte('usage_date', from_date);
    }
    if (to_date) {
      query = query.lte('usage_date', to_date);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Fetch item names
    const skus = [...new Set(data?.map(r => r.item_sku) || [])];
    const userIds = [...new Set((data || []).map((r: any) => r.recorded_by).filter(Boolean))];
    let itemsMap: Record<string, any> = {};
    let usersMap: Record<string, any> = {};

    if (skus.length > 0) {
      const { data: items } = await supabase
        .from('simple_items')
        .select('sku, item_name, category, retail_price')
        .in('sku', skus);

      itemsMap = (items || []).reduce((acc, item) => {
        acc[item.sku] = item;
        return acc;
      }, {} as Record<string, any>);
    }

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', userIds);

      usersMap = (users || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);
    }

    // Enrich with item details and map names
    const enrichedData = (data || []).map(record => {
      // Robust staff name resolution
      const user = usersMap[(record as any).recorded_by];
      let recorded_by_name = record.recorded_by || 'System';

      if (user) {
        const u = Array.isArray(user) ? user[0] : user;
        const firstName = u.first_name || u.firstName;
        const lastName = u.last_name || u.lastName || '';

        if (firstName) {
          recorded_by_name = `${firstName} ${lastName}`.trim();
        }
      }

      return {
        ...record,
        // Map quantity for frontend compatibility
        quantity: record.received_quantity,
        item_name: itemsMap[record.item_sku]?.item_name || record.item_sku,
        category: itemsMap[record.item_sku]?.category,
        retail_price: itemsMap[record.item_sku]?.retail_price,
        recorded_by_name
      };
    });

    if (enrichedData.length > 0) {
      logger.info(`[Kitchen Usage] Record enrichment:`, {
        id: enrichedData[0].id,
        item: enrichedData[0].item_name,
        qty: enrichedData[0].quantity,
        recorded_by_name: enrichedData[0].recorded_by_name
      });
    }

    res.status(200).json({
      success: true,
      count: enrichedData.length,
      data: enrichedData
    });
  } catch (error) {
    logger.error('Error fetching received items:', error);
    next(error);
  }
};

// ============================================================
// CREATE USAGE RECORD (Initialize tracking for received item)
// ============================================================

/**
 * Create a new usage tracking record for received items
 */
export const createUsageRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.user?.branch_id;
    const userId = req.user?.id;
    const {
      dispatch_id,
      item_sku,
      received_quantity,
      unit_cost,
      expected_revenue,
      usage_date
    } = req.body;

    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    if (!item_sku || !received_quantity || received_quantity <= 0) {
      res.status(400).json({
        success: false,
        message: 'Item SKU and received quantity are required'
      });
      return;
    }

    // Start transaction-like flow (manual for now as we don't have a transaction wrapper here)
    const { data, error } = await supabase
      .from('kitchen_usage_records')
      .insert({
        branch_id: branchId,
        dispatch_id: dispatch_id || null,
        item_sku,
        received_quantity,
        // remaining_quantity is GENERATED ALWAYS - calculated automatically
        unit_cost: unit_cost || 0,
        expected_revenue: expected_revenue || 0,
        usage_date: usage_date || new Date().toISOString().split('T')[0],
        recorded_by: userId,
        status: 'approved' // Auto-approve for direct kitchen operations
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`[Kitchen Usage] Auto-approved record ${data.id} for kitchen operations`);

    // Deduct from branch stock
    try {
      await BranchInventoryService.updateBranchStock(
        branchId,
        item_sku,
        -received_quantity, // Negative because we are moving it out of main store
        'KITCHEN_ISSUE',
        userId,
        'KITCHEN_USAGE',
        data.id,
        `KUSG-${data.id.substring(0, 8).toUpperCase()}`
      );

      // =================================================================
      // SYNC TO KITCHEN STOCK LEDGER
      // =================================================================
      // 1. Get item details (name and unit)
      const { data: itemData } = await supabase
        .from('simple_items')
        .select('description, unit')
        .eq('sku', item_sku)
        .single();

      const itemName = itemData?.description || 'Unknown Item';
      const itemUnit = itemData?.unit || 'Unit';

      // 2. Get current kitchen stock balance
      const { data: currentStock } = await supabase
        .from('kitchen_stock')
        .select('current_balance')
        .eq('branch_id', branchId)
        .eq('item_sku', item_sku)
        .single();

      const openingBalance = currentStock?.current_balance || 0;
      const closingBalance = Number(openingBalance) + Number(received_quantity);

      // 3. Insert into kitchen_stock_ledger
      // This will trigger the update_kitchen_stock_balance trigger to update kitchen_stock table
      await supabase
        .from('kitchen_stock_ledger')
        .insert({
          branch_id: branchId,
          item_sku,
          item_name: itemName,
          transaction_type: 'RECEIPT', // or TRANSFER_IN
          reference_type: 'KITCHEN_USAGE',
          reference_id: data.id,
          opening_balance: openingBalance,
          quantity_in: received_quantity,
          quantity_out: 0,
          closing_balance: closingBalance,
          unit_of_measure: itemUnit,
          user_id: userId,
          notes: `Received from Branch Store (Ref: KUSG-${data.id.substring(0, 8).toUpperCase()})`
        });
      // =================================================================

    } catch (stockError) {
      // Rollback usage record if stock update fails
      const { error } = await supabase.from('kitchen_usage_records').delete().eq('id', data.id);
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      throw stockError;
    }

    res.status(201).json({
      success: true,
      message: 'Items automatically approved and sent to kitchen operations',
      data
    });
  } catch (error) {
    logger.error('Error creating usage record:', error);
    next(error);
  }
};

// ============================================================
// RECORD USAGE ENTRY (Individual usage transaction)
// ============================================================

/**
 * Record how items were used (consumed, spoilt, lost, etc.)
 */
export const recordUsageEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { usage_record_id } = req.params;
    const {
      usage_type,
      quantity,
      responsible_staff_id,
      responsible_staff_name,
      reason,
      notes,
      produced_item,
      portions_produced
    } = req.body;

    // Validate usage type
    const validTypes = ['CONSUMED', 'SPOILT', 'LOST', 'DAMAGED', 'EXPIRED', 'RETURNED'];
    if (!validTypes.includes(usage_type)) {
      res.status(400).json({
        success: false,
        message: `Invalid usage type. Must be one of: ${validTypes.join(', ')}`
      });
      return;
    }

    if (!quantity || quantity <= 0) {
      res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });
      return;
    }

    // Check remaining quantity
    const { data: record, error: recordError } = await supabase
      .from('kitchen_usage_records')
      .select('remaining_quantity, received_quantity')
      .eq('id', usage_record_id)
      .single();

    if (recordError || !record) {
      res.status(404).json({ success: false, message: 'Usage record not found' });
      return;
    }

    if (quantity > record.remaining_quantity) {
      res.status(400).json({
        success: false,
        message: `Cannot record ${quantity} units. Only ${record.remaining_quantity} remaining`
      });
      return;
    }

    // Create the usage entry
    const { data, error } = await supabase
      .from('kitchen_usage_entries')
      .insert({
        usage_record_id,
        usage_type,
        quantity,
        responsible_staff_id: responsible_staff_id || null,
        responsible_staff_name: responsible_staff_name || null,
        reason: reason || null,
        notes: notes || null,
        produced_item: usage_type === 'CONSUMED' ? produced_item : null,
        portions_produced: usage_type === 'CONSUMED' ? portions_produced : null,
        recorded_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    // Update status if all items accounted for
    // We re-fetch specifically to get the updated quantities from the trigger
    const { data: updatedRecord, error: updateFetchError } = await supabase
      .from('kitchen_usage_records')
      .select('received_quantity, consumed_quantity, spoilt_quantity, lost_quantity, damaged_quantity, expired_quantity, returned_quantity')
      .eq('id', usage_record_id)
      .single();

    if (!updateFetchError && updatedRecord) {
      const totalAccounted =
        (Number(updatedRecord.consumed_quantity) || 0) +
        (Number(updatedRecord.spoilt_quantity) || 0) +
        (Number(updatedRecord.lost_quantity) || 0) +
        (Number(updatedRecord.damaged_quantity) || 0) +
        (Number(updatedRecord.expired_quantity) || 0) +
        (Number(updatedRecord.returned_quantity) || 0);

      const received = Number(updatedRecord.received_quantity) || 0;
      let newStatus = 'PENDING';

      if (totalAccounted >= received) {
        newStatus = 'COMPLETED';
      } else if (totalAccounted > 0) {
        newStatus = 'PARTIAL';
      }

      if (newStatus !== 'PENDING') {
        await supabase
          .from('kitchen_usage_records')
          .update({ status: newStatus })
          .eq('id', usage_record_id);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Usage entry recorded',
      data
    });
  } catch (error) {
    logger.error('Error recording usage entry:', error);
    next(error);
  }
};

// ============================================================
// GET USAGE ENTRIES FOR A RECORD
// ============================================================

export const getUsageEntries = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { usage_record_id } = req.params;

    const { data, error } = await supabase
      .from('kitchen_usage_entries')
      .select('*')
      .eq('usage_record_id', usage_record_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get responsible staff details
    const staffIds = [...new Set((data || [])
      .filter(e => e.responsible_staff_id)
      .map(e => e.responsible_staff_id))];
    const recordedByIds = [...new Set((data || [])
      .filter(e => e.recorded_by)
      .map(e => e.recorded_by))];

    let staffMap: Record<string, any> = {};
    if (staffIds.length > 0) {
      const { data: staffData } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', staffIds);

      staffMap = (staffData || []).reduce((acc, s) => {
        acc[s.id] = s;
        return acc;
      }, {} as Record<string, any>);
    }

    let recordedByMap: Record<string, any> = {};
    if (recordedByIds.length > 0) {
      const { data: recordedByData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', recordedByIds);

      recordedByMap = (recordedByData || []).reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {} as Record<string, any>);
    }

    const enrichedData = (data || []).map(entry => {
      // Robust staff name resolution
      const user = recordedByMap[(entry as any).recorded_by];
      let recorded_by_name = entry.recorded_by || 'System';

      if (user) {
        const u = Array.isArray(user) ? user[0] : user;
        const firstName = u.first_name || u.firstName;
        const lastName = u.last_name || u.lastName || '';

        if (firstName) {
          recorded_by_name = `${firstName} ${lastName}`.trim();
        }
      }

      return {
        ...entry,
        recorded_by_name,
        responsible_staff: entry.responsible_staff_id ? staffMap[entry.responsible_staff_id] : null
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedData.length,
      data: enrichedData
    });
  } catch (error) {
    logger.error('Error fetching usage entries:', error);
    next(error);
  }
};

// ============================================================
// GET STAFF FOR ACCOUNTABILITY
// ============================================================

/**
 * Get staff members at branch for accountability tracking
 */
export const getBranchStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const isCentral = ['super_admin', 'general_manager', 'auditor', 'central_storekeeper'].includes(req.user?.role || '');

    if (!branchId) {
      if (isCentral) {
        res.status(200).json({ success: true, count: 0, data: [] });
        return;
      }
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role')
      .eq('branch_id', branchId)
      .eq('status', 'active')
      .order('first_name');

    if (error) throw error;

    const enrichedData = (data || []).map(user => ({
      ...user,
      full_name: `${user.first_name} ${user.last_name}`
    }));

    res.status(200).json({
      success: true,
      count: enrichedData.length,
      data: enrichedData
    });
  } catch (error) {
    logger.error('Error fetching branch staff:', error);
    next(error);
  }
};

// ============================================================
// GET STAFF ACCOUNTABILITY REPORT
// ============================================================

export const getStaffAccountability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const { staff_id, period_month } = req.query;

    let query = supabase
      .from('staff_usage_summary')
      .select(`
        *,
        users!inner(first_name, last_name, email),
        branches!inner(name)
      `)
      .order('period_month', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (staff_id) {
      query = query.eq('staff_id', staff_id);
    }
    if (period_month) {
      query = query.eq('period_month', period_month);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate wastage percentage
    const enrichedData = (data || []).map(record => ({
      ...record,
      staff_name: `${record.users.first_name} ${record.users.last_name}`,
      branch_name: record.branches.name,
      total_wastage: record.total_items_spoilt + record.total_items_lost + record.total_items_damaged,
      wastage_percentage: record.total_items_used > 0
        ? ((record.total_items_spoilt + record.total_items_lost + record.total_items_damaged) / record.total_items_used * 100).toFixed(2)
        : 0
    }));

    res.status(200).json({
      success: true,
      count: enrichedData.length,
      data: enrichedData
    });
  } catch (error) {
    logger.error('Error fetching staff accountability:', error);
    next(error);
  }
};

// ============================================================
// GET DAILY USAGE SUMMARY
// ============================================================

export const getDailyUsageSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const { from_date, to_date } = req.query;

    let query = supabase
      .from('kitchen_usage_records')
      .select('*')
      .order('usage_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (from_date) {
      query = query.gte('usage_date', from_date);
    }
    if (to_date) {
      query = query.lte('usage_date', to_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Group by date and branch
    const grouped = (data || []).reduce((acc, record) => {
      const key = `${record.usage_date}_${record.branch_id}`;
      if (!acc[key]) {
        acc[key] = {
          usage_date: record.usage_date,
          branch_id: record.branch_id,
          items_tracked: 0,
          total_received: 0,
          total_consumed: 0,
          total_spoilt: 0,
          total_lost: 0,
          total_damaged: 0,
          total_loss_value: 0,
          total_expected_revenue: 0,
          total_actual_revenue: 0
        };
      }
      acc[key].items_tracked++;
      acc[key].total_received += record.received_quantity || 0;
      acc[key].total_consumed += record.consumed_quantity || 0;
      acc[key].total_spoilt += record.spoilt_quantity || 0;
      acc[key].total_lost += record.lost_quantity || 0;
      acc[key].total_damaged += record.damaged_quantity || 0;
      acc[key].total_loss_value += parseFloat(record.loss_value) || 0;
      acc[key].total_expected_revenue += parseFloat(record.expected_revenue) || 0;
      acc[key].total_actual_revenue += parseFloat(record.actual_revenue) || 0;
      return acc;
    }, {} as Record<string, any>);

    // Get branch names
    const branchIds = [...new Set(Object.values(grouped).map((g: any) => g.branch_id))];
    let branchMap: Record<number, string> = {};

    if (branchIds.length > 0) {
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name')
        .in('id', branchIds);

      branchMap = (branches || []).reduce((acc, b) => {
        acc[b.id] = b.name;
        return acc;
      }, {} as Record<number, string>);
    }

    const summary = Object.values(grouped).map((g: any) => ({
      ...g,
      branch_name: branchMap[g.branch_id] || `Branch ${g.branch_id}`
    }));

    res.status(200).json({
      success: true,
      count: summary.length,
      data: summary
    });
  } catch (error) {
    logger.error('Error fetching daily usage summary:', error);
    next(error);
  }
};

// ============================================================
// CLOSE USAGE RECORD
// ============================================================

export const closeUsageRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { usage_record_id } = req.params;
    const { actual_revenue, notes } = req.body;

    const { data, error } = await supabase
      .from('kitchen_usage_records')
      .update({
        status: 'closed',
        actual_revenue: actual_revenue || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', usage_record_id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Usage record closed',
      data
    });
  } catch (error) {
    logger.error('Error closing usage record:', error);
    next(error);
  }
};

// ============================================================
// GET ITEMS AVAILABLE FOR TRACKING (From branch stock)
// ============================================================

export const getTrackableItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = parseInt(req.query.branch_id as string) || req.user?.branch_id;
    const isCentral = ['super_admin', 'general_manager', 'auditor', 'central_storekeeper'].includes(req.user?.role || '');

    if (!branchId) {
      if (isCentral) {
        res.status(200).json({ success: true, count: 0, data: [] });
        return;
      }
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    // Get branch stock items
    const { data: branchStock, error } = await supabase
      .from('branch_stock')
      .select('*')
      .eq('branch_id', branchId)
      .gt('quantity', 0);

    if (error) throw error;

    // Get item details
    const skus = (branchStock || []).map(s => s.item_sku);
    let itemsMap: Record<string, any> = {};

    if (skus.length > 0) {
      const { data: items } = await supabase
        .from('simple_items')
        .select('sku, item_name, description, category, cost_price, retail_price')
        .in('sku', skus);

      itemsMap = (items || []).reduce((acc, item) => {
        acc[item.sku] = item;
        return acc;
      }, {} as Record<string, any>);
    }

    const enrichedData = (branchStock || []).map(stock => ({
      item_sku: stock.item_sku,
      item_name: itemsMap[stock.item_sku]?.item_name || itemsMap[stock.item_sku]?.description || stock.item_sku,
      quantity: stock.quantity,
      category: itemsMap[stock.item_sku]?.category || 'General',
      unit: stock.unit || 'units',
      cost_price: itemsMap[stock.item_sku]?.cost_price,
      retail_price: itemsMap[stock.item_sku]?.retail_price
    }));

    logger.info(`[Kitchen Usage] Returning ${enrichedData.length} trackable items for branch ${branchId}`);
    logger.info(`[Kitchen Usage] Sample item:`, enrichedData[0]);

    res.status(200).json({
      success: true,
      count: enrichedData.length,
      data: enrichedData
    });
  } catch (error) {
    logger.error('Error fetching trackable items:', error);
    next(error);
  }
};
