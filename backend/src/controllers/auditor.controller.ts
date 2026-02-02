import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// ============ NIGHT AUDIT ============

export const startNightAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const auditDate = req.body.audit_date || new Date().toISOString().split('T')[0];

    // Check if already exists
    const { data: existing } = await supabase
      .from('audit_night_sessions')
      .select('id')
      .eq('audit_date', auditDate)
      .single();

    if (existing) {
      res.status(400).json({ success: false, message: 'Night audit already exists for this date' });
      return;
    }

    const { data, error } = await supabase
      .from('audit_night_sessions')
      .insert([{
        audit_date: auditDate,
        started_at: new Date().toISOString(),
        performed_by: req.user?.id,
        status: 'in_progress'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
    logger.info(`Night audit started for ${auditDate}`);
  } catch (error) {
    next(error);
  }
};

export const completeNightAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { total_revenue, total_payments, occupancy_percentage, adr, revpar, notes } = req.body;

    const { data, error } = await supabase
      .from('audit_night_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_revenue,
        total_payments,
        occupancy_percentage,
        adr,
        revpar,
        notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
    logger.info(`Night audit completed: ${id}`);
  } catch (error) {
    next(error);
  }
};

export const getNightAudits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { start_date, end_date, status } = req.query;

    let query = supabase
      .from('audit_night_sessions')
      .select(`
        *,
        performer:users!performed_by(*)
      `)
      .order('audit_date', { ascending: false });

    if (start_date) query = query.gte('audit_date', start_date);
    if (end_date) query = query.lte('audit_date', end_date);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ AUDIT EXCEPTIONS ============

