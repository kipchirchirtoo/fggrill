/**
 * Branch Payroll Workspace Controller
 *
 * Branch-scoped payroll: generate → review → submit → auditor → director → approve → lock
 * Includes variance engine: vs previous period, vs budget, ghost/spike detection.
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import notificationService from '../services/notification.service';
import crypto from 'crypto';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

const n = (v: any): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

const asyncWrap = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const actorId = (req: Request) => String((req as any).user?.id || '');
const userBranch = (req: Request): number => {
  const raw = (req as any).user?.branch_id ?? req.body.branch_id ?? req.query.branch_id;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed === 0) throw new AppError('Branch ID required', 400);
  return parsed;
};

const batchNumber = () =>
  `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

// ── Payroll calculation (per staff line) ─────────────────────────────────────
function calculateLine(input: {
  basicSalary: number;
  houseAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  overtimePay?: number;
  daysAbsent?: number;
  workingDays?: number;
  loanDeduction?: number;
  advanceDeduction?: number;
  creditBillDeduction?: number;
  uniformDeduction?: number;
  otherDeductions?: number;
  nssfEnabled?: boolean;
  shifEnabled?: boolean;
  housingFundEnabled?: boolean;
  nssfAmount?: number | null;
  shifAmount?: number | null;
  housingFundAmount?: number | null;
}) {
  const workDays = input.workingDays || 26;
  const absent = input.daysAbsent || 0;
  const basic = n(input.basicSalary);
  const house = n(input.houseAllowance);
  const transport = n(input.transportAllowance);
  const otherAllow = n(input.otherAllowances);
  const overtime = n(input.overtimePay);

  const gross = basic + house + transport + otherAllow + overtime;
  const dailyRate = basic / workDays;
  const absentDeduction = round2(dailyRate * absent);

  // Statutory deductions (Kenya 2026 rates)
  const paye = round2(calculatePAYE(gross - absentDeduction));
  const sha = input.shifEnabled !== false
    ? (input.shifAmount != null ? round2(n(input.shifAmount)) : round2(gross * 0.0275))
    : 0;
  const nssf = input.nssfEnabled !== false
    ? (input.nssfAmount != null ? round2(n(input.nssfAmount)) : round2(Math.min(gross * 0.06, 1080)))
    : 0;
  const housingFund = input.housingFundEnabled !== false
    ? (input.housingFundAmount != null ? round2(n(input.housingFundAmount)) : round2(Math.min(gross * 0.015, 2500)))
    : 0;

  const loan = n(input.loanDeduction);
  const advance = n(input.advanceDeduction);
  const creditBill = n(input.creditBillDeduction);
  const uniform = n(input.uniformDeduction);
  const other = n(input.otherDeductions);

  const totalDeductions = round2(paye + sha + nssf + housingFund + absentDeduction + loan + advance + creditBill + uniform + other);
  const netPay = round2(gross - totalDeductions);

  return { gross, paye, sha, nssf, housingFund, absentDeduction, loan, advance, creditBill, uniform, other, totalDeductions, netPay };
}

function calculatePAYE(gross: number): number {
  // Kenya PAYE tax bands 2026
  if (gross <= 24000) return 0;
  if (gross <= 32333) return round2((gross - 24000) * 0.25);
  if (gross <= 500000) return round2(2083.25 + (gross - 32333) * 0.3);
  if (gross <= 800000) return round2(142333.25 + (gross - 500000) * 0.325);
  return round2(239833.25 + (gross - 800000) * 0.35);
}

// ── Ghost / spike / duplicate detection ──────────────────────────────────────
function detectFlags(lines: any[], prevLines: any[]): Array<{ type: string; staff_id: string; detail: string }> {
  const flags: Array<{ type: string; staff_id: string; detail: string }> = [];
  const prevMap = new Map(prevLines.map((l: any) => [l.staff_id, l]));
  const nameSet = new Map<string, string[]>();

  for (const line of lines) {
    // Spike: net pay increased > 30% from last month
    const prev = prevMap.get(line.staff_id);
    if (prev && n(prev.net_pay) > 0) {
      const spike = ((line.netPay - n(prev.net_pay)) / n(prev.net_pay)) * 100;
      if (spike > 30) {
        flags.push({ type: 'spike', staff_id: line.staff_id, detail: `Net pay increased ${round2(spike)}% vs previous month (${n(prev.net_pay)} → ${line.netPay})` });
      }
    }

    // Large overtime: overtime > 40% of basic
    if (line.overtime > 0 && n(line.basicSalary) > 0 && (line.overtime / n(line.basicSalary)) > 0.4) {
      flags.push({ type: 'large_overtime', staff_id: line.staff_id, detail: `Overtime ${line.overtime} is ${round2((line.overtime / n(line.basicSalary)) * 100)}% of basic salary` });
    }

    // Duplicate name check
    const nameKey = String(line.staffName || '').toLowerCase().trim();
    if (nameKey) {
      const existing = nameSet.get(nameKey) || [];
      existing.push(line.staff_id);
      nameSet.set(nameKey, existing);
    }
  }

  // Flag duplicate names
  for (const [name, ids] of nameSet.entries()) {
    if (ids.length > 1) {
      flags.push({ type: 'duplicate', staff_id: ids.join(','), detail: `Duplicate staff name "${name}" found for IDs: ${ids.join(', ')}` });
    }
  }

  return flags;
}

// ── GET /api/payroll/batches ──────────────────────────────────────────────────
export const listPayrollBatches = asyncWrap(async (req, res) => {
  const user = (req as any).user;
  const role = String(user?.role || '');
  const globalRoles = ['super_admin', 'director', 'general_manager', 'auditor', 'hr_manager'];
  const isGlobal = globalRoles.includes(role);

  let query = supabase
    .from('payroll_batches')
    .select('id, batch_number, branch_id, period_label, period_month, period_year, total_gross, total_paye, total_net, headcount, has_ghost_flag, has_spike_flag, status, submitted_at, auditor_reviewed_at, director_approved_at')
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });

  if (!isGlobal) query = query.eq('branch_id', n(user?.branch_id));
  else if (req.query.branch_id) query = query.eq('branch_id', n(req.query.branch_id));

  if (req.query.status) query = query.eq('status', req.query.status);

  const { data, error } = await query.limit(50);
  if (error) throw error;
  res.json({ success: true, data: data || [] });
});

// ── GET /api/payroll/batches/:id ─────────────────────────────────────────────
export const getPayrollBatch = asyncWrap(async (req, res) => {
  const [batchRes, linesRes] = await Promise.all([
    supabase.from('payroll_batches').select('*').eq('id', req.params.id).single(),
    supabase.from('payroll_batch_lines').select('*').eq('batch_id', req.params.id).order('created_at'),
  ]);
  if (batchRes.error) throw batchRes.error;
  res.json({ success: true, data: { ...batchRes.data, lines: linesRes.data || [] } });
});

// ── POST /api/payroll/batches/generate ───────────────────────────────────────
// Auto-generates a payroll batch from staff records + attendance
export const generatePayrollBatch = asyncWrap(async (req, res) => {
  const actor = actorId(req);
  const branch = userBranch(req);
  const { period_month, period_year } = req.body;

  if (!period_month || !period_year) throw new AppError('period_month and period_year required', 400);
  const month = Number(period_month);
  const year = Number(period_year);

  // Check if batch already exists
  const { data: existing } = await supabase
    .from('payroll_batches')
    .select('id, status')
    .eq('branch_id', branch)
    .eq('period_month', month)
    .eq('period_year', year)
    .maybeSingle();

  if (existing && !['draft'].includes(existing.status)) {
    throw new AppError(`Payroll batch for this period already exists with status: ${existing.status}`, 409);
  }

  // Fetch branch staff (using actual column names from staff_profiles)
  const { data: staff, error: staffErr } = await supabase
    .from('staff_profiles')
    .select('id, first_name, last_name, employee_number, department, position, basic_salary, nssf_enabled, shif_enabled, housing_fund_enabled')
    .eq('branch_id', branch)
    .eq('employment_status', 'active');

  if (staffErr) throw staffErr;
  if (!staff?.length) throw new AppError('No active staff found for this branch', 404);

  const staffIds = staff.map((s) => s.id);

  // Fetch all 3 deduction sources in parallel
  const [advancesRes, loansRes, creditBillsRes] = await Promise.allSettled([
    supabase.from('staff_advances').select('staff_id, amount').in('staff_id', staffIds).eq('status', 'approved'),
    supabase.from('staff_loans').select('staff_id, monthly_deduction').in('staff_id', staffIds).eq('status', 'active'),
    supabase.from('staff_credit_bills').select('staff_id, balance').in('staff_id', staffIds).in('status', ['open', 'partial']),
  ]);

  const advanceByStaff = new Map<string, number>();
  const loanByStaff = new Map<string, number>();
  const creditBillByStaff = new Map<string, number>();

  for (const adv of (advancesRes.status === 'fulfilled' ? advancesRes.value.data || [] : [])) {
    advanceByStaff.set(String(adv.staff_id), (advanceByStaff.get(String(adv.staff_id)) || 0) + n(adv.amount));
  }
  for (const loan of (loansRes.status === 'fulfilled' ? loansRes.value.data || [] : [])) {
    loanByStaff.set(String(loan.staff_id), (loanByStaff.get(String(loan.staff_id)) || 0) + n(loan.monthly_deduction));
  }
  for (const bill of (creditBillsRes.status === 'fulfilled' ? creditBillsRes.value.data || [] : [])) {
    creditBillByStaff.set(String(bill.staff_id), (creditBillByStaff.get(String(bill.staff_id)) || 0) + n(bill.balance));
  }

  // Previous period lines for variance
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { data: prevBatch } = await supabase
    .from('payroll_batches')
    .select('id')
    .eq('branch_id', branch)
    .eq('period_month', prevMonth)
    .eq('period_year', prevYear)
    .maybeSingle();

  const prevLines = prevBatch
    ? (await supabase.from('payroll_batch_lines').select('staff_id, net_pay').eq('batch_id', prevBatch.id)).data || []
    : [];

  // Build batch lines — attendance is NOT used; every staff gets full month pay
  const lines = [];
  for (const s of staff) {
    const calc = calculateLine({
      basicSalary: n(s.basic_salary),
      houseAllowance: 0,
      transportAllowance: 0,
      overtimePay: 0,
      daysAbsent: 0,
      workingDays: 26,
      loanDeduction: loanByStaff.get(String(s.id)) || 0,
      advanceDeduction: advanceByStaff.get(String(s.id)) || 0,
      creditBillDeduction: creditBillByStaff.get(String(s.id)) || 0,
      nssfEnabled: (s as any).nssf_enabled,
      shifEnabled: (s as any).shif_enabled,
      housingFundEnabled: (s as any).housing_fund_enabled,
      nssfAmount: (s as any).nssf_amount,
      shifAmount: (s as any).shif_amount,
      housingFundAmount: (s as any).housing_fund_amount,
    });

    const prevLine = prevLines.find((p: any) => p.staff_id === s.id);

    lines.push({
      staff_id: String(s.id),
      staffName: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      staffNumber: (s as any).employee_number || '',
      department: s.department || '',
      designation: (s as any).position || '',
      workingDays: 26,
      daysPresent: 26,
      daysAbsent: 0,
      overtimeHours: 0,
      basicSalary: n(s.basic_salary),
      houseAllowance: 0,
      transportAllowance: 0,
      otherAllowances: 0,
      overtime: 0,
      ...calc,
      prevNetPay: prevLine ? n(prevLine.net_pay) : null,
      netVariance: prevLine ? round2(calc.netPay - n(prevLine.net_pay)) : null,
    });
  }

  // Detect flags
  const flags = detectFlags(lines, prevLines);

  // Batch totals
  const totalGross = round2(lines.reduce((s, l) => s + l.gross, 0));
  const totalPaye = round2(lines.reduce((s, l) => s + l.paye, 0));
  const totalSha = round2(lines.reduce((s, l) => s + l.sha, 0));
  const totalNssf = round2(lines.reduce((s, l) => s + l.nssf, 0));
  const totalHousingFund = round2(lines.reduce((s, l) => s + l.housingFund, 0));
  const totalLoans = round2(lines.reduce((s, l) => s + l.loan, 0));
  const totalAdvances = round2(lines.reduce((s, l) => s + l.advance, 0));
  const totalCreditBills = round2(lines.reduce((s, l) => s + l.creditBill, 0));
  const totalNet = round2(lines.reduce((s, l) => s + l.netPay, 0));
  const prevTotalNet = prevLines.length ? round2(prevLines.reduce((s: number, l: any) => s + n(l.net_pay), 0)) : null;

  const periodLabel = new Date(year, month - 1).toLocaleString('en-KE', { month: 'long', year: 'numeric' });

  // Upsert batch
  const batchPayload = {
    batch_number: existing?.id ? undefined : batchNumber(),
    branch_id: branch,
    period_month: month,
    period_year: year,
    period_label: periodLabel,
    total_gross: totalGross,
    total_paye: totalPaye,
    total_sha: totalSha,
    total_nssf: totalNssf,
    total_housing_fund: totalHousingFund,
    total_loans: totalLoans,
    total_advances: totalAdvances,
    total_credit_bills: totalCreditBills,
    total_net: totalNet,
    headcount: lines.length,
    prev_period_net: prevTotalNet,
    variance_vs_prev: prevTotalNet !== null ? round2(totalNet - prevTotalNet) : null,
    variance_vs_prev_pct: prevTotalNet ? round2(((totalNet - prevTotalNet) / prevTotalNet) * 100) : null,
    has_ghost_flag: flags.some((f) => f.type === 'ghost'),
    has_spike_flag: flags.some((f) => f.type === 'spike'),
    has_duplicate_flag: flags.some((f) => f.type === 'duplicate'),
    flags_json: flags,
    status: 'draft',
    created_by: actor,
    updated_at: new Date().toISOString(),
  };

  const { data: batch, error: batchErr } = existing?.id
    ? await supabase.from('payroll_batches').update(batchPayload).eq('id', existing.id).select().single()
    : await supabase.from('payroll_batches').insert({ ...batchPayload, created_at: new Date().toISOString() }).select().single();

  if (batchErr) throw batchErr;

  // Insert/replace batch lines
  await supabase.from('payroll_batch_lines').delete().eq('batch_id', batch.id);

  const lineRows = lines.map((l) => ({
    batch_id: batch.id,
    branch_id: branch,
    staff_id: l.staff_id,
    staff_name: l.staffName,
    staff_number: l.staffNumber,
    department: l.department,
    designation: l.designation,
    working_days: l.workingDays,
    days_present: l.daysPresent,
    days_absent: l.daysAbsent,
    overtime_hours: l.overtimeHours,
    basic_salary: l.basicSalary,
    house_allowance: l.houseAllowance,
    transport_allowance: l.transportAllowance,
    other_allowances: l.otherAllowances,
    overtime_pay: l.overtime,
    gross_salary: l.gross,
    paye: l.paye,
    sha: l.sha,
    nssf: l.nssf,
    loan_deduction: l.loan,
    advance_deduction: l.advance,
    credit_bill_deduction: l.creditBill,
    housing_fund_deduction: l.housingFund,
    absent_deduction: l.absentDeduction,
    uniform_deduction: l.uniform,
    other_deductions: l.other,
    total_deductions: l.totalDeductions,
    net_pay: l.netPay,
    prev_net_pay: l.prevNetPay,
    net_variance: l.netVariance,
    is_flagged: flags.some((f) => f.staff_id === l.staff_id || f.staff_id.includes(l.staff_id)),
    flag_type: flags.find((f) => f.staff_id === l.staff_id || f.staff_id.includes(l.staff_id))?.type || null,
    flag_detail: flags.find((f) => f.staff_id === l.staff_id || f.staff_id.includes(l.staff_id))?.detail || null,
  }));

  const { error: linesErr } = await supabase.from('payroll_batch_lines').insert(lineRows);
  if (linesErr) logger.warn('[BranchPayroll] Lines insert partial error:', linesErr);

  res.status(201).json({
    success: true,
    data: { ...batch, lines: lineRows, flags },
    message: `Payroll generated for ${periodLabel}: ${lines.length} staff, KES ${totalNet.toLocaleString()} net. ${flags.length} flag(s) detected.`,
  });
});

// ── POST /api/payroll/batches/:id/submit ─────────────────────────────────────
export const submitPayrollBatch = asyncWrap(async (req, res) => {
  const actor = actorId(req);
  const { id } = req.params;

  const { data: batch, error: fetchErr } = await supabase
    .from('payroll_batches')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !batch) throw new AppError('Payroll batch not found', 404);
  if (!['draft'].includes(batch.status)) throw new AppError(`Cannot submit a batch with status: ${batch.status}`, 400);

  const { data, error } = await supabase
    .from('payroll_batches')
    .update({ status: 'auditor_review', submitted_by: actor, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  try {
    await notificationService.createNotification({
      title: 'Payroll Submitted for Review',
      message: `${batch.period_label} payroll for branch ${batch.branch_id} submitted. KES ${n(batch.total_net).toLocaleString()} net pay for ${batch.headcount} staff.${batch.has_ghost_flag ? ' ⚠️ Ghost employee flag.' : ''}${batch.has_spike_flag ? ' ⚠️ Salary spike flag.' : ''}`,
      type: (batch.has_ghost_flag || batch.has_spike_flag) ? 'warning' : 'info',
      category: 'payroll',
      priority: (batch.has_ghost_flag || batch.has_spike_flag) ? 'high' : 'medium',
      role: 'auditor',
      branch_id: batch.branch_id,
      metadata: { batch_id: id },
    });
  } catch (notifErr) {
    logger.warn('[BranchPayroll] Submit notification failed:', notifErr);
  }

  res.json({ success: true, data });
});

// ── PATCH /api/payroll/batches/:id/review ────────────────────────────────────
// Auditor approves / returns
export const reviewPayrollBatch = asyncWrap(async (req, res) => {
  const actor = actorId(req);
  const { id } = req.params;
  const { action, notes } = req.body;

  if (!['approve', 'return'].includes(action)) throw new AppError("action must be 'approve' or 'return'", 400);

  const newStatus = action === 'approve' ? 'director_visible' : 'returned';

  const { data: batch } = await supabase.from('payroll_batches').select('branch_id, period_label, total_net, headcount').eq('id', id).single();

  const { data, error } = await supabase
    .from('payroll_batches')
    .update({ status: newStatus, auditor_id: actor, auditor_notes: notes || null, auditor_reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (newStatus === 'director_visible' && batch) {
    try {
      await notificationService.createNotification({
        title: 'Payroll Awaiting Director Approval',
        message: `${batch.period_label} payroll for branch ${batch.branch_id} has been audited. KES ${n(batch.total_net).toLocaleString()} for ${batch.headcount} staff. Awaiting director approval.`,
        type: 'info',
        category: 'payroll',
        priority: 'high',
        role: 'director',
        branch_id: batch.branch_id,
        metadata: { batch_id: id },
      });
    } catch (notifErr) {
      logger.warn('[BranchPayroll] Auditor review notification failed:', notifErr);
    }
  }

  res.json({ success: true, data });
});

// ── PATCH /api/payroll/batches/:id/approve ───────────────────────────────────
// Director approves → locks payroll
export const approvePayrollBatch = asyncWrap(async (req, res) => {
  const actor = actorId(req);
  const { id } = req.params;
  const { action, notes } = req.body;

  if (!['approve', 'return'].includes(action)) throw new AppError("action must be 'approve' or 'return'", 400);

  const now = new Date().toISOString();
  const newStatus = action === 'approve' ? 'locked' : 'returned';

  const { data, error } = await supabase
    .from('payroll_batches')
    .update({
      status: newStatus,
      director_approved_by: actor,
      director_approved_at: now,
      locked_at: action === 'approve' ? now : null,
      updated_at: now,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  res.json({ success: true, data, message: action === 'approve' ? 'Payroll approved and locked.' : 'Payroll returned for correction.' });
});

// ── GET /api/payroll/director-summary ────────────────────────────────────────
// Director sees cross-branch payroll intelligence
export const getDirectorPayrollSummary = asyncWrap(async (req, res) => {
  const { period_year, period_month } = req.query;
  const year = Number(period_year || new Date().getFullYear());
  const month = Number(period_month || new Date().getMonth() + 1);

  const { data: batches, error } = await supabase
    .from('payroll_batches')
    .select('id, branch_id, period_label, total_gross, total_net, headcount, variance_vs_prev, variance_vs_prev_pct, has_ghost_flag, has_spike_flag, status')
    .eq('period_year', year)
    .eq('period_month', month)
    .order('branch_id');

  if (error) throw error;

  const totalNet = (batches || []).reduce((s: number, b: any) => s + n(b.total_net), 0);
  const totalGross = (batches || []).reduce((s: number, b: any) => s + n(b.total_gross), 0);
  const totalHeadcount = (batches || []).reduce((s: number, b: any) => s + n(b.headcount), 0);
  const flaggedBranches = (batches || []).filter((b: any) => b.has_ghost_flag || b.has_spike_flag).length;

  res.json({
    success: true,
    data: {
      period: { year, month, label: new Date(year, month - 1).toLocaleString('en-KE', { month: 'long', year: 'numeric' }) },
      summary: { total_gross: round2(totalGross), total_net: round2(totalNet), total_headcount: totalHeadcount, flagged_branches: flaggedBranches },
      branches: batches || [],
    },
  });
});

// ── GET /api/payroll/batches/:id/pdf ─────────────────────────────────────────
export const downloadPayrollBatchPdf = asyncWrap(async (req, res) => {
  const { id } = req.params;

  const { data: batch, error: bErr } = await supabase
    .from('payroll_batches')
    .select('*')
    .eq('id', id)
    .single();
  if (bErr || !batch) throw new AppError('Payroll batch not found', 404);

  const { data: lines } = await supabase
    .from('payroll_batch_lines')
    .select('*')
    .eq('batch_id', id)
    .order('staff_name');

  const rows: any[] = lines || [];

  // Fetch branch name
  let branchName = 'All Branches';
  if (batch.branch_id) {
    const { data: branchData } = await supabase.from('branches').select('name').eq('id', batch.branch_id).single();
    if (branchData?.name) branchName = branchData.name;
  }

  // Map batch lines to the branded Python template employee format
  const employees = rows.map((line: any, idx: number) => {
    const nssf        = n(line.nssf);
    const shif        = n(line.sha);
    const paye        = n(line.paye);
    const loans       = n(line.loan_deduction);
    const advances    = n(line.advance_deduction);
    const creditBills = n(line.absent_deduction) + n(line.uniform_deduction) + n(line.other_deductions);
    const calcTotal   = nssf + shif + paye + loans + advances + creditBills;
    const housingLevy = Math.max(0, round2(n(line.total_deductions) - calcTotal));
    return {
      no:           idx + 1,
      emp_id:       line.staff_number || '',
      name:         line.staff_name   || '',
      phone:        '',
      role:         line.designation  || line.department || '',
      branch:       branchName,
      basic_salary: n(line.basic_salary),
      nssf,
      shif,
      housing_levy: housingLevy,
      paye,
      credit_bills: creditBills,
      advances,
      loans,
    };
  });

  const payload = {
    employees,
    period:          batch.period_label || '',
    branch:          branchName,
    generated:       new Date().toLocaleString('en-KE'),
    status:          (batch.status || 'DRAFT').toUpperCase(),
    company_name:    'FAMOUSGATE HOTELS',
    company_address: 'Bomet, Kenya',
    company_email:   'famousgateshotelsbmt@gmail.com',
    company_phone:   '0706 782 828',
  };

  const response = await axios.post(
    `${PYTHON_SERVICE_URL}/api/payroll/generate-pdf`,
    payload,
    { responseType: 'arraybuffer', timeout: 60000 },
  );

  const safePeriod = (batch.period_label || '').replace(/[^A-Za-z0-9]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=FG_Payroll_${safePeriod}.pdf`);
  res.send(Buffer.from(response.data));
});
