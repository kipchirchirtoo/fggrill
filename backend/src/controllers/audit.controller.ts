import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

type AuditSource = {
  table: string;
  label: string;
  timeColumn: string;
};

type AuditQuery = {
  userId?: string;
  action?: string;
  tableName?: string;
  branchId?: string;
  severity?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
};

const AUDIT_SOURCES: AuditSource[] = [
  { table: 'audit_logs', label: 'System Audit', timeColumn: 'created_at' },
  { table: 'audit_trail', label: 'Audit Trail', timeColumn: 'performed_at' },
  { table: 'financial_audit_logs', label: 'Financial Audit', timeColumn: 'created_at' },
  { table: 'inventory_audit_logs', label: 'Inventory Audit', timeColumn: 'created_at' },
  { table: 'inventory_audit_log', label: 'Inventory Audit', timeColumn: 'created_at' },
  { table: 'stock_take_audit_log', label: 'Stock Take Audit', timeColumn: 'created_at' },
  { table: 'dispatch_audit_log', label: 'Dispatch Audit', timeColumn: 'created_at' },
  { table: 'branch_payment_audit', label: 'Branch Payment Audit', timeColumn: 'created_at' },
  { table: 'attendance_audit_logs', label: 'Attendance Audit', timeColumn: 'created_at' },
  { table: 'shift_audit_log', label: 'Shift Audit', timeColumn: 'created_at' },
  { table: 'inventory_governance_reviews', label: 'Inventory Governance', timeColumn: 'created_at' },
];

const clean = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const text = `${value}`.trim();
  return text.length > 0 ? text : undefined;
};

const firstValue = (row: any, keys: string[]): any => {
  for (const key of keys) {
    if (row?.[key] !== null && row?.[key] !== undefined && `${row[key]}`.trim() !== '') {
      return row[key];
    }
  }
  return undefined;
};

const normalizeSeverity = (row: any): string => {
  const explicit = clean(firstValue(row, ['severity', 'risk_level', 'level', 'priority']));
  if (explicit) return explicit.toLowerCase();
  const text = `${firstValue(row, ['action', 'action_type', 'event_type', 'status', 'decision', 'message']) ?? ''}`.toLowerCase();
  if (/(critical|fraud|theft|negative|over|void|reject|failed|error)/.test(text)) return 'critical';
  if (/(warning|flag|variance|mismatch|partial|pending)/.test(text)) return 'warning';
  return 'info';
};

const normalizeAuditRow = (source: AuditSource, row: any): any => {
  const action =
    clean(firstValue(row, ['action', 'action_type', 'event_type', 'audit_action', 'decision', 'status'])) ||
    'recorded';
  const tableName =
    clean(firstValue(row, ['table_name', 'entity_type', 'resource_type', 'reference_type', 'document_type', 'source_document_type'])) ||
    source.table;
  const recordId = clean(firstValue(row, [
    'record_id',
    'entity_id',
    'resource_id',
    'reference_id',
    'source_document_reference',
    'document_id',
    'payment_id',
    'request_id',
    'dispatch_id',
    'stock_take_id',
    'movement_id',
  ]));
  const createdAt =
    clean(firstValue(row, ['created_at', 'performed_at', 'timestamp', 'audit_at', 'reviewed_at', 'detected_at', 'updated_at'])) ||
    new Date().toISOString();
  const userId = clean(firstValue(row, [
    'user_id',
    'actor_id',
    'performed_by',
    'created_by',
    'auditor_id',
    'reviewed_by',
    'resolved_by',
    'approved_by',
  ]));
  const branchId = clean(firstValue(row, [
    'branch_id',
    'requesting_branch_id',
    'from_branch_id',
    'to_branch_id',
    'source_branch_id',
    'destination_branch_id',
  ]));
  const description =
    clean(firstValue(row, ['description', 'message', 'notes', 'reason', 'remarks', 'audit_notes', 'details'])) ||
    `${source.label}: ${action}`;

  return {
    ...row,
    id: `${source.table}:${row.id ?? row.audit_id ?? recordId ?? createdAt}`,
    raw_id: row.id ?? row.audit_id ?? null,
    audit_source: source.label,
    source_table: source.table,
    action,
    table_name: tableName,
    record_id: recordId ?? null,
    description,
    severity: normalizeSeverity(row),
    created_at: createdAt,
    user_id: userId ?? null,
    branch_id: branchId ?? null,
    metadata: row,
  };
};

