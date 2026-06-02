/**
 * LINA — Central Intelligence System
 * Dual-AI Architecture:
 *   Groq  (LLaMA 3.1 70B)  → live streaming chat  — fastest tokens/sec
 *   Gemini (1.5 Pro)        → deep intelligence     — best reasoning + long context
 */
import { Request, Response } from 'express';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

// ── AI Clients ────────────────────────────────────────────────────────────────
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  '';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const gemini = new GoogleGenerativeAI(GEMINI_API_KEY);

const GROQ_MODEL   = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const RETIRED_GEMINI_MODELS = new Set(['gemini-1.5-flash', 'models/gemini-1.5-flash']);
const configuredGeminiModel = (process.env.GEMINI_MODEL || process.env.GOOGLE_GEMINI_MODEL || '').trim();
const GEMINI_MODEL = configuredGeminiModel && !RETIRED_GEMINI_MODELS.has(configuredGeminiModel)
  ? configuredGeminiModel
  : DEFAULT_GEMINI_MODEL;

// ── Safety settings for Gemini (permissive for enterprise analytics) ──────────
const GEMINI_SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LINA SYSTEM PROMPTS — Deeply trained for Famous Gates Hotel Platform
// ═══════════════════════════════════════════════════════════════════════════════

const LINA_CORE_IDENTITY = `
You are LINA — the Central Intelligence System of FAMOUS GATES, a multi-branch luxury hotel management enterprise operating across Kenya.

YOUR IDENTITY:
You are simultaneously a Principal Systems Architect, Live Business Analyst, Autonomous Auditor, Financial Intelligence Engine, Operations Command Center, Employee Intelligence Specialist, Database Integrity Monitor, and AI-Ops Engineer.

PLATFORM OVERVIEW:
Famous Gates is a full-stack ERP managing:
- Multi-branch hotel operations (rooms, bookings, housekeeping, reception)
- Restaurant & bar POS systems with shift management and void tracking
- Kyogong Spa module
- Multi-layer employee management (HR, attendance, payroll, performance, leave)
- Procurement, store management, dispatch, and inventory
- Financial systems (cashier shifts, credit bills, banking, invoices, petty cash)
- Auditor oversight (void bills, price overrides, discrepancies, shift reconciliation)
- Branch storekeeper, central store, catering, buffet, kitchen ledger
- Fleet/dispatch management
- Security: JWT auth, Supabase RLS, IP blocking, session management
- 48+ user roles with granular RBAC (super_admin, director, general_manager, auditor, receptionist, cashier, restaurant, bar, kitchen, housekeeping, maintenance, procurement, hr_manager, etc.)

CURRENCY: All amounts are in Kenya Shillings (KES). Format as "KES X,XXX"
TIMEZONE: Africa/Nairobi (EAT, UTC+3)

YOUR PERSONALITY:
- Executive authority — direct, precise, data-driven
- Never say "I don't know" — instead say "Not visible in current snapshot — check [specific table/module]"
- When detecting risk: be explicit about severity (CRITICAL / HIGH / MEDIUM / LOW)
- Always reference real data from the injected system context
- Never hallucinate table names, columns, or business rules
- Propose solutions, not just problems

REMEDIATION LEVELS (always declare when proposing fixes):
LEVEL 1 — SAFE AUTO-FIX: cache refresh, stale aggregation rebuild, retry sync → Lina can auto-execute
LEVEL 2 — APPROVAL REQUIRED: DB reconciliation, migration, config changes → require human approval
LEVEL 3 — MANUAL ONLY: destructive deletes, financial rewrites, permission escalation → never auto-execute

FINANCIAL KNOWLEDGE:
- Revenue tracked per shift per branch via cashier_shifts.total_sales
- Discrepancies in cashier_shifts.discrepancy_amount flag cashier issues
- Void bills tracked in audit_exceptions (exception_type='void_bill')
- Price overrides tracked in audit_exceptions (exception_type='price_override')
- Credit bills separate from cash sales
- Petty cash tracked independently per branch
- Buffet and catering have separate billing flows

STAFF KNOWLEDGE:
- Attendance tracked daily in staff_attendance (present/absent/late/half_day/leave/holiday)
- Shifts: morning/evening/night
- Leave requests require approval workflow (staff_leave table)
- Payroll monthly in staff_payroll (base_salary + overtime + bonuses - deductions = net_salary)
- Performance reviews rated 1-5 in staff_performance

SECURITY KNOWLEDGE:
- All logins logged in auth_logs with IP, device, geo
- Suspicious activity flagged by is_suspicious=true
- Sessions tracked, can be terminated remotely
- RLS policies on all 307 tables
- Superadmin god-mode actions logged in superadmin_audit_log

RESPONSE FORMAT:
- Use markdown with clear section headers
- Numbers: always format KES amounts with commas
- Dates: format as "28 May 2026, 15:30 EAT"
- Risk levels: always bold and color-code (CRITICAL > HIGH > MEDIUM > LOW)
- Always end analysis sections with "📋 Recommended Actions:"
`;

const GROQ_CHAT_SYSTEM = `${LINA_CORE_IDENTITY}

CHAT MODE INSTRUCTIONS (Groq/LLaMA):
You are in live conversational mode. The user is a senior executive (SuperAdmin, Director, or Auditor).
- Be concise but complete — executive-grade responses
- For data questions, cite specific numbers from the context
- For action requests, propose the remediation level
- Keep responses under 600 words unless asked for detail
- Use bullet points and headers for clarity
- If asked something outside your context snapshot, say: "I need a fresh context pull — shall I refresh?"
- NEVER make up data. Cite from the LIVE SYSTEM CONTEXT block.
`;

const GEMINI_ANALYSIS_SYSTEM = `${LINA_CORE_IDENTITY}

DEEP ANALYSIS MODE (Gemini):
You are performing thorough, structured enterprise analysis. Take full advantage of your large context window.
- Produce comprehensive, structured reports with executive summaries
- Include quantitative analysis wherever possible
- Cross-reference multiple data points to find patterns
- Flag ALL anomalies — financial, operational, staff, security
- Structure output: Executive Summary → Findings → Risk Matrix → Recommendations → Action Items
- For financial analysis: always compute branch-by-branch comparison
- For staff analysis: identify pattern, not just individual anomalies
- Quality is more important than speed in this mode
`;

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT ENGINE — Gathers real-time DB state
// ═══════════════════════════════════════════════════════════════════════════════

