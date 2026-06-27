import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { isGlobalRole } from '../utils/branchIsolation';

// Branch Accountant — Cashier Void Audit. Read-only drill-down over void
// activity compiled per closed cashier shift (see compileShiftVoidAudit in
// cashier-void-audit.service.ts, called from cashier-shifts.controller.ts
// closeShift()). The accountant cannot edit void records here — only
// mark-reviewed / flag-for-manager / add-note against the shift summary.

const VOID_AUDIT_ROLES = new Set([
  'super_admin', 'general_manager', 'director', 'auditor',
  'finance_manager', 'accountant', 'branch_accountant', 'branch_manager'
]);

const assertVoidAuditAccess = (req: Request): void => {
  if (!req.user?.id) throw new AppError('Authentication required', 401);
  if (!VOID_AUDIT_ROLES.has(String(req.user.role || '').toLowerCase())) {
    throw new AppError('Forbidden: accountant or manager role required', 403);
  }
};

const ensureBranchAccess = (req: Request, branchId: unknown): void => {
  if (isGlobalRole(req.user?.role)) return;
  if (Number(req.user?.branch_id) !== Number(branchId)) {
    throw new AppError('Forbidden: shift belongs to another branch', 403);
  }
};

const n = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fullName = (user: any): string => {
  if (!user) return 'Unknown';
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return name || user.email || 'Unknown';
};

