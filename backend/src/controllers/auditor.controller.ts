import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { UserRole } from '../models/User';
import * as BranchInventoryService from '../services/branch-inventory.service';

const FG_PRIMARY = '#1a1a1a';
const FG_SECONDARY = '#555555';
const FG_GOLD = '#c8a84b';
const FG_BORDER = '#e0e0e0';
const FG_ROW_BG = '#f9f9f9';
const FG_HEADER_BG = '#333333';
const FG_ACCENT = '#0066cc';
const FG_COMPANY_NAME = 'FamousGateHotels';
const FG_COMPANY_ADDRESS = 'Bomet, Kenya';
const FG_COMPANY_EMAIL = 'famousgateshotelsbmt@gmail.com';
const FG_COMPANY_PHONE = '0706 782 828';

const userDisplayName = (user: any): string | null => {
  if (!user) return null;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return user.full_name || user.name || fullName || user.email || null;
};

const fetchBranchesById = async (ids: any[]): Promise<Record<string, any>> => {
  const cleanIds = [...new Set(ids.filter((id) => id !== null && id !== undefined && `${id}`.trim() !== ''))];
  if (cleanIds.length === 0) return {};
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code')
    .in('id', cleanIds);
  if (error) {
    logger.warn('Unable to enrich branch names for audit detail', { error: error.message });
    return {};
  }
  return Object.fromEntries((data || []).map((branch: any) => [`${branch.id}`, branch]));
};

const fetchUsersById = async (ids: any[]): Promise<Record<string, any>> => {
  const cleanIds = [...new Set(ids.filter((id) => id !== null && id !== undefined && `${id}`.trim() !== ''))];
  if (cleanIds.length === 0) return {};
  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, role')
    .in('id', cleanIds);
  if (error) {
    logger.warn('Unable to enrich user names for audit detail', { error: error.message });
    return {};
  }
  return Object.fromEntries((data || []).map((user: any) => [`${user.id}`, {
    ...user,
    display_name: userDisplayName(user),
  }]));
};

const fetchSimpleItemsBySku = async (skus: any[]): Promise<Record<string, any>> => {
  const cleanSkus = [...new Set(skus.filter((sku) => sku !== null && sku !== undefined && `${sku}`.trim() !== ''))];
  if (cleanSkus.length === 0) return {};
  const { data, error } = await supabase
    .from('simple_items')
    .select('sku, item_name, description, category, unit_of_measure')
    .in('sku', cleanSkus);
  if (error) {
    logger.warn('Unable to enrich item names for audit detail', { error: error.message });
    return {};
  }
  return Object.fromEntries((data || []).map((item: any) => [`${item.sku}`, item]));
};

const safeRows = async (
  table: string,
  select = '*',
  limit = 250,
  orderColumn = 'created_at'
): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: false })
      .limit(limit);
    if (error) {
      logger.warn(`Auditor source skipped: ${table}`, { error: error.message });
      return [];
    }
    return data || [];
  } catch (error: any) {
    logger.warn(`Auditor source unavailable: ${table}`, { error: error?.message || error });
    return [];
  }
};

const asText = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const text = `${value}`.trim();
  return text.length > 0 ? text : null;
};

const asNumber = (value: any): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const firstNonEmpty = (row: any, keys: string[]): any => {
  for (const key of keys) {
    if (row?.[key] !== null && row?.[key] !== undefined && `${row[key]}`.trim() !== '') return row[key];
  }
  return undefined;
};

const branchMatches = (row: any, branchId?: string): boolean => {
  if (!branchId || branchId === '0') return true;
  const candidate = firstNonEmpty(row, ['branch_id', 'requesting_branch_id', 'from_branch_id', 'to_branch_id']);
  return candidate === undefined || `${candidate}` === `${branchId}`;
};

const pendingLike = (status: any): boolean => {
  const value = `${status || ''}`.toLowerCase();
  return !value || ['draft', 'pending', 'submitted', 'pending_audit', 'unverified', 'ready_to_bill'].includes(value);
};

const normalizeAuditDocument = (row: any, source: string, type: string) => {
  const amount = asNumber(firstNonEmpty(row, [
    'total_amount',
    'grand_total',
    'amount',
    'balance',
    'balance_due',
    'total_value',
    'net_amount',
  ]));
  const supplierName =
    firstNonEmpty(row, ['supplier_name', 'vendor_name', 'payee_name', 'customer_name', 'guest_name', 'employee_name', 'staff_name']) ||
    row.supplier?.name ||
    row.vendor?.name ||
    row.customer?.customer_name ||
    'Counterparty';
  const documentNumber =
    firstNonEmpty(row, ['document_number', 'invoice_number', 'bill_number', 'grn_number', 'payment_number', 'reference', 'po_number']) ||
    row.id;

  return {
    ...row,
    _source: source,
    type,
    document_number: documentNumber,
    invoice_number: firstNonEmpty(row, ['invoice_number', 'bill_number', 'document_number']) || documentNumber,
    supplier_name: supplierName,
    counterparty_name: supplierName,
    total_amount: amount,
    amount,
    status: firstNonEmpty(row, ['audit_status', 'status', 'payment_status', 'approval_status']) || 'pending',
    created_at: firstNonEmpty(row, ['created_at', 'invoice_date', 'bill_date', 'received_date', 'payment_date']) || null,
  };
};

export const getAuditorDashboard = async (req: Request, res: Response): Promise<void> => {
  const branchId = asText(req.query.branch_id ?? req.query.branchId) || undefined;
  const [exceptions, approvals, voidBills, logbooks, watchlist] = await Promise.all([
    safeRows('audit_exceptions'),
    safeRows('approval_requests'),
    safeRows('void_bills'),
    safeRows('cashier_logbooks'),
    safeRows('auditor_watchlist'),
  ]);

  const scopedExceptions = exceptions.filter((row) => branchMatches(row, branchId));
  const scopedApprovals = approvals.filter((row) => branchMatches(row, branchId));
  const scopedVoidBills = voidBills.filter((row) => branchMatches(row, branchId));
  const scopedLogbooks = logbooks.filter((row) => branchMatches(row, branchId));
  const scopedWatchlist = watchlist.filter((row) => branchMatches(row, branchId));

  res.json({
    success: true,
    data: {
      void_bills: scopedVoidBills.length,
      price_overrides: scopedExceptions.filter((row) => `${row.severity || row.risk_level || ''}`.toLowerCase() === 'critical').length,
      large_discounts: scopedApprovals.filter((row) => pendingLike(row.status)).length,
      pending_approvals: scopedApprovals.filter((row) => pendingLike(row.status)).length,
      open_exceptions: scopedExceptions.filter((row) => `${row.status || ''}`.toLowerCase() !== 'resolved').length,
      pending_logbooks: scopedLogbooks.filter((row) => pendingLike(row.status)).length,
      watchlist: scopedWatchlist.filter((row) => `${row.status || ''}`.toLowerCase() !== 'resolved').length,
    },
  });
};

export const getAuditTools = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: {
      records: [
        { title: 'Sales Audit', route: '/auditor/verify/sales', module: 'POS / Restaurant / Bar' },
        { title: 'Financial Reconciliation', route: '/auditor/verify/finances', module: 'Cashier / Finance' },
        { title: 'Invoice Verification', route: '/auditor/invoice-verification', module: 'Accounting / Suppliers' },
        { title: 'Credit Bills', route: '/auditor/credit-bills', module: 'Reception / Payroll' },
        { title: 'Stock Levels', route: '/auditor/verify/stock-levels', module: 'Branch Store / Central Store' },
        { title: 'Branch Orders', route: '/auditor/verify/branch-orders', module: 'Store Requests' },
        { title: 'Deliveries', route: '/dispatch/auditor/deliveries', module: 'Dispatch' },
        { title: 'Staff Audit', route: '/auditor/staff-audit', module: 'HR' },
        { title: 'Kitchen Usage', route: '/kitchen/usage', module: 'Kitchen' },
        { title: 'Void Bills', route: '/auditor/void-bills', module: 'Cashier / POS' },
      ],
    },
  });
};

export const getInvoiceVerification = async (req: Request, res: Response): Promise<void> => {
  const branchId = asText(req.query.branch_id ?? req.query.branchId) || undefined;
  const [arInvoices, apBills, supplierInvoices, grns] = await Promise.all([
    safeRows('accounting_ar_invoices'),
    safeRows('accounting_ap_bills'),
    safeRows('store_supplier_invoices'),
    safeRows('store_grn'),
  ]);

  const invoiceRows = arInvoices
    .filter((row) => branchMatches(row, branchId))
    .map((row) => normalizeAuditDocument(row, 'accounting_ar_invoices', 'customer_invoice'));
  const billRows = apBills
    .filter((row) => branchMatches(row, branchId))
    .map((row) => normalizeAuditDocument(row, 'accounting_ap_bills', 'supplier_bill'));
  const supplierInvoiceRows = supplierInvoices
    .filter((row) => branchMatches(row, branchId))
    .map((row) => normalizeAuditDocument(row, 'store_supplier_invoices', 'supplier_invoice'));
  const readyToBillGrns = grns
    .filter((row) => branchMatches(row, branchId))
    .filter((row) => {
      const status = `${firstNonEmpty(row, ['finance_status', 'invoice_status', 'status']) || ''}`.toLowerCase();
      return !['billed', 'paid', 'closed', 'cancelled'].includes(status);
    })
    .map((row) => normalizeAuditDocument(
      { ...row, status: firstNonEmpty(row, ['finance_status', 'invoice_status']) || 'ready_to_bill' },
      'store_grn',
      'ready_to_bill_grn'
    ));

  const records = [...invoiceRows, ...billRows, ...supplierInvoiceRows, ...readyToBillGrns]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  res.json({
    success: true,
    count: records.length,
    data: {
      summary: {
        records: records.length,
        pending_review: records.filter((row) => pendingLike(row.status)).length,
        total_value: records.reduce((sum, row) => sum + asNumber(row.total_amount), 0),
        ready_to_bill_grns: readyToBillGrns.length,
      },
      records,
      invoices: [...invoiceRows, ...supplierInvoiceRows],
      bills: billRows,
      grns: readyToBillGrns,
    },
  });
};

export const getCreditBillsForAudit = async (req: Request, res: Response): Promise<void> => {
  const branchId = asText(req.query.branch_id ?? req.query.branchId) || undefined;
  const [cashierBills, payrollBills, creditBills, staffBills] = await Promise.all([
    safeRows('cashier_credit_bills'),
    safeRows('payroll_credit_bills'),
    safeRows('credit_bills'),
    safeRows('staff_credit_bills'),
  ]);

  const guestBills = [...cashierBills, ...creditBills]
    .filter((row) => branchMatches(row, branchId))
    .map((row) => normalizeAuditDocument(row, row._source || 'cashier_credit_bills', 'guest_credit_bill'));
  const employeeBills = [...payrollBills, ...staffBills]
    .filter((row) => branchMatches(row, branchId))
    .map((row) => normalizeAuditDocument(row, row._source || 'payroll_credit_bills', 'employee_credit_bill'));
  const records = [...guestBills, ...employeeBills]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  res.json({
    success: true,
    count: records.length,
    data: {
      summary: {
        records: records.length,
        pending_review: records.filter((row) => pendingLike(row.status)).length,
        total_value: records.reduce((sum, row) => sum + asNumber(row.total_amount), 0),
      },
      records,
      credit_bills: records,
      guest_bills: guestBills,
      employee_bills: employeeBills,
    },
  });
};

export const getAuditorDeliveriesAlias = async (req: Request, res: Response): Promise<void> => {
  const branchId = asText(req.query.branch_id ?? req.query.branchId) || undefined;
  const [dispatchNotes, deliveries] = await Promise.all([
    safeRows('dispatch_notes'),
    safeRows('dispatches'),
  ]);
  const records = [...dispatchNotes, ...deliveries]
    .filter((row) => branchMatches(row, branchId))
    .map((row) => ({
      ...row,
      dispatch_number: firstNonEmpty(row, ['dispatch_number', 'note_number', 'reference']) || row.id,
      branch_name: firstNonEmpty(row, ['branch_name', 'to_branch_name', 'destination_branch_name']),
      status: firstNonEmpty(row, ['audit_status', 'status']) || 'pending',
      created_at: firstNonEmpty(row, ['created_at', 'dispatch_date', 'sent_at']) || null,
    }));
  res.json({ success: true, count: records.length, data: { records, deliveries: records } });
};