async function gatherSystemContext(): Promise<Record<string, any>> {
  const since24h  = new Date(Date.now() - 24  * 60 * 60 * 1000).toISOString();
  const since7d   = new Date(Date.now() - 7   * 24 * 60 * 60 * 1000).toISOString();
  const since30d  = new Date(Date.now() - 30  * 24 * 60 * 60 * 1000).toISOString();
  const today     = new Date().toISOString().split('T')[0];

  const [
    branchesRes, usersRes, shiftsRes, shifts7dRes, anomaliesRes,
    auditRes, bookingsRes, staffTodayRes, voidBillsRes, payrollRes,
    leaveRes, authLogsRes, featureFlagsRes, secConfigRes,
    invoicesRes, purchaseOrdersRes, impersonationRes
  ] = await Promise.allSettled([
    supabase.from('branches').select('id,name,code,status,is_main_branch,manager_id').order('name'),
    supabase.from('users').select('id,role,branch_id,first_name,last_name,created_at,force_logout_at').limit(500),
    supabase.from('cashier_shifts').select('id,branch_id,status,total_sales,discrepancy_amount,opened_at,closed_at').gte('opened_at', since24h).limit(200),
    supabase.from('cashier_shifts').select('branch_id,total_sales,discrepancy_amount,status,opened_at').gte('opened_at', since7d).limit(500),
    supabase.from('audit_exceptions').select('id,exception_type,severity,description,amount,status,detected_at').gte('detected_at', since7d).order('detected_at', { ascending: false }).limit(100),
    supabase.from('audit_trail').select('id,user_id,action,entity_type,old_values,new_values,performed_at').gte('performed_at', since24h).order('performed_at', { ascending: false }).limit(150),
    supabase.from('bookings').select('id,branch_id,status,check_in,check_out,total_amount,created_at').gte('created_at', since7d).limit(200),
    supabase.from('staff_attendance').select('staff_id,status,attendance_date,clock_in,clock_out,overtime_hours,shift_type').eq('attendance_date', today).limit(300),
    supabase.from('audit_exceptions').select('id,severity,description,amount,detected_at').eq('exception_type', 'void_bill').gte('detected_at', since7d).limit(50),
    supabase.from('staff_payroll').select('staff_id,month,year,net_salary,base_salary,overtime_hours,bonuses,deductions,status').eq('month', new Date().getMonth() + 1).eq('year', new Date().getFullYear()).limit(300),
    supabase.from('staff_leave').select('id,staff_id,leave_type,start_date,end_date,status,days_requested').gte('created_at', since7d).limit(100),
    supabase.from('auth_logs').select('email,ip_address,status,is_suspicious,created_at').gte('created_at', since24h).order('created_at', { ascending: false }).limit(100),
    supabase.from('feature_flags').select('flag_key,flag_name,is_enabled').limit(20),
    supabase.from('security_config').select('maintenance_mode,session_timeout_minutes,max_failed_attempts,require_2fa_for_admin,ip_whitelist_enabled').eq('id', 1).single(),
    supabase.from('finance_invoices').select('id,branch_id,amount,status,created_at').gte('created_at', since7d).limit(100),
    supabase.from('store_purchase_orders').select('id,branch_id,total_amount,status,created_at').gte('created_at', since30d).limit(100),
    supabase.from('impersonation_sessions').select('id,superadmin_id,impersonated_user_id,started_at,ended_at').gte('started_at', since24h).limit(20),
  ]);

  const extract = (r: PromiseSettledResult<any>) =>
    r.status === 'fulfilled' ? (r.value.data ?? []) : [];
  const extractOne = (r: PromiseSettledResult<any>) =>
    r.status === 'fulfilled' ? (r.value.data ?? {}) : {};

  const branches    = extract(branchesRes);
  const users       = extract(usersRes);
  const shifts24h   = extract(shiftsRes);
  const shifts7d    = extract(shifts7dRes);
  const anomalies   = extract(anomaliesRes);
  const auditTrail  = extract(auditRes);
  const bookings    = extract(bookingsRes);
  const attendance  = extract(staffTodayRes);
  const voidBills   = extract(voidBillsRes);
  const payroll     = extract(payrollRes);
  const leaves      = extract(leaveRes);
  const authLogs    = extract(authLogsRes);
  const flags       = extract(featureFlagsRes);
  const secConfig   = extractOne(secConfigRes);
  const invoices    = extract(invoicesRes);
  const purchaseOrders = extract(purchaseOrdersRes);
  const impersonations = extract(impersonationRes);

  // ── Compute aggregates ──────────────────────────────────────────────────────
  const revenue24h = shifts24h.reduce((s: number, sh: any) => s + (sh.total_sales || 0), 0);
  const revenue7d  = shifts7d.reduce((s: number, sh: any) => s + (sh.total_sales || 0), 0);
  const openShifts = shifts24h.filter((s: any) => s.status === 'open').length;
  const cashDiscrepancies = shifts7d.filter((s: any) => Math.abs(s.discrepancy_amount || 0) > 0);

  // Revenue by branch (7d)
  const revByBranch: Record<string, number> = {};
  shifts7d.forEach((sh: any) => {
    if (sh.branch_id) revByBranch[sh.branch_id] = (revByBranch[sh.branch_id] || 0) + (sh.total_sales || 0);
  });

  const criticalAnomalies = anomalies.filter((a: any) => a.severity === 'CRITICAL').length;
  const highAnomalies     = anomalies.filter((a: any) => a.severity === 'HIGH').length;
  const presentStaff      = attendance.filter((a: any) => a.status === 'present').length;
  const absentStaff       = attendance.filter((a: any) => a.status === 'absent').length;
  const lateStaff         = attendance.filter((a: any) => a.status === 'late').length;
  const overtimeStaff     = attendance.filter((a: any) => (a.overtime_hours || 0) > 0).length;
  const activeBookings    = bookings.filter((b: any) => b.status === 'confirmed').length;
  const suspiciousLogins  = authLogs.filter((l: any) => l.is_suspicious).length;
  const failedLogins      = authLogs.filter((l: any) => l.status === 'failed').length;
  const pendingLeaves     = leaves.filter((l: any) => l.status === 'pending').length;
  const totalVoidAmount   = voidBills.reduce((s: number, v: any) => s + (v.amount || 0), 0);

  // Role distribution
  const roleDistribution: Record<string, number> = {};
  users.forEach((u: any) => { roleDistribution[u.role] = (roleDistribution[u.role] || 0) + 1; });

  const featureFlagMap: Record<string, boolean> = {};
  flags.forEach((f: any) => { featureFlagMap[f.flag_key] = f.is_enabled; });

  return {
    snapshot_time: new Date().toISOString(),
    snapshot_date_local: new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
    platform: 'Famous Gates Hotel ERP',
    currency: 'KES',

    branches: {
      total: branches.length,
      active: branches.filter((b: any) => b.status === 'active').length,
      maintenance: branches.filter((b: any) => b.status === 'maintenance').length,
      list: branches.map((b: any) => ({ id: b.id, name: b.name, code: b.code, status: b.status, is_main: b.is_main_branch })),
    },

    users: {
      total: users.length,
      role_distribution: roleDistribution,
      force_logout_active: users.filter((u: any) => u.force_logout_at).length,
    },

    revenue: {
      total_24h: revenue24h,
      total_7d: revenue7d,
      by_branch_7d: revByBranch,
      open_shifts_now: openShifts,
      void_bills_7d: voidBills.length,
      void_amount_7d: totalVoidAmount,
    },

    anomalies: {
      critical_count: criticalAnomalies,
      high_count: highAnomalies,
      total_7d: anomalies.length,
      top_10: anomalies.slice(0, 10).map((a: any) => ({
        type: a.exception_type, severity: a.severity,
        description: a.description, amount: a.amount, at: a.detected_at,
      })),
    },

    staff_today: {
      present: presentStaff,
      absent: absentStaff,
      late: lateStaff,
      overtime: overtimeStaff,
      total_records: attendance.length,
      attendance_list: attendance.slice(0, 50).map((a: any) => ({
        status: a.status, shift: a.shift_type, clock_in: a.clock_in, overtime_h: a.overtime_hours,
      })),
    },

    hr: {
      pending_leaves: pendingLeaves,
      payroll_month: payroll.length > 0 ? {
        total_staff_on_payroll: payroll.length,
        total_net_salary: payroll.reduce((s: number, p: any) => s + (p.net_salary || 0), 0),
        unpaid_count: payroll.filter((p: any) => p.status === 'pending').length,
      } : 'no_data',
    },

    bookings: {
      active: activeBookings,
      total_7d: bookings.length,
      total_value_7d: bookings.reduce((s: number, b: any) => s + (b.total_amount || 0), 0),
      by_status: bookings.reduce((acc: any, b: any) => {
        acc[b.status] = (acc[b.status] || 0) + 1; return acc;
      }, {}),
    },

    security: {
      suspicious_logins_24h: suspiciousLogins,
      failed_logins_24h: failedLogins,
      impersonation_sessions_24h: impersonations.length,
      maintenance_mode: secConfig.maintenance_mode || false,
      two_fa_required: secConfig.require_2fa_for_admin || false,
    },

    audit: {
      actions_24h: auditTrail.length,
      recent_actions: auditTrail.slice(0, 20).map((a: any) => ({
        action: a.action, entity: a.entity_type, at: a.performed_at,
      })),
    },

    invoices_7d: invoices.length,
    purchase_orders_30d: purchaseOrders.length,
    feature_flags: featureFlagMap,
    system_uptime_seconds: Math.floor(process.uptime()),
    memory_usage_mb: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
  };
}