export const createException = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { audit_session_id, exception_type, severity, description, amount, reference_type, reference_id } = req.body;

    const { data, error } = await supabase
      .from('audit_exceptions')
      .insert([{
        audit_session_id,
        exception_type,
        severity,
        description,
        amount,
        reference_type,
        reference_id,
        status: 'open'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
    logger.warn(`Audit exception created: ${exception_type}`);
  } catch (error) {
    next(error);
  }
};

export const resolveException = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { resolution_notes } = req.body;

    const { data, error } = await supabase
      .from('audit_exceptions')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: req.user?.id,
        resolution_notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getExceptions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { audit_session_id, status, severity } = req.query;

    let query = supabase
      .from('audit_exceptions')
      .select(`
        *,
        resolver:users!resolved_by(*)
      `)
      .order('detected_at', { ascending: false });

    if (audit_session_id) query = query.eq('audit_session_id', audit_session_id);
    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ AUDIT TRAIL ============

export const logAuditTrail = async (
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValues: any,
  newValues: any,
  ipAddress?: string
): Promise<void> => {
  try {
    await supabase
      .from('audit_trail')
      .insert([{
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
        ip_address: ipAddress
      }]);
  } catch (error) {
    logger.error('Failed to log audit trail:', error);
  }
};

export const getAuditTrail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { user_id, entity_type, entity_id, start_date, end_date } = req.query;

    let query = supabase
      .from('audit_trail')
      .select(`
        *,
        user:users(*)
      `)
      .order('performed_at', { ascending: false })
      .limit(100);

    if (user_id) query = query.eq('user_id', user_id);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (entity_id) query = query.eq('entity_id', entity_id);
    if (start_date) query = query.gte('performed_at', start_date);
    if (end_date) query = query.lte('performed_at', end_date);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ INTERNAL AUDIT ============

export const createAuditPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { audit_name, audit_type, department, planned_date, scope, objectives } = req.body;

    const { data, error } = await supabase
      .from('audit_plans')
      .insert([{
        audit_name,
        audit_type,
        department,
        planned_date,
        auditor_id: req.user?.id,
        scope,
        objectives,
        status: 'scheduled'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createFinding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      audit_plan_id,
      finding_number,
      category,
      severity,
      description,
      evidence,
      recommendation,
      responsible_person,
      due_date
    } = req.body;

    const { data, error } = await supabase
      .from('audit_findings')
      .insert([{
        audit_plan_id,
        finding_number,
        category,
        severity,
        description,
        evidence,
        recommendation,
        responsible_person,
        due_date,
        status: 'open'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getFindings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { audit_plan_id, status, severity } = req.query;

    let query = supabase
      .from('audit_findings')
      .select(`
        *,
        audit_plan:audit_plans(*),
        responsible:users!responsible_person(*)
      `)
      .order('created_at', { ascending: false });

    if (audit_plan_id) query = query.eq('audit_plan_id', audit_plan_id);
    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};
// ============ MVP AUDITOR FUNCTIONS ============

/**
 * A. Sales and Stock Verification
 * Confirm sales records, branch orders, and reconcile stock.
 */
export const getSalesVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, start_date, end_date } = req.query;

    // 1. Fetch orders
    let restQuery = supabase.from('restaurant_orders').select('*');
    let barQuery = supabase.from('bar_orders').select('*');

    if (branch_id) {
      restQuery = restQuery.eq('branch_id', branch_id);
      barQuery = barQuery.eq('branch_id', branch_id);
    }
    if (start_date) {
      restQuery = restQuery.gte('created_at', start_date);
      barQuery = barQuery.gte('created_at', start_date);
    }
    if (end_date) {
      restQuery = restQuery.lte('created_at', end_date);
      barQuery = barQuery.lte('created_at', end_date);
    }

    const [restRes, barRes] = await Promise.all([restQuery, barQuery]);

    // 2. Fetch branch stock requests for reconciliation
    let stockReqQuery = supabase.from('stock_requests').select('*, items:stock_request_items(*)');
    if (branch_id) stockReqQuery = stockReqQuery.eq('requesting_branch_id', branch_id);
    if (start_date) stockReqQuery = stockReqQuery.gte('created_at', start_date);

    const stockReqRes = await stockReqQuery;

    const summary = {
      restaurant: {
        total_orders: restRes.data?.length || 0,
        total_value: restRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0,
        voided: restRes.data?.filter(o => o.status === 'cancelled').length || 0
      },
      bar: {
        total_orders: barRes.data?.length || 0,
        total_value: barRes.data?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0,
        voided: barRes.data?.filter(o => o.status === 'cancelled').length || 0
      },
      stock_reconciliation: {
        total_requests: stockReqRes.data?.length || 0,
        pending_requests: stockReqRes.data?.filter(r => r.status === 'PENDING').length || 0,
        approved_requests: stockReqRes.data?.filter(r => r.status === 'APPROVED').length || 0
      }
    };

    res.status(200).json({ success: true, data: summary, orders: { restaurant: restRes.data, bar: barRes.data } });
  } catch (error) {
    next(error);
  }
};

/**
 * B. Financial Verification and Control
 * Reconcile all payment modes against daily sales reports.
 */
export const getFinancialReconciliation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. Get all payments for the date
    let paymentQuery = supabase.from('payments').select('*')
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    const { data: payments, error: payError } = await paymentQuery;
    if (payError) throw payError;

    // 2. Breakdown by mode
    const breakdown = {
      cash: payments?.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      mpesa: payments?.filter(p => p.payment_method === 'mpesa' || p.payment_method === 'mpesa_manual').reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      card: payments?.filter(p => p.payment_method === 'card_manual').reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      other: payments?.filter(p => !['cash', 'mpesa', 'mpesa_manual', 'card_manual'].includes(p.payment_method)).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      total: payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    };

    // 3. Compare with total sales (simplified)
    const { data: restSales } = await supabase.from('restaurant_orders')
      .select('total_amount')
      .eq('status', 'completed')
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    const { data: barSales } = await supabase.from('bar_orders')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    const totalSales = (restSales?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0) +
      (barSales?.reduce((sum, o) => sum + Number(o.total), 0) || 0);

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        payments: breakdown,
        sales: totalSales,
        discrepancy: breakdown.total - totalSales
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * C. Revenue Oversight (By Department)
 * Confirm revenue generated by restaurant, bar, and hotel.
 */
export const getRevenueOversight = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, start_date, end_date } = req.query;

    // Fetch Restaurant Revenue
    let restQuery = supabase.from('restaurant_orders').select('total_amount')
      .eq('status', 'completed');

    // Fetch Bar Revenue
    let barQuery = supabase.from('bar_orders').select('total')
      .eq('status', 'completed');

    // Fetch Hotel/Reception Revenue (assuming reservations table)
    let hotelQuery = supabase.from('reservations').select('total_price')
      .eq('status', 'confirmed');

    if (branch_id) {
      restQuery = restQuery.eq('branch_id', branch_id);
      barQuery = barQuery.eq('branch_id', branch_id);
      // hotel table might not have branch_id if it's per branch already
    }

    if (start_date) {
      restQuery = restQuery.gte('created_at', start_date);
      barQuery = barQuery.gte('created_at', start_date);
      hotelQuery = hotelQuery.gte('created_at', start_date);
    }

    const [restRes, barRes, hotelRes] = await Promise.all([restQuery, barQuery, hotelQuery]);

    const stats = {
      restaurant: restRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0,
      bar: barRes.data?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0,
      hotel: hotelRes.data?.reduce((sum, o) => sum + Number(o.total_price || 0), 0) || 0,
    };

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

/**
 * D. Expenditure and Payment Verification
 * Verify all payments made and legitimacy of expenses.
 */
export const getExpenditureVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, status } = req.query;

    let query = supabase.from('expenses').select(`
      *,
      creator:users!created_by(id, first_name, last_name),
      approver:users!approved_by(id, first_name, last_name)
    `).order('expense_date', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

/**
 * E. Stock Levels Verification
 * Compare current stock levels with theoretical levels and identify variances.
 */
export const getStockLevelsVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id } = req.query;

    if (!branch_id) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }

    // 1. Get current stock levels
    const { data: currentStock, error: stockError } = await supabase
      .from('branch_stock')
      .select(`
        *,
        item:items(id, name, sku, unit, category)
      `)
      .eq('branch_id', branch_id);

    if (stockError) throw stockError;

    // 2. Get recent stock movements for variance analysis
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: movements, error: movError } = await supabase
      .from('branch_stock_movements')
      .select('*')
      .eq('branch_id', branch_id)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (movError) throw movError;

    // 3. Calculate variances and flag discrepancies
    const stockAnalysis = currentStock?.map(stock => {
      const itemMovements = movements?.filter(m => m.item_sku === stock.item_sku) || [];

      const totalIn = itemMovements
        .filter(m => ['RECEIPT', 'ADJUSTMENT_IN', 'TRANSFER_IN'].includes(m.movement_type))
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

      const totalOut = itemMovements
        .filter(m => ['USAGE', 'SALE', 'WASTAGE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'].includes(m.movement_type))
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

      const theoreticalStock = (stock.quantity || 0) - totalOut + totalIn;
      const variance = (stock.quantity || 0) - theoreticalStock;
      const variancePercentage = theoreticalStock > 0 ? (variance / theoreticalStock) * 100 : 0;

      return {
        ...stock,
        current_quantity: stock.quantity,
        theoretical_quantity: theoreticalStock,
        variance,
        variance_percentage: variancePercentage,
        is_discrepancy: Math.abs(variancePercentage) > 10, // Flag if variance > 10%
        recent_movements: itemMovements.length,
        last_movement: itemMovements[0]?.created_at || null
      };
    }) || [];

    const summary = {
      total_items: stockAnalysis.length,
      items_with_discrepancies: stockAnalysis.filter(s => s.is_discrepancy).length,
      total_variance_value: stockAnalysis.reduce((sum, s) => sum + Math.abs(s.variance || 0), 0),
      low_stock_items: stockAnalysis.filter(s => (s.current_quantity || 0) < (s.min_quantity || 0)).length
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        stock_items: stockAnalysis
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * F. Branch Orders Verification
 * Verify stock requests with approval workflow and decision history.
 */
export const getBranchOrdersVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, status, start_date, end_date } = req.query;

    let query = supabase
      .from('stock_requests')
      .select(`
        *,
        items:stock_request_items(*),
        requesting_branch:branches!requesting_branch_id(id, name),
        created_by_user:users!created_by(id, first_name, last_name),
        reviewed_by_user:users!reviewed_by(id, first_name, last_name),
        approved_by_user:users!approved_by(id, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (branch_id) query = query.eq('requesting_branch_id', branch_id);
    if (status) query = query.eq('status', status);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data: requests, error } = await query;
    if (error) throw error;

    // Calculate summary statistics
    const summary = {
      total_requests: requests?.length || 0,
      pending: requests?.filter(r => r.status === 'PENDING').length || 0,
      approved: requests?.filter(r => r.status === 'APPROVED').length || 0,
      rejected: requests?.filter(r => r.status === 'REJECTED').length || 0,
      dispatched: requests?.filter(r => r.status === 'DISPATCHED').length || 0,
      total_items_requested: requests?.reduce((sum, r) => sum + (r.items?.length || 0), 0) || 0
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        requests
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * G. Sold Items Analysis
 * Compare items sold against stock requested to identify patterns.
 */
export const getSoldItemsAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, start_date, end_date } = req.query;

    if (!branch_id) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }

    const startDateStr = start_date as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDateStr = end_date as string || new Date().toISOString();

    // 1. Get items sold from restaurant orders
    const { data: restOrders } = await supabase
      .from('restaurant_orders')
      .select('*, items:restaurant_order_items(*)')
      .eq('branch_id', branch_id)
      .eq('status', 'completed')
      .gte('created_at', startDateStr)
      .lte('created_at', endDateStr);

    // 2. Get items sold from bar orders
    const { data: barOrders } = await supabase
      .from('bar_orders')
      .select('*, items:bar_order_items(*)')
      .eq('branch_id', branch_id)
      .eq('status', 'completed')
      .gte('created_at', startDateStr)
      .lte('created_at', endDateStr);

    // 3. Get stock requested in the same period
    const { data: stockRequests } = await supabase
      .from('stock_requests')
      .select('*, items:stock_request_items(*)')
      .eq('requesting_branch_id', branch_id)
      .gte('created_at', startDateStr)
      .lte('created_at', endDateStr);

    // 4. Aggregate sold items
    const soldItemsMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

    restOrders?.forEach(order => {
      order.items?.forEach((item: any) => {
        const key = item.menu_item_id || item.item_name;
        if (!soldItemsMap[key]) {
          soldItemsMap[key] = { name: item.item_name, quantity: 0, revenue: 0 };
        }
        soldItemsMap[key].quantity += item.quantity || 0;
        soldItemsMap[key].revenue += Number(item.price || 0) * (item.quantity || 0);
      });
    });

    barOrders?.forEach(order => {
      order.items?.forEach((item: any) => {
        const key = item.menu_item_id || item.item_name;
        if (!soldItemsMap[key]) {
          soldItemsMap[key] = { name: item.item_name, quantity: 0, revenue: 0 };
        }
        soldItemsMap[key].quantity += item.quantity || 0;
        soldItemsMap[key].revenue += Number(item.price || 0) * (item.quantity || 0);
      });
    });

    // 5. Aggregate requested items
    const requestedItemsMap: Record<string, number> = {};
    stockRequests?.forEach(request => {
      request.items?.forEach((item: any) => {
        const sku = item.item_sku;
        requestedItemsMap[sku] = (requestedItemsMap[sku] || 0) + (item.requested_quantity || 0);
      });
    });

    // 6. Create comparison analysis
    const analysis = Object.entries(soldItemsMap).map(([key, sold]) => ({
      item_name: sold.name,
      quantity_sold: sold.quantity,
      revenue_generated: sold.revenue,
      stock_requested: requestedItemsMap[key] || 0,
      consumption_ratio: requestedItemsMap[key] ? (sold.quantity / requestedItemsMap[key]) : 0
    }));

    const summary = {
      total_items_sold: Object.keys(soldItemsMap).length,
      total_quantity_sold: Object.values(soldItemsMap).reduce((sum, item) => sum + item.quantity, 0),
      total_revenue: Object.values(soldItemsMap).reduce((sum, item) => sum + item.revenue, 0),
      total_items_requested: Object.keys(requestedItemsMap).length,
      high_demand_items: analysis.filter(a => a.quantity_sold > 50).length
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        analysis: analysis.sort((a, b) => b.quantity_sold - a.quantity_sold)
      }
    });
  } catch (error) {
    next(error);
  }
};
