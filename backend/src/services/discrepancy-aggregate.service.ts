import { supabase } from '../config/database';
import db from '../db';
import { applyBranchFilter } from '../utils/branchIsolation';
import { logger } from '../utils/logger';
import type { Request } from 'express';

export interface DiscrepancyAggregateOptions {
  branchId?: number | null;
  lookbackDays: number;
  pendingHours: number;
  topLimit: number;
}

export interface DiscrepancyAggregatePayload {
  meta: {
    generated_at: string;
    branch_scope: {
      type: 'global' | 'branch';
      branch_id?: number | null;
    };
    lookback_days: number;
    pending_hours: number;
  };
  data: {
    cashier_logbooks: {
      summary: {
        total: number;
        awaiting_accountant: number;
        awaiting_audit: number;
        approved_total: number;
        overdue_pending: number;
        high_variance: number;
        max_variance: number;
      };
      top_overdue: Array<{
        id: string;
        branch_id: number | null;
        branch_name: string | null;
        status: string | null;
        log_date: string | null;
        updated_at: string | null;
        submitted_at: string | null;
        variance: number;
      }>;
    };
    stock_takes: {
      summary: {
        open: number;
        completed: number;
        completed_recent: number;
        completed_stale: number;
        high_variance_recent: number;
        max_variance: number;
        last_completed_at: string | null;
      };
      branches_missing_recent: Array<{
        branch_id: number;
        branch_name: string | null;
        last_completed_at: string | null;
      }>;
      top_variances: Array<{
        id: string;
        take_number: string | null;
        branch_id: number | null;
        branch_name: string | null;
        completed_at: string | null;
        variance_value: number | null;
      }>;
    };
    cashier_shifts: {
      summary: {
        open_or_flagged: number;
        closed: number;
        overdue_open: number;
        high_variance_recent: number;
        total_abs_variance: number;
      };
    };
    discrepancy_flags: {
      summary: {
        open: number;
        investigating: number;
        resolved: number;
        dismissed: number;
        critical: number;
        overdue_open: number;
      };
      recent: Array<{
        id: string;
        branch_id: number | null;
        branch_name: string | null;
        flag_type: string | null;
        severity: string | null;
        status: string | null;
        description: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string | null;
      }>;
    };
    audit_exceptions: {
      summary: {
        open: number;
        critical: number;
        last_detected_at: string | null;
      };
    };
    food_control?: FoodControlVarianceSection;
    inventory_governance?: InventoryGovernanceSection;
    financial_variance?: FinancialVarianceSection;
    payroll_anomalies?: PayrollAnomalySection;
  };
}

export interface FoodControlVarianceSection {
  summary: {
    total_items: number;
    critical: number;
    requires_explanation: number;
    unresolved_value: number;
    latest_shift?: number | null;
  };
  top_variances: Array<{
    id: string;
    branch_id: number | null;
    branch_name: string | null;
    variance_value: number;
    variance_pct: number | null;
    variance_date: string | null;
    reference_type: string | null;
    item_sku: string | null;
    status: string | null;
  }>;
}

export interface InventoryGovernanceSection {
  summary: {
    open_alerts: number;
    critical_alerts: number;
    pending_adjustments: number;
    pending_dispatches: number;
    pending_requests: number;
    warnings?: string[];
  };
  recent: Array<{
    id: string;
    exception_type: string | null;
    severity: string | null;
    status: string | null;
    title: string | null;
    description: string | null;
    source_table: string | null;
    source_id: string | null;
    created_at: string | null;
  }>;
}

export interface FinancialVarianceSection {
  summary: {
    revenue_variance: number;
    cash_variance: number;
    banking_variance: number;
    variance_pct: number;
    requires_explanation: boolean;
  };
  details: Array<{
    component: string;
    variance: number;
    possible_causes: Array<{ cause: string; confidence: number }>;
  }>;
}

export interface PayrollAnomalySection {
  summary: {
    total_batches: number;
    flagged_batches: number;
    spike_flags: number;
    overtime_flags: number;
    duplicate_flags: number;
  };
  flagged_staff: Array<{
    staff_id: string;
    staff_name: string | null;
    flag_type: string | null;
    detail: string | null;
    batch_id: string;
  }>;
}