export const listVoidAudits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertVoidAuditAccess(req);
    let query = supabase
      .from('cashier_shift_void_audits')
      .select('*')
      .order('shift_closed_at', { ascending: false });

    if (!isGlobalRole(req.user?.role)) {
      query = query.eq('branch_id', req.user!.branch_id);
    } else if (req.query.branch_id) {
      query = query.eq('branch_id', Number(req.query.branch_id));
    }
    if (req.query.status) {
      query = query.eq('status', String(req.query.status));
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const cashierIds = [...new Set(rows.map((r: any) => r.cashier_id).filter(Boolean))];
    const branchIds = [...new Set(rows.map((r: any) => r.branch_id).filter(Boolean))];
    const [{ data: cashiers }, { data: branches }] = await Promise.all([
      cashierIds.length ? supabase.from('users').select('id, first_name, last_name, email').in('id', cashierIds) : Promise.resolve({ data: [] as any[] }),
      branchIds.length ? supabase.from('branches').select('id, name').in('id', branchIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const cashiersById = new Map((cashiers || []).map((c: any) => [c.id, c]));
    const branchesById = new Map((branches || []).map((b: any) => [b.id, b]));

    res.json({
      success: true,
      data: rows.map((row: any) => ({
        ...row,
        cashier_name: fullName(cashiersById.get(row.cashier_id)),
        branch_name: branchesById.get(row.branch_id)?.name || null,
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const getVoidAuditDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertVoidAuditAccess(req);
    const { id } = req.params;

    const { data: auditRow, error } = await supabase
      .from('cashier_shift_void_audits')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !auditRow) throw new AppError('Void audit not found', 404);
    ensureBranchAccess(req, auditRow.branch_id);

    const outletShiftIds: string[] = auditRow.outlet_shift_ids || [];

    const [wholeBillResult, itemVoidResult] = await Promise.all([
      outletShiftIds.length
        ? supabase.from('pos_void_requests').select('*').in('shift_id', outletShiftIds).eq('status', 'approved')
        : Promise.resolve({ data: [] as any[], error: null }),
      outletShiftIds.length
        ? supabase.from('pos_item_void_log').select('*').in('shift_id', outletShiftIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    if (wholeBillResult.error) throw wholeBillResult.error;
    if (itemVoidResult.error) throw itemVoidResult.error;

    const wholeBillRows = wholeBillResult.data || [];
    const itemVoidRows = itemVoidResult.data || [];

    const { data: auditDetails } = wholeBillRows.length
      ? await supabase.from('void_bills_audit').select('*').in('void_id', wholeBillRows.map((r: any) => r.id)).eq('action', 'cashier_void')
      : { data: [] as any[] };
    const detailsByVoidId = new Map((auditDetails || []).map((d: any) => [d.void_id, d.details || {}]));

    const actorIds = new Set<string>();
    wholeBillRows.forEach((r: any) => { if (r.requested_by) actorIds.add(r.requested_by); if (r.reviewed_by) actorIds.add(r.reviewed_by); });
    itemVoidRows.forEach((r: any) => { if (r.requested_by) actorIds.add(r.requested_by); if (r.authorized_by) actorIds.add(r.authorized_by); });
    const { data: actors } = actorIds.size
      ? await supabase.from('users').select('id, first_name, last_name, email, employee_number').in('id', Array.from(actorIds))
      : { data: [] as any[] };
    const actorsById = new Map((actors || []).map((a: any) => [a.id, a]));

    type VoidRecord = {
      void_timestamp: string | null;
      bill_shortcode: string | null;
      bill_number: string | null;
      void_type: 'FULL_BILL' | 'LINE_ITEM';
      server_name: string;
      items_voided: Array<{ item_name: string; qty: number; unit_price: number; line_total: number }>;
      original_bill_total: number;
      revised_bill_total: number;
      value_lost: number;
      reason_category: string | null;
      reason: string | null;
      notes: string | null;
      cashier_who_voided: string;
      cashier_employee_id: string | null;
    };

    const records: VoidRecord[] = [];

    for (const row of wholeBillRows) {
      const detail = detailsByVoidId.get(row.id) || {};
      const originalTotal = n(detail.original_total);
      records.push({
        void_timestamp: row.reviewed_at || row.updated_at,
        bill_shortcode: detail.short_code || null,
        bill_number: row.order_number,
        void_type: 'FULL_BILL',
        server_name: detail.waiter_name || 'Unknown',
        items_voided: Array.isArray(detail.items_snapshot)
          ? detail.items_snapshot.map((it: any) => ({
              item_name: it.name || it.item_name || 'Item',
              qty: n(it.quantity ?? it.qty),
              unit_price: n(it.unit_price ?? it.price),
              line_total: n(it.quantity ?? it.qty) * n(it.unit_price ?? it.price),
            }))
          : [],
        original_bill_total: originalTotal,
        revised_bill_total: 0,
        value_lost: originalTotal,
        reason_category: row.reason_category || null,
        reason: row.reason || null,
        notes: row.reason_category === 'other' ? row.reason : null,
        cashier_who_voided: fullName(actorsById.get(row.reviewed_by)),
        cashier_employee_id: actorsById.get(row.reviewed_by)?.employee_number || null,
      });
    }

    const orderIdsForItems = [...new Set(itemVoidRows.map((r: any) => r.order_id).filter(Boolean))];
    const { data: ordersForItems } = orderIdsForItems.length
      ? await supabase.from('pos_shift_orders').select('id, waiter_name, total_amount').in('id', orderIdsForItems)
      : { data: [] as any[] };
    const ordersById = new Map((ordersForItems || []).map((o: any) => [o.id, o]));

    for (const row of itemVoidRows) {
      const order = ordersById.get(row.order_id);
      const lineTotal = n(row.amount_voided);
      records.push({
        void_timestamp: row.voided_at,
        bill_shortcode: row.bill_code || null,
        bill_number: order ? null : null,
        void_type: 'LINE_ITEM',
        server_name: order?.waiter_name || 'Unknown',
        items_voided: [{ item_name: row.item_name, qty: n(row.qty_voided), unit_price: n(row.unit_price), line_total: lineTotal }],
        original_bill_total: n(order?.total_amount) + lineTotal,
        revised_bill_total: n(order?.total_amount),
        value_lost: lineTotal,
        reason_category: row.reason_category || null,
        reason: row.void_reason || null,
        notes: row.reason_category === 'other' ? row.void_reason : null,
        cashier_who_voided: fullName(actorsById.get(row.authorized_by)),
        cashier_employee_id: actorsById.get(row.authorized_by)?.employee_number || null,
      });
    }

    records.sort((a, b) => new Date(a.void_timestamp || 0).getTime() - new Date(b.void_timestamp || 0).getTime());

    // Per-server breakdown with review-flag threshold.
    const REVIEW_FLAG_VALUE_THRESHOLD = 500;
    const REVIEW_FLAG_COUNT_THRESHOLD = 3;
    const perServer = new Map<string, { server_name: string; count: number; value: number }>();
    for (const rec of records) {
      const key = rec.server_name;
      const existing = perServer.get(key) || { server_name: key, count: 0, value: 0 };
      existing.count += 1;
      existing.value += rec.value_lost;
      perServer.set(key, existing);
    }
    const perServerBreakdown = Array.from(perServer.values()).map((row) => ({
      ...row,
      flagged: row.value > REVIEW_FLAG_VALUE_THRESHOLD || row.count >= REVIEW_FLAG_COUNT_THRESHOLD,
    }));

    // Per-reason breakdown, with "other" notes surfaced inline.
    const perReason = new Map<string, { reason_category: string; count: number; value: number; notes: string[] }>();
    for (const rec of records) {
      const key = rec.reason_category || 'uncategorized';
      const existing = perReason.get(key) || { reason_category: key, count: 0, value: 0, notes: [] as string[] };
      existing.count += 1;
      existing.value += rec.value_lost;
      if (key === 'other' && rec.notes) existing.notes.push(rec.notes);
      perReason.set(key, existing);
    }

    res.json({
      success: true,
      data: {
        ...auditRow,
        records,
        per_server: perServerBreakdown,
        per_reason: Array.from(perReason.values()),
      }
    });
  } catch (error) {
    next(error);
  }
};

const loadAuditForAction = async (req: Request) => {
  const { id } = req.params;
  const { data: auditRow, error } = await supabase
    .from('cashier_shift_void_audits')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !auditRow) throw new AppError('Void audit not found', 404);
  ensureBranchAccess(req, auditRow.branch_id);
  return auditRow;
};

export const markVoidAuditReviewed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertVoidAuditAccess(req);
    const auditRow = await loadAuditForAction(req);
    const outletShiftIds: string[] = auditRow.outlet_shift_ids || [];

    // Cannot mark reviewed if any void record has an empty reason — this should
    // already be impossible (reason is mandatory at submission time in both
    // cashierVoidWholeBill/cashierVoidLineItems), but enforced again here as the
    // spec requires.
    const [{ data: wholeBillRows }, { data: itemVoidRows }] = await Promise.all([
      outletShiftIds.length
        ? supabase.from('pos_void_requests').select('id, reason').in('shift_id', outletShiftIds).eq('status', 'approved')
        : Promise.resolve({ data: [] as any[] }),
      outletShiftIds.length
        ? supabase.from('pos_item_void_log').select('id, void_reason').in('shift_id', outletShiftIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const hasEmptyReason =
      (wholeBillRows || []).some((r: any) => !String(r.reason || '').trim()) ||
      (itemVoidRows || []).some((r: any) => !String(r.void_reason || '').trim());
    if (hasEmptyReason) {
      throw new AppError('Cannot mark reviewed: one or more void records have no reason recorded', 400);
    }

    const { data, error } = await supabase
      .from('cashier_shift_void_audits')
      .update({ status: 'reviewed', reviewed_by: req.user!.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', auditRow.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const flagVoidAuditForManager = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertVoidAuditAccess(req);
    const auditRow = await loadAuditForAction(req);
    const { data, error } = await supabase
      .from('cashier_shift_void_audits')
      .update({ status: 'flagged', flagged_by: req.user!.id, flagged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', auditRow.id)
      .select('*')
      .single();
    if (error) throw error;
    logger.info('Void audit flagged for branch manager', { auditId: auditRow.id, flaggedBy: req.user!.id });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const addVoidAuditNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    assertVoidAuditAccess(req);
    const auditRow = await loadAuditForAction(req);
    if (String(auditRow.accountant_note || '').trim()) {
      throw new AppError('A note is already recorded against this shift audit and cannot be edited', 400);
    }
    const note = String(req.body.note || '').trim();
    if (!note) throw new AppError('note is required', 400);

    const { data, error } = await supabase
      .from('cashier_shift_void_audits')
      .update({ accountant_note: note, updated_at: new Date().toISOString() })
      .eq('id', auditRow.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