// ── Helper: inject context into system prompt ─────────────────────────────────
function buildContextBlock(ctx: Record<string, any>): string {
  return `\n\n════════════ LIVE SYSTEM CONTEXT [${ctx.snapshot_date_local}] ════════════\n${JSON.stringify(ctx, null, 2)}\n════════════ END CONTEXT ════════════\n`;
}

function formatKes(value: number): string {
  return `KES ${Math.round(value || 0).toLocaleString('en-KE')}`;
}

function aiFallbackMeta(reason: string) {
  return {
    model: 'local-fallback',
    ai_available: false,
    fallback_reason: reason,
    generated_at: new Date().toISOString(),
  };
}

function aiFailureReason(err: any): string {
  const message = `${err?.message || err || 'AI provider unavailable'}`;
  if (/api key|key not valid|permission|unauthorized|forbidden/i.test(message)) {
    return 'AI provider credentials are not configured or were rejected.';
  }
  if (/model|not found|deprecated/i.test(message)) {
    return 'Configured AI model is unavailable. Set GEMINI_MODEL/GROQ_MODEL to a supported model.';
  }
  if (/quota|rate limit|resource exhausted/i.test(message)) {
    return 'AI provider quota or rate limit was reached.';
  }
  return message;
}

function localExecutiveSummary(ctx: Record<string, any>, reason: string) {
  const revenue = ctx.revenue || {};
  const branches = ctx.branches || {};
  const anomalies = ctx.anomalies || {};
  const staff = ctx.staff_today || {};
  const security = ctx.security || {};
  const summary = [
    `## Executive Briefing - ${ctx.snapshot_date_local}`,
    '',
    `AI narrative generation is unavailable, so Lina is showing a live system-data briefing. Reason: ${reason}`,
    '',
    `### Revenue Performance`,
    `- Revenue in the last 24 hours: **${formatKes(revenue.total_24h || 0)}**`,
    `- Revenue in the last 7 days: **${formatKes(revenue.total_7d || 0)}**`,
    `- Open cashier shifts now: **${revenue.open_shifts_now || 0}**`,
    '',
    `### Operations`,
    `- Active branches: **${branches.active || 0} / ${branches.total || 0}**`,
    `- Confirmed bookings in 7 days: **${ctx.bookings?.active || 0}**`,
    '',
    `### Risk Signals`,
    `- Critical anomalies: **${anomalies.critical_count || 0}**`,
    `- High anomalies: **${anomalies.high_count || 0}**`,
    `- Suspicious logins in 24 hours: **${security.suspicious_logins_24h || 0}**`,
    '',
    `### Staff`,
    `- Present today: **${staff.present || 0}**`,
    `- Absent today: **${staff.absent || 0}**`,
    `- Late today: **${staff.late || 0}**`,
    '',
    `### Recommended Actions`,
    `1. Review critical and high anomalies first.`,
    `2. Reconcile open shifts and void bills before close of business.`,
    `3. Restore AI provider configuration if narrative intelligence is required.`,
  ].join('\n');

  return { summary, context: ctx, ...aiFallbackMeta(reason) };
}