const toNumber = (value: any): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fetchBranchesMap = async (branchIds: Array<number | null | undefined>): Promise<Record<string, string>> => {
  const filtered = Array.from(new Set(branchIds.filter((id): id is number => typeof id === 'number')));
  if (!filtered.length) return {};

  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .in('id', filtered);

  if (error) {
    logger.warn('Failed to fetch branch names for discrepancy aggregate:', error.message);
    return {};
  }

  return (data || []).reduce<Record<string, string>>((acc, row: any) => {
    if (row?.id) acc[String(row.id)] = row.name ?? '';
    return acc;
  }, {});
};

const normalizeBranchScope = (req: Request, explicitBranchId?: number | null) => {
  const role = (req as any).user?.role as string | undefined;
  const branchId = (req as any).user?.branch_id ?? (req as any).user?.branchId;

  if (explicitBranchId && explicitBranchId !== 0) {
    return { type: 'branch' as const, branchId: explicitBranchId };
  }

  if (!role) return { type: 'global' as const, branchId: undefined };

  const globalRoles = ['super_admin', 'general_manager', 'hr_manager', 'auditor', 'director'];
  if (globalRoles.includes(role.toLowerCase())) {
    return { type: 'global' as const, branchId: undefined };
  }

  return { type: 'branch' as const, branchId: branchId ?? null };
};

const normalizeDate = (value: any): string | null => {
  if (!value) return null;
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
};

const fetchCashierLogbookInsights = async (
  req: Request,
  options: DiscrepancyAggregateOptions,
  branchNameMap: Record<string, string>
) => {
  const { lookbackDays, pendingHours, branchId, topLimit } = options;

  let baseQuery = supabase.from('cashier_logbooks').select('*');
  baseQuery = applyBranchFilter(baseQuery, req);

  if (branchId && branchId !== 0) {
    baseQuery = baseQuery.eq('branch_id', branchId);
  }

  const { data, error } = await baseQuery
    .gte('created_at', `now() - interval '${lookbackDays} days'`);

  if (error) {
    logger.warn('Cashier logbook aggregate query failed:', error.message);
    return {
      summary: {
        total: 0,
        awaiting_accountant: 0,
        awaiting_audit: 0,
        approved_total: 0,
        overdue_pending: 0,
        high_variance: 0,
        max_variance: 0,
      },
      top_overdue: [] as any[],
    };
  }

  const rows = data || [];
  const pendingStatuses = new Set(['draft', 'pending_accountant_review', 'pending_audit']);
  const pendingCutoff = Date.now() - pendingHours * 60 * 60 * 1000;

  let total = 0;
  let awaitingAccountant = 0;
  let awaitingAudit = 0;
  let approvedTotal = 0;
  let overduePending = 0;
  let highVariance = 0;
  let maxVariance = 0;

  const overdueRows: Array<{
    id: string;
    branch_id: number | null;
    branch_name: string | null;
    status: string | null;
    log_date: string | null;
    updated_at: string | null;
    submitted_at: string | null;
    variance: number;
  }> = [];

  for (const row of rows) {
    const status = (row as any).status as string | null;
    const branch = (row as any).branch_id ?? null;
    const updatedAtIso = normalizeDate((row as any).updated_at);
    const updatedAtMs = updatedAtIso ? new Date(updatedAtIso).getTime() : null;
    const createdAtIso = normalizeDate((row as any).created_at);

    const variance = toNumber((row as any).closing_float) - toNumber((row as any).opening_float) - toNumber((row as any).total_cash);

    total += 1;

    if (status === 'pending_accountant_review') awaitingAccountant += 1;
    if (status === 'pending_audit') awaitingAudit += 1;
    if (status === 'approved') approvedTotal += 1;

    if (pendingStatuses.has(status ?? '') && (updatedAtMs === null || updatedAtMs < pendingCutoff)) {
      overduePending += 1;
      overdueRows.push({
        id: (row as any).id,
        branch_id: branch,
        branch_name: branch ? branchNameMap[String(branch)] ?? null : null,
        status,
        log_date: normalizeDate((row as any).log_date),
        updated_at: updatedAtIso ?? createdAtIso,
        submitted_at: normalizeDate((row as any).submitted_at),
        variance,
      });
    }

    if (Math.abs(variance) >= toNumber(process.env.LOGBOOK_FLAG_VARIANCE_THRESHOLD) || Math.abs(variance) >= 10000) {
      highVariance += 1;
    }

    maxVariance = Math.max(maxVariance, Math.abs(variance));
  }

  overdueRows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  return {
    summary: {
      total,
      awaiting_accountant: awaitingAccountant,
      awaiting_audit: awaitingAudit,
      approved_total: approvedTotal,
      overdue_pending: overduePending,
      high_variance: highVariance,
      max_variance: maxVariance,
    },
    top_overdue: overdueRows.slice(0, topLimit),
  };
};

