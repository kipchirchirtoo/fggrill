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
        status: 'open',
        detected_at: new Date().toISOString()
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

/**
 * Verify and Clear Anomaly
 * Auditor marks a transaction as verified.
 */
export const verifyAnomaly = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id, type, notes } = req.body;
    const auditorId = req.user?.id;
    const timestamp = new Date().toISOString();

    if (!id || !type) {
      res.status(400).json({ success: false, message: 'ID and entity type are required' });
      return;
    }

    let result;
    let error;

    switch (type) {
      case 'restaurant_order':
        const { data: restData, error: restError } = await supabase
          .from('restaurant_orders')
          .update({
            auditor_id: auditorId,
            audited_at: timestamp,
            audit_notes: notes
          })
          .eq('id', id)
          .select()
          .single();
        result = restData;
        error = restError;
        break;

      case 'bar_order':
        const { data: barData, error: barError } = await supabase
          .from('bar_orders')
          .update({
            auditor_id: auditorId,
            audited_at: timestamp,
            audit_notes: notes
          })
          .eq('id', id)
          .select()
          .single();
        result = barData;
        error = barError;
        break;

      case 'bill':
        const { data: billData, error: billError } = await supabase
          .from('unpaid_bills')
          .update({
            auditor_id: auditorId,
            auditor_confirmed_at: timestamp,
            remarks: notes
          })
          .eq('id', id)
          .select()
          .single();
        result = billData;
        error = billError;
        break;

      case 'invoice':
        const { data: invData, error: invError } = await supabase
          .from('accounting_ar_invoices')
          .update({
            auditor_id: auditorId,
            audited_at: timestamp,
            audit_notes: notes,
            status: 'verified'
          })
          .eq('id', id)
          .select()
          .single();
        result = invData;
        error = invError;
        break;

      case 'exception':
        const { data: excData, error: excError } = await supabase
          .from('audit_exceptions')
          .update({
            status: 'resolved',
            resolved_at: timestamp,
            resolved_by: auditorId,
            resolution_notes: notes
          })
          .eq('id', id)
          .select()
          .single();
        result = excData;
        error = excError;
        break;

      case 'pos_transaction':
        const { data: posData, error: posError } = await supabase
          .from('pos_transactions')
          .update({
            auditor_id: auditorId,
            audited_at: timestamp,
            audit_notes: notes
          })
          .eq('id', id)
          .select()
          .single();
        result = posData;
        error = posError;
        break;

      case 'payment':
        const { data: payData, error: payError } = await supabase
          .from('payments')
          .update({
            metadata: {
              ...(req.body.metadata || {}),
              auditor_id: auditorId,
              audited_at: timestamp,
              audit_notes: notes,
              verified: true
            }
          })
          .eq('id', id)
          .select()
          .single();
        result = payData;
        error = payError;
        break;

      case 'stock_movement':
        const { data: moveData, error: moveError } = await supabase
          .from('branch_stock_movements')
          .update({ auditor_id: auditorId, audited_at: timestamp, audit_notes: notes })
          .eq('id', id)
          .select()
          .single();
        result = moveData;
        error = moveError;
        break;

      case 'kitchen_usage':
        const { data: kitchenData, error: kitchenError } = await supabase
          .from('kitchen_usage_entries')
          .update({ auditor_id: auditorId, audited_at: timestamp, audit_notes: notes })
          .eq('id', id)
          .select()
          .single();
        result = kitchenData;
        error = kitchenError;
        break;

      case 'stock_request':
        const { data: reqData, error: reqError } = await supabase
          .from('stock_requests')
          .update({ auditor_id: auditorId, audited_at: timestamp, audit_notes: notes })
          .eq('id', id)
          .select()
          .single();
        result = reqData;
        error = reqError;
        break;

      case 'dispatch_note':
        const { data: dispatchData, error: dispatchError } = await supabase
          .from('dispatch_notes')
          .update({ auditor_id: auditorId, audited_at: timestamp, audit_notes: notes })
          .eq('id', id)
          .select()
          .single();
        result = dispatchData;
        error = dispatchError;
        break;

      default:
        res.status(400).json({ success: false, message: 'Invalid entity type for verification' });
        return;
    }

    if (error) throw error;

    // 2. Fetch linked exceptions if it's not already an exception
    let exceptions = [];
    if (type !== 'exception' && result?.id) {
      const { data: linkedExceptions } = await supabase
        .from('audit_exceptions')
        .select('*')
        .eq('reference_id', result.id)
        .eq('reference_type', type);
      exceptions = linkedExceptions || [];
    }

    res.status(200).json({
      success: true,
      message: 'Anomaly verified and cleared successfully',
      data: result
    });
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

// ============ AUDITOR WATCHLIST ============