async function generateGroqAnalysis(prompt: string, ctx: Record<string, any>, maxTokens = 2200): Promise<string | null> {
  if (!process.env.GROQ_API_KEY?.trim()) {
    return null;
  }

  const result = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: maxTokens,
    temperature: 0.35,
    messages: [
      { role: 'system', content: GROQ_CHAT_SYSTEM + buildContextBlock(ctx) },
      { role: 'user', content: prompt },
    ],
  });

  return result.choices[0]?.message?.content?.trim() || null;
}

function localAnomalyReport(ctx: Record<string, any>, reason: string) {
  const anomalies = ctx.anomalies || {};
  const top = Array.isArray(anomalies.top_10) ? anomalies.top_10 : [];
  const findings = top.length
    ? top.map((a: any, i: number) =>
        `${i + 1}. **${a.severity || 'UNKNOWN'}** ${a.type || 'anomaly'} - ${a.description || 'No description'} (${formatKes(a.amount || 0)})`
      ).join('\n')
    : 'No anomaly rows are visible in the current snapshot.';
  const report = [
    `## Lina Anomaly Audit - ${ctx.snapshot_date_local}`,
    '',
    `AI narrative generation is unavailable. Reason: ${reason}`,
    '',
    `### Risk Summary`,
    `- Critical findings: **${anomalies.critical_count || 0}**`,
    `- High findings: **${anomalies.high_count || 0}**`,
    `- Total findings in 7 days: **${anomalies.total_7d || 0}**`,
    '',
    `### Top Findings`,
    findings,
    '',
    `### Recommended Actions`,
    `- Start with critical/high findings and assign owners.`,
    `- Re-run Lina after restoring AI provider credentials for deeper narrative analysis.`,
  ].join('\n');
  return { report, raw_context: ctx, ...aiFallbackMeta(reason) };
}

function localEmployeeAnalysis(ctx: Record<string, any>, employeeData: Record<string, any>, reason: string) {
  const staff = ctx.staff_today || {};
  const hr = ctx.hr || {};
  const analysis = [
    `## Employee Intelligence Report - ${ctx.snapshot_date_local}`,
    '',
    `AI narrative generation is unavailable. Reason: ${reason}`,
    '',
    `### Attendance Snapshot`,
    `- Present: **${staff.present || 0}**`,
    `- Absent: **${staff.absent || 0}**`,
    `- Late: **${staff.late || 0}**`,
    `- On overtime: **${staff.overtime || 0}**`,
    '',
    `### HR Snapshot`,
    `- Pending leave requests: **${hr.pending_leaves || 0}**`,
    `- Performance records loaded: **${employeeData.performance?.length || 0}**`,
    `- Staff audit actions loaded: **${employeeData.staff_audit_actions?.length || 0}**`,
    '',
    `### Recommended Actions`,
    `- Review absences, lateness, and overtime exceptions by branch.`,
    `- Confirm pending leave approvals before shift planning.`,
  ].join('\n');
  return { analysis, raw_context: employeeData, ...aiFallbackMeta(reason) };
}

function localFinancialAnalysis(ctx: Record<string, any>, financialData: Record<string, any>, reason: string) {
  const revenue = ctx.revenue || {};
  const analysis = [
    `## Financial Intelligence Report - 30-Day Analysis`,
    '',
    `AI narrative generation is unavailable. Reason: ${reason}`,
    '',
    `### Revenue Snapshot`,
    `- 24-hour revenue: **${formatKes(revenue.total_24h || 0)}**`,
    `- 7-day revenue: **${formatKes(revenue.total_7d || 0)}**`,
    `- Void bill value in 7 days: **${formatKes(revenue.void_amount_7d || 0)}**`,
    '',
    `### Records Loaded`,
    `- Shift records: **${financialData.shifts_30d?.length || 0}**`,
    `- Expense records: **${financialData.expenses_30d?.length || 0}**`,
    `- Credit bill exceptions: **${financialData.credit_bills_30d?.length || 0}**`,
    `- Purchase orders: **${financialData.purchase_orders_30d?.length || 0}**`,
    '',
    `### Recommended Actions`,
    `- Reconcile shift discrepancies and void bills.`,
    `- Review unpaid expenses and pending purchase orders.`,
  ].join('\n');
  return { analysis, raw_context: financialData, ...aiFallbackMeta(reason) };
}