const fetchStockTakeInsights = async (
  req: Request,
  options: DiscrepancyAggregateOptions,
  branchNameMap: Record<string, string>
) => {
  const { lookbackDays, branchId, topLimit } = options;

  let baseQuery = supabase.from('stock_takes').select('*');
  baseQuery = applyBranchFilter(baseQuery, req);
  if (branchId && branchId !== 0) baseQuery = baseQuery.eq('branch_id', branchId);

  const { data, error } = await baseQuery
    .or(
      `started_at.not.is.null,completed_at.not.is.null`
    )
    .gte('created_at', `now() - interval '${lookbackDays} days'`)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('Stock take aggregate query failed:', error.message);
    return {
      summary: {
        open: 0,
        completed: 0,
        completed_recent: 0,
        completed_stale: 0,
        high_variance_recent: 0,
        max_variance: 0,
        last_completed_at: null,
      },
      branches_missing_recent: [] as any[],
      top_variances: [] as any[],
    };
  }

  const rows = data || [];
  const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const lookbackCutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

  let open = 0;
  let completed = 0;
  let completedRecent = 0;
  let completedStale = 0;
  let highVarianceRecent = 0;
  let maxVariance = 0;
  let lastCompletedAt: string | null = null;

  const branchLastCompleted = new Map<number, number | null>();
  const topVarianceRows: Array<{
    id: string;
    take_number: string | null;
    branch_id: number | null;
    branch_name: string | null;
    completed_at: string | null;
    variance_value: number | null;
  }> = [];

  for (const row of rows) {
    const status = (row as any).status as string | null;
    const branch = (row as any).branch_id as number | null;
    const completedAt = normalizeDate((row as any).completed_at);
    const completedMs = completedAt ? new Date(completedAt).getTime() : null;
    const variance = toNumber((row as any).variance_value);

    if (status && status.toUpperCase() !== 'COMPLETED') {
      open += 1;
    } else {
      completed += 1;
      if (completedMs !== null) {
        if (!lastCompletedAt || completedMs > new Date(lastCompletedAt).getTime()) {
          lastCompletedAt = completedAt;
        }

        if (completedMs >= recentCutoff) completedRecent += 1;
        else completedStale += 1;

        if (completedMs >= lookbackCutoff && Math.abs(variance) >= 5000) {
          highVarianceRecent += 1;
        }

        if (Math.abs(variance) > maxVariance) maxVariance = Math.abs(variance);

        topVarianceRows.push({
          id: (row as any).id,
          take_number: (row as any).take_number ?? (row as any).count_number ?? null,
          branch_id: branch,
          branch_name: branch ? branchNameMap[String(branch)] ?? null : null,
          completed_at: completedAt,
          variance_value: variance,
        });
      }
    }

    if (branch !== null) {
      const prev = branchLastCompleted.get(branch) ?? null;
      if (completedMs !== null && (prev === null || completedMs > prev)) {
        branchLastCompleted.set(branch, completedMs);
      }
    }
  }

  topVarianceRows.sort((a, b) => Math.abs((b.variance_value ?? 0)) - Math.abs((a.variance_value ?? 0)));

  const branchesMissingRecent = Array.from(branchLastCompleted.entries())
    .filter(([_, completedMs]) => completedMs === null || completedMs < recentCutoff)
    .map(([branch]) => ({
      branch_id: branch,
      branch_name: branchNameMap[String(branch)] ?? null,
      last_completed_at: branchLastCompleted.get(branch) ? new Date(branchLastCompleted.get(branch) as number).toISOString() : null,
    }));

  return {
    summary: {
      open,
      completed,
      completed_recent: completedRecent,
      completed_stale: completedStale,
      high_variance_recent: highVarianceRecent,
      max_variance: maxVariance,
      last_completed_at: lastCompletedAt,
    },
    branches_missing_recent: branchesMissingRecent,
    top_variances: topVarianceRows.slice(0, topLimit),
  };
};

