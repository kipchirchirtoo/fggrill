import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { isGlobalRole } from '../utils/branchIsolation';

// ============================================================================
// Branch outbound payments — initiate, approve (maker-checker + threshold
// director sign-off), release, with a forensic audit trail.
// ============================================================================

// Payments above this (in branch currency) require Director sign-off.
const DIRECTOR_THRESHOLD = Number(process.env.BRANCH_PAYMENT_DIRECTOR_THRESHOLD || 50000);

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const resolveBranchId = (req: Request): number | null => {
  const role = (req as any).user?.role;
  const userBranch = (req as any).user?.branch_id;
  const queryBranch = req.query.branch_id ?? (req.body && req.body.branch_id);
  if (isGlobalRole(role)) {
    const q = parseInt(String(queryBranch), 10);
    if (Number.isFinite(q) && q > 0) return q;
    const ub = parseInt(String(userBranch), 10);
    return Number.isFinite(ub) && ub > 0 ? ub : null;
  }
  const ub = parseInt(String(userBranch), 10);
  return Number.isFinite(ub) && ub > 0 ? ub : null;
};

const actorName = (req: Request): string => {
  const u = (req as any).user || {};
  return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email || 'User';
};

const writeAudit = async (
  paymentId: string,
  action: string,
  req: Request,
  details: Record<string, any> = {}
): Promise<void> => {
  try {
    await supabase.from('branch_payment_audit').insert({
      payment_id: paymentId,
      action,
      actor_id: (req as any).user?.id || null,
      actor_name: actorName(req),
      actor_role: (req as any).user?.role || null,
      ip_address: req.ip || req.headers['x-forwarded-for']?.toString() || null,
      details,
    });
  } catch (e) {
    logger.warn('branch_payment_audit insert failed', e as any);
  }
};

// @desc    Initiate an outbound branch payment (Branch Accountant = maker)
// @route   POST /api/branch-payments
export const createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'No branch context available' });
      return;
    }
    const {
      category, payment_method, payee_name, payee_account, amount, currency,
      description, reference, receipt_url, po_id, grn_id, invoice_id,
    } = req.body || {};

    if (!category || !payment_method || !payee_name) {
      res.status(400).json({ success: false, message: 'category, payment_method and payee_name are required' });
      return;
    }
    const amt = num(amount);
    if (amt <= 0) {
      res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
      return;
    }

    const paymentNumber = `FGP-${branchId}-${Date.now().toString().slice(-8)}`;
    const requiresDirector = amt > DIRECTOR_THRESHOLD;

    const { data, error } = await supabase
      .from('branch_payments')
      .insert([{
        branch_id: branchId,
        payment_number: paymentNumber,
        category,
        payment_method,
        payee_name,
        payee_account: payee_account || null,
        amount: amt,
        currency: currency || 'KES',
        description: description || null,
        reference: reference || null,
        receipt_url: receipt_url || null,
        po_id: po_id || null,
        grn_id: grn_id || null,
        invoice_id: invoice_id || null,
        status: 'pending',
        requires_director: requiresDirector,
        created_by: (req as any).user?.id || null,
        created_by_name: actorName(req),
      }])
      .select()
      .single();
    if (error) throw error;

    await writeAudit(data.id, 'created', req, { amount: amt, requires_director: requiresDirector });
    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error('createPayment failed:', error);
    next(error);
  }
};

// @desc    List branch payments (branch-scoped; global roles see all/by branch)
// @route   GET /api/branch-payments?status=&branch_id=
export const listPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = String((req as any).user?.role || '');
    let query = supabase.from('branch_payments').select('*').order('created_at', { ascending: false });

    // Branch isolation: non-global roles only see their own branch.
    if (!isGlobalRole(role)) {
      const ub = (req as any).user?.branch_id;
      if (ub) query = query.eq('branch_id', ub);
    } else if (req.query.branch_id) {
      query = query.eq('branch_id', req.query.branch_id);
    }
    if (req.query.status && req.query.status !== 'all') {
      query = query.eq('status', req.query.status);
    }
    const { data, error } = await query.limit(300);
    if (error) throw error;

    const list = (data || []) as Array<Record<string, any>>;
    const summary = {
      total: list.length,
      pending: list.filter((p) => p.status === 'pending').length,
      awaiting_director: list.filter((p) => p.status === 'manager_approved' && p.requires_director).length,
      released: list.filter((p) => p.status === 'released').length,
      total_outflow: list.filter((p) => p.status === 'released').reduce((s, p) => s + num(p.amount), 0),
      pending_value: list
        .filter((p) => ['pending', 'manager_approved', 'director_approved'].includes(p.status))
        .reduce((s, p) => s + num(p.amount), 0),
    };

    res.status(200).json({ success: true, data: list, summary });
  } catch (error) {
    logger.error('listPayments failed:', error);
    next(error);
  }
};