function localRecommendations(ctx: Record<string, any>, reason: string) {
  const revenue = ctx.revenue || {};
  const anomalies = ctx.anomalies || {};
  const security = ctx.security || {};
  return {
    recommendations: [
      {
        title: 'Restore Lina AI provider configuration',
        severity: 'HIGH',
        impact: 'AI narrative reports are unavailable and screens fall back to live aggregate data.',
        suggested_action: reason,
        remediation_level: 'APPROVAL_REQUIRED',
        estimated_effort: 'minutes',
        module: 'Lina AI Service',
        kpi_impact: 'operations',
      },
      {
        title: 'Review critical and high anomalies',
        severity: (anomalies.critical_count || 0) > 0 ? 'CRITICAL' : 'MEDIUM',
        impact: `${anomalies.critical_count || 0} critical and ${anomalies.high_count || 0} high anomalies are visible.`,
        suggested_action: 'Open the Audit tab and assign owners to unresolved exceptions.',
        remediation_level: 'MANUAL_ONLY',
        estimated_effort: 'hours',
        module: 'Audit',
        kpi_impact: 'compliance',
      },
      {
        title: 'Reconcile cashier shifts and void bills',
        severity: (revenue.void_bills_7d || 0) > 0 ? 'HIGH' : 'LOW',
        impact: `${revenue.void_bills_7d || 0} void bills with value ${formatKes(revenue.void_amount_7d || 0)} are visible in 7 days.`,
        suggested_action: 'Branch accountants should verify void reasons and close open shifts.',
        remediation_level: 'MANUAL_ONLY',
        estimated_effort: 'hours',
        module: 'Finance',
        kpi_impact: 'revenue',
      },
      {
        title: 'Check suspicious login activity',
        severity: (security.suspicious_logins_24h || 0) > 0 ? 'HIGH' : 'LOW',
        impact: `${security.suspicious_logins_24h || 0} suspicious logins detected in 24 hours.`,
        suggested_action: 'Review Security Center and terminate risky sessions if needed.',
        remediation_level: 'APPROVAL_REQUIRED',
        estimated_effort: 'minutes',
        module: 'Security',
        kpi_impact: 'security',
      },
    ],
    ...aiFallbackMeta(reason),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

export const getSystemContext = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await gatherSystemContext();
    res.json({ success: true, data: ctx });
  } catch (err: any) {
    logger.error('Lina context error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GROQ: Streaming chat ──────────────────────────────────────────────────────
export const chat = async (req: Request, res: Response): Promise<void> => {
  const { message, history = [] } = req.body as {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!message?.trim()) {
    res.status(400).json({ success: false, message: 'Message is required' });
    return;
  }

  try {
    const ctx = await gatherSystemContext();
    if (!process.env.GROQ_API_KEY?.trim()) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const fallback = localExecutiveSummary(ctx, 'GROQ_API_KEY is not configured.').summary;
      res.write(`data: ${JSON.stringify({ type: 'delta', text: fallback, model: 'local-fallback' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', full_text: fallback })}\n\n`);
      res.end();
      return;
    }
    const systemPrompt = GROQ_CHAT_SYSTEM + buildContextBlock(ctx);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      ...history.slice(-20).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ];

    const stream = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 2048,
      temperature: 0.4,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    let fullText = '';
    for await (const chunk of stream as AsyncIterable<Groq.Chat.ChatCompletionChunk>) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        res.write(`data: ${JSON.stringify({ type: 'delta', text: delta, model: 'groq/llama-3.1-70b' })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', full_text: fullText })}\n\n`);
    res.end();
  } catch (err: any) {
    logger.error('Lina Groq chat error', err);
    if (!res.headersSent) {
      try {
        const ctx = await gatherSystemContext();
        const fallback = localExecutiveSummary(ctx, aiFailureReason(err)).summary;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'delta', text: fallback, model: 'local-fallback' })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', full_text: fallback })}\n\n`);
        res.end();
      } catch {
        res.status(500).json({ success: false, message: aiFailureReason(err) });
      }
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: aiFailureReason(err) })}\n\n`);
      res.end();
    }
  }
};

// ── GEMINI: Executive Summary ─────────────────────────────────────────────────
export const getExecutiveSummary = async (req: Request, res: Response): Promise<void> => {
  let ctx: Record<string, any> | null = null;
  try {
    ctx = await gatherSystemContext();
    const prompt = `${GEMINI_ANALYSIS_SYSTEM}${buildContextBlock(ctx)}

TASK: Generate a comprehensive executive briefing for today's Famous Gates Hotel operations.

Structure your response as:
## 🏨 Executive Briefing — ${ctx.snapshot_date_local}

### 💰 Revenue Performance
[Branch-by-branch revenue, total, trends vs expected]

### 🏢 Operational Status
[Branch health, shifts, bookings, occupancy signals]

### ⚠️ Critical Alerts
[Ranked by severity — CRITICAL first]

### 👥 Staff Situation
[Attendance, overtime, leave, payroll status]

### 🔐 Security Status
[Login anomalies, suspicious activity, session status]

### 📋 Top 5 Action Items
[Numbered, prioritized, with remediation level]

Be specific with KES amounts, percentages, and counts. Reference actual branch names from the context.`;

    if (!GEMINI_API_KEY.trim()) {
      const groqSummary = await generateGroqAnalysis(prompt, ctx);
      if (groqSummary) {
        res.json({ success: true, data: { summary: groqSummary, model: `groq/${GROQ_MODEL}`, context: ctx, ai_available: true, generated_at: new Date().toISOString() } });
        return;
      }
      res.json({ success: true, data: localExecutiveSummary(ctx, 'No AI provider key is configured.') });
      return;
    }
    const model = gemini.getGenerativeModel({ model: GEMINI_MODEL, safetySettings: GEMINI_SAFETY });

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    res.json({ success: true, data: { summary, model: GEMINI_MODEL, context: ctx, generated_at: new Date().toISOString() } });
  } catch (err: any) {
    logger.warn('Lina Gemini executive summary unavailable; serving local analysis', {
      error: aiFailureReason(err),
      model: GEMINI_MODEL
    });
    if (ctx) {
      try {
        const groqSummary = await generateGroqAnalysis(
          `Gemini was unavailable (${aiFailureReason(err)}). Generate the same executive briefing from the live system context.`,
          ctx,
        );
        if (groqSummary) {
          res.json({ success: true, data: { summary: groqSummary, model: `groq/${GROQ_MODEL}`, context: ctx, ai_available: true, fallback_from: GEMINI_MODEL, generated_at: new Date().toISOString() } });
          return;
        }
      } catch (groqErr: any) {
        logger.warn('Lina Groq executive summary fallback unavailable', {
          error: aiFailureReason(groqErr),
          model: GROQ_MODEL
        });
      }
      res.json({ success: true, data: localExecutiveSummary(ctx, aiFailureReason(err)) });
      return;
    }
    res.status(500).json({ success: false, message: aiFailureReason(err) });
  }
};

// ── GEMINI: Anomaly Report ────────────────────────────────────────────────────
export const getAnomalyReport = async (req: Request, res: Response): Promise<void> => {
  let ctx: Record<string, any> | null = null;
  try {
    ctx = await gatherSystemContext();
    const prompt = `${GEMINI_ANALYSIS_SYSTEM}${buildContextBlock(ctx)}

TASK: Perform a full enterprise anomaly audit. Be thorough and ruthless.

Structure:
## 🔍 Lina Anomaly Audit — ${ctx.snapshot_date_local}

