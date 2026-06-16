import db from '../db';
import { AppError } from '../middleware/errorHandler';

type JsonRecord = Record<string, any>;

const allowedReviewStatuses = new Set(['open', 'acknowledged', 'in_review', 'resolved', 'dismissed', 'escalated']);

const tableExists = async (tableName: string): Promise<boolean> => {
  const result = await db.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
  return Boolean(result.rows[0]?.table_name);
};

const branchWhere = (branchId?: number | null, alias = '') => {
  if (!branchId) return { clause: '', params: [] as any[] };
  const prefix = alias ? `${alias}.` : '';
  return { clause: ` AND ${prefix}branch_id = $1`, params: [branchId] };
};

const safeQuery = async <T = JsonRecord>(
  tableName: string,
  warnings: string[],
  run: () => Promise<T[]>
): Promise<T[]> => {
  if (!(await tableExists(tableName))) {
    warnings.push(`${tableName} is not available; apply the inventory governance migrations.`);
    return [];
  }

  try {
    return await run();
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('does not exist') || msg.includes('42703')) {
      warnings.push(`${tableName} query failed due to missing column/table: ${msg}`);
      return [];
    }
    throw err;
  }
};

const severityRank = (severity: string) => {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    default: return 1;
  }
};

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const exceptionRow = (input: JsonRecord): JsonRecord => ({
  id: input.id,
  branch_id: input.branch_id ?? null,
  exception_type: input.exception_type,
  severity: input.severity || 'medium',
  source_table: input.source_table,
  source_id: String(input.source_id || input.id),
  source_number: input.source_number || null,
  title: input.title,
  description: input.description || null,
  status: input.status || 'open',
  created_at: input.created_at,
  metadata: input.metadata || {}
});