// @desc    Single payment + audit trail (three-way match docs included)
// @route   GET /api/branch-payments/:id
export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('branch_payments').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }
    if (!isGlobalRole((req as any).user?.role)) {
      const ub = (req as any).user?.branch_id;
      if (ub && Number(data.branch_id) !== Number(ub)) {
        res.status(404).json({ success: false, message: 'Payment not found in your branch' });
        return;
      }
    }
    const { data: audit } = await supabase
      .from('branch_payment_audit').select('*').eq('payment_id', req.params.id)
      .order('created_at', { ascending: true });

    res.status(200).json({ success: true, data: { ...data, audit_trail: audit || [] } });
  } catch (error) {
    logger.error('getPayment failed:', error);
    next(error);
  }
};

const loadForAction = async (req: Request, res: Response): Promise<Record<string, any> | null> => {
  const { data, error } = await supabase
    .from('branch_payments').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return null;
  }
  if (!isGlobalRole((req as any).user?.role)) {
    const ub = (req as any).user?.branch_id;
    if (ub && Number(data.branch_id) !== Number(ub)) {
      res.status(404).json({ success: false, message: 'Payment not found in your branch' });
      return null;
    }
  }
  // Maker-checker: the creator may never approve/release/their own payment.
  if (data.created_by && data.created_by === (req as any).user?.id) {
    res.status(403).json({ success: false, message: 'Maker-checker: you cannot approve a payment you created' });
    return null;
  }
  return data;
};

// @desc    Manager / Director approval step
// @route   PUT /api/branch-payments/:id/approve  body: { role: 'manager'|'director' }
export const approvePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userRole = String((req as any).user?.role || '').toLowerCase();
    const asDirector = req.body?.role === 'director' || ['director', 'super_admin'].includes(userRole);
    const bill = await loadForAction(req, res);
    if (!bill) return;
    if (['released', 'rejected'].includes(bill.status)) {
      res.status(400).json({ success: false, message: `Payment already ${bill.status}` });
      return;
    }

    const now = new Date().toISOString();
    const update: Record<string, any> = { updated_at: now };
    let action: string;

    if (asDirector) {
      if (!bill.requires_director) {
        res.status(400).json({ success: false, message: 'This payment does not require director sign-off' });
        return;
      }
      if (bill.status !== 'manager_approved') {
        res.status(400).json({ success: false, message: 'Manager approval is required before the director can sign off' });
        return;
      }
      update.status = 'director_approved';
      update.director_id = (req as any).user?.id;
      update.director_approved_at = now;
      action = 'director_approved';
    } else {
      if (bill.status !== 'pending') {
        res.status(400).json({ success: false, message: `Cannot approve a payment that is ${bill.status}` });
        return;
      }
      update.status = 'manager_approved';
      update.manager_id = (req as any).user?.id;
      update.manager_approved_at = now;
      action = 'manager_approved';
    }

    const { data, error } = await supabase
      .from('branch_payments').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req.params.id, action, req);
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('approvePayment failed:', error);
    next(error);
  }
};

// @desc    Release the funds (Treasury / Director / Finance Manager)
// @route   PUT /api/branch-payments/:id/release
export const releasePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bill = await loadForAction(req, res);
    if (!bill) return;
    const ready = bill.requires_director
      ? bill.status === 'director_approved'
      : bill.status === 'manager_approved';
    if (!ready) {
      res.status(400).json({
        success: false,
        message: bill.requires_director
          ? 'Payment must be approved by the manager and director before release'
          : 'Payment must be approved by the manager before release',
      });
      return;
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('branch_payments')
      .update({ status: 'released', released_by: (req as any).user?.id, released_at: now, updated_at: now })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req.params.id, 'released', req, { amount: num(bill.amount) });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('releasePayment failed:', error);
    next(error);
  }
};

// @desc    Reject a payment with a reason
// @route   PUT /api/branch-payments/:id/reject  body: { reason }
export const rejectPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bill = await loadForAction(req, res);
    if (!bill) return;
    if (['released', 'rejected'].includes(bill.status)) {
      res.status(400).json({ success: false, message: `Payment already ${bill.status}` });
      return;
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('branch_payments')
      .update({
        status: 'rejected',
        rejected_by: (req as any).user?.id,
        rejected_at: now,
        rejection_reason: req.body?.reason || null,
        updated_at: now,
      })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req.params.id, 'rejected', req, { reason: req.body?.reason || null });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('rejectPayment failed:', error);
    next(error);
  }
};