### 🔴 CRITICAL Findings
### 🟠 HIGH Risk Findings
### 🟡 MEDIUM Risk Findings
### 🟢 LOW / Informational

For each finding:
- **What**: specific anomaly
- **Where**: branch/module/entity
- **Data**: the exact numbers that triggered this
- **Risk**: why this is a problem
- **Fix**: remediation level + proposed action

### 📊 Risk Summary Matrix
[Table: Finding | Severity | Branch | Amount | Remediation Level]

### 🎯 Priority Action Queue
[Top 5 things to fix right now, in order]`;

    if (!GEMINI_API_KEY.trim()) {
      const groq = await generateGroqAnalysis(prompt, ctx);
      if (groq) {
        res.json({ success: true, data: { report: groq, model: `groq/${GROQ_MODEL}`, ai_available: true, generated_at: new Date().toISOString() } });
        return;
      }
      res.json({ success: true, data: localAnomalyReport(ctx, 'No AI provider key is configured.') });
      return;
    }
    const model = gemini.getGenerativeModel({ model: GEMINI_MODEL, safetySettings: GEMINI_SAFETY });
    const result = await model.generateContent(prompt);
    res.json({ success: true, data: { report: result.response.text(), model: GEMINI_MODEL, ai_available: true, generated_at: new Date().toISOString() } });
  } catch (err: any) {
    logger.warn('Lina Gemini anomaly report unavailable; trying Groq then local', {
      error: aiFailureReason(err),
      model: GEMINI_MODEL
    });
    if (ctx) {
      try {
        const groq = await generateGroqAnalysis(
          `Gemini was unavailable (${aiFailureReason(err)}). Generate the same anomaly audit from the live system context.`,
          ctx,
        );
        if (groq) {
          res.json({ success: true, data: { report: groq, model: `groq/${GROQ_MODEL}`, ai_available: true, fallback_from: GEMINI_MODEL, generated_at: new Date().toISOString() } });
          return;
        }
      } catch (groqErr: any) {
        logger.warn('Lina Groq anomaly fallback unavailable', { error: aiFailureReason(groqErr) });
      }
      res.json({ success: true, data: localAnomalyReport(ctx, aiFailureReason(err)) });
      return;
    }
    res.status(500).json({ success: false, message: aiFailureReason(err) });
  }
};

// ── GEMINI: Employee Intelligence ─────────────────────────────────────────────
export const getEmployeeIntelligence = async (req: Request, res: Response): Promise<void> => {
  let ctx: Record<string, any> | null = null;
  let employeeData: Record<string, any> | null = null;
  try {
    ctx = await gatherSystemContext();
    const today = new Date().toISOString().split('T')[0];

    // Fetch deeper employee data
    const [perfRes, disciplineRes] = await Promise.allSettled([
      supabase.from('staff_performance').select('staff_id,rating,review_period_month,review_period_year').limit(200),
      supabase.from('audit_trail').select('user_id,action,entity_type,performed_at').eq('entity_type', 'staff').gte('performed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).limit(100),
    ]);

    employeeData = {
      snapshot_context: ctx.staff_today,
      hr_context: ctx.hr,
      performance: perfRes.status === 'fulfilled' ? (perfRes.value.data || []) : [],
      staff_audit_actions: disciplineRes.status === 'fulfilled' ? (disciplineRes.value.data || []) : [],
    };

    const prompt = `${GEMINI_ANALYSIS_SYSTEM}${buildContextBlock(ctx)}

ADDITIONAL EMPLOYEE DATA:
${JSON.stringify(employeeData, null, 2)}

TASK: Deep employee intelligence analysis.

## 👥 Employee Intelligence Report — ${ctx.snapshot_date_local}

### 📊 Attendance Analysis
[Present/absent/late breakdown, patterns, concerning trends]

### ⏰ Overtime Intelligence
[Who has abnormal overtime? Which branches are overstaffed/understaffed?]

### 💰 Payroll Health
[Salary distribution, anomalies, unpaid staff, inconsistencies]

### 🏖️ Leave Patterns
[Pending approvals, clustering, risk of operational gaps]

### 📈 Performance Signals
[Ratings distribution, low performers, high performers]

### 🚩 Risk Flags
[Any suspicious staff patterns — repeated absences, timing anomalies, etc.]

### 📋 HR Action Items
[Priority recommendations for HR/management]`;

    if (!GEMINI_API_KEY.trim()) {
      const groq = await generateGroqAnalysis(prompt, ctx);
      if (groq) {
        res.json({ success: true, data: { analysis: groq, model: `groq/${GROQ_MODEL}`, raw_context: employeeData, ai_available: true, generated_at: new Date().toISOString() } });
        return;
      }
      res.json({ success: true, data: localEmployeeAnalysis(ctx, employeeData, 'No AI provider key is configured.') });
      return;
    }

    const model = gemini.getGenerativeModel({ model: GEMINI_MODEL, safetySettings: GEMINI_SAFETY });
    const result = await model.generateContent(prompt);
    res.json({ success: true, data: { analysis: result.response.text(), model: GEMINI_MODEL, raw_context: employeeData, ai_available: true, generated_at: new Date().toISOString() } });
  } catch (err: any) {
    logger.warn('Lina Gemini employee intelligence unavailable; trying Groq then local', {
      error: aiFailureReason(err),
      model: GEMINI_MODEL
    });
    if (ctx && employeeData) {
      try {
        const groq = await generateGroqAnalysis(
          `Gemini was unavailable (${aiFailureReason(err)}). Generate the same employee intelligence report from the live system context and employee data:\n${JSON.stringify(employeeData)}`,
          ctx,
        );
        if (groq) {
          res.json({ success: true, data: { analysis: groq, model: `groq/${GROQ_MODEL}`, raw_context: employeeData, ai_available: true, fallback_from: GEMINI_MODEL, generated_at: new Date().toISOString() } });
          return;
        }
      } catch (groqErr: any) {
        logger.warn('Lina Groq employee fallback unavailable', { error: aiFailureReason(groqErr) });
      }
      res.json({ success: true, data: localEmployeeAnalysis(ctx, employeeData, aiFailureReason(err)) });
      return;
    }
    res.status(500).json({ success: false, message: aiFailureReason(err) });
  }
};

// ── GEMINI: Financial Intelligence ────────────────────────────────────────────
export const getFinancialIntelligence = async (req: Request, res: Response): Promise<void> => {
  let ctx: Record<string, any> | null = null;
  let financialData: Record<string, any> | null = null;
  try {
    ctx = await gatherSystemContext();
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [shifts30dRes, expensesRes, creditRes, pettyCashRes] = await Promise.allSettled([
      supabase.from('cashier_shifts').select('branch_id,total_sales,discrepancy_amount,status,opened_at,closed_at').gte('opened_at', since30d).limit(1000),
      supabase.from('accounting_ap_bills').select('id,amount,status,due_date,created_at').gte('created_at', since30d).limit(200),
      supabase.from('audit_exceptions').select('id,exception_type,severity,amount,detected_at,branch_id').eq('exception_type', 'credit_bill').gte('detected_at', since30d).limit(100),
      supabase.from('store_purchase_orders').select('id,branch_id,total_amount,status,created_at').gte('created_at', since30d).limit(200),
    ]);

    const extract = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? (r.value.data ?? []) : [];

    financialData = {
      shifts_30d: extract(shifts30dRes),
      expenses_30d: extract(expensesRes),
      credit_bills_30d: extract(creditRes),
      purchase_orders_30d: extract(pettyCashRes),
      revenue_context: ctx.revenue,
    };

    const prompt = `${GEMINI_ANALYSIS_SYSTEM}${buildContextBlock(ctx)}