export async function getExceptionQueue(input: {
  branchId?: number | null;
  status?: string | null;
  severity?: string | null;
  limit?: number;
}): Promise<{ data: JsonRecord[]; warnings: string[] }> {
  const warnings: string[] = [];
  const limit = Math.min(Math.max(Number(input.limit || 100), 1), 500);
  const rows: JsonRecord[] = [];

  rows.push(...await safeQuery('inventory_alerts', warnings, async () => {
    const branch = branchWhere(input.branchId);
    const params = [...branch.params];
    let statusClause = '';
    if (input.status) {
      params.push(input.status);
      statusClause = ` AND status = $${params.length}`;
    } else {
      statusClause = ` AND status IN ('open', 'acknowledged')`;
    }
    let severityClause = '';
    if (input.severity) {
      params.push(input.severity);
      severityClause = ` AND severity = $${params.length}`;
    }

    const result = await db.query(
      `
        SELECT id, branch_id, alert_type, severity, status, message,
               source_document_type, source_document_reference, metadata, created_at
        FROM inventory_alerts
        WHERE 1=1${branch.clause}${statusClause}${severityClause}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
      params
    );

    return result.rows.map((row) => exceptionRow({
      ...row,
      exception_type: row.alert_type,
      source_table: 'inventory_alerts',
      source_id: row.id,
      source_number: row.source_document_reference,
      title: String(row.alert_type || 'inventory_alert').replace(/_/g, ' '),
      description: row.message
    }));
  }));

  rows.push(...await safeQuery('stock_take_investigations', warnings, async () => {
    const branch = branchWhere(input.branchId);
    const params = [...branch.params];
    let severityClause = '';
    if (input.severity) {
      params.push(input.severity);
      severityClause = ` AND severity = $${params.length}`;
    }
    const statusClause = input.status ? ` AND status = $${params.push(input.status)}` : ` AND status IN ('open', 'investigating')`;
    const result = await db.query(
      `
        SELECT id, branch_id, stock_count_id, item_sku, severity, status, reason, metadata, created_at
        FROM stock_take_investigations
        WHERE 1=1${branch.clause}${statusClause}${severityClause}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
      params
    );

    return result.rows.map((row) => exceptionRow({
      ...row,
      exception_type: 'critical_variance',
      source_table: 'stock_take_investigations',
      source_id: row.id,
      source_number: row.item_sku,
      title: `Stock take variance: ${row.item_sku || 'item'}`,
      description: row.reason || 'Stock take variance requires review'
    }));
  }));

  rows.push(...await safeQuery('inventory_adjustment_requests', warnings, async () => {
    const branch = branchWhere(input.branchId);
    const params = [...branch.params];
    const result = await db.query(
      `
        SELECT id, branch_id, adjustment_number, adjustment_reason, status, reason, metadata, created_at
        FROM inventory_adjustment_requests
        WHERE status IN ('requested', 'approved')
          AND adjustment_reason IN ('theft', 'loss', 'write_off', 'spoilage', 'damage', 'count_variance')
          ${branch.clause}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
      params
    );

    return result.rows.map((row) => exceptionRow({
      ...row,
      exception_type: 'suspicious_adjustment',
      severity: ['theft', 'write_off'].includes(String(row.adjustment_reason)) ? 'critical' : 'high',
      source_table: 'inventory_adjustment_requests',
      source_id: row.id,
      source_number: row.adjustment_number,
      title: `Adjustment review: ${row.adjustment_number}`,
      description: row.reason || row.adjustment_reason
    }));
  }));

  rows.push(...await safeQuery('stock_requests', warnings, async () => {
    const branch = branchWhere(input.branchId);
    const result = await db.query(
      `
        SELECT id, branch_id, request_number, status, workflow_status, reason, notes, created_at
        FROM stock_requests
        WHERE COALESCE(workflow_status, status) IN ('auditor_rejected', 'returned_for_correction', 'rejected')
          ${branch.clause}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
      branch.params
    );

    return result.rows.map((row) => exceptionRow({
      ...row,
      exception_type: 'rejected_request',
      severity: 'medium',
      source_table: 'stock_requests',
      source_id: row.id,
      source_number: row.request_number,
      title: `Rejected request: ${row.request_number || row.id}`,
      description: row.reason || row.notes || 'Request was rejected or returned'
    }));
  }));

  rows.push(...await safeQuery('dispatch_notes', warnings, async () => {
    const branch = branchWhere(input.branchId);
    const result = await db.query(
      `
        SELECT id, branch_id, dispatch_number, status, receipt_status, notes, created_at
        FROM dispatch_notes
        WHERE COALESCE(receipt_status, status) IN ('partial', 'partially_received', 'in_transit', 'dispatched')
          ${branch.clause}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
      branch.params
    );

    return result.rows.map((row) => exceptionRow({
      ...row,
      exception_type: row.receipt_status === 'partial' || row.receipt_status === 'partially_received'
        ? 'partial_dispatch'
        : 'unreceived_dispatch',
      severity: row.receipt_status === 'partial' || row.receipt_status === 'partially_received' ? 'high' : 'medium',
      source_table: 'dispatch_notes',
      source_id: row.id,
      source_number: row.dispatch_number,
      title: `Dispatch follow-up: ${row.dispatch_number || row.id}`,
      description: row.notes || 'Dispatch requires receipt verification'
    }));
  }));

  const filtered = rows
    .filter((row) => !input.severity || row.severity === input.severity)
    .sort((a, b) => {
      const severityDelta = severityRank(b.severity) - severityRank(a.severity);
      if (severityDelta !== 0) return severityDelta;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })
    .slice(0, limit);

  return { data: filtered, warnings };
}

export async function getAlertSummary(input: {
  branchId?: number | null;
  status?: string | null;
  limit?: number;
}): Promise<{ summary: JsonRecord; recent: JsonRecord[]; warnings: string[] }> {
  const warnings: string[] = [];
  if (!(await tableExists('inventory_alerts'))) {
    return {
      summary: { total: 0, critical: 0, high: 0, open: 0, resolved: 0, by_type: [] },
      recent: [],
      warnings: ['inventory_alerts is not available; apply the core inventory migration.']
    };
  }

  const branch = branchWhere(input.branchId);
  const params = [...branch.params];
  let statusClause = '';
  if (input.status) {
    params.push(input.status);
    statusClause = ` AND status = $${params.length}`;
  }

  const [summaryResult, byTypeResult, recentResult] = await Promise.all([
    db.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
          COUNT(*) FILTER (WHERE severity = 'high')::int AS high,
          COUNT(*) FILTER (WHERE status = 'open')::int AS open,
          COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved
        FROM inventory_alerts
        WHERE 1=1${branch.clause}${statusClause}
      `,
      params
    ),
    db.query(
      `
        SELECT alert_type, severity, status, COUNT(*)::int AS count
        FROM inventory_alerts
        WHERE 1=1${branch.clause}${statusClause}
        GROUP BY alert_type, severity, status
        ORDER BY count DESC, alert_type
      `,
      params
    ),
    db.query(
      `
        SELECT *
        FROM inventory_alerts
        WHERE 1=1${branch.clause}${statusClause}
        ORDER BY created_at DESC
        LIMIT ${Math.min(Math.max(Number(input.limit || 25), 1), 100)}
      `,
      params
    )
  ]);

  return {
    summary: {
      ...(summaryResult.rows[0] || { total: 0, critical: 0, high: 0, open: 0, resolved: 0 }),
      by_type: byTypeResult.rows
    },
    recent: recentResult.rows,
    warnings
  };
}

export async function getRoleDashboard(input: {
  role: string;
  branchId?: number | null;
}): Promise<{ data: JsonRecord; warnings: string[] }> {
  const warnings: string[] = [];
  const branch = branchWhere(input.branchId);
  const params = branch.params;

  const countFrom = async (tableName: string, where = ''): Promise<number> => {
    if (!(await tableExists(tableName))) {
      warnings.push(`${tableName} is not available.`);
      return 0;
    }
    const result = await db.query(
      `SELECT COUNT(*)::int AS count FROM ${tableName} WHERE 1=1${branch.clause}${where}`,
      params
    );
    return numberValue(result.rows[0]?.count);
  };

  const [
    openAlerts,
    criticalAlerts,
    pendingAdjustments,
    pendingRequests,
    pendingDispatches,
    productionRuns,
    stockTakes
  ] = await Promise.all([
    countFrom('inventory_alerts', ` AND status = 'open'`),
    countFrom('inventory_alerts', ` AND status = 'open' AND severity = 'critical'`),
    countFrom('inventory_adjustment_requests', ` AND status IN ('requested', 'approved')`),
    countFrom('stock_requests', ` AND COALESCE(workflow_status, status) IN ('submitted_to_auditor', 'auditor_approved', 'packing')`),
    countFrom('dispatch_notes', ` AND COALESCE(receipt_status, status) IN ('dispatched', 'in_transit', 'partial', 'partially_received')`),
    countFrom('inventory_production_runs', ` AND created_at >= NOW() - INTERVAL '7 days'`),
    countFrom('stock_counts', ` AND status NOT IN ('closed', 'posted')`)
  ]);

  const queue = await getExceptionQueue({ branchId: input.branchId, limit: 10 });
  warnings.push(...queue.warnings);

  return {
    data: {
      role: input.role,
      branch_id: input.branchId ?? null,
      cards: {
        open_alerts: openAlerts,
        critical_alerts: criticalAlerts,
        pending_adjustments: pendingAdjustments,
        pending_requests: pendingRequests,
        pending_dispatches: pendingDispatches,
        production_runs_7d: productionRuns,
        open_stock_takes: stockTakes
      },
      exception_queue: queue.data
    },
    warnings
  };
}

export async function listGovernanceDocuments(input: {
  branchId?: number | null;
  documentType?: string | null;
  limit?: number;
}): Promise<{ data: JsonRecord[]; warnings: string[] }> {
  const warnings: string[] = [];
  if (!(await tableExists('inventory_documents'))) {
    return { data: [], warnings: ['inventory_documents is not available.'] };
  }

  const branch = branchWhere(input.branchId);
  const params = [...branch.params];
  let typeClause = `
    AND document_type IN (
      'branch_request',
      'auditor_approval',
      'packing_list',
      'dispatch_document',
      'receipt_verification',
      'department_request_log',
      'material_issue_note',
      'production_run',
      'shift_closing',
      'stock_take',
      'stock_take_variance',
      'stock_adjustment',
      'audit_exception_report',
      'governance_dashboard_export',
      'inventory_alert_report'
    )
  `;

  if (input.documentType) {
    params.push(input.documentType);
    typeClause = ` AND document_type = $${params.length}`;
  }

  const result = await db.query(
    `
      SELECT *
      FROM inventory_documents
      WHERE 1=1${branch.clause}${typeClause}
      ORDER BY created_at DESC
      LIMIT ${Math.min(Math.max(Number(input.limit || 100), 1), 500)}
    `,
    params
  );

  return { data: result.rows, warnings };
}

export async function listGovernanceRules(): Promise<JsonRecord[]> {
  if (!(await tableExists('inventory_governance_rules'))) return [];
  const result = await db.query(
    `
      SELECT *
      FROM inventory_governance_rules
      WHERE active = TRUE
      ORDER BY severity DESC, title ASC
    `
  );
  return result.rows;
}

export async function reviewException(input: {
  branchId?: number | null;
  exceptionType: string;
  severity?: string | null;
  sourceTable: string;
  sourceId: string;
  sourceNumber?: string | null;
  title: string;
  description?: string | null;
  status: string;
  assignedRole?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
  actorId: string;
  metadata?: JsonRecord | null;
}): Promise<JsonRecord> {
  if (!allowedReviewStatuses.has(input.status)) {
    throw new AppError('Invalid review status', 400);
  }
  if (!(await tableExists('inventory_governance_reviews'))) {
    throw new AppError('Inventory governance review table is not available. Apply migrations first.', 503);
  }

  const result = await db.query(
    `
      INSERT INTO inventory_governance_reviews (
        branch_id, exception_type, severity, source_table, source_id, source_number,
        title, description, status, assigned_role, assigned_to, reviewed_by,
        reviewed_at, resolution_notes, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid, $12::uuid, NOW(), $13, $14::jsonb)
      RETURNING *
    `,
    [
      input.branchId ?? null,
      input.exceptionType,
      input.severity || 'medium',
      input.sourceTable,
      input.sourceId,
      input.sourceNumber || null,
      input.title,
      input.description || null,
      input.status,
      input.assignedRole || null,
      input.assignedTo || null,
      input.actorId,
      input.notes || null,
      JSON.stringify(input.metadata || {})
    ]
  );

  if (input.sourceTable === 'inventory_alerts' && await tableExists('inventory_alerts')) {
    const alertStatus = input.status === 'resolved'
      ? 'resolved'
      : input.status === 'dismissed'
        ? 'dismissed'
        : input.status === 'acknowledged' || input.status === 'in_review'
          ? 'acknowledged'
          : null;
    if (alertStatus) {
      await db.query(
        `
          UPDATE inventory_alerts
          SET status = $1, resolved_at = CASE WHEN $1 IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END
          WHERE id::text = $2
        `,
        [alertStatus, input.sourceId]
      );
    }
  }

  if (input.sourceTable === 'stock_take_investigations' && await tableExists('stock_take_investigations')) {
    const investigationStatus = input.status === 'resolved' ? 'closed' : input.status === 'dismissed' ? 'closed' : 'investigating';
    await db.query(
      `UPDATE stock_take_investigations SET status = $1 WHERE id::text = $2`,
      [investigationStatus, input.sourceId]
    );
  }

  return result.rows[0];
}
