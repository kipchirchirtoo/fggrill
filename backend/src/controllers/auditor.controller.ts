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