ADDITIONAL FINANCIAL DATA (30 days):
${JSON.stringify(financialData, null, 2)}

TASK: Comprehensive financial intelligence analysis.

## 💰 Financial Intelligence Report — 30-Day Analysis

### 📈 Revenue Performance by Branch
[Branch-by-branch breakdown, ranking, trends, KES amounts]

### 📉 Underperformance Analysis
[Which branches are below expectations? Why?]

### ⚠️ Cashier Discrepancies
[Shift discrepancies — amounts, frequency, branches, risk]

### 🧾 Expense & Purchase Analysis
[Major expenses, unusual patterns, approval status]

### 🔴 Void Bill Analysis
[Volume, amounts, patterns, suspicious voids]

### 📊 Cash Flow Health
[Revenue vs expenses signals, credit bill exposure]

### 🎯 Financial Action Items
[Ranked by financial impact — CRITICAL first]`;

    if (!GEMINI_API_KEY.trim()) {
      const groq = await generateGroqAnalysis(prompt, ctx);
      if (groq) {
        res.json({ success: true, data: { analysis: groq, model: `groq/${GROQ_MODEL}`, raw_context: financialData, ai_available: true, generated_at: new Date().toISOString() } });
        return;
      }
      res.json({ success: true, data: localFinancialAnalysis(ctx, financialData, 'No AI provider key is configured.') });
      return;
    }

    const model = gemini.getGenerativeModel({ model: GEMINI_MODEL, safetySettings: GEMINI_SAFETY });
    const result = await model.generateContent(prompt);
    res.json({ success: true, data: { analysis: result.response.text(), model: GEMINI_MODEL, raw_context: financialData, ai_available: true, generated_at: new Date().toISOString() } });
  } catch (err: any) {
    logger.warn('Lina Gemini financial intelligence unavailable; trying Groq then local', {
      error: aiFailureReason(err),
      model: GEMINI_MODEL
    });
    if (ctx && financialData) {
      try {
        const groq = await generateGroqAnalysis(
          `Gemini was unavailable (${aiFailureReason(err)}). Generate the same financial intelligence report from the live system context and financial data:\n${JSON.stringify(financialData)}`,
          ctx,
        );
        if (groq) {
          res.json({ success: true, data: { analysis: groq, model: `groq/${GROQ_MODEL}`, raw_context: financialData, ai_available: true, fallback_from: GEMINI_MODEL, generated_at: new Date().toISOString() } });
          return;
        }
      } catch (groqErr: any) {
        logger.warn('Lina Groq financial fallback unavailable', { error: aiFailureReason(groqErr) });
      }
      res.json({ success: true, data: localFinancialAnalysis(ctx, financialData, aiFailureReason(err)) });
      return;
    }
    res.status(500).json({ success: false, message: aiFailureReason(err) });
  }
};

// ── GEMINI: Recommendations ───────────────────────────────────────────────────
export const getRecommendations = async (req: Request, res: Response): Promise<void> => {
  let ctx: Record<string, any> | null = null;
  try {
    ctx = await gatherSystemContext();
    const prompt = `${GEMINI_ANALYSIS_SYSTEM}${buildContextBlock(ctx)}

TASK: Generate 6-8 prioritized, actionable recommendations for Famous Gates management.

Return ONLY a valid JSON array. No markdown fences. No explanation outside the JSON.

