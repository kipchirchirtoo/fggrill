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
      .select('*')
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
      .select('*')
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
      .select('*')
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
      .select('*')
      .order('created_at', { ascending: false });

    if (audit_plan_id) query = query.eq('audit_plan_id', audit_plan_id);
    if (status) query = query.eq('status', status);
    if (severity) query = query.eq('severity', severity);

    const { data: rawData, error } = await query;
    if (error) throw error;

    // Manual join users and audit plans
    const userIds = [...new Set(rawData?.map(d => d.responsible_person).filter(Boolean))];
    const planIds = [...new Set(rawData?.map(d => d.audit_plan_id).filter(Boolean))];

    const [{ data: users }, { data: plans }] = await Promise.all([
      supabase.from('users').select('*').in('id', userIds),
      supabase.from('audit_plans').select('*').in('id', planIds)
    ]);

    const userMap = Object.fromEntries(users?.map(u => [u.id, u]) || []);
    const planMap = Object.fromEntries(plans?.map(p => [p.id, p]) || []);

    const data = rawData?.map(d => ({
      ...d,
      responsible: userMap[d.responsible_person],
      audit_plan: planMap[d.audit_plan_id]
    })) || [];

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

    // 1. Fetch branches for names
    const { data: branches } = await supabase.from('branches').select('id, name');

    // 2. Fetch orders
    let restQuery = supabase.from('restaurant_orders').select('*');
    let barQuery = supabase.from('bar_orders').select('*');

    if (branch_id && branch_id !== '0') {
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

    // 3. Group by branch if no specific branch requested
    const branchSummaries: Record<string, any> = {};
    if (!branch_id || branch_id === '0') {
      branches?.forEach(b => {
        branchSummaries[b.id] = {
          branch_id: b.id,
          branch_name: b.name,
          restaurant: { total_orders: 0, total_value: 0, voided: 0 },
          bar: { total_orders: 0, total_value: 0, voided: 0 },
          total_revenue: 0
        };
      });

      restRes.data?.forEach(o => {
        if (branchSummaries[o.branch_id]) {
          branchSummaries[o.branch_id].restaurant.total_orders++;
          if (o.status !== 'cancelled') {
            branchSummaries[o.branch_id].restaurant.total_value += Number(o.total_amount || 0);
            branchSummaries[o.branch_id].total_revenue += Number(o.total_amount || 0);
          } else {
            branchSummaries[o.branch_id].restaurant.voided++;
          }
        }
      });

      barRes.data?.forEach(o => {
        if (branchSummaries[o.branch_id]) {
          branchSummaries[o.branch_id].bar.total_orders++;
          if (o.status !== 'cancelled') {
            branchSummaries[o.branch_id].bar.total_value += Number(o.total || 0);
            branchSummaries[o.branch_id].total_revenue += Number(o.total || 0);
          } else {
            branchSummaries[o.branch_id].bar.voided++;
          }
        }
      });
    }

    // 4. Fetch branch stock requests for reconciliation
    let stockReqQuery = supabase.from('stock_requests').select('*');
    if (branch_id && branch_id !== '0') stockReqQuery = stockReqQuery.eq('requesting_branch_id', branch_id);
    if (start_date) stockReqQuery = stockReqQuery.gte('created_at', start_date);

    const rawStockReqs = await stockReqQuery;
    const reqIds = rawStockReqs.data?.map(r => r.id) || [];
    const { data: reqItems } = await supabase.from('stock_request_items').select('*').in('request_id', reqIds);

    const itemsByReq = (reqItems || []).reduce((acc: any, item) => {
      if (!acc[item.request_id]) acc[item.request_id] = [];
      acc[item.request_id].push(item);
      return acc;
    }, {});

    const stockReqRes = {
      ...rawStockReqs,
      data: rawStockReqs.data?.map(r => ({ ...r, items: itemsByReq[r.id] || [] }))
    };

    const summary = {
      restaurant: {
        total_orders: restRes.data?.length || 0,
        total_value: restRes.data?.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0,
        voided: restRes.data?.filter(o => o.status === 'cancelled').length || 0
      },
      bar: {
        total_orders: barRes.data?.length || 0,
        total_value: barRes.data?.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total || 0), 0) || 0,
        voided: barRes.data?.filter(o => o.status === 'cancelled').length || 0
      },
      stock_reconciliation: {
        total_requests: stockReqRes.data?.length || 0,
        pending_requests: stockReqRes.data?.filter(r => r.status === 'PENDING').length || 0,
        approved_requests: stockReqRes.data?.filter(r => r.status === 'APPROVED').length || 0
      },
      branch_summaries: Object.values(branchSummaries)
    };

    res.status(200).json({
      success: true,
      data: summary,
      orders: {
        restaurant: restRes.data,
        bar: barRes.data
      }
    });
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

    if (branch_id && branch_id !== '0') {
      paymentQuery = paymentQuery.eq('branch_id', branch_id);
    }

    const { data: rawPayments, error: payError } = await paymentQuery;
    if (payError) throw payError;

    // Fetch related users and branches manually to avoid relationship issues
    const userIds = [...new Set(rawPayments?.map(p => p.created_by).filter(Boolean))];
    const branchIds = [...new Set(rawPayments?.map(p => p.branch_id).filter(Boolean))];

    const [{ data: users }, { data: branches }] = await Promise.all([
      supabase.from('users').select('id, first_name, last_name, role').in('id', userIds),
      supabase.from('branches').select('id, name').in('id', branchIds)
    ]);

    const userMap = Object.fromEntries(users?.map(u => [u.id, u]) || []);
    const branchMap = Object.fromEntries(branches?.map(b => [b.id, b]) || []);

    const payments = rawPayments?.map(p => ({
      ...p,
      cashier: userMap[p.created_by],
      branch: branchMap[p.branch_id]
    })) || [];

    // 2. Breakdown by mode
    const breakdown = {
      cash: payments?.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      mpesa: payments?.filter(p => p.payment_method === 'mpesa' || p.payment_method === 'mpesa_manual').reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      card: payments?.filter(p => p.payment_method === 'card_manual').reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      other: payments?.filter(p => !['cash', 'mpesa', 'mpesa_manual', 'card_manual'].includes(p.payment_method)).reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      total: payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    };

    // 3. Group by Cashier
    const cashierGroups: Record<string, any> = {};
    payments?.forEach(p => {
      const cashierId = p.created_by || 'system';
      const cashierName = p.cashier ? `${p.cashier.first_name} ${p.cashier.last_name}` : 'System';
      const branchName = p.branch?.name || 'Main';

      if (!cashierGroups[cashierId]) {
        cashierGroups[cashierId] = {
          cashier_id: cashierId,
          cashier_name: cashierName,
          branch_name: branchName,
          total_amount: 0,
          payment_count: 0,
          payments: []
        };
      }

      cashierGroups[cashierId].total_amount += Number(p.amount);
      cashierGroups[cashierId].payment_count += 1;
      cashierGroups[cashierId].payments.push(p);
    });

    const cashierSummaries = Object.values(cashierGroups);

    // 4. Compare with total sales
    let restSalesQuery = supabase.from('restaurant_orders')
      .select('total_amount, branch_id')
      .eq('status', 'completed')
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    let barSalesQuery = supabase.from('bar_orders')
      .select('total, branch_id')
      .eq('status', 'completed')
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    if (branch_id && branch_id !== '0') {
      restSalesQuery = restSalesQuery.eq('branch_id', branch_id);
      barSalesQuery = barSalesQuery.eq('branch_id', branch_id);
    }

    const { data: restSales } = await restSalesQuery;
    const { data: barSales } = await barSalesQuery;

    const totalSales = (restSales?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0) +
      (barSales?.reduce((sum, o) => sum + Number(o.total), 0) || 0);

    // 5. Build recent transactions list (formatted for frontend)
    const recentTransactions = payments?.map(p => ({
      reference_number: p.reference,
      payment_method: p.payment_method,
      amount: p.amount,
      status: p.status,
      cashier_name: p.cashier ? `${p.cashier.first_name} ${p.cashier.last_name}` : 'System',
      branch_name: p.branch?.name || 'Main',
      created_at: p.created_at
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        payments_by_mode: breakdown, // Match frontend naming convention
        total_payments: breakdown.total,
        sales: totalSales,
        variance: breakdown.total - totalSales,
        cashier_summaries: cashierSummaries,
        recent_transactions: recentTransactions
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueOversight = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, start_date, end_date } = req.query;
    const start = (start_date as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = (end_date as string) || new Date().toISOString().split('T')[0];

    // 1. Departmental Revenue Queries
    let restQuery = supabase.from('restaurant_orders').select('total_amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', start)
      .lte('created_at', end);

    let barQuery = supabase.from('bar_orders').select('total, created_at')
      .eq('status', 'completed')
      .gte('created_at', start)
      .lte('created_at', end);

    let roomQuery = supabase.from('reservations').select('total_amount, created_at')
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .gte('created_at', start)
      .lte('created_at', end);

    let eventQuery = supabase.from('outside_catering_bookings').select('total_amount, created_at')
      .in('status', ['confirmed', 'completed'])
      .gte('event_date', start)
      .lte('event_date', end);

    if (branch_id && branch_id !== '0') {
      restQuery = restQuery.eq('branch_id', branch_id);
      barQuery = barQuery.eq('branch_id', branch_id);
      roomQuery = roomQuery.eq('branch_id', branch_id);
      eventQuery = eventQuery.eq('branch_id', branch_id);
    }

    const [restRes, barRes, roomRes, eventRes] = await Promise.all([restQuery, barQuery, roomQuery, eventQuery]);

    const restRev = restRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
    const barRev = barRes.data?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0;
    const roomRev = roomRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
    const eventRev = eventRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

    // 2. Daily Trends
    const trendsMap: Record<string, number> = {};
    const processTrends = (items: any[] | null, key: string) => {
      items?.forEach(i => {
        const date = i.created_at?.split('T')[0] || i.event_date;
        trendsMap[date] = (trendsMap[date] || 0) + Number(i[key] || 0);
      });
    };
    processTrends(restRes.data, 'total_amount');
    processTrends(barRes.data, 'total');
    processTrends(roomRes.data, 'total_amount');
    processTrends(eventRes.data, 'total_amount');

    const dailyTrends = Object.keys(trendsMap).sort().map(date => ({
      day: date.slice(5), // MM-DD
      amount: trendsMap[date]
    }));

    // 3. Yield Optimization Stats
    // Occupancy
    const { count: totalRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
    const { count: occupiedRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'occupied');
    const occupancy = totalRooms ? Math.round((occupiedRooms || 0) / totalRooms * 100) : 0;

    // AVG Order Value (F&B)
    const fbOrders = (restRes.data?.length || 0) + (barRes.data?.length || 0);
    const avgOrderValue = fbOrders ? Math.round((restRev + barRev) / fbOrders) : 0;

    // 4. Leakage & Anomalies
    const { data: exceptions } = await supabase.from('audit_exceptions')
      .select('*')
      .gte('detected_at', start)
      .lte('detected_at', end)
      .limit(5);

    const { data: cancelledRest } = await supabase.from('restaurant_orders')
      .select('total_amount, order_number')
      .eq('status', 'cancelled')
      .gte('created_at', start)
      .limit(5);

    const anomalies = [
      ...(exceptions || []).map(e => ({ type: 'AUDIT_EXCEPTION', detail: e.description, severity: e.severity })),
      ...(cancelledRest || []).map(o => ({ type: 'VOIDED_ORDER', detail: `Rest Order ${o.order_number} cancelled`, severity: 'MEDIUM' }))
    ].slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        total_revenue: restRev + barRev + roomRev + eventRev,
        revenue_by_dept: {
          restaurant: restRev,
          bar: barRev,
          rooms: roomRev,
          events: eventRev
        },
        daily_trends: dailyTrends,
        hotel_occupancy: `${occupancy}%`,
        avg_order_value: avgOrderValue,
        anomalies: anomalies
      }
    });
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

    let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false });

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

    // 1. Fetch branches for names
    const { data: branches } = await supabase.from('branches').select('id, name');

    // 2. Fetch current stock levels
    let stockQuery = supabase.from('branch_stock').select('*');

    if (branch_id && branch_id !== '0') {
      stockQuery = stockQuery.eq('branch_id', branch_id);
    }

    const { data: rawStock, error: stockError } = await stockQuery;
    if (stockError) throw stockError;

    // Fetch related items manually
    const itemSkus = [...new Set(rawStock?.map(s => s.item_sku).filter(Boolean))];
    const { data: items } = await supabase.from('items').select('id, name, sku, unit, category').in('sku', itemSkus);
    const itemMap = Object.fromEntries(items?.map(i => [i.sku, i]) || []);

    const currentStock = rawStock?.map(s => ({
      ...s,
      item: itemMap[s.item_sku]
    })) || [];

    // 3. Fetch recent stock movements for variance analysis
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let movQuery = supabase
      .from('branch_stock_movements')
      .select('*')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (branch_id && branch_id !== '0') {
      movQuery = movQuery.eq('branch_id', branch_id);
    }

    const { data: movements, error: movError } = await movQuery;
    if (movError) throw movError;

    // 4. Calculate variances and flag discrepancies
    const stockAnalysis = currentStock?.map(stock => {
      const itemMovements = movements?.filter(m => m.item_sku === stock.item_sku && m.branch_id === stock.branch_id) || [];

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
        is_discrepancy: Math.abs(variancePercentage) > 10,
        recent_movements: itemMovements.length,
        last_movement: itemMovements[0]?.created_at || null
      };
    }) || [];

    // 5. Group by branch if no specific branch requested
    const branchSummaries: Record<string, any> = {};
    if (!branch_id || branch_id === '0') {
      branches?.forEach(b => {
        const branchStock = stockAnalysis.filter(s => s.branch_id === b.id);
        branchSummaries[b.id] = {
          branch_id: b.id,
          branch_name: b.name,
          total_items: branchStock.length,
          items_with_discrepancies: branchStock.filter(s => s.is_discrepancy).length,
          total_variance_value: branchStock.reduce((sum, s) => sum + Math.abs(s.variance || 0), 0),
          low_stock_items: branchStock.filter(s => (s.current_quantity || 0) < (s.min_quantity || 0)).length
        };
      });
    }

    const summary = {
      total_items: stockAnalysis.length,
      items_with_discrepancies: stockAnalysis.filter(s => s.is_discrepancy).length,
      total_variance_value: stockAnalysis.reduce((sum, s) => sum + Math.abs(s.variance || 0), 0),
      low_stock_items: stockAnalysis.filter(s => (s.current_quantity || 0) < (s.min_quantity || 0)).length,
      branch_summaries: Object.values(branchSummaries)
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

    // 1. Fetch branches for names
    const { data: branches } = await supabase.from('branches').select('id, name');

    let query = supabase
      .from('stock_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (branch_id && branch_id !== '0') query = query.eq('requesting_branch_id', branch_id);
    if (status) query = query.eq('status', status);
    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);

    const { data: rawRequests, error } = await query;
    if (error) throw error;

    // Fetch related data manually to avoid schema cache relationship issues
    const requestIds = rawRequests?.map(r => r.id) || [];
    const userIds = [...new Set([
      ...rawRequests?.map(r => r.created_by),
      ...rawRequests?.map(r => r.reviewed_by),
      ...rawRequests?.map(r => r.approved_by)
    ].filter(Boolean))];
    const branchIds = [...new Set(rawRequests?.map(r => r.requesting_branch_id).filter(Boolean))];

    const [
      { data: reqItems },
      { data: users },
      { data: branchesData }
    ] = await Promise.all([
      supabase.from('stock_request_items').select('*').in('request_id', requestIds),
      supabase.from('users').select('id, first_name, last_name').in('id', userIds),
      supabase.from('branches').select('id, name').in('id', branchIds)
    ]);

    const itemsMap = (reqItems || []).reduce((acc: any, item) => {
      if (!acc[item.request_id]) acc[item.request_id] = [];
      acc[item.request_id].push(item);
      return acc;
    }, {});
    const userMap = Object.fromEntries(users?.map(u => [u.id, u]) || []);
    const branchMap = Object.fromEntries(branchesData?.map(b => [b.id, b]) || []);

    const requests = rawRequests?.map(r => ({
      ...r,
      items: itemsMap[r.id] || [],
      requesting_branch: branchMap[r.requesting_branch_id],
      created_by_user: userMap[r.created_by],
      reviewed_by_user: userMap[r.reviewed_by],
      approved_by_user: userMap[r.approved_by]
    })) || [];

    // 2. Group by branch if no specific branch requested
    const branchSummaries: Record<string, any> = {};
    if (!branch_id || branch_id === '0') {
      branches?.forEach(b => {
        const branchReqs = requests?.filter(r => r.requesting_branch_id === b.id) || [];
        branchSummaries[b.id] = {
          branch_id: b.id,
          branch_name: b.name,
          total_requests: branchReqs.length,
          pending: branchReqs.filter(r => r.status === 'PENDING').length,
          approved: branchReqs.filter(r => r.status === 'APPROVED').length,
          rejected: branchReqs.filter(r => r.status === 'REJECTED').length,
          dispatched: branchReqs.filter(r => r.status === 'DISPATCHED').length,
          total_items: branchReqs.reduce((sum, r) => sum + (r.items?.length || 0), 0)
        };
      });
    }

    // Calculate overall summary statistics
    const summary = {
      total_requests: requests?.length || 0,
      pending: requests?.filter(r => r.status === 'PENDING').length || 0,
      approved: requests?.filter(r => r.status === 'APPROVED').length || 0,
      rejected: requests?.filter(r => r.status === 'REJECTED').length || 0,
      dispatched: requests?.filter(r => r.status === 'DISPATCHED').length || 0,
      total_items_requested: requests?.reduce((sum, r) => sum + (r.items?.length || 0), 0) || 0,
      branch_summaries: Object.values(branchSummaries)
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

    // 1. Fetch branches for names
    const { data: branches } = await supabase.from('branches').select('id, name');

    const startDateStr = start_date as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDateStr = end_date as string || new Date().toISOString();

    // 2. Fetch orders and stock requests
    let restQuery = supabase.from('restaurant_orders').select('*').eq('status', 'completed').gte('created_at', startDateStr).lte('created_at', endDateStr);
    let barQuery = supabase.from('bar_orders').select('*').eq('status', 'completed').gte('created_at', startDateStr).lte('created_at', endDateStr);
    let stockReqQuery = supabase.from('stock_requests').select('*').gte('created_at', startDateStr).lte('created_at', endDateStr);

    if (branch_id && branch_id !== '0') {
      restQuery = restQuery.eq('branch_id', branch_id);
      barQuery = barQuery.eq('branch_id', branch_id);
      stockReqQuery = stockReqQuery.eq('requesting_branch_id', branch_id);
    }

    const [rawRest, rawBar, rawStock] = await Promise.all([restQuery, barQuery, stockReqQuery]);

    // Fetch items separately for manual joining
    const restIds = rawRest.data?.map(o => o.id) || [];
    const barIds = rawBar.data?.map(o => o.id) || [];
    const stockIds = rawStock.data?.map(o => o.id) || [];

    const [restItemsRes, barItemsRes, stockItemsRes] = await Promise.all([
      supabase.from('restaurant_order_items').select('*').in('order_id', restIds),
      supabase.from('bar_order_items').select('*').in('order_id', barIds),
      supabase.from('stock_request_items').select('*').in('request_id', stockIds)
    ]);

    const itemsByRestId = (restItemsRes.data || []).reduce((acc: any, i) => {
      if (!acc[i.order_id]) acc[i.order_id] = [];
      acc[i.order_id].push(i);
      return acc;
    }, {});
    const itemsByBarId = (barItemsRes.data || []).reduce((acc: any, i) => {
      if (!acc[i.order_id]) acc[i.order_id] = [];
      acc[i.order_id].push(i);
      return acc;
    }, {});
    const itemsByStockId = (stockItemsRes.data || []).reduce((acc: any, i) => {
      if (!acc[i.request_id]) acc[i.request_id] = [];
      acc[i.request_id].push(i);
      return acc;
    }, {});

    const restRes = { ...rawRest, data: rawRest.data?.map(o => ({ ...o, items: itemsByRestId[o.id] || [] })) };
    const barRes = { ...rawBar, data: rawBar.data?.map(o => ({ ...o, items: itemsByBarId[o.id] || [] })) };
    const stockRes = { ...rawStock, data: rawStock.data?.map(o => ({ ...o, items: itemsByStockId[o.id] || [] })) };

    // 3. Process data by branch
    const branchSummaries: Record<string, any> = {};
    if (!branch_id || branch_id === '0') {
      branches?.forEach(b => {
        branchSummaries[b.id] = {
          branch_id: b.id,
          branch_name: b.name,
          total_items_sold: 0,
          total_revenue: 0,
          total_quantity: 0
        };
      });
    }

    const soldItemsMap: Record<string, { name: string; quantity: number; revenue: number; branch_id: string }> = {};
    const processOrders = (orders: any[] | null) => {
      orders?.forEach(order => {
        order.items?.forEach((item: any) => {
          const key = `${order.branch_id}_${item.menu_item_id || item.item_name}`;
          if (!soldItemsMap[key]) {
            soldItemsMap[key] = { name: item.item_name, quantity: 0, revenue: 0, branch_id: order.branch_id };
          }
          const qty = item.quantity || 0;
          const rev = Number(item.price || 0) * qty;
          soldItemsMap[key].quantity += qty;
          soldItemsMap[key].revenue += rev;

          if (branchSummaries[order.branch_id]) {
            branchSummaries[order.branch_id].total_revenue += rev;
            branchSummaries[order.branch_id].total_quantity += qty;
          }
        });
      });
    };

    processOrders(restRes.data || null);
    processOrders(barRes.data || null);

    // 4. Create comparison analysis
    const requestedItemsMap: Record<string, number> = {};
    stockRes.data?.forEach(request => {
      request.items?.forEach((item: any) => {
        const key = `${request.requesting_branch_id}_${item.item_sku}`;
        requestedItemsMap[key] = (requestedItemsMap[key] || 0) + (item.requested_quantity || 0);
      });
    });

    const analysis = Object.entries(soldItemsMap).map(([key, sold]) => ({
      ...sold,
      stock_requested: requestedItemsMap[key] || 0,
      consumption_ratio: requestedItemsMap[key] ? (sold.quantity / requestedItemsMap[key]) : 0
    }));

    const summary = {
      total_items_sold: Object.keys(soldItemsMap).length,
      total_quantity_sold: Object.values(soldItemsMap).reduce((sum, item) => sum + item.quantity, 0),
      total_revenue: Object.values(soldItemsMap).reduce((sum, item) => sum + item.revenue, 0),
      branch_summaries: Object.values(branchSummaries)
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        analysis: analysis.sort((a, b) => b.quantity - a.quantity)
      }
    });
  } catch (error) {
    next(error);
  }
};