export const flagItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { entity_type, entity_id, reason, metadata } = req.body;
    const flagged_by = req.user?.id;

    if (!entity_type || !entity_id) {
      res.status(400).json({ success: false, message: 'entity_type and entity_id are required' });
      return;
    }

    const { data, error } = await supabase
      .from('auditor_watchlist')
      .insert([{
        entity_type,
        entity_id,
        reason,
        flagged_by,
        metadata,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    // Optional: Update the entity itself to show it's flagged
    if (entity_type === 'invoice') {
      await supabase.from('accounting_ar_invoices').update({ is_flagged: true }).eq('id', entity_id);
    }

    res.status(201).json({ success: true, data });
    logger.info(`Item flagged for audit: ${entity_type} ${entity_id}`);
  } catch (error) {
    next(error);
  }
};

export const getWatchlist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, entity_type } = req.query;

    let query = supabase
      .from('auditor_watchlist')
      .select(`
        *,
        flagged_by_user:users!flagged_by(id, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (entity_type) query = query.eq('entity_type', entity_type);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

export const resolveWatchlistItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, resolution_notes } = req.body;

    const { data, error } = await supabase
      .from('auditor_watchlist')
      .update({
        status: status || 'resolved',
        updated_at: new Date().toISOString(),
        metadata: { resolution_notes }
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If resolved, we might want to unflag the entity
    if ((status === 'resolved' || status === 'dismissed') && data.entity_type === 'invoice') {
      await supabase.from('accounting_ar_invoices').update({ is_flagged: false }).eq('id', data.entity_id);
    }

    res.status(200).json({ success: true, data });
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

    // 2. Fetch orders, payments, and POS transactions
    let restQuery = supabase.from('restaurant_orders').select('*'); // items fetched separately to avoid schema cache FK issues
    let barQuery = supabase.from('bar_orders').select('*, items:bar_order_items(*)'); // Fetch items for details (no inventory join)
    let poolQuery = supabase.from('restaurant_pool_token_sales').select('*');
    let paymentsQuery = supabase.from('payments').select('*');
    let posQuery = supabase.from('pos_transactions').select('*');

    if (branch_id && branch_id !== '0') {
      restQuery = restQuery.eq('branch_id', branch_id);
      barQuery = barQuery.eq('branch_id', branch_id);
      poolQuery = poolQuery.eq('branch_id', branch_id);
      // payments table doesn't have branch_id directly, inferred in frontend or handled by previous fix. 
      // However, for this specific report, we might need to rely on the previously implemented getFinancialReconciliation logic if we want strict branch filtering on payments.
      // But for "Sales Verification", orders are the primary source of truth for *Sales*. Payments are for *Collection*.
      // We will include payments that match the orders found, or if possible filter by branch if columns were added (unlikely).
      // Given previous context: Payments query was refactored in getFinancialReconciliation to infer branch. 
      // Here we will fetch all and let frontend/summary logic attribute them, OR duplicates logic.
      // To be safe and fast, let's fetch payments related to the date range.
      posQuery = posQuery.eq('branch_id', branch_id);
    }

    if (start_date) {
      restQuery = restQuery.gte('created_at', start_date);
      barQuery = barQuery.gte('created_at', start_date);
      poolQuery = poolQuery.gte('created_at', start_date);
      paymentsQuery = paymentsQuery.gte('payment_date', start_date);
      posQuery = posQuery.gte('transaction_date', start_date);
    }
    if (end_date) {
      restQuery = restQuery.lte('created_at', end_date);
      barQuery = barQuery.lte('created_at', end_date);
      poolQuery = poolQuery.lte('created_at', end_date);
      paymentsQuery = paymentsQuery.lte('payment_date', end_date);
      posQuery = posQuery.lte('transaction_date', end_date);
    }

    const [restRes, barRes, poolRes, payRes, posRes] = await Promise.all([restQuery, barQuery, poolQuery, paymentsQuery, posQuery]);

    // 3. Group by branch if no specific branch requested
    // 3. Group by branch if no specific branch requested
    const branchSummaries: Record<string, any> = {};
    if (!branch_id || branch_id === '0') {
      branches?.forEach(b => {
        branchSummaries[b.id] = {
          branch_id: b.id,
          branch_name: b.name,
          restaurant: { total_orders: 0, total_value: 0, voided: 0 },
          bar: { total_orders: 0, total_value: 0, voided: 0 },
          pool: { total_sales: 0, total_value: 0 },
          pos: { total_transactions: 0, total_value: 0 },
          total_revenue: 0, // Sales (Orders)
          total_collected: 0 // Collections (Payments + POS)
        };
      });

      restRes.data?.forEach(o => {
        const bSummary = branchSummaries[o.branch_id];
        if (bSummary) {
          bSummary.restaurant.total_orders++;
          if (o.status !== 'cancelled') {
            bSummary.restaurant.total_value += Number(o.total_amount || 0);
            bSummary.total_revenue += Number(o.total_amount || 0);
          } else {
            bSummary.restaurant.voided++;
          }
        }
      });

      barRes.data?.forEach(o => {
        const bSummary = branchSummaries[o.branch_id];
        if (bSummary) {
          bSummary.bar.total_orders++;
          if (o.status !== 'cancelled') {
            bSummary.bar.total_value += Number(o.total || 0);
            bSummary.total_revenue += Number(o.total || 0);
          } else {
            bSummary.bar.voided++;
          }
        }
      });

      poolRes.data?.forEach(s => {
        const bSummary = branchSummaries[s.branch_id];
        if (bSummary) {
          bSummary.pool.total_sales++;
          const saleValue = Number(s.quantity || 0) * Number(s.amount_per_token || 0);
          bSummary.pool.total_value += saleValue;
          bSummary.total_revenue += saleValue;
          // Pool tokens are usually immediate cash/mpesa collection
          bSummary.total_collected += saleValue;
        }
      });

      // POS Transactions - Track as collection, not sales revenue (unless strict retail)
      posRes.data?.forEach(p => {
        const bSummary = branchSummaries[p.branch_id];
        if (bSummary) {
          bSummary.pos.total_transactions++;
          bSummary.pos.total_value += Number(p.amount || 0);
          // Do NOT add to total_revenue (Sales) to avoid double counting if POS is used for order payments
          bSummary.total_collected += Number(p.amount || 0);
        }
      });

      // Payments - Track as collection
      payRes.data?.forEach(p => {
        // Payments might not have branch_id directly, or it might be inferred.
        // If query included branch_id filter, these are valid.
        // If not, we check if payment has branch_id or if we can link it.
        // Assuming updated schema has branch_id or we rely on what we have.
        if (p.branch_id && branchSummaries[p.branch_id]) {
          branchSummaries[p.branch_id].total_collected += Number(p.amount || 0);
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
      pool: {
        total_sales: poolRes.data?.length || 0,
        total_value: poolRes.data?.reduce((sum, s) => sum + (Number(s.quantity || 0) * Number(s.amount_per_token || 0)), 0) || 0
      },
      pos: {
        total_transactions: posRes.data?.length || 0,
        total_value: posRes.data?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0
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
        bar: barRes.data,
        pool_tokens: poolRes.data
      },
      pos_transactions: posRes.data,
      payments: payRes.data
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

    // 1. Get all payments for the date (remove branch_id filter as it doesn't exist on payments)
    const { data: rawPayments, error: payError } = await supabase.from('payments').select('*')
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    const { data: poolSales } = await supabase.from('restaurant_pool_token_sales')
      .select('*, cashier:users(id, first_name, last_name)')
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    if (payError) throw payError;

    // 2. Collect IDs for related entities to infer branch and cashier
    const bookingIds = [...new Set(rawPayments?.map(p => p.booking_id).filter(Boolean))];
    const invoiceIds = [...new Set(rawPayments?.map(p => p.invoice_id).filter(Boolean))];
    const restOrderIds = [...new Set(rawPayments?.map(p => p.restaurant_order_id).filter(Boolean))];
    const barOrderIds = [...new Set(rawPayments?.map(p => p.bar_order_id).filter(Boolean))];
    const posIds = [...new Set(rawPayments?.map(p => p.pos_transaction_id).filter(Boolean))];

    // 3. Parallel fetch of related entities
    const [
      { data: bookings },
      { data: invoices },
      { data: restOrders },
      { data: barOrders },
      { data: posTxns }
    ] = await Promise.all([
      bookingIds.length ? supabase.from('reservations').select('id, branch_id, created_by, auditor_id, audited_at, audit_notes').in('id', bookingIds) : { data: [] },
      invoiceIds.length ? supabase.from('accounting_ar_invoices').select('id, created_by, auditor_id, audited_at, audit_notes').in('id', invoiceIds) : { data: [] },
      restOrderIds.length ? supabase.from('restaurant_orders').select('id, branch_id, staff_id, auditor_id, audited_at, audit_notes').in('id', restOrderIds) : { data: [] },
      barOrderIds.length ? supabase.from('bar_orders').select('id, branch_id, staff_id, auditor_id, audited_at, audit_notes').in('id', barOrderIds) : { data: [] },
      posIds.length ? supabase.from('pos_transactions').select('id, branch_id, cashier_id, auditor_id, audited_at, audit_notes').in('id', posIds) : { data: [] }
    ]);

    // 4. Create lookup maps
    const bookingMap = Object.fromEntries(bookings?.map(b => [b.id, b]) || []);
    const invoiceMap = Object.fromEntries(invoices?.map(i => [i.id, i]) || []);
    const restOrderMap = Object.fromEntries(restOrders?.map(o => [o.id, o]) || []);
    const barOrderMap = Object.fromEntries(barOrders?.map(o => [o.id, o]) || []);
    const posMap = Object.fromEntries(posTxns?.map(p => [p.id, p]) || []);

    // 5. Enrich payments with inferred data
    let enrichedPayments = rawPayments?.map(p => {
      let inferredBranchId = null;
      let inferredUserId = null;

      if (p.booking_id && bookingMap[p.booking_id]) {
        inferredBranchId = bookingMap[p.booking_id].branch_id;
        inferredUserId = bookingMap[p.booking_id].created_by;
      } else if (p.restaurant_order_id && restOrderMap[p.restaurant_order_id]) {
        inferredBranchId = restOrderMap[p.restaurant_order_id].branch_id;
        inferredUserId = restOrderMap[p.restaurant_order_id].staff_id;
      } else if (p.bar_order_id && barOrderMap[p.bar_order_id]) {
        inferredBranchId = barOrderMap[p.bar_order_id].branch_id;
        inferredUserId = barOrderMap[p.bar_order_id].staff_id;
      } else if (p.pos_transaction_id && posMap[p.pos_transaction_id]) {
        inferredBranchId = posMap[p.pos_transaction_id].branch_id;
        inferredUserId = posMap[p.pos_transaction_id].cashier_id;
      } else if (p.invoice_id && invoiceMap[p.invoice_id]) {
        // Invoices don't have branch_id usually, treat as null (Head Office) or derive from user if needed
        inferredUserId = invoiceMap[p.invoice_id].created_by;
      }

      const related = p.booking_id ? bookingMap[p.booking_id] :
        (p.restaurant_order_id ? restOrderMap[p.restaurant_order_id] :
          (p.bar_order_id ? barOrderMap[p.bar_order_id] :
            (p.pos_transaction_id ? posMap[p.pos_transaction_id] : (p.invoice_id ? invoiceMap[p.invoice_id] : null))));

      return {
        ...p,
        branch_id: inferredBranchId,
        user_id: inferredUserId,
        auditor_id: related?.auditor_id || p.metadata?.auditor_id,
        audited_at: related?.audited_at || p.metadata?.audited_at,
        audit_notes: related?.audit_notes || p.metadata?.audit_notes
      };
    }) || [];

    // 6. Filter by requested branch
    if (branch_id && branch_id !== '0') {
      enrichedPayments = enrichedPayments.filter(p => String(p.branch_id) === String(branch_id));
    }

    // 6b. Add pool token sales as virtual payments
    const virtualPoolPayments = (poolSales || [])
      .filter(s => !branch_id || branch_id === '0' || String(s.branch_id) === String(branch_id))
      .map(s => ({
        id: s.id,
        amount: Number(s.quantity || 0) * Number(s.amount_per_token || 0),
        payment_method: s.payment_method,
        status: 'completed',
        reference: `POOL-TOKEN-${s.id.slice(0, 8)}`,
        created_at: s.created_at,
        branch_id: s.branch_id,
        created_by: s.cashier_id,
        is_pool_token: true,
        cashier: s.cashier
      }));

    enrichedPayments = [...enrichedPayments, ...virtualPoolPayments];

    // 7. Fetch user and branch details for display
    const userIds = [...new Set(enrichedPayments.map(p => p.created_by).filter(Boolean))];
    const branchIds = [...new Set(enrichedPayments.map(p => p.branch_id).filter(Boolean))];

    const [{ data: users }, { data: branches }] = await Promise.all([
      userIds.length ? supabase.from('users').select('id, first_name, last_name, role').in('id', userIds) : { data: [] },
      branchIds.length ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [] }
    ]);

    const userMap = Object.fromEntries(users?.map(u => [u.id, u]) || []);
    const branchMap = Object.fromEntries(branches?.map(b => [b.id, b]) || []);

    const payments = enrichedPayments.map(p => ({
      ...p,
      cashier: userMap[p.created_by],
      branch: branchMap[p.branch_id]
    }));

    // 8. Breakdown by mode
    const breakdown = {
      cash: payments.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + Number(p.amount), 0),
      mpesa: payments.filter(p => p.payment_method === 'mpesa' || p.payment_method === 'mpesa_manual').reduce((sum, p) => sum + Number(p.amount), 0),
      card: payments.filter(p => p.payment_method === 'card_manual').reduce((sum, p) => sum + Number(p.amount), 0),
      other: payments.filter(p => !['cash', 'mpesa', 'mpesa_manual', 'card_manual'].includes(p.payment_method)).reduce((sum, p) => sum + Number(p.amount), 0),
      total: payments.reduce((sum, p) => sum + Number(p.amount), 0)
    };

    // 9. Group by Cashier
    const cashierGroups: Record<string, any> = {};
    payments.forEach(p => {
      const cashierId = p.created_by || 'system';
      const cashierName = p.cashier ? `${p.cashier.first_name} ${p.cashier.last_name}` : (p.created_by ? 'Unknown User' : 'System');
      const branchName = p.branch?.name || (p.branch_id ? 'Unknown Branch' : 'Main / Global');

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

    // 10. Compare with total sales (Sales logic remains filtered by DB as those tables have branch_id)
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
    // poolSales already fetched earlier

    const totalSales = (restSales?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0) +
      (barSales?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0) +
      (poolSales?.reduce((sum, s) => sum + (Number(s.quantity || 0) * Number(s.amount_per_token || 0)), 0) || 0);

    // 11. Build recent transactions list
    const paramsLimit = req.query.limit as string;
    const limit = paramsLimit === 'all' ? undefined : (parseInt(paramsLimit) || 50);

    let recentTransactions = payments.map(p => ({
      id: p.id,
      reference_number: p.reference,
      payment_method: p.payment_method,
      amount: p.amount,
      status: p.status,
      cashier_name: p.cashier ? `${p.cashier.first_name} ${p.cashier.last_name}` : 'System',
      branch_name: p.branch?.name || 'Main',
      is_pool_token: (p as any).is_pool_token || false,
      created_at: p.created_at
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (limit) {
      recentTransactions = recentTransactions.slice(0, limit);
    }

    // 12. Group by branch if no specific branch requested
    let branchSummaries: any[] = [];
    if (!branch_id || branch_id === '0') {
      const branchGroups: Record<string, any> = {};

      const getGroup = (id: string, nameFallback: string) => {
        if (!branchGroups[id]) {
          branchGroups[id] = {
            branch_id: id,
            branch_name: nameFallback,
            total_payments: 0,
            payment_count: 0,
            cash: 0,
            mpesa: 0,
            card: 0,
            total_sales: 0
          };
        }
        return branchGroups[id];
      };

      payments.forEach(p => {
        const bg = getGroup(p.branch_id || 'main', p.branch?.name || 'Main Office');
        bg.total_payments += Number(p.amount);
        bg.payment_count += 1;

        if (p.payment_method === 'cash') {
          bg.cash += Number(p.amount);
        } else if (p.payment_method?.includes('mpesa')) {
          bg.mpesa += Number(p.amount);
        } else if (p.payment_method?.includes('card')) {
          bg.card += Number(p.amount);
        }
      });

      // Add Sales Data
      restSales?.forEach(o => {
        const bg = getGroup(o.branch_id || 'main', 'Main Office');
        bg.total_sales += Number(o.total_amount || 0);
      });

      barSales?.forEach(o => {
        const bg = getGroup(o.branch_id || 'main', 'Main Office');
        bg.total_sales += Number(o.total || 0);
      });

      // Finalize with Variance
      branchSummaries = Object.values(branchGroups).map((bg: any) => ({
        ...bg,
        variance: bg.total_payments - bg.total_sales
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        date: targetDate,
        payments_by_mode: breakdown,
        total_payments: breakdown.total,
        sales: totalSales,
        variance: breakdown.total - totalSales,
        cashier_summaries: cashierSummaries,
        recent_transactions: recentTransactions,
        branch_summaries: branchSummaries
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueOversight = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, start_date, end_date } = req.query;
    const start = (start_date as string) || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
    const end = (end_date as string) || new Date().toISOString();

    // 1. Fetch Revenue Streams
    let restQuery = supabase.from('restaurant_orders').select('total_amount, created_at, status')
      .in('status', ['completed', 'paid', 'delivered'])
      .gte('created_at', start)
      .lte('created_at', end);

    let barQuery = supabase.from('bar_orders').select('total, created_at, status')
      .in('status', ['completed', 'paid', 'closed'])
      .gte('created_at', start)
      .lte('created_at', end);

    let roomQuery = supabase.from('reservations').select('total_amount, created_at, status')
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .gte('created_at', start)
      .lte('created_at', end);

    let eventQuery = supabase.from('outside_catering_bookings').select('total_amount, event_date, status')
      .in('status', ['confirmed', 'completed'])
      .gte('event_date', start)
      .lte('event_date', end);

    let posQuery = supabase.from('pos_transactions').select('amount, created_at')
      .gte('created_at', start)
      .lte('created_at', end);

    let billQuery = supabase.from('unpaid_bills').select('id, total_amount, paid_amount, created_at, status')
      .is('auditor_id', null)
      .gte('created_at', start)
      .lte('created_at', end);

    let poolQuery = supabase.from('restaurant_pool_token_sales').select('quantity, amount_per_token, created_at')
      .gte('created_at', start)
      .lte('created_at', end);

    if (branch_id && branch_id !== '0') {
      restQuery = restQuery.eq('branch_id', branch_id);
      barQuery = barQuery.eq('branch_id', branch_id);
      roomQuery = roomQuery.eq('branch_id', branch_id);
      eventQuery = eventQuery.eq('branch_id', branch_id);
      posQuery = posQuery.eq('branch_id', branch_id);
      billQuery = billQuery.eq('branch_id', branch_id);
      poolQuery = poolQuery.eq('branch_id', branch_id);
    }

    const [restRes, barRes, roomRes, eventRes, posRes, billRes, poolRes] = await Promise.all([
      restQuery, barQuery, roomQuery, eventQuery, posQuery, billQuery, poolQuery
    ]);

    const restRev = restRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
    const barRev = barRes.data?.reduce((sum, o) => sum + Number(o.total || 0), 0) || 0;
    const poolRev = poolRes.data?.reduce((sum, o) => sum + (Number(o.quantity || 0) * Number(o.amount_per_token || 0)), 0) || 0;
    const roomRev = roomRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
    const eventRev = eventRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
    const posRev = posRes.data?.reduce((sum, o) => sum + Number(o.amount || 0), 0) || 0;
    const billsTotal = billRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
    const billsPaid = billRes.data?.reduce((sum, o) => sum + Number(o.paid_amount || 0), 0) || 0;

    // 2. Daily Trends
    const trendsMap: Record<string, number> = {};
    const processTrends = (items: any[] | null, key: string, dateKey: string = 'created_at') => {
      items?.forEach(i => {
        const date = (i[dateKey] || '').split('T')[0];
        if (date) {
          trendsMap[date] = (trendsMap[date] || 0) + Number(i[key] || 0);
        }
      });
    };
    processTrends(restRes.data, 'total_amount');
    processTrends(barRes.data, 'total');
    processTrends(roomRes.data, 'total_amount');
    processTrends(eventRes.data, 'total_amount', 'event_date');
    processTrends(posRes.data, 'amount');
    poolRes.data?.forEach(i => {
      const date = (i.created_at || '').split('T')[0];
      if (date) {
        trendsMap[date] = (trendsMap[date] || 0) + (Number(i.quantity || 0) * Number(i.amount_per_token || 0));
      }
    });

    const dailyTrends = Object.keys(trendsMap).sort().map(date => ({
      day: date.slice(5), // MM-DD
      amount: trendsMap[date]
    })).slice(-15); // Show last 15 days

    // 3. Yield Optimization Stats
    const { count: totalRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
    const { count: occupiedRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'occupied');
    const occupancy = totalRooms ? Math.round((occupiedRooms || 0) / totalRooms * 100) : 0;

    const fbOrders = (restRes.data?.length || 0) + (barRes.data?.length || 0) + (poolRes.data?.length || 0);
    const avgOrderValue = fbOrders ? Math.round((restRev + barRev + poolRev) / fbOrders) : 0;

    // 4. Leakage & Anomalies Detection
    const { data: exceptions } = await supabase.from('audit_exceptions')
      .select('*')
      .eq('status', 'open')
      .gte('detected_at', start)
      .lte('detected_at', end)
      .order('detected_at', { ascending: false })
      .limit(10);

    const { data: voidedOrders } = await supabase.from('restaurant_orders')
      .select('id, total_amount, order_number, table_number, created_at')
      .eq('status', 'cancelled')
      .is('auditor_id', null)
      .gte('created_at', start)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: voidedBarOrders } = await supabase.from('bar_orders')
      .select('id, total, order_number, created_at')
      .eq('status', 'cancelled')
      .is('auditor_id', null)
      .gte('created_at', start)
      .limit(5);

    const pendingBills = billRes.data?.filter(b => b.status === 'unpaid' || b.status === 'partial') || [];

    // 5. Intelligent Anomaly Aggregation
    // Create a Set of (type:id) that have active exceptions to avoid duplication
    const flaggedEntityIds = new Set((exceptions || []).map(e => `${e.reference_type}:${e.reference_id}`));

    const anomalies = [
      // 1. Explicit exceptions (High priority)
      ...(exceptions || []).map(e => ({
        id: e.id,
        entity_type: 'exception',
        type: 'FLAGGED',
        detail: `[${e.exception_type}] ${e.description}`,
        severity: e.severity,
        time: e.detected_at || e.created_at,
        reference_id: e.reference_id,
        reference_type: e.reference_type
      })),

      // 2. Voided Orders (only if not already flagged)
      ...(voidedOrders || [])
        .filter(o => !flaggedEntityIds.has(`restaurant_order:${o.id}`))
        .map(o => ({ id: o.id, entity_type: 'restaurant_order', type: 'VOID', detail: `Rest Order #${o.order_number} voided without audit`, severity: 'MEDIUM', time: o.created_at })),

      ...(voidedBarOrders || [])
        .filter(o => !flaggedEntityIds.has(`bar_order:${o.id}`))
        .map(o => ({ id: o.id, entity_type: 'bar_order', type: 'VOID', detail: `Bar Order #${o.order_number} voided without audit`, severity: 'MEDIUM', time: o.created_at })),

      // 3. Unpaid Bills (only if not already flagged)
      ...pendingBills
        .filter(b => !flaggedEntityIds.has(`bill:${b.id}`))
        .map(b => ({ id: b.id, entity_type: 'bill', type: 'UNPAID', detail: `Bill pending: KES ${(Number(b.total_amount) - Number(b.paid_amount)).toLocaleString()}`, severity: 'LOW', time: b.created_at }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);

    res.status(200).json({
      success: true,
      data: {
        total_revenue: restRev + barRev + roomRev + eventRev + posRev + poolRev,
        collected_revenue: restRev + barRev + roomRev + eventRev + posRev + billsPaid + poolRev,
        pending_revenue: billsTotal - billsPaid,
        revenue_by_dept: {
          restaurant: restRev,
          bar: barRev,
          rooms: roomRev,
          events: eventRev,
          pos: posRev,
          pool: poolRev
        },
        daily_trends: dailyTrends,
        hotel_occupancy: `${occupancy}%`,
        avg_order_value: avgOrderValue,
        anomalies: anomalies,
        summary: {
          total_voids: (voidedOrders?.length || 0) + (voidedBarOrders?.length || 0),
          void_value: [...(voidedOrders || []), ...(voidedBarOrders || [])].reduce((sum, o) => sum + Number((o as any).total_amount || (o as any).total || 0), 0)
        }
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

    // Fetch related items from simple_items (the active inventory table)
    const itemSkus = [...new Set(rawStock?.map(s => s.item_sku).filter(Boolean))];
    const { data: items } = await supabase
      .from('simple_items')
      .select('id, item_name, sku, unit_of_measure, category, cost_price')
      .in('sku', itemSkus);

    const itemMap = Object.fromEntries(
      items?.map(i => [i.sku, { ...i, name: i.item_name, unit: i.unit_of_measure }]) || []
    );

    const currentStock = rawStock?.map(s => ({
      ...s,
      item: itemMap[s.item_sku]
    })) || [];

    // 3. Fetch recent stock movements for variance analysis
    // Extend to 30 days for better variance history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let movQuery = supabase
      .from('branch_stock_movements')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (branch_id && branch_id !== '0') {
      movQuery = movQuery.eq('branch_id', branch_id);
    }

    const { data: movements, error: movError } = await movQuery;
    if (movError) throw movError;

    // 4. Calculate variances and flag discrepancies
    const stockAnalysis = currentStock?.map(stock => {
      const itemMovements = movements?.filter(m => m.item_sku === stock.item_sku && m.branch_id === stock.branch_id) || [];

      // Sort by date to calculate running total correctly if needed, but for theoretical we just sum diffs
      const totalIn = itemMovements
        .filter(m => ['PURCHASE', 'RECEIPT', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'RETURN'].includes(m.movement_type?.toUpperCase()))
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

      const totalOut = itemMovements
        .filter(m => ['SALE', 'KITCHEN_USE', 'HOUSEKEEPING_USE', 'WASTAGE', 'DAMAGE', 'LOSS', 'TRANSFER_OUT', 'ADJUSTMENT_OUT'].includes(m.movement_type?.toUpperCase()))
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

      // Theoretical = previous stock (30 days ago) + In - Out
      // Since we don't have historical snapshot for "30 days ago" easily, we trust the movement log 
      // relative to current recorded stock to find "Theoretical should be"
      // However, usually theoretical is calculated as (Last Count + In - Out)
      // Here we check if current stock matches the movement delta
      const theoreticalStock = (stock.quantity || 0); // Placeholder if we can't reconstruct
      const variance = 0; // Better logic needed if we don't have snapshots

      // For now, use a simplified "Discrepancy" based on known flags or large wastage
      const wastageValue = itemMovements
        .filter(m => ['WASTAGE', 'DAMAGE', 'LOSS'].includes(m.movement_type?.toUpperCase()))
        .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

      const variancePercentage = wastageValue > 0 && stock.quantity > 0 ? (wastageValue / stock.quantity) * 100 : 0;

      return {
        ...stock,
        current_quantity: stock.quantity,
        theoretical_quantity: stock.quantity + wastageValue, // Assuming wastage is the variance
        variance: wastageValue,
        variance_percentage: variancePercentage,
        is_discrepancy: wastageValue > 0 || Math.abs(variancePercentage) > 5,
        recent_movements: itemMovements.length,
        last_movement: itemMovements[0]?.created_at || null,
        cost_price: stock.item?.cost_price || 0
      };
    }) || [];

    // 5. Group by branch if no specific branch requested
    const branchSummaries: Record<string, any> = {};
    if (!branch_id || branch_id === '0') {
      branches?.forEach(b => {
        const branchStock = stockAnalysis.filter(s => Number(s.branch_id) === Number(b.id));
        const discrepancies = branchStock.filter(s => s.is_discrepancy).length;
        const totalItems = branchStock.length;

        // Calculate a basic health score (percentage of items without discrepancies)
        const healthScore = totalItems > 0
          ? Math.max(0, Math.round(((totalItems - discrepancies) / totalItems) * 100))
          : 100;

        branchSummaries[b.id] = {
          branch_id: b.id,
          branch_name: b.name,
          total_items: totalItems,
          items_with_discrepancies: discrepancies,
          health_score: healthScore,
          total_variance_value: branchStock.reduce((sum, s) => sum + (Math.abs(s.variance || 0) * (s.cost_price || 0)), 0),
          low_stock_items: branchStock.filter(s => (Number(s.quantity || 0) <= Number(s.reorder_level || 0))).length
        };
      });
    }

    const summary = {
      total_items: stockAnalysis.length,
      items_with_discrepancies: stockAnalysis.filter(s => s.is_discrepancy).length,
      total_variance_value: stockAnalysis.reduce((sum, s) => sum + (Math.abs(s.variance || 0) * (s.cost_price || 0)), 0),
      low_stock_items: stockAnalysis.filter(s => (Number(s.quantity || 0) <= Number(s.reorder_level || 0))).length,
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

    // Fetch item details for all requested items from multiple possible tables
    const itemSkus = [...new Set(reqItems?.map(i => i.item_sku).filter(Boolean))];
    const [
      { data: simpleItems },
      { data: inventoryItems }
    ] = await Promise.all([
      supabase.from('simple_items').select('sku, item_name, unit_of_measure, category').in('sku', itemSkus),
      supabase.from('inventory_items').select('item_code, name, unit, category').in('item_code', itemSkus)
    ]);

    const simpleDetailsMap = Object.fromEntries(simpleItems?.map(i => [i.sku, i]) || []);
    const inventoryDetailsMap = Object.fromEntries(inventoryItems?.map(i => [i.item_code, i]) || []);

    // Enrich request items with item details
    const enrichedReqItems = reqItems?.map(item => {
      const sItem = simpleDetailsMap[item.item_sku];
      const iItem = inventoryDetailsMap[item.item_sku];

      return {
        ...item,
        item_name: sItem?.item_name || iItem?.name || item.name || item.item_name || item.item_sku || 'Unknown Item',
        item_unit: sItem?.unit_of_measure || iItem?.unit || item.unit || '',
        item_category: sItem?.category || iItem?.category || item.category || '',
        requested_quantity: item.requested_quantity || item.quantity_requested || item.quantity || 0,
        approved_quantity: item.approved_quantity !== undefined && item.approved_quantity !== null ? item.approved_quantity : (item.quantity_approved || 0),
        quantity_requested: item.requested_quantity || item.quantity_requested || item.quantity || 0,
        quantity_approved: item.approved_quantity !== undefined && item.approved_quantity !== null ? item.approved_quantity : (item.quantity_approved || 0),
        quantity: item.requested_quantity || item.quantity_requested || item.quantity || 0
      };
    }) || [];

    const itemsMap = enrichedReqItems.reduce((acc: any, item) => {
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
          pending: branchReqs.filter(r => ['PENDING_AUDIT', 'PENDING', 'UNDER_REVIEW'].includes(r.status)).length,
          approved: branchReqs.filter(r => ['APPROVED', 'PARTIALLY_APPROVED', 'READY', 'VERIFIED'].includes(r.status)).length,
          rejected: branchReqs.filter(r => r.status === 'REJECTED').length,
          dispatched: branchReqs.filter(r => ['DISPATCHED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RECEIVED', 'CONFIRMED'].includes(r.status)).length,
          total_items: branchReqs.reduce((sum, r) => sum + (r.items?.length || 0), 0)
        };
      });
    }

    // Calculate overall summary statistics
    const summary = {
      total_requests: requests?.length || 0,
      pending: requests?.filter(r => ['PENDING_AUDIT', 'PENDING', 'UNDER_REVIEW'].includes(r.status)).length || 0,
      approved: requests?.filter(r => ['APPROVED', 'PARTIALLY_APPROVED', 'READY', 'VERIFIED'].includes(r.status)).length || 0,
      rejected: requests?.filter(r => r.status === 'REJECTED').length || 0,
      dispatched: requests?.filter(r => ['DISPATCHED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RECEIVED', 'CONFIRMED'].includes(r.status)).length || 0,
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
      supabase.from('bar_order_items').select('*').in('order_id', barIds), // No inventory join - bar_order_items only has drink_id and drink_name
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

    const soldItemsMap: Record<string, { name: string; quantity: number; revenue: number; branch_id: string; category: string; item_id?: string }> = {};
    const processOrders = (orders: any[] | null, type: 'restaurant' | 'bar') => {
      orders?.forEach(order => {
        order.items?.forEach((item: any) => {
          // Determine name and ID
          let name = 'Unknown Item';
          let item_id = '';

          if (type === 'restaurant') {
            name = item.menu_item?.name || item.item_name || 'Unknown Item';
            item_id = item.menu_item_id;
          } else {
            // For bar, use drink_name directly from bar_order_items
            name = item.drink_name || item.item_name || 'Unknown Item';
            item_id = item.drink_id;
          }

          const key = `${order.branch_id}_${name}`; // Aggregate by name + branch
          if (!soldItemsMap[key]) {
            soldItemsMap[key] = { name: name, quantity: 0, revenue: 0, branch_id: order.branch_id, category: type, item_id: item_id };
          }
          const qty = item.quantity || 0;
          const rev = Number(item.price || item.unit_price || 0) * qty; // Handle price differences

          // Fix: Ensure we don't add NaN
          if (!isNaN(rev)) {
            soldItemsMap[key].revenue += rev;
          }
          soldItemsMap[key].quantity += qty;

          if (branchSummaries[order.branch_id]) {
            if (!isNaN(rev)) branchSummaries[order.branch_id].total_revenue += rev;
            branchSummaries[order.branch_id].total_quantity += qty;
            branchSummaries[order.branch_id].total_items_sold += 1;
          }
        });
      });
    };

    processOrders(restRes.data || null, 'restaurant');
    processOrders(barRes.data || null, 'bar');

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

/**
 * H. Bar Stock Audits
 * Fetch physical stock counts from bar and compare with theoretical stock.
 */
export const getBarStockAudits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, status } = req.query;

    let query = supabase
      .from('stock_counts')
      .select('*, items:stock_count_items(*), branch:branches(name), user:users!fk_stock_counts_counted_by(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);

    const { data: audits, error } = await query;
    if (error) throw error;

    // Since there is no formal relationship between stock_count_items and restaurant_bar_inventory in the schema,
    // we fetch the drink names manually here.
    const drinkIds = new Set<string>();
    audits?.forEach((audit: any) => {
      audit.items?.forEach((item: any) => {
        if (item.item_id) drinkIds.add(item.item_id);
      });
    });

    if (drinkIds.size > 0) {
      const { data: drinks } = await supabase
        .from('restaurant_bar_inventory')
        .select('id, name')
        .in('id', Array.from(drinkIds));

      const drinkMap = (drinks || []).reduce((acc: any, drink: any) => {
        acc[drink.id] = drink.name;
        return acc;
      }, {});

      audits?.forEach((audit: any) => {
        audit.items?.forEach((item: any) => {
          if (item.item_id && drinkMap[item.item_id]) {
            item.drink = { name: drinkMap[item.item_id] };
          }
        });
      });
    }

    res.status(200).json({ success: true, count: audits?.length || 0, data: audits });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify a Bar Stock Take
 * Auditor approves the count and it updates the system inventory.
 */
export const verifyBarStockTake = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = (req as any).user?.id;

    // 1. Get the stock count and its items
    const { data: count, error: countError } = await supabase
      .from('stock_counts')
      .select('*, items:stock_count_items(*)')
      .eq('id', id)
      .single();

    if (countError || !count) throw new Error('Stock count not found');
    if (count.status === 'verified') throw new Error('Stock count already verified');

    // 2. Update restaurant_bar_inventory for each item
    for (const item of count.items) {
      if (!item.item_id) continue;

      const { error: updateError } = await supabase
        .from('restaurant_bar_inventory')
        .update({
          current_bottles: item.physical_quantity,
          last_counted_at: new Date().toISOString()
        })
        .eq('id', item.item_id);

      if (updateError) {
        console.error(`Error updating inventory for item ${item.item_id}:`, updateError.message);
      }

      // Also log movement - Use branch_stock_movements table
      await supabase.from('branch_stock_movements').insert([{
        item_sku: item.item_id, // For bar items, we use ID as SKU in movements for now
        branch_id: count.branch_id,
        quantity: item.physical_quantity - item.system_quantity,
        movement_type: 'adjustment',
        reference_type: 'stock_count',
        reference_id: id,
        notes: `Bar Audit Adjustment: ${notes || ''}`,
        performed_by: userId
      }]);
    }

    // 3. Mark the count as verified
    const { error: verifyError } = await supabase.from('stock_counts').update({
      status: 'verified',
      verified_by: userId,
      verified_at: new Date().toISOString(),
      audit_notes: notes
    }).eq('id', id);

    if (verifyError) throw verifyError;

    res.status(200).json({ success: true, message: 'Stock count verified and inventory updated' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed information for a specific audit anomaly or transaction.
 */
export const getAnomalyDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id, type } = req.query;

    if (!id || !type) {
      throw new Error('Missing id or type parameter');
    }

    let data;
    let error;

    switch (type) {
      case 'restaurant_order':
        // Fetch restaurant order without embedded items to avoid schema cache FK issues
        const { data: restOrder, error: restError } = await supabase
          .from('restaurant_orders')
          .select('*, branch:branches(name), waiter:users!created_by(first_name, last_name), auditor:users!auditor_id(first_name, last_name)')
          .eq('id', id)
          .single();
        if (restError) { data = null; error = restError; break; }
        // Fetch items separately
        const { data: restItems } = await supabase
          .from('restaurant_order_items')
          .select('*')
          .eq('order_id', id);
        // Fetch menu item names for the items
        const menuItemIds = (restItems || []).map((i: any) => i.menu_item_id).filter(Boolean);
        let menuItemMap: Record<string, string> = {};
        if (menuItemIds.length > 0) {
          const { data: menuItems } = await supabase
            .from('restaurant_menu_items')
            .select('id, name')
            .in('id', menuItemIds);
          (menuItems || []).forEach((m: any) => { menuItemMap[m.id] = m.name; });
        }
        const enrichedItems = (restItems || []).map((i: any) => ({
          ...i,
          item_name: menuItemMap[i.menu_item_id] || i.item_name || 'Unknown Item'
        }));
        data = { ...restOrder, items: enrichedItems };
        error = null;
        break;

      case 'bar_order':
        // Fetch bar order with items (no inventory join since bar_order_items only has drink_id and drink_name)
        const { data: barOrder, error: barError } = await supabase
          .from('bar_orders')
          .select('*, items:bar_order_items(*), branch:branches(name), waiter:users!created_by(first_name, last_name), auditor:users!auditor_id(first_name, last_name)')
          .eq('id', id)
          .single();
        data = barOrder;
        error = barError;
        break;

      case 'bill':
        // Fetch bill details with items if possible, and branch/user info
        const { data: bill, error: billError } = await supabase
          .from('unpaid_bills')
          .select('*, branch:branches(name), waiter:users!created_by(first_name, last_name), auditor:users!auditor_id(first_name, last_name)')
          .eq('id', id)
          .single();
        data = bill;
        error = billError;
        break;

      case 'exception':
        const { data: exception, error: excError } = await supabase
          .from('audit_exceptions')
          .select('*, auditor:users!resolved_by(first_name, last_name)')
          .eq('id', id)
          .single();
        data = exception;
        error = excError;
        break;

      default:
        throw new Error('Invalid entity type');
    }

    if (error) throw error;
    if (!data) throw new Error('Record not found');

    // 2. Fetch linked exceptions if it's not already an exception
    let exceptions = [];
    if (type !== 'exception' && data.id) {
      const { data: linkedExceptions } = await supabase
        .from('audit_exceptions')
        .select('*')
        .eq('reference_id', data.id)
        .eq('reference_type', type);
      exceptions = linkedExceptions || [];
    }

    res.status(200).json({
      success: true,
      data: {
        ...data,
        linked_exceptions: exceptions
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============ DAILY LOG VERIFICATION ============

// @desc    Get daily logs by status for auditor verification
// @route   GET /api/auditor/daily-logs?status=pending_audit
// @access  Private (Auditor)
export const getDailyLogsStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status } = req.query;

    // Map frontend status to database status
    // Frontend uses 'pending_audit', database uses 'submitted'
    const dbStatus = status === 'pending_audit' ? 'submitted' : status;

    logger.info('Fetching daily logs with status:', { status, dbStatus });

    let query = supabase
      .from('finance_daily_logs')
      .select(`
        *,
        branch:branches!branch_id(id, name, code),
        creator:users!created_by(id, first_name, last_name, email),
        verifier:users!verified_by(id, first_name, last_name, email),
        lines:finance_daily_log_lines(*)
      `)
      .order('log_date', { ascending: false });

    if (dbStatus) {
      query = query.eq('status', dbStatus);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching daily logs:', error);
      throw error;
    }

    // Transform data to match frontend expectations
    const transformedData = data?.map(log => ({
      id: log.id,
      branch_id: log.branch_id,
      branch_name: log.branch?.name || 'Unknown Branch',
      log_date: log.log_date,
      opening_balance: log.opening_balance,
      closing_balance: log.closing_balance,
      total_payments: log.total_payments,
      total_expenses: log.total_expenses,
      notes: log.notes,
      status: log.status,
      creator_name: log.creator ? `${log.creator.first_name} ${log.creator.last_name}` : 'Unknown',
      creator_email: log.creator?.email,
      verified_by: log.verified_by,
      verified_at: log.verified_at,
      rejection_reason: log.rejection_reason,
      created_at: log.created_at,
      updated_at: log.updated_at,
      lines: log.lines?.map((line: any) => ({
        id: line.id,
        type: line.entry_type,
        reference_number: line.reference_id,
        payee: line.description,
        description: line.description,
        amount: line.amount,
        payment_method: line.payment_method,
        category: line.category,
        section: line.section
      })) || []
    }));

    res.status(200).json({
      success: true,
      count: transformedData?.length || 0,
      data: transformedData
    });

    logger.info(`Retrieved ${transformedData?.length || 0} daily logs with status: ${dbStatus}`);
  } catch (error) {
    logger.error('Exception in getDailyLogsStatus:', error);
    next(error);
  }
};

// @desc    Verify or reject a daily log
// @route   POST /api/auditor/daily-logs/:id/verify
// @access  Private (Auditor)
export const verifyDailyLog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    if (!action || !['verified', 'rejected'].includes(action)) {
      res.status(400).json({
        success: false,
        message: 'Invalid action. Must be "verified" or "rejected"'
      });
      return;
    }

    if (action === 'rejected' && !notes) {
      res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a log'
      });
      return;
    }

    logger.info('Verifying daily log:', { id, action, auditor: req.user?.id });

    // Update the daily log
    const updateData: any = {
      status: action,
      verified_by: req.user?.id,
      verified_at: new Date().toISOString()
    };

    if (action === 'rejected') {
      updateData.rejection_reason = notes;
    }

    const { data, error } = await supabase
      .from('finance_daily_logs')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        branch:branches!branch_id(id, name, code),
        creator:users!created_by(id, first_name, last_name, email),
        verifier:users!verified_by(id, first_name, last_name, email)
      `)
      .single();

    if (error) {
      logger.error('Error verifying daily log:', error);
      throw error;
    }

    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Daily log not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Daily log ${action === 'verified' ? 'verified' : 'rejected'} successfully`,
      data: {
        id: data.id,
        status: data.status,
        verified_by: data.verified_by,
        verified_at: data.verified_at,
        rejection_reason: data.rejection_reason
      }
    });

    logger.info(`Daily log ${action}: ${id} by auditor ${req.user?.id}`);
  } catch (error) {
    logger.error('Exception in verifyDailyLog:', error);
    next(error);
  }
};