const fetchSourceRows = async (source: AuditSource, limit: number): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from(source.table)
      .select('*')
      .order(source.timeColumn, { ascending: false })
      .limit(limit);

    if (error) {
      logger.warn(`Audit source skipped: ${source.table}`, { error: error.message });
      return [];
    }

    return (data || []).map((row: any) => normalizeAuditRow(source, row));
  } catch (error: any) {
    logger.warn(`Audit source unavailable: ${source.table}`, { error: error?.message || error });
    return [];
  }
};

const matchesAuditQuery = (row: any, query: AuditQuery): boolean => {
  if (query.userId && `${row.user_id}` !== query.userId) return false;
  if (query.branchId && query.branchId !== '0' && `${row.branch_id}` !== query.branchId) return false;
  if (query.source && query.source !== 'all' && `${row.source_table}` !== query.source && `${row.audit_source}` !== query.source) return false;
  if (query.action && !`${row.action}`.toLowerCase().includes(query.action.toLowerCase())) return false;
  if (query.tableName && !`${row.table_name}`.toLowerCase().includes(query.tableName.toLowerCase())) return false;
  if (query.severity && query.severity !== 'all' && `${row.severity}` !== query.severity.toLowerCase()) return false;

  const time = new Date(row.created_at).getTime();
  if (query.startDate && time < new Date(query.startDate).getTime()) return false;
  if (query.endDate && time > new Date(query.endDate).getTime()) return false;
  return true;
};

const enrichAuditRows = async (rows: any[]): Promise<any[]> => {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const branchIds = [...new Set(rows.map((row) => row.branch_id).filter(Boolean))];

  let usersById = new Map<string, any>();
  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role')
      .in('id', userIds);
    if (!error) {
      usersById = new Map((data || []).map((user: any) => [`${user.id}`, user]));
    }
  }

  let branchesById = new Map<string, any>();
  if (branchIds.length > 0) {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, code')
      .in('id', branchIds);
    if (!error) {
      branchesById = new Map((data || []).map((branch: any) => [`${branch.id}`, branch]));
    }
  }

  return rows.map((row) => {
    const user = row.user_id ? usersById.get(`${row.user_id}`) : null;
    const branch = row.branch_id ? branchesById.get(`${row.branch_id}`) : null;
    const userName =
      row.user_name ||
      row.actor_name ||
      (user ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email : null) ||
      'System';
    return {
      ...row,
      user,
      user_name: userName,
      branch,
      branch_name: branch?.name || null,
    };
  });
};