const fetchCashierShiftInsights = async (
  req: Request,
  options: DiscrepancyAggregateOptions
) => {
  const { lookbackDays, pendingHours, branchId } = options;

  let baseQuery = supabase.from('cashier_shifts').select('*');
  baseQuery = applyBranchFilter(baseQuery, req);
  if (branchId && branchId !== 0) baseQuery = baseQuery.eq('branch_id', branchId);

  const { data, error } = await baseQuery
    .gte('start_time', `now() - interval '${lookbackDays} days'`);

  if (error) {
    logger.warn('Cashier shift aggregate query failed:', error.message);
    return {
      summary: {
        open_or_flagged: 0,
        closed: 0,
        overdue_open: 0,
        high_variance_recent: 0,
        total_abs_variance: 0,
      },
    };
  }

  const rows = data || [];
  const nowMs = Date.now();
  const cutoff = nowMs - pendingHours * 60 * 60 * 1000;

  let openOrFlagged = 0;
  let closed = 0;
  let overdueOpen = 0;
  let highVariance = 0;
  let totalAbsVariance = 0;

  for (const row of rows) {
    const status = (row as any).status as string | null;
    const variance = toNumber((row as any).actual_cash) - toNumber((row as any).expected_cash);
    const updatedAt = normalizeDate((row as any).updated_at) ?? normalizeDate((row as any).start_time);
    const updatedMs = updatedAt ? new Date(updatedAt).getTime() : null;

    if (status && ['open', 'pending', 'flagged'].includes(status)) {
      openOrFlagged += 1;
      if (updatedMs === null || updatedMs < cutoff) overdueOpen += 1;
    } else if (status && ['closed', 'approved'].includes(status)) {
      closed += 1;
    }

    if (Math.abs(variance) >= 1000) highVariance += 1;
    totalAbsVariance += Math.abs(variance);
  }

  return {
    summary: {
      open_or_flagged: openOrFlagged,
      closed,
      overdue_open: overdueOpen,
      high_variance_recent: highVariance,
      total_abs_variance: totalAbsVariance,
    },
  };
};

const fetchDiscrepancyFlagInsights = async (
  req: Request,
  options: DiscrepancyAggregateOptions,
  branchNameMap: Record<string, string>
) => {
  const { lookbackDays, branchId, topLimit } = options;

  let baseQuery = supabase.from('discrepancy_flags').select('*').order('created_at', { ascending: false });
  baseQuery = applyBranchFilter(baseQuery, req);
  if (branchId && branchId !== 0) baseQuery = baseQuery.eq('branch_id', branchId);

  const { data, error } = await baseQuery
    .gte('created_at', `now() - interval '${lookbackDays} days'`)
    .limit(topLimit);

  if (error) {
    logger.warn('Discrepancy flag aggregate query failed:', error.message);
    return {
      summary: {
        open: 0,
        investigating: 0,
        resolved: 0,
        dismissed: 0,
        critical: 0,
        overdue_open: 0,
      },
      recent: [] as any[],
    };
  }

  const rows = data || [];

  let open = 0;
  let investigating = 0;
  let resolved = 0;
  let dismissed = 0;
  let critical = 0;
  let overdueOpen = 0;

  const overdueCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

  const recent = rows.map((row: any) => {
    const status = (row.status ?? '').toLowerCase();
    const severity = (row.severity ?? '').toLowerCase();
    const branch = row.branch_id ?? null;
    const createdAt = normalizeDate(row.created_at);

    if (status === 'open') open += 1;
    else if (status === 'investigating') investigating += 1;
    else if (status === 'resolved') resolved += 1;
    else if (status === 'dismissed') dismissed += 1;

    if (severity === 'critical') critical += 1;

    if (!['resolved', 'dismissed'].includes(status) && createdAt) {
      const ms = new Date(createdAt).getTime();
      if (ms < overdueCutoff) overdueOpen += 1;
    }

    return {
      id: row.id,
      branch_id: branch,
      branch_name: branch ? branchNameMap[String(branch)] ?? null : null,
      flag_type: row.flag_type ?? null,
      severity: row.severity ?? null,
      status: row.status ?? null,
      description: row.description ?? null,
      metadata: row.metadata ?? null,
      created_at: createdAt,
    };
  });

  return {
    summary: {
      open,
      investigating,
      resolved,
      dismissed,
      critical,
      overdue_open: overdueOpen,
    },
    recent,
  };
};

