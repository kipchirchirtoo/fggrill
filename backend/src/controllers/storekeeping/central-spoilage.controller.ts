import { Request, Response } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { generateOrderNumber } from '../../services/sku.service';

// Spoilage reasons enum
const SPOILAGE_REASONS = [
  'EXPIRED',
  'DAMAGED',
  'SPOILED',
  'QUALITY_ISSUE',
  'THEFT',
  'BREAKAGE',
  'CONTAMINATION',
  'OTHER'
] as const;

type SpoilageReason = typeof SPOILAGE_REASONS[number];

const barOutletTypeFor = (value: unknown): 'main_bar' | 'executive_bar' => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('executive')) return 'executive_bar';
  return 'main_bar';
};

const branchIdForRequest = (req: Request): number | null => {
  const raw = req.query.branch_id ?? (req as any).user?.branch_id ?? null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const isBarSpoilageRequest = (value: unknown): boolean => {
  const raw = String(value || '').trim().toLowerCase();
  return ['bar_store', 'bar', 'main_bar', 'executive_bar'].includes(raw);
};

// ============================================================
// GET SPOILAGE RECORDS
// ============================================================

export const getSpoilageRecords = async (req: Request, res: Response) => {
  try {
    const { store_type, reason, status, from_date, to_date } = req.query;

    let query = supabase
      .from('v_central_spoilage_log')
      .select('*');

    if (store_type) {
      query = query.eq('store_type', store_type);
    }
    if (reason) {
      query = query.eq('reason', reason);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (from_date) {
      query = query.gte('spoilage_date', from_date);
    }
    if (to_date) {
      query = query.lte('spoilage_date', to_date);
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);

    if (error) throw error;

    // Calculate summary stats
    const records = data || [];
    const summary = {
      totalRecords: records.length,
      totalLoss: records.reduce((sum, r) => sum + (r.total_loss || 0), 0),
      pendingApproval: records.filter(r => r.status === 'PENDING').length,
      byReason: records.reduce((acc, r) => {
        const reason = r.reason || 'OTHER';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byStoreType: records.reduce((acc, r) => {
        const type = r.store_type || 'foodstuffs';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({
      success: true,
      count: records.length,
      summary,
      data: records
    });
  } catch (error: any) {
    logger.error('Error fetching spoilage records:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch spoilage records'
    });
  }
};

// ============================================================
// GET SPOILAGE SUMMARY/STATS
// ============================================================

export const getSpoilageSummary = async (req: Request, res: Response) => {
  try {
    const { period, store_type } = req.query; // 'today', 'week', 'month'

    let fromDate: string;
    const now = new Date();
    
    switch (period) {
      case 'week':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'month':
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default: // today
        fromDate = new Date().toISOString().split('T')[0];
    }

    let query = supabase
      .from('central_spoilage_log')
      .select('*')
      .gte('created_at', fromDate);

    if (store_type) {
      query = query.eq('store_type', store_type);
    }

    const { data, error } = await query;

    if (error) throw error;

    const records = data || [];

    // Group by reason
    const byReason = records.reduce((acc, record) => {
      const reason = record.reason || 'OTHER';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by day
    const byDay = records.reduce((acc, record) => {
      const day = new Date(record.created_at).toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = { count: 0, loss: 0 };
      }
      acc[day].count++;
      acc[day].loss += record.total_loss || 0;
      return acc;
    }, {} as Record<string, { count: number; loss: number }>);

    res.json({
      success: true,
      data: {
        totalRecords: records.length,
        totalLoss: records.reduce((sum, r) => sum + (r.total_loss || 0), 0),
        byReason,
        byDay,
        period: period || 'today'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching spoilage summary:', error);
    res.json({
      success: true,
      data: {
        totalRecords: 0,
        totalLoss: 0,
        byReason: {},
        byDay: {},
        period: 'today'
      }
    });
  }
};

// ============================================================
// GET ITEMS FOR SPOILAGE (searchable dropdown)
// ============================================================

export const getSpoilageItems = async (req: Request, res: Response) => {
  try {
    const { search, store_type, bar_location, outlet_type } = req.query;

    if (isBarSpoilageRequest(store_type)) {
      const branchId = branchIdForRequest(req);
      if (!branchId) {
        return res.json({ success: true, count: 0, data: [] });
      }

      const outletType = barOutletTypeFor(bar_location || outlet_type || store_type);
      const { data: outlet, error: outletError } = await supabase
        .from('pos_outlets')
        .select('id, branch_id, name, outlet_type')
        .eq('branch_id', branchId)
        .eq('outlet_type', outletType)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (outletError) throw outletError;
      if (!outlet) {
        return res.json({ success: true, count: 0, data: [] });
      }

      let query = supabase
        .from('pos_outlet_items')
        .select('id, name, sku, category, unit, cost_price, selling_price, current_stock')
        .eq('outlet_id', outlet.id)
        .eq('is_active', true);

      if (search) {
        const searchTerm = String(search).trim();
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.order('name').limit(300);
      if (error) throw error;

      const items = (data || []).map((item) => ({
        id: item.id,
        name: item.name || item.sku || 'POS Item',
        sku: item.sku || item.id,
        category: item.category || 'Bar',
        store_type: 'bar_store',
        unit: item.unit || 'each',
        cost: item.cost_price || item.selling_price || 0,
        stock: item.current_stock || 0,
        outlet_type: outlet.outlet_type,
        outlet_name: outlet.name,
      }));

      return res.json({
        success: true,
        count: items.length,
        data: items
      });
    }

    let query = supabase
      .from('simple_items')
      .select('sku, item_name, description, category, store_type, unit_of_measure, cost_price, quantity')
      .eq('is_active', true);

    if (store_type) {
      query = query.eq('store_type', store_type);
    }

    if (search) {
      const searchTerm = String(search).trim();
      query = query.or(`item_name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query.order('item_name').limit(100);

    if (error) throw error;

    const items = (data || []).map(item => ({
      id: item.sku,
      name: item.item_name || item.description,
      sku: item.sku,
      category: item.category,
      store_type: item.store_type,
      unit: item.unit_of_measure || 'pcs',
      cost: item.cost_price || 0,
      stock: item.quantity || 0
    }));

    res.json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error: any) {
    logger.error('Error fetching spoilage items:', error);
    res.json({
      success: true,
      count: 0,
      data: []
    });
  }
};

// ============================================================
// CREATE SPOILAGE RECORD (with atomic stock deduction)
// ============================================================

export const createSpoilageRecord = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const {
      item_sku,
      quantity,
      unit,
      reason,
      reason_details,
      disposal_method,
      notes,
      spoilage_date
    } = req.body;
    const barLocation = req.body?.bar_location || req.body?.outlet_type || req.body?.store_type;

    // Validation
    if (!item_sku || !quantity || !unit || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Item SKU, quantity, unit, and reason are required'
      });
    }

    if (!SPOILAGE_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Invalid reason. Must be one of: ${SPOILAGE_REASONS.join(', ')}`
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    const barSpoilage = isBarSpoilageRequest(req.body?.store_type);
    let item: any = null;
    let previousQuantity = 0;
    let newQuantity = 0;
    let unitCost = 0;

    if (barSpoilage) {
      const branchId = branchIdForRequest(req);
      if (!branchId) {
        return res.status(400).json({
          success: false,
          message: 'Branch is required for bar spoilage'
        });
      }

      const outletType = barOutletTypeFor(barLocation);
      const { data: outlet, error: outletError } = await supabase
        .from('pos_outlets')
        .select('id, branch_id, name, outlet_type')
        .eq('branch_id', branchId)
        .eq('outlet_type', outletType)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (outletError) throw outletError;
      if (!outlet) {
        return res.status(404).json({
          success: false,
          message: 'Main bar POS outlet not found for this branch'
        });
      }

      const { data: outletItem, error: outletItemError } = await supabase
        .from('pos_outlet_items')
        .select('*')
        .eq('outlet_id', outlet.id)
        .or(`sku.eq.${item_sku},id.eq.${item_sku}`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (outletItemError || !outletItem) {
        return res.status(404).json({
          success: false,
          message: 'Bar POS item not found'
        });
      }

      item = outletItem;
      previousQuantity = Number(item.current_stock || 0);
      if (previousQuantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${previousQuantity}, Requested: ${quantity}`
        });
      }
      newQuantity = previousQuantity - quantity;
      unitCost = Number(item.cost_price || item.selling_price || 0);
    } else {
      const { data: simpleItem, error: itemError } = await supabase
        .from('simple_items')
        .select('*')
        .eq('sku', item_sku)
        .single();

      if (itemError || !simpleItem) {
        return res.status(404).json({
          success: false,
          message: 'Item not found'
        });
      }

      item = simpleItem;
      previousQuantity = Number(item.quantity || 0);
      if (previousQuantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${previousQuantity}, Requested: ${quantity}`
        });
      }
      newQuantity = previousQuantity - quantity;
      unitCost = item.cost_price || 0;
    }

    // Generate spoilage number
    const { data: spoilageNumber, error: seqError } = await supabase
      .rpc('get_spoilage_number');

    if (seqError) throw seqError;

    // 1. Create spoilage record
    const { data: spoilage, error: spoilageError } = await supabase
      .from('central_spoilage_log')
      .insert({
        spoilage_number: spoilageNumber,
        item_sku,
        item_name: item.item_name || item.description || item.name,
        store_type: barSpoilage ? 'bar_store' : (item.store_type || 'foodstuffs'),
        category: item.category || 'Bar',
        quantity,
        unit: unit || item.unit_of_measure || item.unit || 'each',
        unit_cost: unitCost,
        reason,
        reason_details,
        disposal_method,
        status: 'PENDING',
        recorded_by: userId,
        notes,
        spoilage_date: spoilage_date || new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (spoilageError) throw spoilageError;

    // 2. Deduct stock from the correct inventory source
    const updateError = barSpoilage
      ? (await supabase
          .from('pos_outlet_items')
          .update({
            current_stock: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id)).error
      : (await supabase
          .from('simple_items')
          .update({
            quantity: newQuantity,
            last_updated: new Date().toISOString()
          })
          .eq('sku', item_sku)).error;

    if (updateError) throw updateError;

    // 3. Write a unified branch_stock_movements audit row so central spoilage
    //    is visible to the movement history and stocktake deductions screens.
    //    Best-effort — non-blocking to preserve existing error handling.
    const branchIdForMvt = barSpoilage ? branchIdForRequest(req) : (item.branch_id || branchIdForRequest(req));
    if (branchIdForMvt) {
      supabase.from('branch_stock_movements').insert({
        branch_id: branchIdForMvt,
        item_sku,
        item_id: barSpoilage ? (item.source_item_id || item.drink_id || null) : (item.id || null),
        movement_type: 'ADJUSTMENT_OUT',
        quantity,
        reference: `C-SPOILAGE-${spoilage.id}`,
        reference_type: 'central_spoilage',
        reference_id: spoilage.id,
        notes: `Central spoilage ${spoilage.spoilage_number || ''}: ${reason}${reason_details ? ' — ' + reason_details : ''}`,
        performed_by: userId || null,
        created_by: userId || null,
        previous_stock: previousQuantity,
        new_stock: newQuantity,
      }).then(({ error: mvErr }) => {
        if (mvErr) logger.warn('branch_stock_movements insert failed (central spoilage):', mvErr.message);
      });
    }

    // 4. Log to stock_history
    const orderNum = await generateOrderNumber('SPL');
    const { error: historyError } = await supabase.from('stock_history').insert({
      item_sku,
      change_type: 'OUT',
      quantity_change: quantity,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      reason: `SPOILAGE: ${reason}`,
      reference: spoilageNumber,
      notes: reason_details || notes,
      user_id: userId
    });

    if (historyError) {
      logger.error('Error logging stock history:', historyError);
      // Don't fail the operation if history logging fails
    }

    logger.info(`Spoilage recorded: ${spoilageNumber} - ${item_sku} -${quantity} units`);

    res.status(201).json({
      success: true,
      message: 'Spoilage recorded successfully - stock deducted',
      data: {
        ...spoilage,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        order_number: orderNum
      }
    });
  } catch (error: any) {
    logger.error('Error creating spoilage record:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record spoilage'
    });
  }
};

// ============================================================
// APPROVE/REJECT SPOILAGE RECORD
// ============================================================

export const updateSpoilageStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, rejection_reason } = req.body; // action: 'approve' | 'reject'
    const userId = (req as any).user?.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be approve or reject'
      });
    }

    // Get current record
    const { data: current, error: fetchError } = await supabase
      .from('central_spoilage_log')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return res.status(404).json({
        success: false,
        message: 'Spoilage record not found'
      });
    }

    if (current.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Record is already ${current.status.toLowerCase()}`
      });
    }

    const updateData: any = {
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      approved_by: userId,
      approved_at: new Date().toISOString()
    };

    if (action === 'reject') {
      updateData.rejection_reason = rejection_reason;

      // Revert stock deduction if rejected
      const { data: item } = await supabase
        .from('simple_items')
        .select('quantity')
        .eq('sku', current.item_sku)
        .single();

      if (item) {
        const newQuantity = item.quantity + current.quantity;
        await supabase
          .from('simple_items')
          .update({
            quantity: newQuantity,
            last_updated: new Date().toISOString()
          })
          .eq('sku', current.item_sku);

        // Log reversal to stock_history
        const orderNum = await generateOrderNumber('SPL-REV');
        await supabase.from('stock_history').insert({
          item_sku: current.item_sku,
          change_type: 'IN',
          quantity_change: current.quantity,
          previous_quantity: item.quantity,
          new_quantity: newQuantity,
          reason: `SPOILAGE REVERSAL: ${current.reason}`,
          reference: current.spoilage_number,
          notes: `Reverted rejected spoilage: ${rejection_reason}`,
          user_id: userId
        });

        logger.info(`Spoilage rejected and stock reverted: ${current.spoilage_number}`);
      }
    }

    const { data, error } = await supabase
      .from('central_spoilage_log')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `Spoilage record ${action}d successfully`,
      data
    });
  } catch (error: any) {
    logger.error('Error updating spoilage status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update spoilage status'
    });
  }
};

// ============================================================
// GET SINGLE SPOILAGE RECORD
// ============================================================

export const getSpoilageRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('v_central_spoilage_log')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Spoilage record not found'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    logger.error('Error fetching spoilage record:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch spoilage record'
    });
  }
};
