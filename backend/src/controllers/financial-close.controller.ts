/**
 * Financial Close Controller
 *
 * Flow:
 *  1. Accountant fills workspace → clicks Submit
 *  2. POST /workspace/close  → system generates its own snapshot on-demand,
 *     runs variance engine, returns analysis to accountant
 *  3. Accountant sees variance. If negative → must provide reason.
 *  4. Accountant clicks Post → POST /workspace/submissions/:id/post
 *     This sends to BOTH Auditor AND Director.
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import {
  computeVarianceAnalysis,
  generateBranchDailySnapshot,
} from '../services/daily-financial-engine.service';
import notificationService from '../services/notification.service';

const n = (v: any): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

const asyncWrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const userId = (req: Request) => String((req as any).user?.id || '');
const branchId = (req: Request): number => {
  const raw = (req as any).user?.branch_id ?? req.body.branch_id ?? req.query.branch_id;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed === 0) throw new AppError('Branch ID required', 400);
  return parsed;
};

// ── POST /api/finance/workspace/close ────────────────────────────────────────
// Step 1: Accountant clicks Submit.
// System generates its own workspace from operational data on-demand,
// runs variance engine, and returns comparison to the accountant.
// Nothing is sent to auditor/director yet.
export const submitWorkspaceClose = asyncWrap(async (req, res) => {
  const actor = userId(req);
  const branch = branchId(req);
  const { record_date, submitted_revenue, submitted_cogs, submitted_expenses, submitted_net_profit, submitted_cash, submitted_banked, submitted_unbanked } = req.body;

  if (!record_date) throw new AppError('record_date required', 400);

  // Pull the saved daily_financial_record
  const { data: existingRecord, error: fetchErr } = await supabase
    .from('daily_financial_records')
    .select('*')
    .eq('branch_id', branch)
    .eq('record_date', record_date)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  const revenue = n(submitted_revenue ?? existingRecord?.total_revenue);
  const cogs = n(submitted_cogs ?? existingRecord?.total_cogs);
  const expenses = n(submitted_expenses ?? existingRecord?.total_expenses);
  const netProfit = n(submitted_net_profit ?? existingRecord?.net_profit);
  const cash = n(submitted_cash ?? (existingRecord?.payment_data as any)?.cash);
  const banked = n(submitted_banked ?? (existingRecord?.banking_data as any)?.banked);
  const unbanked = n(submitted_unbanked ?? existingRecord?.unbanked_cash);

  // Generate system snapshot on-demand (don't rely only on midnight cron)
  try {
    await generateBranchDailySnapshot(branch, record_date);
  } catch (snapErr) {
    logger.warn(`[FinancialClose] On-demand snapshot failed branch=${branch} date=${record_date}:`, snapErr);
  }

  // Run variance engine
  const variance = await computeVarianceAnalysis({
    branchId: branch,
    date: record_date,
    submittedRevenue: revenue,
    submittedExpenses: expenses,
    submittedNetProfit: netProfit,
    submittedCash: cash,
    submittedBanked: banked,
  });

  // Upsert the workspace submission record
  const { data: submission, error: upsertErr } = await supabase
    .from('financial_workspace_submissions')
    .upsert({
      branch_id: branch,
      record_date,
      submitted_revenue: revenue,
      submitted_cogs: cogs,
      submitted_expenses: expenses,
      submitted_net_profit: netProfit,
      submitted_cash: cash,
      submitted_banked: banked,
      submitted_unbanked: unbanked,
      revenue_variance: variance.revenueVariance,
      cash_variance: variance.cashVariance,
      banking_variance: variance.bankingVariance,
      pos_variance: variance.posVariance,
      payroll_variance: variance.payrollVariance,
      supplier_variance: variance.supplierVariance,
      overall_variance: variance.overallVariance,
      variance_pct: variance.variancePct,
      variance_analysis: variance.smartAnalysis,
      requires_explanation: variance.requiresExplanation,
      status: variance.requiresExplanation ? 'submitted' : 'submitted',
      submitted_by: actor,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'branch_id,record_date' })
    .select()
    .single();

  if (upsertErr) throw upsertErr;

  // Also update the daily_financial_records status to SUBMITTED
  await supabase
    .from('daily_financial_records')
    .upsert({
      branch_id: branch,
      record_date,
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'branch_id,record_date' });

  // Notify auditors if no explanation needed, else wait for explanation
  if (!variance.requiresExplanation) {
    try {
      await notificationService.createNotification({
        title: 'Daily Workspace Submitted',
        message: `Branch ${branch} has submitted their daily financial workspace for ${record_date}. Ready for audit review.`,
        type: 'info',
        category: 'financial_close',
        priority: 'medium',
        role: 'auditor',
        branch_id: branch,
        metadata: { submission_id: submission.id, record_date },
      });
    } catch (notifErr) {
      logger.warn('[FinancialClose] Notification failed:', notifErr);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      submission,
      variance: {
        overall: variance.overallVariance,
        pct: variance.variancePct,
        revenue: variance.revenueVariance,
        cash: variance.cashVariance,
        banking: variance.bankingVariance,
        smart_analysis: variance.smartAnalysis,
      },
      requires_explanation: variance.requiresExplanation,
      message: variance.requiresExplanation
        ? 'Variance detected. Please provide a mandatory explanation before this workspace can proceed to audit.'
        : 'Workspace submitted successfully. Auditor has been notified.',
    },
  });
});

// ── POST /api/finance/workspace/close/:id/explain ────────────────────────────
// Accountant provides mandatory explanation for negative variance
export const submitVarianceExplanation = asyncWrap(async (req, res) => {
  const { id } = req.params;
  const actor = userId(req);
  const { reason, notes, documents } = req.body;

  const VALID_REASONS = [
    'cash_shortage', 'banking_delay', 'inventory_loss', 'revenue_leakage',
    'posting_error', 'fraud_suspected', 'supplier_error', 'payroll_error', 'other',
  ];

  if (!reason || !VALID_REASONS.includes(reason)) {
    throw new AppError(`reason must be one of: ${VALID_REASONS.join(', ')}`, 400);
  }
  if (!notes || String(notes).trim().length < 20) {
    throw new AppError('Explanation notes must be at least 20 characters', 400);
  }

  const { data: submission, error: fetchErr } = await supabase
    .from('financial_workspace_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !submission) throw new AppError('Submission not found', 404);
  if (!submission.requires_explanation) throw new AppError('No explanation required for this submission', 400);

  const { data: updated, error: updateErr } = await supabase
    .from('financial_workspace_submissions')
    .update({
      explanation_reason: reason,
      explanation_notes: notes.trim(),
      explanation_documents: documents || [],
      explanation_submitted_at: new Date().toISOString(),
      status: 'auditor_review',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) throw updateErr;

  // Notify auditors now that explanation is provided
  try {
    await notificationService.createNotification({
      title: 'Financial Variance Explained',
      message: `Branch ${submission.branch_id} has explained a ${submission.overall_variance < 0 ? 'negative' : 'positive'} variance of ${submission.overall_variance} for ${submission.record_date}. Reason: ${reason}. Ready for audit review.`,
      type: 'warning',
      category: 'financial_close',
      priority: 'high',
      role: 'auditor',
      branch_id: submission.branch_id,
      metadata: { submission_id: id, reason, record_date: submission.record_date },
    });
  } catch (notifErr) {
    logger.warn('[FinancialClose] Explanation notification failed:', notifErr);
  }

  res.json({ success: true, data: updated });
});

// ── GET /api/finance/workspace/submissions ───────────────────────────────────
// Get submissions for a branch (accountant) or all branches (auditor/director)
export const getWorkspaceSubmissions = asyncWrap(async (req, res) => {
  const user = (req as any).user;
  const role = String(user?.role || '');
  const globalRoles = ['super_admin', 'director', 'general_manager', 'auditor'];
  const isGlobal = globalRoles.includes(role);

  let query = supabase
    .from('financial_workspace_submissions')
    .select('*')
    .order('record_date', { ascending: false });

  if (!isGlobal) {
    query = query.eq('branch_id', n(user?.branch_id));
  } else if (req.query.branch_id) {
    query = query.eq('branch_id', n(req.query.branch_id));
  }

  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.from) query = query.gte('record_date', req.query.from);
  if (req.query.to) query = query.lte('record_date', req.query.to);

  query = query.limit(Number(req.query.limit || 60));

  const { data, error } = await query;
  if (error) throw error;

  res.json({ success: true, data: data || [] });
});

// ── GET /api/finance/workspace/submissions/:id ───────────────────────────────
export const getWorkspaceSubmission = asyncWrap(async (req, res) => {
  const { data, error } = await supabase
    .from('financial_workspace_submissions')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) throw error;
  res.json({ success: true, data });
});

// ── PATCH /api/finance/workspace/submissions/:id/review ──────────────────────
// Auditor approves or returns the workspace submission
export const reviewWorkspaceSubmission = asyncWrap(async (req, res) => {
  const { id } = req.params;
  const actor = userId(req);
  const { action, notes } = req.body;

  if (!['approve', 'return'].includes(action)) throw new AppError("action must be 'approve' or 'return'", 400);

  const newStatus = action === 'approve' ? 'approved' : 'returned';

  const { data, error } = await supabase
    .from('financial_workspace_submissions')
    .update({
      status: newStatus,
      auditor_id: actor,
      auditor_notes: notes || null,
      auditor_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Update the linked daily_financial_records status
  if (newStatus === 'approved') {
    await supabase
      .from('daily_financial_records')
      .update({ status: 'REVIEWED', reviewed_at: new Date().toISOString(), reviewed_by: actor })
      .eq('branch_id', data.branch_id)
      .eq('record_date', data.record_date);
  }

  res.json({ success: true, data });
});

// ── GET /api/finance/workspace/audit-queue ───────────────────────────────────
// Auditor sees all pending submissions needing review
export const getAuditReviewQueue = asyncWrap(async (req, res) => {
  const { data, error } = await supabase
    .from('financial_workspace_submissions')
    .select('id, branch_id, record_date, submitted_revenue, submitted_net_profit, overall_variance, variance_pct, requires_explanation, explanation_reason, status, submitted_at, submitted_by')
    .in('status', ['submitted', 'auditor_review'])
    .order('submitted_at', { ascending: true })
    .limit(100);

  if (error) throw error;
  res.json({ success: true, data: data || [] });
});

// ── GET /api/finance/snapshot/:branchId/:date ────────────────────────────────
// Get the system-generated daily snapshot for a branch/date
export const getDailySnapshot = asyncWrap(async (req, res) => {
  const { branchId: bid, date } = req.params;
  const { data, error } = await supabase
    .from('financial_daily_snapshots')
    .select('*')
    .eq('branch_id', Number(bid))
    .eq('snapshot_date', date)
    .maybeSingle();

  if (error) throw error;
  res.json({ success: true, data: data || null });
});

// ── POST /api/finance/workspace/submissions/:id/post ─────────────────────────
// Accountant clicks "Post" after reviewing variance (and optionally providing
// an explanation). This is the step that sends to BOTH Auditor AND Director.
export const postWorkspaceSubmission = asyncWrap(async (req, res) => {
  const { id } = req.params;
  const actor = userId(req);
  const { explanation_reason, explanation_notes, explanation_documents } = req.body;

  const { data: submission, error: fetchErr } = await supabase
    .from('financial_workspace_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !submission) throw new AppError('Submission not found', 404);
  if (submission.status === 'locked' || submission.status === 'approved') {
    throw new AppError('This submission has already been finalised', 400);
  }
  if (submission.requires_explanation && !explanation_reason && !submission.explanation_reason) {
    throw new AppError('An explanation is required before posting this workspace', 400);
  }

  const updatePayload: Record<string, any> = {
    status: 'auditor_review',
    updated_at: new Date().toISOString(),
    posted_at: new Date().toISOString(),
    posted_by: actor,
  };

  if (explanation_reason) updatePayload.explanation_reason = explanation_reason;
  if (explanation_notes) updatePayload.explanation_notes = String(explanation_notes).trim();
  if (explanation_documents) updatePayload.explanation_documents = explanation_documents;
  if (explanation_reason || explanation_notes) {
    updatePayload.explanation_submitted_at = new Date().toISOString();
  }

  const { data: updated, error: updateErr } = await supabase
    .from('financial_workspace_submissions')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (updateErr) throw updateErr;

  const branch = submission.branch_id;
  const recordDate = submission.record_date;
  const variance = round2(submission.overall_variance ?? 0);
  const hasWarning = Math.abs(variance) >= 500;

  // Notify AUDITOR
  try {
    await notificationService.createNotification({
      title: 'Workspace Posted for Audit Review',
      message: `Branch ${branch} has posted their daily workspace for ${recordDate}. Overall variance: KES ${variance.toLocaleString()}.${hasWarning ? ' ⚠️ Variance exceeds threshold.' : ''}`,
      type: hasWarning ? 'warning' : 'info',
      category: 'financial_close',
      priority: hasWarning ? 'high' : 'medium',
      role: 'auditor',
      branch_id: branch,
      metadata: { submission_id: id, record_date: recordDate, overall_variance: variance },
    });
  } catch (e) {
    logger.warn('[FinancialClose] Auditor notification failed:', e);
  }

  // Notify DIRECTOR simultaneously
  try {
    await notificationService.createNotification({
      title: 'Branch Workspace Posted',
      message: `Branch ${branch} has closed their daily workspace for ${recordDate} (KES ${variance >= 0 ? '+' : ''}${variance.toLocaleString()} variance). Sent for audit review.`,
      type: hasWarning ? 'warning' : 'info',
      category: 'financial_close',
      priority: hasWarning ? 'high' : 'low',
      role: 'director',
      branch_id: branch,
      metadata: { submission_id: id, record_date: recordDate, overall_variance: variance },
    });
  } catch (e) {
    logger.warn('[FinancialClose] Director notification failed:', e);
  }

  res.json({
    success: true,
    data: updated,
    message: 'Workspace posted. Auditor and Director have been notified.',
  });
});

// ── GET /api/finance/branch-profitability ────────────────────────────────────
// Branch profitability breakdown by outlet
export const getBranchProfitability = asyncWrap(async (req, res) => {
  const user = (req as any).user;
  const branch = n(req.query.branch_id ?? user?.branch_id);
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_financial_records')
    .select('record_date, revenue_data, total_revenue, total_cogs, total_expenses, net_profit')
    .eq('branch_id', branch)
    .gte('record_date', from)
    .lte('record_date', to)
    .eq('status', 'REVIEWED')
    .order('record_date', { ascending: true });

  if (error) throw error;
  const records = data || [];

  const totals = {
    restaurant: 0, bar: 0, executive_bar: 0, sports_bar: 0,
    rooms: 0, conferences: 0, outside_catering: 0, other: 0,
    total_revenue: 0, total_cogs: 0, total_expenses: 0, net_profit: 0,
  };

  for (const r of records) {
    const rev = (r.revenue_data as any) || {};
    for (const key of Object.keys(totals).slice(0, 8)) {
      (totals as any)[key] += n(rev[key]);
    }
    totals.total_revenue += n(r.total_revenue);
    totals.total_cogs += n(r.total_cogs);
    totals.total_expenses += n(r.total_expenses);
    totals.net_profit += n(r.net_profit);
  }

  res.json({ success: true, data: { totals, records, period: { from, to } } });
});