const fetchAuditExceptionInsights = async (
  req: Request,
  options: DiscrepancyAggregateOptions,
  branchNameMap: Record<string, string>
) => {
  const { lookbackDays, branchId } = options;

  let baseQuery = supabase.from('audit_exceptions').select('*');
  baseQuery = applyBranchFilter(baseQuery, req);
  if (branchId && branchId !== 0) baseQuery = baseQuery.eq('branch_id', branchId);

  const { data, error } = await baseQuery
    .gte('detected_at', `now() - interval '${lookbackDays} days'`)
    .order('detected_at', { ascending: false });

  if (error) {
    logger.warn('Audit exception aggregate query failed:', error.message);
    return {
      summary: {
        open: 0,
        critical: 0,
        last_detected_at: null,
      },
    };
  }

  const rows = data || [];
  let open = 0;
  let critical = 0;
  let lastDetected: string | null = null;

  for (const row of rows) {
    const status = (row as any).status?.toLowerCase();
    const severity = (row as any).severity?.toLowerCase();
    const detectedAt = normalizeDate((row as any).detected_at);

    if (status !== 'resolved') open += 1;
    if (severity === 'critical') critical += 1;

    if (detectedAt && (!lastDetected || new Date(detectedAt).getTime() > new Date(lastDetected).getTime())) {
      lastDetected = detectedAt;
    }
  }

  return {
    summary: {
      open,
      critical,
      last_detected_at: lastDetected,
    },
  };
};

const fetchFoodControlInsights = async (
  branchId: number | null | undefined,
  topLimit: number,
  lookbackDays: number,
  branchNameMap: Record<string, string>
): Promise<FoodControlVarianceSection> => {
  let query = supabase
    .from('food_control_variance')
    .select('*')
    .gte('variance_date', `now() - interval '${lookbackDays} days'`);

  if (branchId && branchId !== 0) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.order('variance_value', { ascending: false }).limit(topLimit);

  if (error) {
    logger.warn('Food control variance query failed:', error.message);
    return {
      summary: {
        total_items: 0,
        critical: 0,
        requires_explanation: 0,
        unresolved_value: 0,
        latest_shift: null,
      },
      top_variances: [],
    };
  }

  const rows = data || [];
  let total = 0;
  let critical = 0;
  let requiresExplanation = 0;
  let unresolvedValue = 0;
  let latestShift: number | null = null;

  const mapped = rows.map((row: any) => {
    total += 1;
    const severity = String(row.status || '').toLowerCase();
    if (severity === 'critical') critical += 1;
    if (row.requires_explanation === true || String(row.status || '') === 'pending') requiresExplanation += 1;
    const varianceValue = Number(row.variance_value || 0);
    if (String(row.status || '') !== 'resolved') {
      unresolvedValue += Math.abs(varianceValue);
    }

    if (row.shift_id && (!latestShift || Number(row.shift_id) > latestShift)) {
      latestShift = Number(row.shift_id);
    }

    return {
      id: row.id,
      branch_id: row.branch_id ?? null,
      branch_name: row.branch_id ? branchNameMap[String(row.branch_id)] ?? null : null,
      variance_value: varianceValue,
      variance_pct: row.variance_pct ?? null,
      variance_date: row.variance_date ?? null,
      reference_type: row.reference_type ?? null,
      item_sku: row.item_sku ?? null,
      status: row.status ?? null,
    };
  });

  return {
    summary: {
      total_items: total,
      critical,
      requires_explanation: requiresExplanation,
      unresolved_value: unresolvedValue,
      latest_shift: latestShift,
    },
    top_variances: mapped,
  };
};