export const getStaffAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, start_date, end_date, staff_id } = req.query;

    logger.info('Fetching staff audit with filters:', { branch_id, start_date, end_date, staff_id });

    // 1. Fetch Staff Credit Bills
    let creditQuery = supabase
      .from('staff_credit_bills')
      .select(`
        *,
        staff:staff_profiles!staff_id(
          id, 
          user:users!user_id(first_name, last_name, email)
        )
      `)
      .order('date', { ascending: false });

    // 2. Fetch Staff Advances
    let advancesQuery = supabase
      .from('staff_advances')
      .select(`
        *,
        staff:staff_profiles!staff_id(
          id, 
          user:users!user_id(first_name, last_name, email)
        )
      `)
      .order('request_date', { ascending: false });

    // 3. Fetch Staff Loans
    let loansQuery = supabase
      .from('staff_loans')
      .select(`
        *,
        staff:staff_profiles!staff_id(
          id, 
          user:users!user_id(first_name, last_name, email)
        )
      `)
      .order('start_date', { ascending: false });

    // Apply filters
    if (staff_id && staff_id !== 'all') {
      creditQuery = creditQuery.eq('staff_id', staff_id);
      advancesQuery = advancesQuery.eq('staff_id', staff_id);
      loansQuery = loansQuery.eq('staff_id', staff_id);
    }

    if (start_date) {
      creditQuery = creditQuery.gte('date', start_date);
      advancesQuery = advancesQuery.gte('request_date', start_date);
      loansQuery = loansQuery.gte('start_date', start_date);
    }
    if (end_date) {
      creditQuery = creditQuery.lte('date', end_date);
      advancesQuery = advancesQuery.lte('request_date', end_date);
      loansQuery = loansQuery.lte('start_date', end_date);
    }

    // Await all
    const [
      { data: creditBills, error: creditError },
      { data: advances, error: advancesError },
      { data: loans, error: loansError }
    ] = await Promise.all([creditQuery, advancesQuery, loansQuery]);

    if (creditError) throw creditError;
    if (advancesError) throw advancesError;
    if (loansError) throw loansError;

    const unifiedRecords: any[] = [];

    // Process Credit Bills
    creditBills?.forEach((bill: any) => {
      // Handle nested user object safely
      const user = bill.staff?.user;
      const firstName = Array.isArray(user) ? user[0]?.first_name : user?.first_name;
      const lastName = Array.isArray(user) ? user[0]?.last_name : user?.last_name;
      let name = (firstName && lastName) ? `${firstName} ${lastName}` : null;

      // If no staff name from relationship, try to extract from description
      if (!name && bill.description) {
        // Try to extract name from patterns like "Shift Credit - Shift #XXX - NAME"
        const match = bill.description.match(/- ([A-Z\s]+)$/);
        if (match) {
          name = match[1].trim();
        }
      }

      // Final fallback
      if (!name) {
        name = 'Unknown Staff';
      }

      unifiedRecords.push({
        id: bill.id,
        date: bill.date,
        type: 'Credit Bill',
        amount: bill.amount,
        staff_name: name,
        staff_id: bill.staff_id,
        description: bill.description,
        status: bill.is_paid ? 'Paid' : 'Unpaid',
        reference: bill.id.substring(0, 8).toUpperCase(),
        original_record: bill
      });
    });

    // Process Advances
    advances?.forEach((adv: any) => {
      const user = adv.staff?.user;
      const firstName = Array.isArray(user) ? user[0]?.first_name : user?.first_name;
      const lastName = Array.isArray(user) ? user[0]?.last_name : user?.last_name;
      let name = (firstName && lastName) ? `${firstName} ${lastName}` : null;

      // If no staff name from relationship, try to extract from reason
      if (!name && adv.reason) {
        const match = adv.reason.match(/- ([A-Z\s]+)$/);
        if (match) {
          name = match[1].trim();
        }
      }

      // Final fallback
      if (!name) {
        name = 'Unknown Staff';
      }

      unifiedRecords.push({
        id: adv.id,
        date: adv.request_date,
        type: 'Advance',
        amount: adv.amount,
        staff_name: name,
        staff_id: adv.staff_id,
        description: adv.reason,
        status: adv.status, // approved, pending, rejected, paid
        reference: adv.id.substring(0, 8).toUpperCase(),
        original_record: adv
      });
    });

    // Process Loans
    loans?.forEach((loan: any) => {
      const user = loan.staff?.user;
      const firstName = Array.isArray(user) ? user[0]?.first_name : user?.first_name;
      const lastName = Array.isArray(user) ? user[0]?.last_name : user?.last_name;
      let name = (firstName && lastName) ? `${firstName} ${lastName}` : null;

      // If no staff name from relationship, try to extract from reason
      if (!name && loan.reason) {
        const match = loan.reason.match(/- ([A-Z\s]+)$/);
        if (match) {
          name = match[1].trim();
        }
      }

      // Final fallback
      if (!name) {
        name = 'Unknown Staff';
      }

      unifiedRecords.push({
        id: loan.id,
        date: loan.start_date,
        type: 'Loan',
        amount: loan.total_amount,
        staff_name: name,
        staff_id: loan.staff_id,
        description: loan.reason,
        status: loan.status, // active, paid, defaulted
        reference: loan.id.substring(0, 8).toUpperCase(),
        original_record: loan
      });
    });

    // Sort by Date Descending
    unifiedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Summarize by Staff
    const staffSummary: Record<string, any> = {};

    unifiedRecords.forEach(record => {
      if (!staffSummary[record.staff_id]) {
        staffSummary[record.staff_id] = {
          staff_id: record.staff_id,
          staff_name: record.staff_name,
          total_credit_bills: 0,
          total_advances: 0,
          total_loans: 0,
          outstanding_balance: 0 // Rough estimate
        };
      }

      const summary = staffSummary[record.staff_id];
      if (record.type === 'Credit Bill') {
        summary.total_credit_bills += Number(record.amount || 0);
        if (record.status === 'Unpaid') summary.outstanding_balance += Number(record.amount || 0);
      } else if (record.type === 'Advance') {
        summary.total_advances += Number(record.amount || 0);
      } else if (record.type === 'Loan') {
        summary.total_loans += Number(record.amount || 0);
        if (record.status === 'active') {
          summary.outstanding_balance += Number(record.original_record.remaining_balance || 0);
        }
      }
    });

    res.status(200).json({
      success: true,
      count: unifiedRecords.length,
      data: unifiedRecords,
      summary: Object.values(staffSummary)
    });

  } catch (error) {
    logger.error('Error fetching staff audit:', error);
    next(error);
  }
};
