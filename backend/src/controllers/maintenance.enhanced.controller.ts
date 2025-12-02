import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// ============ ASSETS MANAGEMENT ============

export const getAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, status, category } = req.query;
    
    let query = supabase
      .from('maintenance_assets')
      .select('*')
      .order('name');
    
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

export const createAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_assets')
      .insert([{ ...req.body, asset_tag: `AST-${Date.now()}` }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, data });
    logger.info(`Asset created: ${data.asset_tag}`);
  } catch (error) {
    next(error);
  }
};

export const updateAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_assets')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ============ PREVENTIVE MAINTENANCE ============

export const getPreventiveSchedules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { is_active, overdue } = req.query;
    
    let query = supabase
      .from('maintenance_preventive_schedules')
      .select(`
        *,
        asset:maintenance_assets(*),
        technician:staff_profiles(*)
      `)
      .order('next_due');
    
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
    if (overdue === 'true') query = query.lt('next_due', new Date().toISOString().split('T')[0]);
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

export const createPreventiveSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_preventive_schedules')
      .insert([req.body])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ============ SPARE PARTS INVENTORY ============

export const getSpareParts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { low_stock } = req.query;
    
    const { data: allParts, error } = await supabase
      .from('maintenance_spare_parts')
      .select('*')
      .order('part_name');
    
    if (error) throw error;
    
    // Filter for low stock items if requested
    const data = low_stock === 'true'
      ? allParts?.filter(p => p.current_stock <= (p.reorder_point || p.min_stock_level))
      : allParts;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

export const createPartTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { part_id, transaction_type, quantity, unit_cost, work_order_id, notes } = req.body;
    
    // Get current stock
    const { data: part } = await supabase
      .from('maintenance_spare_parts')
      .select('current_stock')
      .eq('id', part_id)
      .single();
    
    if (!part) throw new Error('Part not found');
    
    // Calculate new stock
    const newStock = transaction_type === 'issue' 
      ? part.current_stock - quantity 
      : part.current_stock + quantity;
    
    // Create transaction
    const { data: transaction, error: transError } = await supabase
      .from('maintenance_parts_transactions')
      .insert([{
        part_id,
        transaction_type,
        quantity,
        unit_cost,
        total_cost: quantity * unit_cost,
        work_order_id,
        notes,
        performed_by: req.user?.id
      }])
      .select()
      .single();
    
    if (transError) throw transError;
    
    // Update stock
    await supabase
      .from('maintenance_spare_parts')
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', part_id);
    
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
};

// ============ CONTRACTORS ============

export const getContractors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { is_active } = req.query;
    
    let query = supabase
      .from('maintenance_contractors')
      .select('*')
      .order('name');
    
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ ENERGY/UTILITY TRACKING ============

export const recordMeterReading = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_meter_readings')
      .insert([{ ...req.body, recorded_by: req.user?.id }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getEnergyConsumption = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { meter_type, start_date, end_date, location } = req.query;
    
    let query = supabase
      .from('maintenance_meter_readings')
      .select('*')
      .order('reading_date', { ascending: false });
    
    if (meter_type) query = query.eq('meter_type', meter_type);
    if (location) query = query.eq('location', location);
    if (start_date) query = query.gte('reading_date', start_date);
    if (end_date) query = query.lte('reading_date', end_date);
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ WORK ORDER ATTACHMENTS ============

export const uploadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { work_order_id, file_name, file_url, file_type } = req.body;
    
    const { data, error } = await supabase
      .from('maintenance_work_order_attachments')
      .insert([{
        work_order_id,
        file_name,
        file_url,
        file_type,
        uploaded_by: req.user?.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ============ DASHBOARD & ANALYTICS ============

export const getMaintenanceDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get work order stats
    const { data: workOrders } = await supabase
      .from('maintenance_work_orders')
      .select('status, priority');
    
    // Get asset stats
    const { data: assets } = await supabase
      .from('maintenance_assets')
      .select('status, category');
    
    // Get overdue preventive maintenance
    const { data: overduepm } = await supabase
      .from('maintenance_preventive_schedules')
      .select('id')
      .eq('is_active', true)
      .lt('next_due', new Date().toISOString().split('T')[0]);
    
    // Get low stock items
    const { data: allParts } = await supabase
      .from('maintenance_spare_parts')
      .select('id, part_name, current_stock, min_stock_level, reorder_point');
    
    const lowStock = allParts?.filter(p => p.current_stock <= (p.reorder_point || p.min_stock_level));
    
    const dashboard = {
      work_orders: {
        total: workOrders?.length || 0,
        pending: workOrders?.filter(w => w.status === 'pending').length || 0,
        in_progress: workOrders?.filter(w => w.status === 'in_progress').length || 0,
        completed: workOrders?.filter(w => w.status === 'completed').length || 0,
        urgent: workOrders?.filter(w => w.priority === 'urgent').length || 0
      },
      assets: {
        total: assets?.length || 0,
        operational: assets?.filter(a => a.status === 'operational').length || 0,
        needs_maintenance: assets?.filter(a => a.status === 'needs_maintenance').length || 0,
        under_maintenance: assets?.filter(a => a.status === 'under_maintenance').length || 0
      },
      preventive_maintenance: {
        overdue: overduepm?.length || 0
      },
      inventory: {
        low_stock_items: lowStock?.length || 0,
        items: lowStock || []
      }
    };
    
    res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
};