const fetchInventoryGovernanceInsights = async (
  branchId: number | null | undefined,
  topLimit: number
): Promise<InventoryGovernanceSection> => {
  const warnings: string[] = [];
  const params: any[] = [];
  let branchClause = '';
  if (branchId && branchId !== 0) {
    params.push(branchId);
    branchClause = ` AND branch_id = $${params.length}`;
  }

  const safeCount = async (table: string, extraClause = ''): Promise<number> => {
    try {
      const result = await db.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE 1=1${branchClause}${extraClause}`, params);
      return Number(result.rows[0]?.count || 0);
    } catch (err: any) {
      warnings.push(`${table}: ${err.message || err}`);
      return 0;
    }
  };

  const [openAlerts, criticalAlerts, pendingAdjustments, pendingDispatches, pendingRequests] = await Promise.all([
    safeCount('inventory_alerts', ` AND status = 'open'`),
    safeCount('inventory_alerts', ` AND status = 'open' AND severity = 'critical'`),
    safeCount('inventory_adjustment_requests', ` AND status IN ('requested','approved')`),
    safeCount('dispatch_notes', ` AND COALESCE(receipt_status, status) IN ('dispatched','in_transit','partial','partially_received')`),
    safeCount('stock_requests', ` AND COALESCE(workflow_status, status) IN ('submitted_to_branch_accountant','branch_accountant_approved','submitted_to_auditor','auditor_approved','packing')`),
  ]);

  const recent: InventoryGovernanceSection['recent'] = [];

  try {
    const result = await db.query(
      `SELECT id, branch_id, alert_type AS exception_type, severity, status, message AS description, source_document_type AS source_table,
              source_document_reference AS source_id, created_at
       FROM inventory_alerts
       WHERE 1=1${branchClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, topLimit],
    );

    for (const row of result.rows) {
      recent.push({
        id: String(row.id),
        exception_type: row.exception_type,
        severity: row.severity,
        status: row.status,
        title: String(row.exception_type || 'inventory_alert').replace(/_/g, ' '),
        description: row.description,
        source_table: row.source_table,
        source_id: row.source_id ? String(row.source_id) : null,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      });
    }
  } catch (err: any) {
    warnings.push(`inventory_alerts recent: ${err.message || err}`);
  }

  return {
    summary: {
      open_alerts: openAlerts,
      critical_alerts: criticalAlerts,
      pending_adjustments: pendingAdjustments,
      pending_dispatches: pendingDispatches,
      pending_requests: pendingRequests,
      warnings: warnings.length ? warnings : undefined,
    },
    recent,
  };
};

const fetchFinancialVarianceInsights = async (
  branchId: number | null | undefined,
  date: string | null
): Promise<FinancialVarianceSection | null> => {
  if (!branchId) return null;

  const targetDate = date || new Date().toISOString().split('T')[0];
  const { data: snapshot } = await supabase
    .from('financial_daily_snapshots')
    .select('*')
    .eq('branch_id', branchId)
    .eq('snapshot_date', targetDate)
    .maybeSingle();

  if (!snapshot) return null;

  const submittedRevenue = Number(snapshot.submitted_revenue ?? snapshot.total_system_revenue ?? 0);
  const submittedCash = Number(snapshot.submitted_cash ?? snapshot.system_cash_collected ?? 0);
  const submittedBanked = Number(snapshot.submitted_banked ?? snapshot.system_banked ?? 0);

  const revenueVariance = Number(snapshot.submitted_revenue ?? 0) - Number(snapshot.total_system_revenue ?? 0);
  const cashVariance = submittedCash - Number(snapshot.system_cash_collected ?? 0);
  const bankingVariance = submittedBanked - Number(snapshot.system_banked ?? 0);
  const revenueBase = Number(snapshot.total_system_revenue ?? 0);
  const variancePct = revenueBase > 0 ? (revenueVariance / revenueBase) * 100 : 0;
  const requiresExplanation = Math.abs(revenueVariance) > 500 || Math.abs(cashVariance) > 500 || Math.abs(bankingVariance) > 500;

  return {
    summary: {
      revenue_variance: revenueVariance,
      cash_variance: cashVariance,
      banking_variance: bankingVariance,
      variance_pct: variancePct,
      requires_explanation: requiresExplanation,
    },
    details: [
      {
        component: 'Revenue',
        variance: revenueVariance,
        possible_causes: [],
      },
      {
        component: 'Cash',
        variance: cashVariance,
        possible_causes: [],
      },
      {
        component: 'Banking',
        variance: bankingVariance,
        possible_causes: [],
      },
    ],
  };
};