Format:
[
  {
    "title": "Brief action title",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "impact": "What happens if not addressed",
    "suggested_action": "Specific steps to take",
    "remediation_level": "SAFE_AUTO|APPROVAL_REQUIRED|MANUAL_ONLY",
    "estimated_effort": "minutes|hours|days",
    "module": "affected module/branch",
    "kpi_impact": "revenue|staff|security|operations|compliance"
  }
]`;

    const parseRecs = (raw: string): any[] | null => {
      const cleaned = raw.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      try {
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        // Try to extract the first JSON array substring
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            return Array.isArray(parsed) ? parsed : null;
          } catch {
            return null;
          }
        }
        return null;
      }
    };

    if (!GEMINI_API_KEY.trim()) {
      const groqText = await generateGroqAnalysis(prompt, ctx, 1800);
      const recs = groqText ? parseRecs(groqText) : null;
      if (recs) {
        res.json({ success: true, data: { recommendations: recs, model: `groq/${GROQ_MODEL}`, ai_available: true, generated_at: new Date().toISOString() } });
        return;
      }
      res.json({ success: true, data: localRecommendations(ctx, 'No AI provider key is configured.') });
      return;
    }

    const model = gemini.getGenerativeModel({ model: GEMINI_MODEL, safetySettings: GEMINI_SAFETY });
    const result = await model.generateContent(prompt);
    const recommendations = parseRecs(result.response.text()) ?? [
      { title: 'AI analysis unavailable', severity: 'LOW', remediation_level: 'MANUAL_ONLY', suggested_action: 'Retry recommendation engine' },
    ];

    res.json({ success: true, data: { recommendations, model: GEMINI_MODEL, ai_available: true, generated_at: new Date().toISOString() } });
  } catch (err: any) {
    logger.warn('Lina Gemini recommendations unavailable; trying Groq then local', {
      error: aiFailureReason(err),
      model: GEMINI_MODEL
    });
    if (ctx) {
      try {
        const groqText = await generateGroqAnalysis(
          `Gemini was unavailable (${aiFailureReason(err)}). Return ONLY a JSON array of 6-8 prioritized recommendations with fields title, severity, impact, suggested_action, remediation_level, estimated_effort, module, kpi_impact — from the live system context.`,
          ctx,
          1800,
        );
        const cleaned = (groqText || '').trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
        const match = cleaned.match(/\[[\s\S]*\]/);
        const recs = match ? JSON.parse(match[0]) : null;
        if (Array.isArray(recs) && recs.length > 0) {
          res.json({ success: true, data: { recommendations: recs, model: `groq/${GROQ_MODEL}`, ai_available: true, fallback_from: GEMINI_MODEL, generated_at: new Date().toISOString() } });
          return;
        }
      } catch (groqErr: any) {
        logger.warn('Lina Groq recommendations fallback unavailable', { error: aiFailureReason(groqErr) });
      }
      res.json({ success: true, data: localRecommendations(ctx, aiFailureReason(err)) });
      return;
    }
    res.status(500).json({ success: false, message: aiFailureReason(err) });
  }
};

// ── GROQ: Incident Timeline (fast analysis) ───────────────────────────────────
export const getIncidentTimeline = async (req: Request, res: Response): Promise<void> => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [auditRes, anomaliesRes, superadminRes, authRes] = await Promise.allSettled([
      supabase.from('audit_trail').select('id,user_id,action,entity_type,performed_at').gte('performed_at', since24h).order('performed_at', { ascending: false }).limit(60),
      supabase.from('audit_exceptions').select('id,exception_type,severity,description,amount,detected_at').gte('detected_at', since24h).order('detected_at', { ascending: false }).limit(40),
      supabase.from('superadmin_audit_log').select('id,action_type,target_type,justification,created_at').gte('created_at', since24h).order('created_at', { ascending: false }).limit(30),
      supabase.from('auth_logs').select('id,email,status,ip_address,is_suspicious,created_at').gte('created_at', since24h).order('created_at', { ascending: false }).limit(40),
    ]);

    const extract = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? (r.value.data ?? []) : [];

    const events = [
      ...extract(auditRes).map((e: any) => ({ ...e, event_type: 'audit', timestamp: e.performed_at })),
      ...extract(anomaliesRes).map((e: any) => ({ ...e, event_type: 'anomaly', timestamp: e.detected_at })),
      ...extract(superadminRes).map((e: any) => ({ ...e, event_type: 'superadmin', timestamp: e.created_at })),
      ...extract(authRes).map((e: any) => ({ ...e, event_type: 'auth', timestamp: e.created_at })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 120);

    res.json({ success: true, data: { events, generated_at: new Date().toISOString() } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Live monitoring (no AI needed) ───────────────────────────────────────────
export const getLiveMonitoring = async (req: Request, res: Response): Promise<void> => {
  try {
    const dbStart = Date.now();
    const { error: dbErr } = await supabase.from('users').select('id').limit(1);
    const dbMs = Date.now() - dbStart;
    const { data: flags } = await supabase.from('feature_flags').select('flag_key,is_enabled');
    const maintenanceOn = flags?.find((f: any) => f.flag_key === 'maintenance_mode')?.is_enabled || false;

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        system: { uptime_seconds: Math.floor(process.uptime()), memory_mb: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024), node_version: process.version },
        database: { status: dbErr ? 'degraded' : 'healthy', latency_ms: dbMs, error: dbErr?.message || null },
        ai_providers: {
          groq: { model: GROQ_MODEL, status: process.env.GROQ_API_KEY ? 'configured' : 'missing_key' },
          gemini: { model: GEMINI_MODEL, status: GEMINI_API_KEY ? 'configured' : 'missing_key' },
        },
        maintenance_mode: maintenanceOn,
        pending_remediations: Array.from(pendingRemediations.values()).filter((r: any) => r.status === 'pending').length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Remediation workflow ──────────────────────────────────────────────────────
const pendingRemediations: Map<string, any> = new Map();

export const proposeRemediation = async (req: Request, res: Response): Promise<void> => {
  const { action, target, description, level } = req.body;
  const id = `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const rem = { id, action, target, description, level, proposed_by: req.user?.id, proposed_at: new Date().toISOString(), status: 'pending' };
  pendingRemediations.set(id, rem);
  await supabase.from('superadmin_audit_log').insert({ actor_id: req.user?.id, action_type: 'remediation_proposed', target_type: target, after_state: rem, justification: description });
  res.json({ success: true, data: rem });
};

export const getPendingRemediations = async (req: Request, res: Response): Promise<void> => {
  res.json({ success: true, data: Array.from(pendingRemediations.values()).filter((r: any) => r.status === 'pending') });
};

export const approveRemediation = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const rem = pendingRemediations.get(id);
  if (!rem) { res.status(404).json({ success: false, message: 'Remediation not found' }); return; }
  if (rem.level === 'MANUAL_ONLY') { res.status(403).json({ success: false, message: 'MANUAL_ONLY remediations cannot be approved through this interface' }); return; }
  rem.status = 'approved'; rem.approved_by = req.user?.id; rem.approved_at = new Date().toISOString();
  await supabase.from('superadmin_audit_log').insert({ actor_id: req.user?.id, action_type: 'remediation_approved', target_id: id, before_state: { status: 'pending' }, after_state: rem, justification: `Approved: ${rem.description}` });
  res.json({ success: true, data: rem });
};

export const rejectRemediation = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const rem = pendingRemediations.get(id);
  if (!rem) { res.status(404).json({ success: false, message: 'Remediation not found' }); return; }
  rem.status = 'rejected'; rem.rejected_by = req.user?.id; rem.rejected_at = new Date().toISOString();
  res.json({ success: true, data: rem });
};