export const getNightAuditStatus = async (_req: Request, res: Response): Promise<void> => {
  const sessions = await safeRows('audit_night_sessions', '*', 5);
  const exceptions = await safeRows('audit_exceptions', '*', 200);
  const latest = sessions[0] || null;
  res.json({
    success: true,
    data: {
      status: latest?.status || 'not_started',
      active_session: latest,
      open_exceptions: exceptions.filter((row) => `${row.status || ''}`.toLowerCase() !== 'resolved').length,
    },
  });
};

export const completeLatestNightAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessions = await safeRows('audit_night_sessions', '*', 5);
    const latest = sessions.find((session) => `${session.status}`.toLowerCase() === 'in_progress') || sessions[0];
    if (!latest?.id) {
      res.status(404).json({ success: false, message: 'No night audit session found' });
      return;
    }
    req.params.id = latest.id;
    return completeNightAudit(req, res, next);
  } catch (error) {
    next(error);
  }
};

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
    // Support both route params (/anomalies/:id/clear) and body params (/verify/clear with body)
    const id = req.params.id || req.body.id;
    const type = req.body.type || req.query.type;
    const notes = req.body.notes;
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
        const { data: stockRequestItems, error: stockItemsError } = await supabase
          .from('stock_request_items')
          .select('*')
          .eq('request_id', id);

        if (stockItemsError) {
          error = stockItemsError;
          break;
        }

        if (!stockRequestItems?.length) {
          res.status(400).json({ success: false, message: 'No items found on this stock request to approve' });
          return;
        }

        await BranchInventoryService.approveStockRequest(
          id,
          auditorId!,
          stockRequestItems.map((item: any) => ({
            id: item.id,
            approved_quantity: Number(item.requested_quantity ?? item.quantity_requested ?? item.quantity ?? 0),
            status: 'APPROVED'
          })),
          notes || 'Verified from Branch Orders audit'
        );

        const { data: reqData, error: reqError } = await supabase
          .from('stock_requests')
          .select('*')
          .eq('id', id)
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
      const { error } = await supabase.from('accounting_ar_invoices').update({ is_flagged: true }).eq('id', entity_id);
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
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
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (entity_type) query = query.eq('entity_type', entity_type);

    const { data, error } = await query;
    if (error) throw error;

    const flaggedByIds = [...new Set((data || []).map((item: any) => item.flagged_by).filter(Boolean))];
    let usersById = new Map<string, { id: string; first_name: string; last_name: string }>();

    if (flaggedByIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', flaggedByIds);

      if (!usersError) {
        usersById = new Map((users || []).map((user: any) => [user.id, user]));
      }
    }

    const enrichedData = (data || []).map((item: any) => ({
      ...item,
      flagged_by_user: item.flagged_by ? (usersById.get(item.flagged_by) || null) : null,
    }));

    res.status(200).json({ success: true, count: enrichedData.length, data: enrichedData });
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
      const { error } = await supabase.from('accounting_ar_invoices').update({ is_flagged: false }).eq('id', data.entity_id);
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
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
    const { data: branches, error: branchesError } = await supabase.from('branches').select('id, name');
    if (branchesError) {
      console.error('Database error:', branchesError);
      throw branchesError;
    }

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
    const { data: reqItems, error: reqItemsError } = await supabase.from('stock_request_items').select('*').in('request_id', reqIds);
    if (reqItemsError) {
      console.error('Database error:', reqItemsError);
      throw reqItemsError;
    }

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
    console.log('ðŸ” [Financial Reconciliation] Starting with params:', req.query);
    const { branch_id, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    console.log('ðŸ” [Financial Reconciliation] Target date:', targetDate);

    // 1. Get all payments for the date (remove branch_id filter as it doesn't exist on payments)
    console.log('ðŸ” [Financial Reconciliation] Fetching payments...');
    const { data: rawPayments, error: payError } = await supabase.from('payments').select('*')
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    if (payError) {
      console.error('âŒ [Financial Reconciliation] Payments query error:', payError);
      throw payError;
    }
    console.log(`âœ… [Financial Reconciliation] Found ${rawPayments?.length || 0} payments`);

    console.log('ðŸ” [Financial Reconciliation] Fetching pool token sales...');
    const { data: poolSales, error: poolSalesError } = await supabase.from('restaurant_pool_token_sales')
      .select('*')
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    if (poolSalesError) {
      console.error('âŒ [Financial Reconciliation] Pool sales query error:', poolSalesError);
      throw poolSalesError;
    }
    console.log(`âœ… [Financial Reconciliation] Found ${poolSales?.length || 0} pool token sales`);

    // Fetch cashier details for pool sales separately
    const poolCashierIds = [...new Set(poolSales?.map(s => s.cashier_id).filter(Boolean))];
    const { data: poolCashiers } = poolCashierIds.length 
      ? await supabase.from('users').select('id, first_name, last_name').in('id', poolCashierIds)
      : { data: [] };
    const poolCashierMap = Object.fromEntries(poolCashiers?.map(u => [u.id, u]) || []);

    // 2. Collect IDs for related entities to infer branch and cashier
    console.log('ðŸ” [Financial Reconciliation] Collecting related entity IDs...');
    const bookingIds = [...new Set(rawPayments?.map(p => p.booking_id).filter(Boolean))];
    const invoiceIds = [...new Set(rawPayments?.map(p => p.invoice_id).filter(Boolean))];
    const restOrderIds = [...new Set(rawPayments?.map(p => p.restaurant_order_id).filter(Boolean))];
    const barOrderIds = [...new Set(rawPayments?.map(p => p.bar_order_id).filter(Boolean))];
    const posIds = [...new Set(rawPayments?.map(p => p.pos_transaction_id).filter(Boolean))];
    console.log('ðŸ” [Financial Reconciliation] IDs collected:', { bookingIds: bookingIds.length, invoiceIds: invoiceIds.length, restOrderIds: restOrderIds.length, barOrderIds: barOrderIds.length, posIds: posIds.length });

    // 3. Parallel fetch of related entities
    console.log('ðŸ” [Financial Reconciliation] Fetching related entities...');
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
    console.log('âœ… [Financial Reconciliation] Related entities fetched:', { bookings: bookings?.length || 0, invoices: invoices?.length || 0, restOrders: restOrders?.length || 0, barOrders: barOrders?.length || 0, posTxns: posTxns?.length || 0 });

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
        cashier: poolCashierMap[s.cashier_id]
      }));

    enrichedPayments = [...enrichedPayments, ...virtualPoolPayments];

    // 7. Fetch user and branch details for display
    const userIds = [...new Set(enrichedPayments.map(p => p.user_id || p.created_by).filter(Boolean))];
    const branchIds = [...new Set(enrichedPayments.map(p => p.branch_id).filter(Boolean))];
    console.log('ðŸ” [Financial Reconciliation] Fetching user and branch details...', { userIds: userIds.length, branchIds: branchIds.length });

    const [{ data: users }, { data: branches }] = await Promise.all([
      userIds.length ? supabase.from('users').select('id, first_name, last_name, role').in('id', userIds) : { data: [] },
      branchIds.length ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [] }
    ]);

    const userMap = Object.fromEntries(users?.map(u => [u.id, u]) || []);
    const branchMap = Object.fromEntries(branches?.map(b => [b.id, b]) || []);

    const payments = enrichedPayments.map(p => ({
      ...p,
      cashier: userMap[p.user_id || p.created_by],
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
      const cashierId = p.user_id || p.created_by || 'system';
      const cashierName = p.cashier ? `${p.cashier.first_name} ${p.cashier.last_name}` : ((p.user_id || p.created_by) ? 'Unknown User' : 'System');
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
    console.log('âœ… [Financial Reconciliation] Response sent successfully');
  } catch (error) {
    console.error('âŒ [Financial Reconciliation] Error occurred:', error);
    console.error('âŒ [Financial Reconciliation] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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
    const { count: totalRooms, error: totalRoomsError } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
    if (totalRoomsError) {
      console.error('Database error:', totalRoomsError);
      throw totalRoomsError;
    }
    const { count: occupiedRooms, error: occupiedRoomsError } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'occupied');
    if (occupiedRoomsError) {
      console.error('Database error:', occupiedRoomsError);
      throw occupiedRoomsError;
    }
    const occupancy = totalRooms ? Math.round((occupiedRooms || 0) / totalRooms * 100) : 0;

    const fbOrders = (restRes.data?.length || 0) + (barRes.data?.length || 0) + (poolRes.data?.length || 0);
    const avgOrderValue = fbOrders ? Math.round((restRev + barRev + poolRev) / fbOrders) : 0;

    // 4. Leakage & Anomalies Detection
    const { data: exceptions, error: exceptionsError } = await supabase.from('audit_exceptions')
      .select('*')
      .eq('status', 'open')
      .gte('detected_at', start)
      .lte('detected_at', end)
      .order('detected_at', { ascending: false })
      .limit(10);

    if (exceptionsError) {
      console.error('Database error:', exceptionsError);
      throw exceptionsError;
    }

    const { data: voidedOrders, error: voidedOrdersError } = await supabase.from('restaurant_orders')
      .select('id, total_amount, order_number, table_number, created_at')
      .eq('status', 'cancelled')
      .is('auditor_id', null)
      .gte('created_at', start)
      .order('created_at', { ascending: false })
      .limit(10);

    if (voidedOrdersError) {
      console.error('Database error:', voidedOrdersError);
      throw voidedOrdersError;
    }

    const { data: voidedBarOrders, error: voidedBarOrdersError } = await supabase.from('bar_orders')
      .select('id, total, order_number, created_at')
      .eq('status', 'cancelled')
      .is('auditor_id', null)
      .gte('created_at', start)
      .limit(5);

    if (voidedBarOrdersError) {
      console.error('Database error:', voidedBarOrdersError);
      throw voidedBarOrdersError;
    }

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
    const { data: branches , error } = await supabase.from('branches').select('id, name');
    if (error) {
      console.error('Database error:', error);
      throw error;
    }

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
export const exportStockLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ExcelJS = require('exceljs');
    const user = (req as any).user;
    const requestedBranchId = (req.body?.branch_id ?? req.query.branch_id) as string | number | undefined;
    const branchScopedRoles = [
      UserRole.BRANCH_STOREKEEPER,
      UserRole.BRANCH_MANAGER,
      UserRole.BRANCH_ACCOUNTANT,
    ];
    const isBranchScoped = user?.role && branchScopedRoles.includes(user.role);
    const userBranchId = user?.branch_id ?? user?.branchId;
    const branch_id = isBranchScoped ? userBranchId : requestedBranchId;

    if (isBranchScoped && !branch_id) {
      res.status(403).json({
        success: false,
        message: 'Branch context is required to export the stock ledger',
      });
      return;
    }

    // Fetch branch name
    let branchName = 'All Branches';
    if (branch_id && `${branch_id}` !== '0') {
      const { data: branch , error } = await supabase.from('branches').select('name').eq('id', branch_id).single();
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      if (branch) branchName = branch.name;
    }

    // Fetch stock
    let stockQuery = supabase.from('branch_stock').select('*');
    if (branch_id && `${branch_id}` !== '0') stockQuery = stockQuery.eq('branch_id', branch_id);
    const { data: rawStock, error: stockError } = await stockQuery;
    if (stockError) throw stockError;

    // Fetch item details
    const itemSkus = [...new Set(rawStock?.map((s: any) => s.item_sku).filter(Boolean))];
    const { data: items } = await supabase
      .from('simple_items')
      .select('id, item_name, sku, unit_of_measure, category, cost_price')
      .in('sku', itemSkus as string[]);

    const itemMap: Record<string, any> = Object.fromEntries(
      items?.map((i: any) => [i.sku, { name: i.item_name, unit: i.unit_of_measure, category: i.category, cost_price: i.cost_price }]) || []
    );

    // Fetch 30-day movements for variance
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let movQuery = supabase.from('branch_stock_movements').select('*').gte('created_at', thirtyDaysAgo.toISOString());
    if (branch_id && `${branch_id}` !== '0') movQuery = movQuery.eq('branch_id', branch_id);
    const { data: movements } = await movQuery;

    // Build workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FamousGate Hotels';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Stock Ledger', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    });

    // â”€â”€ Title block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ws.mergeCells('A1:L1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'FAMOUSGATE HOTELS â€” STOCK LEDGER REPORT';
    titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    ws.mergeCells('A2:L2');
    const subCell = ws.getCell('A2');
    subCell.value = `Branch: ${branchName}   |   Generated: ${new Date().toLocaleString()}   |   Period: Last 30 Days`;
    subCell.font = { name: 'Calibri', italic: true, size: 11, color: { argb: 'FFFFFFFF' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E6DA4' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 22;

    ws.addRow([]); // spacer row 3

    // â”€â”€ Column definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ws.columns = [
      { key: 'name',          width: 32 },
      { key: 'sku',           width: 18 },
      { key: 'category',      width: 18 },
      { key: 'unit',          width: 12 },
      { key: 'systemStock',   width: 16 },
      { key: 'theoretical',   width: 18 },
      { key: 'variance',      width: 14 },
      { key: 'variancePct',   width: 14 },
      { key: 'costPrice',     width: 14 },
      { key: 'varianceValue', width: 18 },
      { key: 'status',        width: 14 },
      { key: 'lastMovement',  width: 18 },
    ];

    // â”€â”€ Header row (row 4) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const headers = ['Item Name', 'SKU', 'Category', 'Unit', 'System Stock', 'Theoretical Stock',
      'Variance', 'Variance %', 'Cost Price (KES)', 'Variance Value (KES)', 'Status', 'Last Movement'];

    const headerRow = ws.getRow(4);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF2E6DA4' } },
        bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FF2E6DA4' } },
        right: { style: 'thin', color: { argb: 'FF2E6DA4' } },
      };
    });
    headerRow.height = 30;

    // â”€â”€ Data rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let rowIndex = 5;
    let flaggedCount = 0;
    let totalVarianceValue = 0;

    (rawStock || []).forEach((stock: any) => {
      const item = itemMap[stock.item_sku] || {};
      const itemMovements = (movements || []).filter((m: any) => m.item_sku === stock.item_sku && m.branch_id === stock.branch_id);

      const wastage = itemMovements
        .filter((m: any) => ['WASTAGE', 'DAMAGE', 'LOSS'].includes(m.movement_type?.toUpperCase()))
        .reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0);

      const currentQty = Number(stock.quantity || 0);
      const theoreticalQty = currentQty + wastage;
      const variance = wastage;
      const variancePct = currentQty > 0 ? (variance / currentQty) * 100 : 0;
      const costPrice = Number(item.cost_price || 0);
      const varianceValue = Math.abs(variance) * costPrice;
      const isFlagged = variance > 0;
      const lastMov = itemMovements[0]?.created_at ? new Date(itemMovements[0].created_at).toLocaleDateString() : 'N/A';

      if (isFlagged) { flaggedCount++; totalVarianceValue += varianceValue; }

      const isEven = (rowIndex % 2 === 0);
      const rowBg = isFlagged ? 'FFFFF3CD' : (isEven ? 'FFF5F9FF' : 'FFFFFFFF');

      const row = ws.getRow(rowIndex);
      const values = [
        item.name || stock.item_sku || '',
        stock.item_sku || '',
        item.category || 'General',
        item.unit || 'Unit',
        currentQty,
        parseFloat(theoreticalQty.toFixed(2)),
        parseFloat(variance.toFixed(2)),
        parseFloat(variancePct.toFixed(2)),
        parseFloat(costPrice.toFixed(2)),
        parseFloat(varianceValue.toFixed(2)),
        isFlagged ? 'Flagged' : 'Balanced',
        lastMov,
      ];

      values.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'hair', color: { argb: 'FFD0D7E0' } },
          bottom: { style: 'hair', color: { argb: 'FFD0D7E0' } },
          left: { style: 'hair', color: { argb: 'FFD0D7E0' } },
          right: { style: 'hair', color: { argb: 'FFD0D7E0' } },
        };

        // Numeric formatting
        if ([4, 5, 6].includes(i)) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' }; }
        if (i === 7) { cell.numFmt = '#,##0.00"%"'; cell.alignment = { horizontal: 'right' }; }
        if ([8, 9].includes(i)) { cell.numFmt = '"KES "#,##0.00'; cell.alignment = { horizontal: 'right' }; }

        // Status cell colour
        if (i === 10) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isFlagged ? 'FF9B1C1C' : 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isFlagged ? 'FFFEE2E2' : 'FFD1FAE5' } };
          cell.alignment = { horizontal: 'center' };
        }

        // Item name left-align
        if (i === 0) { cell.alignment = { horizontal: 'left', wrapText: true }; }
      });

      row.height = 20;
      rowIndex++;
    });

    // â”€â”€ Summary row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ws.addRow([]);
    rowIndex++;
    const summaryRow = ws.getRow(rowIndex);
    ws.mergeCells(`A${rowIndex}:D${rowIndex}`);
    const sumLabel = summaryRow.getCell(1);
    sumLabel.value = `SUMMARY  |  Total Items: ${rawStock?.length || 0}   Flagged: ${flaggedCount}   Balanced: ${(rawStock?.length || 0) - flaggedCount}`;
    sumLabel.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    sumLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
    sumLabel.alignment = { horizontal: 'left', vertical: 'middle' };

    const sumValCell = summaryRow.getCell(10);
    sumValCell.value = parseFloat(totalVarianceValue.toFixed(2));
    sumValCell.numFmt = '"KES "#,##0.00';
    sumValCell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    sumValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } };
    sumValCell.alignment = { horizontal: 'right', vertical: 'middle' };
    summaryRow.height = 26;

    // â”€â”€ Freeze header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4, activeCell: 'A5' }];

    // â”€â”€ Stream response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const filename = `stock_ledger_${branchName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
}