const fetchPayrollAnomalies = async (
  branchId: number | null | undefined,
  lookbackDays: number
): Promise<PayrollAnomalySection> => {
  let query = supabase
    .from('payroll_batches')
    .select('id, branch_id, created_at, flags_json, metadata')
    .gte('created_at', `now() - interval '${lookbackDays} days'`);

  if (branchId && branchId !== 0) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

  if (error) {
    logger.warn('Payroll batch query failed:', error.message);
    return {
      summary: {
        total_batches: 0,
        flagged_batches: 0,
        spike_flags: 0,
        overtime_flags: 0,
        duplicate_flags: 0,
      },
      flagged_staff: [],
    };
  }

  const batches = data || [];
  let total = batches.length;
  let flaggedBatches = 0;
  let spikeFlags = 0;
  let overtimeFlags = 0;
  let duplicateFlags = 0;
  const flaggedStaff: PayrollAnomalySection['flagged_staff'] = [];

  for (const batch of batches) {
    const flags = Array.isArray(batch.flags_json) ? batch.flags_json : batch.flags_json ? JSON.parse(batch.flags_json) : [];
    const uniqueFlags = new Set<string>();
    for (const flag of flags) {
      const type = flag.type || flag.flag_type;
      if (type) uniqueFlags.add(type);
      if (type === 'spike') spikeFlags += 1;
      if (type === 'large_overtime') overtimeFlags += 1;
      if (type === 'duplicate') duplicateFlags += 1;
      flaggedStaff.push({
        staff_id: flag.staff_id ?? 'unknown',
        staff_name: flag.staff_name ?? null,
        flag_type: type ?? null,
        detail: flag.detail ?? null,
        batch_id: batch.id,
      });
    }
    if (uniqueFlags.size > 0) flaggedBatches += 1;
  }

  return {
    summary: {
      total_batches: total,
      flagged_batches: flaggedBatches,
      spike_flags: spikeFlags,
      overtime_flags: overtimeFlags,
      duplicate_flags: duplicateFlags,
    },
    flagged_staff: flaggedStaff.slice(0, 50),
  };
};

export const buildDiscrepancyAggregate = async (
  req: Request,
  options: DiscrepancyAggregateOptions
): Promise<DiscrepancyAggregatePayload> => {
  const scope = normalizeBranchScope(req, options.branchId ?? null);
  const branchIdForQueries = scope.type === 'branch' ? scope.branchId ?? null : options.branchId ?? null;

  const branchNameMap = await fetchBranchesMap([
    branchIdForQueries ?? undefined,
  ]);

  const [
    cashierLogbooks,
    stockTakes,
    cashierShifts,
    discrepancyFlags,
    auditExceptions,
    foodControl,
    inventoryGovernance,
    financialVariance,
    payroll,
  ] = await Promise.all([
    fetchCashierLogbookInsights(req, { ...options, branchId: branchIdForQueries ?? undefined }, branchNameMap),
    fetchStockTakeInsights(req, { ...options, branchId: branchIdForQueries ?? undefined }, branchNameMap),
    fetchCashierShiftInsights(req, { ...options, branchId: branchIdForQueries ?? undefined }),
    fetchDiscrepancyFlagInsights(req, { ...options, branchId: branchIdForQueries ?? undefined }, branchNameMap),
    fetchAuditExceptionInsights(req, { ...options, branchId: branchIdForQueries ?? undefined }, branchNameMap),
    fetchFoodControlInsights(branchIdForQueries ?? null, options.topLimit, options.lookbackDays, branchNameMap),
    fetchInventoryGovernanceInsights(branchIdForQueries ?? null, options.topLimit),
    fetchFinancialVarianceInsights(branchIdForQueries ?? null, null),
    fetchPayrollAnomalies(branchIdForQueries ?? null, options.lookbackDays),
  ]);

  return {
    meta: {
      generated_at: new Date().toISOString(),
      branch_scope: scope.type === 'branch' ? { type: 'branch', branch_id: branchIdForQueries ?? null } : { type: 'global' },
      lookback_days: options.lookbackDays,
      pending_hours: options.pendingHours,
    },
    data: {
      cashier_logbooks: cashierLogbooks,
      stock_takes: stockTakes,
      cashier_shifts: cashierShifts,
      discrepancy_flags: discrepancyFlags,
      audit_exceptions: auditExceptions,
      food_control: foodControl,
      inventory_governance: inventoryGovernance,
      financial_variance: financialVariance || undefined,
      payroll_anomalies: payroll,
    },
  };
};