const getUnifiedAuditRows = async (query: AuditQuery, fetchLimit: number): Promise<any[]> => {
  const rows = (await Promise.all(AUDIT_SOURCES.map((source) => fetchSourceRows(source, fetchLimit)))).flat();
  return rows
    .filter((row) => matchesAuditQuery(row, query))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// @desc    Get audit logs from every known audit source
// @route   GET /api/audit/logs
// @access  Private (Admin/Auditor)
export const getAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const numericLimit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const numericPage = Math.max(Number(req.query.page) || 1, 1);
    const from = (numericPage - 1) * numericLimit;
    const query: AuditQuery = {
      userId: clean(req.query.user_id),
      action: clean(req.query.action),
      tableName: clean(req.query.table_name ?? req.query.entity_type),
      branchId: clean(req.query.branch_id ?? req.query.branchId),
      severity: clean(req.query.severity),
      source: clean(req.query.source),
      startDate: clean(req.query.startDate ?? req.query.start_date),
      endDate: clean(req.query.endDate ?? req.query.end_date),
    };

    const rows = await getUnifiedAuditRows(query, Math.max(numericLimit * 4, 120));
    const pageRows = rows.slice(from, from + numericLimit);
    const enrichedData = await enrichAuditRows(pageRows);

    res.status(200).json({
      success: true,
      count: enrichedData.length,
      total: rows.length,
      page: numericPage,
      limit: numericLimit,
      data: enrichedData,
      summary: {
        total: rows.length,
        critical: rows.filter((row) => row.severity === 'critical').length,
        warning: rows.filter((row) => row.severity === 'warning').length,
        sources: [...new Set(rows.map((row) => row.source_table))],
      },
    });
  } catch (error) {
    logger.error('Failed to fetch audit logs', error);
    res.status(200).json({
      success: true,
      count: 0,
      total: 0,
      data: [],
      summary: { total: 0, critical: 0, warning: 0, sources: [] },
    });
  }
};

// @desc    Create audit log entry
// @route   POST /api/audit/logs
// @access  Private (System)
export const createAuditLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { action, table_name, record_id, old_values, new_values, ip_address, user_agent, branch_id, severity, description } = req.body;

    const auditLog = {
      user_id: req.user?.id,
      action,
      table_name,
      record_id,
      old_values,
      new_values,
      branch_id: branch_id || req.user?.branch_id || null,
      severity: severity || 'info',
      description,
      ip_address: ip_address || req.ip,
      user_agent: user_agent || req.get('user-agent'),
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('audit_logs')
      .insert([auditLog])
      .select()
      .single();

    if (error) {
      const fallbackAuditLog = {
        user_id: auditLog.user_id,
        action: auditLog.action,
        table_name: auditLog.table_name,
        record_id: auditLog.record_id,
        old_values: auditLog.old_values,
        new_values: auditLog.new_values,
        ip_address: auditLog.ip_address,
        user_agent: auditLog.user_agent,
        created_at: auditLog.created_at,
      };

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('audit_logs')
        .insert([fallbackAuditLog])
        .select()
        .single();

      if (fallbackError) throw error;

      logger.info(`Audit log created with legacy schema: ${action} on ${table_name}#${record_id}`);

      res.status(201).json({
        success: true,
        data: fallbackData,
      });
      return;
    }

    logger.info(`Audit log created: ${action} on ${table_name}#${record_id}`);

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get audit log statistics
// @route   GET /api/audit/stats
// @access  Private (Admin)
export const getAuditStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query: AuditQuery = {
      branchId: clean(req.query.branch_id ?? req.query.branchId),
      startDate: clean(req.query.startDate ?? req.query.start_date),
      endDate: clean(req.query.endDate ?? req.query.end_date),
    };
    const rows = await getUnifiedAuditRows(query, 500);

    const stats = {
      totalActions: rows.length,
      critical: rows.filter((row) => row.severity === 'critical').length,
      warning: rows.filter((row) => row.severity === 'warning').length,
      actionsByType: rows.reduce((acc: Record<string, number>, log: any) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {}),
      actionsByTable: rows.reduce((acc: Record<string, number>, log: any) => {
        acc[log.table_name] = (acc[log.table_name] || 0) + 1;
        return acc;
      }, {}),
      actionsBySource: rows.reduce((acc: Record<string, number>, log: any) => {
        acc[log.source_table] = (acc[log.source_table] || 0) + 1;
        return acc;
      }, {}),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to fetch audit stats', error);
    res.status(200).json({
      success: true,
      data: {
        totalActions: 0,
        critical: 0,
        warning: 0,
        actionsByType: {},
        actionsByTable: {},
        actionsBySource: {},
      },
    });
  }
};