/**
 * F. Branch Orders Verification
 * Verify stock requests with approval workflow and decision history.
 */
export const getBranchOrdersVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, start_date, end_date } = req.query;

    // Enforce branch isolation: branch-scoped users can only see their own branch's requests
    const { isGlobalRole } = await import('../utils/branchIsolation');
    const userBranchId = req.user?.branch_id;
    const isCentral = isGlobalRole(req.user?.role);

    // Determine effective branch_id
    let effectiveBranchId: string | undefined;
    if (isCentral) {
      // Global roles may filter by any branch via query param
      effectiveBranchId = req.query.branch_id as string | undefined;
    } else {
      // Branch-scoped roles are locked to their own branch
      effectiveBranchId = userBranchId ? String(userBranchId) : undefined;
    }

    // 1. Fetch branches for names
    const { data: branches, error: branchesError2 } = await supabase.from('branches').select('id, name');
    if (branchesError2) {
      console.error('Database error:', branchesError2);
      throw branchesError2;
    }

    let query = supabase
      .from('stock_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (effectiveBranchId && effectiveBranchId !== '0') query = query.eq('requesting_branch_id', effectiveBranchId);
    if (status) query = query.eq('status', status);
    if (start_date) {
      const startIso = String(start_date).includes('T') ? String(start_date) : `${start_date}T00:00:00.000Z`;
      query = query.gte('created_at', startIso);
    }
    if (end_date) {
      const endIso = String(end_date).includes('T') ? String(end_date) : `${end_date}T23:59:59.999Z`;
      query = query.lte('created_at', endIso);
    }

    const { data: rawRequests, error: requestsError } = await query;
    if (requestsError) throw requestsError;

    // Fetch related data manually to avoid schema cache relationship issues
    const requestIds = rawRequests?.map(r => r.id) || [];
    const userIds = [...new Set([
      ...(rawRequests?.map(r => r.created_by) || []),
      ...(rawRequests?.map(r => r.reviewed_by) || []),
      ...(rawRequests?.map(r => r.approved_by) || [])
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
    if (!effectiveBranchId || effectiveBranchId === '0') {
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

const normalizeDateWindow = (startDate?: any, endDate?: any) => {
  const startRaw = startDate ? String(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endRaw = endDate ? String(endDate) : new Date().toISOString().split('T')[0];
  const startIso = startRaw.includes('T') ? startRaw : `${startRaw}T00:00:00.000Z`;
  const endIso = endRaw.includes('T') ? endRaw : `${endRaw}T23:59:59.999Z`;
  return { startRaw, endRaw, startIso, endIso };
};

const outletGroupFor = (source: string, category?: string, orderType?: string) => {
  const normalized = `${source} ${category || ''} ${orderType || ''}`.toLowerCase();
  if (normalized.includes('room')) return 'rooms';
  if (normalized.includes('non_consumable') || normalized.includes('non-consumable')) return 'non_consumables';
  if (normalized.includes('bar')) return 'bar';
  return 'restaurant';
};

const soldOutletLabel = (group: string) => ({
  restaurant: 'Restaurant',
  bar: 'Bar',
  rooms: 'Rooms',
  non_consumables: 'Non-consumables',
}[group] || group);

const movementTier = (quantity: number, maxQuantity: number, days: number) => {
  const velocity = days > 0 ? quantity / days : quantity;
  if (maxQuantity > 0 && quantity >= maxQuantity * 0.6) return 'fast';
  if (velocity >= 5) return 'fast';
  if (velocity <= 1) return 'slow';
  return 'steady';
};

const fgMoney = (value: any): string =>
  `KES ${Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fgDate = (value: any): string => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fgLogoPath = (): string | null => {
  const candidates = [
    path.join(process.cwd(), '../frontend/public/fglogo.png'),
    path.join(process.cwd(), 'frontend/public/fglogo.png'),
    path.join(__dirname, '../../../frontend/public/fglogo.png')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const drawSoldItemsHeader = (doc: PDFKit.PDFDocument, title: string, subtitle: string): number => {
  const logoPath = fgLogoPath();
  if (logoPath) {
    doc.image(logoPath, 40, 30, { width: 55 });
  } else {
    doc.circle(67, 57, 27).fill(FG_PRIMARY);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('FG', 53, 47);
  }

  doc.fillColor(FG_PRIMARY).fontSize(15).font('Helvetica-Bold').text(FG_COMPANY_NAME, 110, 30, {
    align: 'right'
  });
  doc.fontSize(9).font('Helvetica').fillColor(FG_SECONDARY)
    .text(FG_COMPANY_ADDRESS, 110, 50, { align: 'right' })
    .text(`Email: ${FG_COMPANY_EMAIL}`, { align: 'right' })
    .text(`Tel: ${FG_COMPANY_PHONE}`, { align: 'right' });

  doc.strokeColor(FG_BORDER).lineWidth(1).moveTo(40, 100).lineTo(doc.page.width - 40, 100).stroke();
  doc.rect(40, 101, doc.page.width - 80, 3).fill(FG_GOLD);
  doc.fillColor(FG_PRIMARY).fontSize(14).font('Helvetica-Bold').text(title, 40, 114, { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor(FG_SECONDARY).text(subtitle, 40, 132, { align: 'center' });
  doc.strokeColor(FG_BORDER).lineWidth(0.5).moveTo(40, 146).lineTo(doc.page.width - 40, 146).stroke();
  doc.fillColor(FG_PRIMARY);
  return 158;
};

const drawSoldItemsFooter = (doc: PDFKit.PDFDocument): void => {
  const y = doc.page.height - 52;
  doc.strokeColor(FG_BORDER).lineWidth(0.5).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
  doc.fillColor(FG_SECONDARY).fontSize(7.5).font('Helvetica')
    .text(`Generated: ${new Date().toLocaleString('en-KE')} | ${FG_COMPANY_NAME} - Confidential`, 40, y + 7, {
      width: doc.page.width - 80,
      align: 'center',
      lineBreak: false,
      ellipsis: true
    });
};

const soldItemsSpace = (doc: PDFKit.PDFDocument, y: number, needed = 60): number => {
  if (y + needed < doc.page.height - 70) return y;
  drawSoldItemsFooter(doc);
  doc.addPage();
  return drawSoldItemsHeader(doc, 'SOLD ITEMS ANALYTICS REPORT', 'Continued');
};

const soldItemsSectionTitle = (doc: PDFKit.PDFDocument, title: string, y: number): number => {
  doc.fillColor(FG_PRIMARY).fontSize(11).font('Helvetica-Bold').text(title, 40, y);
  doc.rect(40, y + 15, doc.page.width - 80, 2).fill(FG_GOLD);
  return y + 26;
};

const soldItemsTable = (
  doc: PDFKit.PDFDocument,
  y: number,
  headers: string[],
  rows: string[][],
  widths: number[],
  aligns: Array<'left' | 'center' | 'right'> = []
): number => {
  const left = 40;
  let currentY = y;
  doc.rect(left, currentY, doc.page.width - 80, 20).fill(FG_HEADER_BG);
  doc.fillColor('white').fontSize(7.2).font('Helvetica-Bold');
  let x = left + 6;
  headers.forEach((header, index) => {
    doc.text(header, x, currentY + 6, {
      width: widths[index] - 8,
      align: aligns[index] || 'left',
      ellipsis: true
    });
    x += widths[index];
  });
  currentY += 20;

  rows.forEach((row, rowIndex) => {
    currentY = soldItemsSpace(doc, currentY, 22);
    if (rowIndex % 2 === 0) doc.rect(left, currentY, doc.page.width - 80, 18).fill(FG_ROW_BG);
    doc.fillColor(FG_PRIMARY).fontSize(7.1).font('Helvetica');
    x = left + 6;
    row.forEach((value, index) => {
      doc.text(value, x, currentY + 5, {
        width: widths[index] - 8,
        align: aligns[index] || 'left',
        ellipsis: true
      });
      x += widths[index];
    });
    doc.strokeColor(FG_BORDER).lineWidth(0.3).moveTo(left, currentY + 18).lineTo(doc.page.width - 40, currentY + 18).stroke();
    currentY += 18;
  });
  return currentY + 12;
};

const buildSoldItemsAnalysisPDF = async (payload: any): Promise<Buffer> => {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const summary = payload.summary || {};
    const period = summary.period || {};
    const branchName = (summary.branch_summaries || [])[0]?.branch_name || 'Branch';
    const subtitle = `${branchName} | ${fgDate(period.start_date)} to ${fgDate(period.end_date)}`;
    let y = drawSoldItemsHeader(doc, 'SOLD ITEMS ANALYTICS REPORT', subtitle);

    doc.fillColor(FG_SECONDARY).fontSize(8).font('Helvetica')
      .text(`Branch: ${branchName}`, 40, y, { width: 170 })
      .text(`Period: ${fgDate(period.start_date)} to ${fgDate(period.end_date)}`, 210, y, { width: 190 })
      .text(`Generated: ${new Date().toLocaleString('en-KE')}`, 400, y, { width: 155 });
    y += 30;

    const cards = [
      { label: 'TOTAL REVENUE', value: fgMoney(summary.total_revenue), color: FG_PRIMARY },
      { label: 'UNITS SOLD', value: Number(summary.total_quantity_sold || 0).toLocaleString('en-KE'), color: FG_ACCENT },
      { label: 'GROSS PROFIT', value: fgMoney(summary.gross_profit), color: FG_HEADER_BG },
      { label: 'MARGIN', value: `${Number(summary.profit_margin || 0).toFixed(1)}%`, color: '#236b4e' }
    ];
    const cardWidth = (doc.page.width - 110) / 4;
    cards.forEach((card, index) => {
      const x = 40 + index * (cardWidth + 10);
      doc.roundedRect(x, y, cardWidth, 48, 4).fill(card.color);
      doc.fillColor(FG_GOLD).fontSize(7).font('Helvetica-Bold').text(card.label, x + 8, y + 11, {
        width: cardWidth - 16,
        align: 'center'
      });
      doc.fillColor('white').fontSize(11).font('Helvetica-Bold').text(card.value, x + 8, y + 27, {
        width: cardWidth - 16,
        align: 'center',
        ellipsis: true
      });
    });
    y += 68;

    y = soldItemsSectionTitle(doc, 'OUTLET REVENUE BREAKDOWN', y);
    y = soldItemsTable(
      doc,
      y,
      ['Outlet', 'Items', 'Qty', 'Revenue', 'COGS', 'Gross Profit', 'Margin'],
      (summary.outlet_breakdown || []).map((row: any) => [
        String(row.label || row.key || '-'),
        Number(row.item_count || 0).toLocaleString('en-KE'),
        Number(row.quantity || 0).toLocaleString('en-KE'),
        fgMoney(row.revenue),
        fgMoney(row.cost_of_goods_sold),
        fgMoney(row.gross_profit),
        `${Number(row.profit_margin || 0).toFixed(1)}%`
      ]),
      [92, 50, 50, 90, 76, 98, 49],
      ['left', 'center', 'center', 'right', 'right', 'right', 'right']
    );

    y = soldItemsSpace(doc, y, 120);
    y = soldItemsSectionTitle(doc, 'FAST MOVING ITEMS', y);
    y = soldItemsTable(
      doc,
      y,
      ['Item', 'Outlet', 'Qty', 'Velocity/day', 'Revenue', 'Profit'],
      (payload.fast_moving_items || []).slice(0, 12).map((item: any) => [
        String(item.name || item.item_name || '-'),
        String(item.outlet_label || item.category || '-'),
        Number(item.quantity || 0).toLocaleString('en-KE'),
        Number(item.velocity_per_day || 0).toFixed(2),
        fgMoney(item.revenue),
        fgMoney(item.gross_profit)
      ]),
      [165, 80, 50, 72, 78, 60],
      ['left', 'left', 'center', 'center', 'right', 'right']
    );

    y = soldItemsSpace(doc, y, 120);
    y = soldItemsSectionTitle(doc, 'SLOW MOVING ITEMS', y);
    y = soldItemsTable(
      doc,
      y,
      ['Item', 'Outlet', 'Qty', 'Velocity/day', 'Revenue', 'Profit'],
      (payload.slow_moving_items || []).slice(0, 12).map((item: any) => [
        String(item.name || item.item_name || '-'),
        String(item.outlet_label || item.category || '-'),
        Number(item.quantity || 0).toLocaleString('en-KE'),
        Number(item.velocity_per_day || 0).toFixed(2),
        fgMoney(item.revenue),
        fgMoney(item.gross_profit)
      ]),
      [165, 80, 50, 72, 78, 60],
      ['left', 'left', 'center', 'center', 'right', 'right']
    );

    y = soldItemsSpace(doc, y, 140);
    y = soldItemsSectionTitle(doc, 'DETAILED SOLD ITEMS LEDGER', y);
    soldItemsTable(
      doc,
      y,
      ['Product', 'Outlet', 'Qty', 'Revenue', 'COGS', 'Profit', 'Margin', 'Movement'],
      (payload.analysis || []).slice(0, 80).map((item: any) => [
        String(item.name || item.item_name || '-'),
        String(item.outlet_label || item.category || '-'),
        Number(item.quantity || 0).toLocaleString('en-KE'),
        fgMoney(item.revenue),
        fgMoney(item.cost_of_goods_sold),
        fgMoney(item.gross_profit),
        `${Number(item.profit_margin || 0).toFixed(1)}%`,
        String(item.movement_tier || '-').toUpperCase()
      ]),
      [130, 70, 42, 72, 62, 67, 45, 57],
      ['left', 'left', 'center', 'right', 'right', 'right', 'right', 'center']
    );

    drawSoldItemsFooter(doc);
    doc.end();
  });
};

const buildSoldItemsAnalysisPayload = async (req: Request) => {
    const { branch_id, start_date, end_date } = req.query;
    const requestedBranchId = branch_id ? String(branch_id) : '';
    const userBranchId = req.user?.branch_id ? String(req.user.branch_id) : '';
    const userRole = String(req.user?.role || '');
    const isBranchScopedUser = ['branch_manager', 'branch_accountant'].includes(userRole);

    if (isBranchScopedUser && requestedBranchId && requestedBranchId !== '0' && userBranchId && requestedBranchId !== userBranchId) {
      const error = new Error('Access denied. You can only view sold items analytics for your assigned branch.') as any;
      error.statusCode = 403;
      throw error;
    }

    const effectiveBranchId = isBranchScopedUser
      ? (userBranchId || (requestedBranchId && requestedBranchId !== '0' ? requestedBranchId : ''))
      : (requestedBranchId && requestedBranchId !== '0' ? requestedBranchId : '');

    const { data: branches, error: branchesError } = await supabase.from('branches').select('id, name');
    if (branchesError) throw branchesError;

    const branchNameMap = (branches || []).reduce((acc: Record<string, string>, branch: any) => {
      acc[String(branch.id)] = branch.name;
      return acc;
    }, {});

    const { startRaw, endRaw, startIso, endIso } = normalizeDateWindow(start_date, end_date);
    const days = Math.max(1, Math.ceil((new Date(endIso).getTime() - new Date(startIso).getTime()) / (24 * 60 * 60 * 1000)));

    let restQuery = supabase.from('restaurant_orders').select('id, branch_id, created_at, order_type, room_number, department').eq('status', 'completed').gte('created_at', startIso).lte('created_at', endIso);
    let barQuery = supabase.from('bar_orders').select('id, branch_id, created_at').eq('status', 'completed').gte('created_at', startIso).lte('created_at', endIso);
    let outletOrderQuery = supabase
      .from('pos_shift_orders')
      .select('id, outlet_id, shift_id, order_number, order_type, room_number, customer_name, status, payment_status, total_amount, items, created_at, kitchen_status, kitchen_ready_at, updated_at')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .or('status.in.(paid,credit_bill),payment_status.in.(paid,credit_bill)');
    let stockReqQuery = supabase.from('stock_requests').select('id, requesting_branch_id').gte('created_at', startIso).lte('created_at', endIso);
    let barStockReqQuery = supabase.from('bar_stock_requests').select('id, branch_id').gte('created_at', startIso).lte('created_at', endIso);

    if (effectiveBranchId) {
      restQuery = restQuery.eq('branch_id', effectiveBranchId);
      barQuery = barQuery.eq('branch_id', effectiveBranchId);
      stockReqQuery = stockReqQuery.eq('requesting_branch_id', effectiveBranchId);
      barStockReqQuery = barStockReqQuery.eq('branch_id', effectiveBranchId);
    }

    const [rawRest, rawBar, rawOutletOrders, rawStock, rawBarStock] = await Promise.all([restQuery, barQuery, outletOrderQuery, stockReqQuery, barStockReqQuery]);

    if (rawRest.error) throw rawRest.error;
    if (rawBar.error) throw rawBar.error;
    if (rawOutletOrders.error) throw rawOutletOrders.error;
    if (rawStock.error) throw rawStock.error;
    if (rawBarStock.error) throw rawBarStock.error;

    const restOrders = rawRest.data || [];
    const barOrders = rawBar.data || [];
    let outletOrders = rawOutletOrders.data || [];
    const stockRequests = rawStock.data || [];
    const barStockRequests = rawBarStock.data || [];

    const outletIds = [...new Set(outletOrders.map((order: any) => order.outlet_id).filter(Boolean))];
    const shiftIds = [...new Set(outletOrders.map((order: any) => order.shift_id).filter(Boolean))];
    const [outletsRes, outletStockRes] = await Promise.all([
      outletIds.length
        ? supabase.from('pos_outlets').select('id, branch_id, name, outlet_type').in('id', outletIds)
        : Promise.resolve({ data: [], error: null } as any),
      shiftIds.length
        ? supabase.from('pos_shift_stock_counts').select('shift_id, outlet_item_id, item_name, sku, cost_price, selling_price, sold_quantity').in('shift_id', shiftIds)
        : Promise.resolve({ data: [], error: null } as any)
    ]);
    if (outletsRes.error) throw outletsRes.error;
    if (outletStockRes.error) throw outletStockRes.error;

    const outletMap = (outletsRes.data || []).reduce((acc: Record<string, any>, outlet: any) => {
      acc[String(outlet.id)] = outlet;
      return acc;
    }, {});
    if (effectiveBranchId) {
      outletOrders = outletOrders.filter((order: any) => Number(outletMap[String(order.outlet_id)]?.branch_id) === Number(effectiveBranchId));
    }
    const stockCountByShiftItem = (outletStockRes.data || []).reduce((acc: Record<string, any>, row: any) => {
      acc[`${row.shift_id}_${row.outlet_item_id}`] = row;
      return acc;
    }, {});

    const restIds = restOrders.map((order: any) => order.id).filter(Boolean);
    const barIds = barOrders.map((order: any) => order.id).filter(Boolean);
    const stockIds = stockRequests.map((request: any) => request.id).filter(Boolean);
    const barStockIds = barStockRequests.map((request: any) => request.id).filter(Boolean);

    const [restItemsRes, barItemsRes, stockItemsRes, barStockItemsRes] = await Promise.all([
      restIds.length
        ? supabase.from('restaurant_order_items').select('order_id, menu_item_id, item_name, quantity, unit_price, total_price, kitchen_status, kitchen_ready_at').in('order_id', restIds)
        : Promise.resolve({ data: [], error: null } as any),
      barIds.length
        ? supabase.from('bar_order_items').select('order_id, drink_id, drink_name, item_name, quantity, unit_price, total_price').in('order_id', barIds)
        : Promise.resolve({ data: [], error: null } as any),
      stockIds.length
        ? supabase.from('stock_request_items').select('request_id, item_sku, requested_quantity').in('request_id', stockIds)
        : Promise.resolve({ data: [], error: null } as any),
      barStockIds.length
        ? supabase.from('bar_stock_request_items').select('request_id, inventory_item_id, requested_quantity').in('request_id', barStockIds)
        : Promise.resolve({ data: [], error: null } as any)
    ]);

    if (restItemsRes.error) throw restItemsRes.error;
    if (barItemsRes.error) throw barItemsRes.error;
    if (stockItemsRes.error) throw stockItemsRes.error;
    if (barStockItemsRes.error) throw barStockItemsRes.error;

    const restaurantItems = restItemsRes.data || [];
    const barItems = barItemsRes.data || [];
    const stockItems = stockItemsRes.data || [];
    const barStockItems = barStockItemsRes.data || [];

    const menuItemIds = [...new Set(restaurantItems.map((item: any) => item.menu_item_id).filter(Boolean))];
    const drinkIds = [...new Set(barItems.map((item: any) => item.drink_id).filter(Boolean))];

    const [menuItemsRes, barInventoryRes] = await Promise.all([
      menuItemIds.length
        ? supabase.from('restaurant_menu_items').select('id, name').in('id', menuItemIds)
        : Promise.resolve({ data: [], error: null } as any),
      drinkIds.length
        ? supabase.from('restaurant_bar_inventory').select('id, name, category').in('id', drinkIds)
        : Promise.resolve({ data: [], error: null } as any)
    ]);

    if (menuItemsRes.error) throw menuItemsRes.error;
    if (barInventoryRes.error) throw barInventoryRes.error;

    const menuItemNameMap = (menuItemsRes.data || []).reduce((acc: Record<string, string>, item: any) => {
      acc[String(item.id)] = item.name;
      return acc;
    }, {});

    const barItemMap = (barInventoryRes.data || []).reduce((acc: Record<string, any>, item: any) => {
      acc[String(item.id)] = item;
      return acc;
    }, {});

    let consumptionMappings: any[] = [];
    try {
      const { data: mappingData, error: mappingError } = await supabase
        .from('audit_config_consumption')
        .select('menu_item_id, inventory_item_sku, branch_id');

      if (!mappingError) {
        consumptionMappings = mappingData || [];
      }
    } catch (_error) {}

    const restItemsByOrderId = restaurantItems.reduce((acc: Record<string, any[]>, item: any) => {
      const key = String(item.order_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const barItemsByOrderId = barItems.reduce((acc: Record<string, any[]>, item: any) => {
      const key = String(item.order_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const stockItemsByRequestId = stockItems.reduce((acc: Record<string, any[]>, item: any) => {
      const key = String(item.request_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const barStockItemsByRequestId = barStockItems.reduce((acc: Record<string, any[]>, item: any) => {
      const key = String(item.request_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const soldItemsMap: Record<string, any> = {};
    const soldTransactionIds = new Set<string>();

    const addSoldItem = (payload: {
      branchId: string;
      itemId?: string;
      sku?: string;
      name: string;
      quantity: number;
      revenue: number;
      cost?: number;
      category: string;
      source: string;
      outletGroup?: string;
      soldAt?: string;
      orderId?: string;
      receiptNumber?: string;
      kdsMinutes?: number | null;
    }) => {
      const key = `${payload.branchId}_${payload.source}_${payload.itemId || payload.name}`;
      if (!soldItemsMap[key]) {
        soldItemsMap[key] = {
          branch_id: payload.branchId,
          branch_name: branchNameMap[payload.branchId] || `Branch ${payload.branchId}`,
          item_id: payload.itemId || null,
          sku: payload.sku || payload.itemId || null,
          name: payload.name,
          quantity: 0,
          revenue: 0,
          cost_of_goods_sold: 0,
          category: payload.category,
          source: payload.source,
          outlet_group: payload.outletGroup || outletGroupFor(payload.source, payload.category),
          daily: {},
          transaction_ids: new Set<string>(),
          references: new Set<string>(),
          last_sold_at: null,
          kds_count: 0,
          kds_total_minutes: 0
        };
      }

      soldItemsMap[key].quantity += payload.quantity;
      soldItemsMap[key].revenue += payload.revenue;
      soldItemsMap[key].cost_of_goods_sold += Number(payload.cost || 0);
      if (payload.soldAt) {
        const day = String(payload.soldAt).slice(0, 10);
        if (!soldItemsMap[key].daily[day]) soldItemsMap[key].daily[day] = { date: day, quantity: 0, revenue: 0, cost_of_goods_sold: 0 };
        soldItemsMap[key].daily[day].quantity += payload.quantity;
        soldItemsMap[key].daily[day].revenue += payload.revenue;
        soldItemsMap[key].daily[day].cost_of_goods_sold += Number(payload.cost || 0);
        if (!soldItemsMap[key].last_sold_at || new Date(payload.soldAt).getTime() > new Date(soldItemsMap[key].last_sold_at).getTime()) {
          soldItemsMap[key].last_sold_at = payload.soldAt;
        }
      }
      if (payload.orderId) {
        const orderKey = `${payload.source}:${payload.orderId}`;
        soldItemsMap[key].transaction_ids.add(orderKey);
        soldTransactionIds.add(orderKey);
      }
      if (payload.receiptNumber) {
        soldItemsMap[key].references.add(String(payload.receiptNumber));
      }
      if (payload.kdsMinutes !== null && payload.kdsMinutes !== undefined && Number.isFinite(payload.kdsMinutes)) {
        soldItemsMap[key].kds_count += 1;
        soldItemsMap[key].kds_total_minutes += payload.kdsMinutes;
      }
    };

    restOrders.forEach((order: any) => {
      const branchKey = String(order.branch_id);
      (restItemsByOrderId[String(order.id)] || []).forEach((item: any) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const revenue = Number(item.total_price ?? quantity * unitPrice) || 0;
        const itemId = item.menu_item_id ? String(item.menu_item_id) : '';
        const name = menuItemNameMap[itemId] || item.item_name || 'Unknown Item';
        const readyAt = item.kitchen_ready_at ? new Date(item.kitchen_ready_at).getTime() : NaN;
        const createdAt = order.created_at ? new Date(order.created_at).getTime() : NaN;
        const kdsMinutes = Number.isFinite(readyAt) && Number.isFinite(createdAt)
          ? Math.max(0, (readyAt - createdAt) / 60000)
          : null;

        addSoldItem({
          branchId: branchKey,
          itemId,
          name,
          quantity,
          revenue,
          category: 'Restaurant',
          source: 'restaurant',
          outletGroup: outletGroupFor('restaurant', order.department, order.order_type),
          soldAt: order.created_at,
          orderId: String(order.id),
          kdsMinutes
        });
      });
    });

    barOrders.forEach((order: any) => {
      const branchKey = String(order.branch_id);
      (barItemsByOrderId[String(order.id)] || []).forEach((item: any) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const revenue = Number(item.total_price ?? quantity * unitPrice) || 0;
        const itemId = item.drink_id ? String(item.drink_id) : '';
        const barItem = itemId ? barItemMap[itemId] : null;
        const name = barItem?.name || item.drink_name || item.item_name || 'Unknown Item';

        addSoldItem({
          branchId: branchKey,
          itemId,
          name,
          quantity,
          revenue,
          category: barItem?.category || 'Bar',
          source: 'bar',
          outletGroup: order.room_number ? 'rooms' : 'bar',
          soldAt: order.created_at,
          orderId: String(order.id)
        });
      });
    });

    outletOrders.forEach((order: any) => {
      const outlet = outletMap[String(order.outlet_id)] || {};
      const branchKey = String(outlet.branch_id || effectiveBranchId || '');
      if (!branchKey) return;
      const orderItems = Array.isArray(order.items) ? order.items : [];
      orderItems.forEach((item: any) => {
        const quantity = Number(item.quantity ?? item.qty ?? 0) || 0;
        const unitPrice = Number(item.unit_price ?? item.selling_price ?? item.price ?? 0) || 0;
        const revenue = Number(item.line_total ?? item.total_price ?? item.total ?? quantity * unitPrice) || 0;
        const itemId = item.outlet_item_id ? String(item.outlet_item_id) : String(item.product_id || item.id || item.name || '');
        const stockRow = stockCountByShiftItem[`${order.shift_id}_${itemId}`] || {};
        const costPrice = Number(item.cost_price ?? stockRow.cost_price ?? 0) || 0;
        const readyAt = order.kitchen_ready_at ? new Date(order.kitchen_ready_at).getTime() : NaN;
        const createdAt = order.created_at ? new Date(order.created_at).getTime() : NaN;
        const kdsMinutes = Number.isFinite(readyAt) && Number.isFinite(createdAt)
          ? Math.max(0, (readyAt - createdAt) / 60000)
          : null;
        const outletGroup = outletGroupFor(String(outlet.outlet_type || item.outlet_type || ''), item.category, order.order_type);
        addSoldItem({
          branchId: branchKey,
          itemId,
          sku: item.sku || stockRow.sku || itemId,
          name: item.name || item.item_name || stockRow.item_name || 'POS Item',
          quantity,
          revenue,
          cost: quantity * costPrice,
          category: item.category || soldOutletLabel(outletGroup),
          source: String(outlet.outlet_type || 'pos_outlet'),
          outletGroup,
          soldAt: order.created_at,
          orderId: String(order.id),
          receiptNumber: order.order_number ? String(order.order_number) : undefined,
          kdsMinutes
        });
      });
    });

    const requestedInventoryByBranchSku: Record<string, number> = {};
    stockRequests.forEach((request: any) => {
      const branchKey = String(request.requesting_branch_id);
      (stockItemsByRequestId[String(request.id)] || []).forEach((item: any) => {
        const sku = String(item.item_sku || '');
        if (!sku) return;
        const key = `${branchKey}_${sku}`;
        requestedInventoryByBranchSku[key] = (requestedInventoryByBranchSku[key] || 0) + Number(item.requested_quantity || 0);
      });
    });

    const requestedBarByBranchItem: Record<string, number> = {};
    barStockRequests.forEach((request: any) => {
      const branchKey = String(request.bar_branch_id);
      (barStockItemsByRequestId[String(request.id)] || []).forEach((item: any) => {
        const inventoryItemId = item.inventory_item_id ? String(item.inventory_item_id) : '';
        if (!inventoryItemId) return;
        const key = `${branchKey}_${inventoryItemId}`;
        requestedBarByBranchItem[key] = (requestedBarByBranchItem[key] || 0) + Number(item.requested_quantity || 0);
      });
    });

    const branchSummaries: Record<string, any> = {};

    if (effectiveBranchId) {
      branchSummaries[effectiveBranchId] = {
        branch_id: effectiveBranchId,
	        branch_name: branchNameMap[effectiveBranchId] || `Branch ${effectiveBranchId}`,
	        total_items_sold: 0,
	        total_revenue: 0,
	        total_quantity: 0,
	        total_cogs: 0,
	        gross_profit: 0
	      };
    } else {
      (branches || []).forEach((branch: any) => {
        const branchKey = String(branch.id);
        branchSummaries[branchKey] = {
          branch_id: branch.id,
	          branch_name: branch.name,
	          total_items_sold: 0,
	          total_revenue: 0,
	          total_quantity: 0,
	          total_cogs: 0,
	          gross_profit: 0
	        };
      });
    }

    const analysis = Object.values(soldItemsMap).map((sold: any) => {
      let stockRequested = 0;

      if (sold.source === 'restaurant' && sold.item_id) {
        const branchSpecificMappings = consumptionMappings.filter((mapping: any) => (
          String(mapping.menu_item_id) === String(sold.item_id) && String(mapping.branch_id || '') === String(sold.branch_id)
        ));
        const globalMappings = consumptionMappings.filter((mapping: any) => (
          String(mapping.menu_item_id) === String(sold.item_id) && !mapping.branch_id
        ));
        const applicableMappings = branchSpecificMappings.length > 0 ? branchSpecificMappings : globalMappings;
        const relevantSkus = [...new Set(applicableMappings.map((mapping: any) => String(mapping.inventory_item_sku || '')).filter(Boolean))];

        relevantSkus.forEach((sku) => {
          stockRequested += requestedInventoryByBranchSku[`${sold.branch_id}_${sku}`] || 0;
        });
      }

      if (sold.source === 'bar' && sold.item_id) {
        stockRequested = requestedBarByBranchItem[`${sold.branch_id}_${sold.item_id}`] || 0;
      }

      if (!branchSummaries[sold.branch_id]) {
        branchSummaries[sold.branch_id] = {
          branch_id: sold.branch_id,
          branch_name: sold.branch_name,
          total_items_sold: 0,
          total_revenue: 0,
          total_quantity: 0,
          total_cogs: 0,
          gross_profit: 0
        };
      }

      branchSummaries[sold.branch_id].total_items_sold += 1;
      branchSummaries[sold.branch_id].total_revenue += sold.revenue;
      branchSummaries[sold.branch_id].total_quantity += sold.quantity;
      branchSummaries[sold.branch_id].total_cogs += sold.cost_of_goods_sold;
      branchSummaries[sold.branch_id].gross_profit += sold.revenue - sold.cost_of_goods_sold;

      return {
        branch_id: sold.branch_id,
        branch_name: sold.branch_name,
        item_id: sold.item_id,
        sku: sold.sku,
        name: sold.name,
        category: sold.category,
        outlet_group: sold.outlet_group,
        outlet_label: soldOutletLabel(sold.outlet_group),
        quantity: sold.quantity,
        gross_revenue: sold.revenue,
        net_revenue: sold.revenue,
        revenue: sold.revenue,
        cost_of_goods_sold: sold.cost_of_goods_sold,
        gross_profit: sold.revenue - sold.cost_of_goods_sold,
        profit_margin: sold.revenue > 0 ? ((sold.revenue - sold.cost_of_goods_sold) / sold.revenue) * 100 : 0,
        average_selling_price: sold.quantity > 0 ? sold.revenue / sold.quantity : 0,
        transaction_count: sold.transaction_ids?.size || 0,
        references: Array.from(sold.references || []),
        last_sold_at: sold.last_sold_at,
        stock_requested: stockRequested,
        consumption_ratio: stockRequested > 0 ? sold.quantity / stockRequested : 0,
        average_kds_minutes: sold.kds_count > 0 ? sold.kds_total_minutes / sold.kds_count : null,
        daily: Object.values(sold.daily)
      };
    });

    const maxQuantity = analysis.reduce((max: number, item: any) => Math.max(max, Number(item.quantity || 0)), 0);
    const enrichedAnalysis = analysis.map((item: any) => ({
      ...item,
      velocity_per_day: Number(item.quantity || 0) / days,
      movement_tier: movementTier(Number(item.quantity || 0), maxQuantity, days)
    })).sort((a, b) => b.quantity - a.quantity);

    const outletBreakdown = ['restaurant', 'bar', 'rooms', 'non_consumables'].map((group) => {
      const rows = enrichedAnalysis.filter((item: any) => item.outlet_group === group);
      const revenue = rows.reduce((sum: number, item: any) => sum + Number(item.revenue || 0), 0);
      const cogs = rows.reduce((sum: number, item: any) => sum + Number(item.cost_of_goods_sold || 0), 0);
      const quantity = rows.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
      return {
        key: group,
        label: soldOutletLabel(group),
        item_count: rows.length,
        quantity,
        revenue,
        cost_of_goods_sold: cogs,
        gross_profit: revenue - cogs,
        profit_margin: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0
      };
    });

    const dailyMap: Record<string, any> = {};
    enrichedAnalysis.forEach((item: any) => {
      (item.daily || []).forEach((day: any) => {
        if (!dailyMap[day.date]) dailyMap[day.date] = { date: day.date, revenue: 0, cost_of_goods_sold: 0, gross_profit: 0, quantity: 0 };
        dailyMap[day.date].revenue += Number(day.revenue || 0);
        dailyMap[day.date].cost_of_goods_sold += Number(day.cost_of_goods_sold || 0);
        dailyMap[day.date].gross_profit += Number(day.revenue || 0) - Number(day.cost_of_goods_sold || 0);
        dailyMap[day.date].quantity += Number(day.quantity || 0);
      });
    });
    const dailyRevenue = Object.values(dailyMap).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

    const kdsItems = enrichedAnalysis.filter((item: any) => item.average_kds_minutes !== null && item.average_kds_minutes !== undefined);
    const kdsIntelligence = {
      average_prep_minutes: kdsItems.length
        ? kdsItems.reduce((sum: number, item: any) => sum + Number(item.average_kds_minutes || 0), 0) / kdsItems.length
        : null,
      slowest_items: [...kdsItems].sort((a: any, b: any) => Number(b.average_kds_minutes || 0) - Number(a.average_kds_minutes || 0)).slice(0, 10),
      fastest_items: [...kdsItems].sort((a: any, b: any) => Number(a.average_kds_minutes || 0) - Number(b.average_kds_minutes || 0)).slice(0, 10)
    };

    const summary = {
      total_items_sold: enrichedAnalysis.length,
      total_quantity_sold: enrichedAnalysis.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0),
      total_transactions: soldTransactionIds.size,
      total_revenue: enrichedAnalysis.reduce((sum: number, item: any) => sum + Number(item.revenue || 0), 0),
      gross_revenue: enrichedAnalysis.reduce((sum: number, item: any) => sum + Number(item.gross_revenue || item.revenue || 0), 0),
      net_revenue: enrichedAnalysis.reduce((sum: number, item: any) => sum + Number(item.net_revenue || item.revenue || 0), 0),
      total_cogs: enrichedAnalysis.reduce((sum: number, item: any) => sum + Number(item.cost_of_goods_sold || 0), 0),
      gross_profit: enrichedAnalysis.reduce((sum: number, item: any) => sum + Number(item.gross_profit || 0), 0),
      profit_margin: 0,
      fast_moving_count: enrichedAnalysis.filter((item: any) => item.movement_tier === 'fast').length,
      slow_moving_count: enrichedAnalysis.filter((item: any) => item.movement_tier === 'slow').length,
      branch_summaries: Object.values(branchSummaries),
      outlet_breakdown: outletBreakdown,
      daily_revenue: dailyRevenue,
      kds_intelligence: kdsIntelligence,
      period: { start_date: startRaw, end_date: endRaw, days }
    };
    summary.profit_margin = summary.total_revenue > 0 ? (summary.gross_profit / summary.total_revenue) * 100 : 0;

    // ── Cashier Payment Clearance ──────────────────────────────────────────────
    let cashierClearance: any = { shifts: [], summary: {} };
    try {
      let shiftsQuery = supabase
        .from('cashier_shifts')
        .select('id, branch_id, cashier_id, approved_by, start_time, end_time, status, expected_cash, actual_cash, opening_float, notes')
        .gte('start_time', startIso)
        .lte('start_time', endIso)
        .order('start_time', { ascending: false });

      if (effectiveBranchId) {
        shiftsQuery = shiftsQuery.eq('branch_id', effectiveBranchId);
      }

      const { data: shifts, error: shiftsError } = await shiftsQuery;
      if (!shiftsError && shifts && shifts.length > 0) {
        const cashierIds = [...new Set(shifts.map((s: any) => s.cashier_id).filter(Boolean))];
        const approverIds = [...new Set(shifts.map((s: any) => s.approved_by).filter(Boolean))];
        const allIds = [...new Set([...cashierIds, ...approverIds])];

        let usersMap: Record<string, any> = {};
        if (allIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .in('id', allIds);
          usersMap = (users || []).reduce((acc: any, u: any) => {
            acc[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim();
            return acc;
          }, {});
        }

        const enrichedShifts = shifts.map((shift: any) => {
          const expected = Number(shift.expected_cash || 0);
          const actual = Number(shift.actual_cash || 0);
          const variance = actual - expected;
          return {
            ...shift,
            cashier_name: usersMap[shift.cashier_id] || 'Unknown',
            approved_by_name: shift.approved_by ? (usersMap[shift.approved_by] || 'Unknown') : null,
            expected_cash: expected,
            actual_cash: actual,
            variance,
            variance_pct: expected > 0 ? (variance / expected) * 100 : 0,
            has_discrepancy: Math.abs(variance) > 10,
          };
        });

        cashierClearance = {
          shifts: enrichedShifts,
          summary: {
            total_shifts: enrichedShifts.length,
            pending: enrichedShifts.filter((s: any) => s.status === 'open' || s.status === 'pending').length,
            approved: enrichedShifts.filter((s: any) => s.status === 'closed' || s.status === 'approved').length,
            with_discrepancy: enrichedShifts.filter((s: any) => s.has_discrepancy).length,
            total_expected: enrichedShifts.reduce((sum: number, s: any) => sum + s.expected_cash, 0),
            total_actual: enrichedShifts.reduce((sum: number, s: any) => sum + s.actual_cash, 0),
            total_variance: enrichedShifts.reduce((sum: number, s: any) => sum + s.variance, 0),
          }
        };
      }
    } catch (clearanceErr: any) {
      // Non-fatal: sold items analysis can still return without clearance data
      console.warn('[SoldItems] Could not load cashier clearance:', clearanceErr?.message);
    }
    // ─────────────────────────────────────────────────────────────────────────

    return {
      summary,
      analysis: enrichedAnalysis,
      fast_moving_items: enrichedAnalysis.filter((item: any) => item.movement_tier === 'fast').slice(0, 15),
      slow_moving_items: [...enrichedAnalysis].filter((item: any) => item.movement_tier === 'slow').sort((a: any, b: any) => Number(a.quantity || 0) - Number(b.quantity || 0)).slice(0, 15),
      cashier_clearance: cashierClearance
    };
};

/**
 * G. Sold Items Analysis
 * Compare items sold against stock requested to identify patterns.
 */
export const getSoldItemsAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = await buildSoldItemsAnalysisPayload(req);

    res.status(200).json({
      success: true,
      data: payload
    });
  } catch (error) {
    next(error);
  }
};

export const exportSoldItemsAnalysisPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = await buildSoldItemsAnalysisPayload(req);
    const summary = payload.summary || {};
    const period = summary.period || {};
    const pdfBuffer = await buildSoldItemsAnalysisPDF(payload);
    const filename = `FG_Sold_Items_${period.start_date || 'from'}_to_${period.end_date || 'to'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
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
      .select('*, items:stock_count_items(*), branch:branches(name)')
      .order('created_at', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);

    const { data: audits, error } = await query;
    if (error) throw error;

    // Fetch user names separately (no reliable FK in schema cache)
    const userIds = new Set<string>();
    audits?.forEach((audit: any) => {
      if (audit.counted_by) userIds.add(audit.counted_by);
    });

    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', Array.from(userIds));

      const userMap = (users || []).reduce((acc: any, u: any) => {
        acc[u.id] = { first_name: u.first_name, last_name: u.last_name };
        return acc;
      }, {});

      audits?.forEach((audit: any) => {
        if (audit.counted_by && userMap[audit.counted_by]) {
          audit.user = userMap[audit.counted_by];
        }
      });
    }

    // Fetch item names â€” item_id can reference either restaurant_bar_inventory or store_items
    const itemIds = new Set<string>();
    audits?.forEach((audit: any) => {
      audit.items?.forEach((item: any) => {
        if (item.item_id) itemIds.add(item.item_id);
      });
    });

    if (itemIds.size > 0) {
      const idArray = Array.from(itemIds);

      // Try both tables in parallel
      const [{ data: barItems }, { data: storeItems }] = await Promise.all([
        supabase.from('restaurant_bar_inventory').select('id, name').in('id', idArray),
        supabase.from('store_items').select('id, name').in('id', idArray),
      ]);

      const itemMap: Record<string, string> = {};
      (barItems || []).forEach((d: any) => { itemMap[d.id] = d.name; });
      (storeItems || []).forEach((d: any) => { itemMap[d.id] = d.name; });

      audits?.forEach((audit: any) => {
        audit.items?.forEach((item: any) => {
          if (item.item_id && itemMap[item.item_id]) {
            item.drink = { name: itemMap[item.item_id] };
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
      const { error: movementError } = await supabase.from('branch_stock_movements').insert([{
        item_sku: item.item_id, // For bar items, we use ID as SKU in movements for now
        branch_id: count.branch_id,
        quantity: item.physical_quantity - item.system_quantity,
        movement_type: 'adjustment',
        reference_type: 'stock_count',
        reference_id: id,
        notes: `Bar Audit Adjustment: ${notes || ''}`,
        performed_by: userId
      }]);

      if (movementError) {
        console.error('Database error:', movementError);
        throw movementError;
      }
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
    // Support both route params (/anomalies/:id) and query params (/verify/details?id=...&type=...)
    const id = req.params.id || req.query.id;
    const type = String(req.query.type || '');

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
          .select('*')
          .eq('id', id)
          .single();
        if (exception && exception.resolved_by) {
          const { data: auditorUser } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', exception.resolved_by)
            .maybeSingle();
          (exception as any).auditor = auditorUser || null;
        }
        data = exception;
        error = excError;
        break;

      case 'delivery':
        const { data: delivery, error: deliveryError } = await supabase
          .from('dispatches')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        const { data: deliveryItems } = await supabase
          .from('dispatch_items')
          .select('*')
          .eq('dispatch_id', id);
        data = delivery ? { ...delivery, items: deliveryItems || [] } : null;
        error = deliveryError;
        break;

      case 'stock_audit':
      case 'bar_stock': {
        const { data: stockAudit, error: stockAuditError } = await supabase
          .from('stock_counts')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        const { data: stockAuditItems } = await supabase
          .from('stock_count_items')
          .select('*')
          .eq('stock_count_id', id);
        if (stockAudit) {
          const [branchesById, usersById, itemsBySku] = await Promise.all([
            fetchBranchesById([stockAudit.branch_id]),
            fetchUsersById([
              stockAudit.created_by,
              stockAudit.counted_by,
              stockAudit.approved_by,
              stockAudit.verified_by,
            ]),
            fetchSimpleItemsBySku((stockAuditItems || []).map((item: any) => item.item_sku)),
          ]);
          const branch = branchesById[`${stockAudit.branch_id}`] || null;
          const enrichedStockItems = (stockAuditItems || []).map((item: any) => {
            const simpleItem = itemsBySku[`${item.item_sku}`] || null;
            return {
              ...item,
              item: simpleItem,
              item_name: simpleItem?.item_name || item.item_name || item.item_sku,
              item_category: simpleItem?.category || item.item_category,
              item_unit: simpleItem?.unit_of_measure || item.item_unit,
            };
          });
          data = {
            ...stockAudit,
            branch,
            branch_name: branch?.name || stockAudit.branch_name || null,
            created_by_user: usersById[`${stockAudit.created_by}`] || null,
            counted_by_user: usersById[`${stockAudit.counted_by}`] || null,
            approved_by_user: usersById[`${stockAudit.approved_by}`] || null,
            verified_by_user: usersById[`${stockAudit.verified_by}`] || null,
            items: enrichedStockItems,
          };
        } else {
          data = null;
        }
        error = stockAuditError;
        break;
      }

      case 'stock_request':
      case 'approval': {
        const { data: stockRequest, error: stockRequestError } = await supabase
          .from('stock_requests')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        const { data: stockRequestItems } = await supabase
          .from('stock_request_items')
          .select('*')
          .eq('request_id', id);
        if (stockRequest) {
          const [branchesById, usersById, itemsBySku] = await Promise.all([
            fetchBranchesById([
              stockRequest.requesting_branch_id,
              stockRequest.branch_id,
              stockRequest.from_branch_id,
              stockRequest.to_branch_id,
            ]),
            fetchUsersById([
              stockRequest.created_by,
              stockRequest.requested_by,
              stockRequest.approved_by,
              stockRequest.reviewed_by,
              stockRequest.verified_by,
              stockRequest.auditor_id,
            ]),
            fetchSimpleItemsBySku((stockRequestItems || []).map((item: any) => item.item_sku || item.sku)),
          ]);
          const requestingBranch =
            branchesById[`${stockRequest.requesting_branch_id}`] ||
            branchesById[`${stockRequest.branch_id}`] ||
            null;
          const enrichedRequestItems = (stockRequestItems || []).map((item: any) => {
            const sku = item.item_sku || item.sku;
            const simpleItem = itemsBySku[`${sku}`] || null;
            return {
              ...item,
              item: simpleItem,
              item_name: simpleItem?.item_name || item.item_name || sku,
              item_category: simpleItem?.category || item.item_category,
              item_unit: simpleItem?.unit_of_measure || item.item_unit,
            };
          });
          data = {
            ...stockRequest,
            requesting_branch: requestingBranch,
            branch_name: requestingBranch?.name || stockRequest.branch_name || null,
            created_by_user: usersById[`${stockRequest.created_by}`] || null,
            requested_by_user: usersById[`${stockRequest.requested_by}`] || null,
            approved_by_user: usersById[`${stockRequest.approved_by}`] || null,
            reviewed_by_user: usersById[`${stockRequest.reviewed_by}`] || null,
            verified_by_user: usersById[`${stockRequest.verified_by}`] || null,
            auditor: usersById[`${stockRequest.auditor_id}`] || null,
            items: enrichedRequestItems,
          };
        } else {
          data = null;
        }
        error = stockRequestError;
        break;
      }

      case 'stock_item':
        const stockItemId = String(id);
        const stockItemQuery = supabase.from('simple_items').select('*');
        const { data: inventoryItem, error: inventoryItemError } = /^\d+$/.test(stockItemId)
          ? await stockItemQuery.or(`id.eq.${stockItemId},sku.eq.${stockItemId}`)
          : await stockItemQuery.eq('sku', stockItemId).maybeSingle();
        data = inventoryItem || { id, type, message: 'Stock movement row. Open the selected record for full ledger fields.' };
        error = inventoryItemError && inventoryItemError.code !== 'PGRST116' ? inventoryItemError : null;
        break;

      case 'sold_item':
        data = { id, type, message: 'Sold item analysis rows are aggregated from completed restaurant and bar orders.' };
        error = null;
        break;

      default:
        data = { id, type, message: 'No deep-detail route is configured for this audit entity type. Review the selected record fields.' };
        error = null;
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
      creator_name: 'Unknown',
      creator_email: null,
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
    const effectiveBranchId = (req as any).user?.branch_id || branch_id;

    logger.info('Fetching staff audit with filters:', { branch_id: effectiveBranchId, start_date, end_date, staff_id });

    let staffProfilesQuery = supabase
      .from('staff_profiles')
      .select('*');

    if (effectiveBranchId && effectiveBranchId !== 'all') {
      staffProfilesQuery = staffProfilesQuery.eq('branch_id', effectiveBranchId);
    }

    if (staff_id && staff_id !== 'all') {
      staffProfilesQuery = staffProfilesQuery.eq('id', staff_id);
    }

    const { data: staffProfiles, error: staffProfilesError } = await staffProfilesQuery;

    if (staffProfilesError) {
      logger.error('Error fetching staff profiles for staff audit:', staffProfilesError);
      throw staffProfilesError;
    }

    const branchIds = [...new Set((staffProfiles || [])
      .map((staff: any) => staff.branch_id)
      .filter(Boolean))];
    const { data: branches, error: branchesError } = branchIds.length
      ? await supabase.from('branches').select('id, name, code').in('id', branchIds)
      : { data: [], error: null };

    if (branchesError) {
      logger.error('Error fetching branches for staff audit:', branchesError);
      throw branchesError;
    }

    const branchMap = new Map((branches || []).map((branch: any) => [branch.id, branch]));

    const profileMap = new Map((staffProfiles || []).map((staff: any) => [staff.id, staff]));
    const profileByUserId = new Map(
      (staffProfiles || [])
        .filter((staff: any) => Boolean(staff.user_id))
        .map((staff: any) => [staff.user_id, staff])
    );
    const staffIds = (staffProfiles || []).map((staff: any) => staff.id).filter(Boolean);
    const staffUserIds = Array.from(profileByUserId.keys()).filter(Boolean);

    if (staffIds.length === 0) {
      res.status(200).json({
        success: true,
        count: 0,
        data: [],
        summary: []
      });
      return;
    }

    let creditQuery = supabase
      .from('staff_credit_bills')
      .select('*')
      .in('staff_id', staffIds);

    let advancesQuery = supabase
      .from('staff_advances')
      .select('*')
      .in('staff_id', staffIds);

    let loansQuery = supabase
      .from('staff_loans')
      .select('*')
      .in('staff_id', staffIds);

    const [
      { data: creditBills, error: creditError },
      { data: advances, error: advancesError },
      { data: loans, error: loansError }
    ] = await Promise.all([
      creditQuery,
      advancesQuery,
      loansQuery
    ]);

    if (creditError) {
      logger.error('Error fetching credit bills:', creditError);
      throw creditError;
    }

    if (advancesError) {
      logger.error('Error fetching advances:', advancesError);
      throw advancesError;
    }

    if (loansError) {
      logger.error('Error fetching loans:', loansError);
      throw loansError;
    }

    let unpaidBillsByWaiter: any[] = [];
    let unpaidBillsByCustomer: any[] = [];
    const unpaidBillLookupStrategies = [
      { label: 'user_id', ids: staffUserIds },
      { label: 'staff_profile_id', ids: staffIds }
    ].filter((strategy, index, strategies) => {
      if (strategy.ids.length === 0) {
        return false;
      }

      return strategies.findIndex(other => JSON.stringify(other.ids) === JSON.stringify(strategy.ids)) === index;
    });

    for (const strategy of unpaidBillLookupStrategies) {
      const queryVariants = [
        {
          label: 'status-filtered',
          build: (column: 'waiter_id' | 'customer_id') => supabase
            .from('unpaid_bills')
            .select('*')
            .in(column, strategy.ids)
            .eq('status', 'unpaid')
        },
        {
          label: 'without-status',
          build: (column: 'waiter_id' | 'customer_id') => supabase
            .from('unpaid_bills')
            .select('*')
            .in(column, strategy.ids)
        }
      ];

      let resolved = false;

      for (const variant of queryVariants) {
        const [waiterResult, customerResult] = await Promise.all([
          variant.build('waiter_id'),
          variant.build('customer_id')
        ]);

        if (!waiterResult.error && !customerResult.error) {
          unpaidBillsByWaiter = waiterResult.data || [];
          unpaidBillsByCustomer = customerResult.data || [];
          resolved = true;
          break;
        }

        logger.warn('Staff audit unpaid bills lookup failed, trying fallback strategy', {
          lookup: strategy.label,
          variant: variant.label,
          waiterError: waiterResult.error?.message || waiterResult.error,
          customerError: customerResult.error?.message || customerResult.error
        });
      }

      if (resolved) {
        break;
      }
    }

    const unpaidBillMap = new Map<string, any>();

    [...(unpaidBillsByWaiter || []), ...(unpaidBillsByCustomer || [])].forEach((bill: any) => {
      if (!unpaidBillMap.has(bill.id)) {
        unpaidBillMap.set(bill.id, bill);
      }
    });

    const unifiedRecords: any[] = [];

    const getStaffProfile = (recordStaffId?: string | null) => {
      if (!recordStaffId) {
        return null;
      }

      return profileMap.get(recordStaffId) || null;
    };

    const buildStaffDetails = (staffProfile: any) => {
      const staffName = staffProfile
        ? `${staffProfile.first_name || staffProfile.firstName || ''} ${staffProfile.last_name || staffProfile.lastName || ''}`.trim()
          || staffProfile.full_name
          || staffProfile.name
          || staffProfile.email
          || 'â€”'
        : 'â€”';

      return {
        staff_name: staffName,
        staff_role: staffProfile?.role || staffProfile?.position || null,
        role: staffProfile?.role || staffProfile?.position || null,
        staff_department: staffProfile?.department || null,
        staff_code: staffProfile?.employee_id || staffProfile?.staff_code || staffProfile?.id_number || staffProfile?.national_id || null,
        staff_phone: staffProfile?.phone || staffProfile?.phone_number || null,
        branch_id: staffProfile?.branch_id || null,
        branch_name: staffProfile?.branch_id ? branchMap.get(staffProfile.branch_id)?.name || null : null
      };
    };

    const isWithinDateRange = (value?: string | null) => {
      if (!value) {
        return !start_date && !end_date;
      }

      const recordDate = new Date(value);
      if (Number.isNaN(recordDate.getTime())) {
        return !start_date && !end_date;
      }

      if (start_date) {
        const from = new Date(`${start_date}T00:00:00`);
        if (recordDate < from) {
          return false;
        }
      }

      if (end_date) {
        const to = new Date(`${end_date}T23:59:59`);
        if (recordDate > to) {
          return false;
        }
      }

      return true;
    };

    const numberValue = (value: any) => {
      const parsed = Number(value || 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const isSettledCreditStatus = (status: any, isPaid?: any) => {
      const normalized = String(status || '').toLowerCase();
      return Boolean(isPaid) || ['paid', 'paid_cash', 'deducted', 'cancelled'].includes(normalized);
    };

    const creditOutstandingAmount = (bill: any) => {
      const amount = numberValue(bill.amount);
      if (isSettledCreditStatus(bill.status, bill.is_paid)) {
        return 0;
      }
      if (bill.balance !== null && bill.balance !== undefined) {
        return Math.max(0, numberValue(bill.balance));
      }
      if (bill.balance_amount !== null && bill.balance_amount !== undefined) {
        return Math.max(0, numberValue(bill.balance_amount));
      }
      return Math.max(0, amount - numberValue(bill.paid_amount));
    };

    const advanceOutstandingAmount = (advance: any) => {
      const status = String(advance.status || '').toLowerCase();
      if (['deducted', 'paid', 'paid_cash', 'cancelled', 'rejected'].includes(status)) {
        return 0;
      }
      return Math.max(0, numberValue(advance.balance ?? advance.balance_amount ?? advance.amount));
    };

    const loanOutstandingAmount = (loan: any) => {
      const status = String(loan.status || '').toLowerCase();
      if (['closed', 'paid', 'deducted', 'cancelled', 'rejected'].includes(status)) {
        return 0;
      }
      return Math.max(0, numberValue(loan.remaining_balance ?? loan.balance ?? loan.total_amount));
    };

    creditBills?.forEach((bill: any) => {
      if (!isWithinDateRange(bill.bill_date || bill.created_at)) {
        return;
      }

      const staffProfile = getStaffProfile(bill.staff_id);
      const amount = numberValue(bill.amount);
      const outstandingAmount = creditOutstandingAmount(bill);
      unifiedRecords.push({
        id: bill.id,
        date: bill.bill_date,
        type: 'Credit Bill',
        amount,
        staff_id: bill.staff_id,
        description: bill.description || 'Staff credit bill',
        action: 'Credit Bill',
        status: outstandingAmount <= 0
          ? 'Paid'
          : bill.status === 'pending'
            ? 'Unpaid'
            : bill.status === 'deducted'
              ? 'Deducted'
              : bill.status === 'paid_cash'
                ? 'Paid'
                : bill.status || 'Unpaid',
        reference: (bill.id || '').substring(0, 8).toUpperCase(),
        created_at: bill.created_at || bill.bill_date,
        outstanding_amount: outstandingAmount,
        paid_amount: Math.max(0, amount - outstandingAmount),
        original_record: bill,
        ...buildStaffDetails(staffProfile)
      });
    });

    advances?.forEach((adv: any) => {
      if (!isWithinDateRange(adv.advance_date || adv.created_at)) {
        return;
      }

      const staffProfile = getStaffProfile(adv.staff_id);
      const outstandingAmount = advanceOutstandingAmount(adv);
      unifiedRecords.push({
        id: adv.id,
        date: adv.advance_date || adv.created_at,
        type: 'Advance',
        amount: numberValue(adv.amount),
        staff_id: adv.staff_id,
        description: adv.reason || 'Salary advance',
        action: 'Advance',
        status: adv.status,
        reference: (adv.id || '').substring(0, 8).toUpperCase(),
        created_at: adv.created_at || adv.advance_date,
        auditor_id: adv.auditor_id,
        auditor_confirmed_at: adv.auditor_confirmed_at,
        outstanding_amount: outstandingAmount,
        original_record: adv,
        ...buildStaffDetails(staffProfile)
      });
    });

    loans?.forEach((loan: any) => {
      if (!isWithinDateRange(loan.loan_date || loan.created_at)) {
        return;
      }

      const staffProfile = getStaffProfile(loan.staff_id);
      const outstandingAmount = loanOutstandingAmount(loan);
      unifiedRecords.push({
        id: loan.id,
        date: loan.loan_date || loan.created_at,
        type: 'Loan',
        amount: numberValue(loan.total_amount || loan.amount),
        staff_id: loan.staff_id,
        description: loan.reason || 'Staff loan',
        action: 'Loan',
        status: loan.status,
        reference: (loan.id || '').substring(0, 8).toUpperCase(),
        created_at: loan.created_at || loan.loan_date,
        auditor_id: loan.auditor_id,
        auditor_confirmed_at: loan.auditor_confirmed_at,
        outstanding_amount: outstandingAmount,
        original_record: loan,
        ...buildStaffDetails(staffProfile)
      });
    });

    Array.from(unpaidBillMap.values()).forEach((bill: any) => {
      if (!isWithinDateRange(bill.bill_date || bill.created_at)) {
        return;
      }

      const associatedStaffProfile = profileMap.get(bill.staff_id)
        || profileMap.get(bill.customer_id)
        || profileMap.get(bill.waiter_id)
        || profileByUserId.get(bill.customer_id)
        || profileByUserId.get(bill.waiter_id)
        || null;
      const associatedStaffId = associatedStaffProfile?.id || bill.staff_id || null;
      const staffProfile = associatedStaffProfile || getStaffProfile(associatedStaffId);

      if (!staffProfile) {
        return;
      }

      const normalizedStatus = String(bill.status || '').toLowerCase();
      const outstandingAmount = numberValue(bill.balance_amount ?? bill.amount ?? bill.total_amount ?? 0);

      if (normalizedStatus && !['unpaid', 'partial', 'overdue'].includes(normalizedStatus) && outstandingAmount <= 0) {
        return;
      }

      unifiedRecords.push({
        id: bill.id,
        date: bill.bill_date || bill.created_at,
        type: 'Unpaid Bill',
        amount: outstandingAmount,
        staff_id: associatedStaffId,
        description: `POS unpaid bill${bill.customer_name ? ` - ${bill.customer_name}` : ''}`,
        action: 'Unpaid Bill',
        status: bill.status || 'unpaid',
        reference: bill.bill_number || (bill.id || '').substring(0, 8).toUpperCase(),
        created_at: bill.created_at || bill.bill_date,
        auditor_id: bill.auditor_id,
        outstanding_amount: outstandingAmount,
        linked_party_name: bill.customer_name || null,
        original_record: bill,
        ...buildStaffDetails(staffProfile)
      });
    });

    unifiedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const staffSummary: Record<string, any> = {};

    (staffProfiles || []).forEach((staff: any) => {
      const staffName = `${staff.first_name || staff.firstName || ''} ${staff.last_name || staff.lastName || ''}`.trim()
        || staff.full_name
        || staff.name
        || staff.email
        || 'â€”';
      staffSummary[staff.id] = {
        staff_id: staff.id,
        staff_name: staffName,
        employee_id: staff.employee_id || staff.staff_code || staff.id_number || staff.national_id || null,
        national_id: staff.national_id || staff.id_number || null,
        department: staff.department || null,
        role: staff.role || staff.position || null,
        phone: staff.phone || staff.phone_number || null,
        branch_id: staff.branch_id || null,
        branch_name: staff.branch_id ? branchMap.get(staff.branch_id)?.name || null : null,
        salary: numberValue(staff.basic_salary ?? staff.salary ?? staff.monthly_salary ?? staff.gross_salary),
        total_credit_bills: 0,
        outstanding_credit_bills: 0,
        total_advances: 0,
        outstanding_advances: 0,
        total_loans: 0,
        outstanding_loans: 0,
        total_unpaid_bills: 0,
        outstanding_balance: 0,
        net_payable: 0
      };
    });

    unifiedRecords.forEach(record => {
      if (!record.staff_id || !staffSummary[record.staff_id]) {
        return;
      }

      const summary = staffSummary[record.staff_id];
      if (record.type === 'Credit Bill') {
        summary.total_credit_bills += Number(record.amount || 0);
        summary.outstanding_credit_bills += Number(record.outstanding_amount || 0);
        summary.outstanding_balance += Number(record.outstanding_amount || 0);
      } else if (record.type === 'Advance') {
        summary.total_advances += Number(record.amount || 0);
        summary.outstanding_advances += Number(record.outstanding_amount || 0);
        summary.outstanding_balance += Number(record.outstanding_amount || 0);
      } else if (record.type === 'Loan') {
        summary.total_loans += Number(record.amount || 0);
        summary.outstanding_loans += Number(record.outstanding_amount || 0);
        summary.outstanding_balance += Number(record.outstanding_amount || 0);
      } else if (record.type === 'Unpaid Bill') {
        summary.total_unpaid_bills += Number(record.amount || 0);
        summary.outstanding_balance += Number(record.outstanding_amount || 0);
      }
    });

    Object.values(staffSummary).forEach((summary: any) => {
      summary.net_payable = Math.max(0, numberValue(summary.salary) - numberValue(summary.outstanding_balance));
    });

    res.status(200).json({
      success: true,
      count: unifiedRecords.length,
      data: unifiedRecords,
      summary: Object.values(staffSummary).sort((a: any, b: any) => a.staff_name.localeCompare(b.staff_name))
    });
  } catch (error) {
    logger.error('Error fetching staff audit:', error);
    next(error);
  }
};
