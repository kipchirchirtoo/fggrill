/**
 * Kitchen Usage Controller
 * Track how received items are consumed in the kitchen
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

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
        branches!inner(name),
        users!kitchen_usage_records_recorded_by_fkey(first_name, last_name)
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
    let itemsMap: Record<string, any> = {};
    
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

    // Enrich with item details
    const enrichedData = (data || []).map(record => ({
      ...record,
      item_name: itemsMap[record.item_sku]?.item_name || record.item_sku,
      category: itemsMap[record.item_sku]?.category,
      retail_price: itemsMap[record.item_sku]?.retail_price
    }));

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

    const { data, error } = await supabase
      .from('kitchen_usage_records')
      .insert({
        branch_id: branchId,
        dispatch_id: dispatch_id || null,
        item_sku,
        received_quantity,
        unit_cost: unit_cost || 0,
        expected_revenue: expected_revenue || 0,
        usage_date: usage_date || new Date().toISOString().split('T')[0],
        recorded_by: userId,
        status: 'PENDING'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Usage tracking record created',
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
    const { data: updatedRecord } = await supabase
      .from('kitchen_usage_records')
      .select('remaining_quantity')
      .eq('id', usage_record_id)
      .single();

    if (updatedRecord && updatedRecord.remaining_quantity === 0) {
      await supabase
        .from('kitchen_usage_records')
        .update({ status: 'COMPLETED' })
        .eq('id', usage_record_id);
    } else if (updatedRecord && updatedRecord.remaining_quantity < record.received_quantity) {
      await supabase
        .from('kitchen_usage_records')
        .update({ status: 'PARTIAL' })
        .eq('id', usage_record_id);
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
      .select(`
        *,
        users!kitchen_usage_entries_recorded_by_fkey(first_name, last_name)
      `)
      .eq('usage_record_id', usage_record_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get responsible staff details
    const staffIds = [...new Set((data || [])
      .filter(e => e.responsible_staff_id)
      .map(e => e.responsible_staff_id))];

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

    const enrichedData = (data || []).map(entry => ({
      ...entry,
      responsible_staff: entry.responsible_staff_id ? staffMap[entry.responsible_staff_id] : null
    }));

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

    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID required' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('first_name');

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data: data || []
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
        status: 'CLOSED',
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
    const branchId = req.user?.branch_id;

    if (!branchId) {
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
        .select('sku, item_name, category, cost_price, retail_price')
        .in('sku', skus);
      
      itemsMap = (items || []).reduce((acc, item) => {
        acc[item.sku] = item;
        return acc;
      }, {} as Record<string, any>);
    }

    const enrichedData = (branchStock || []).map(stock => ({
      ...stock,
      item_name: itemsMap[stock.item_sku]?.item_name || stock.item_sku,
      category: itemsMap[stock.item_sku]?.category,
      cost_price: itemsMap[stock.item_sku]?.cost_price,
      retail_price: itemsMap[stock.item_sku]?.retail_price
    }));

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
