import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

// =====================================================
// AUDIT LOGS
// =====================================================

// @desc    Get audit logs
// @route   GET /api/audit/logs
// @access  Private (Admin)
export const getAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { user_id, action, table_name, startDate, endDate, limit = 100, page = 1 } = req.query;
    const numericLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
    const numericPage = Math.max(Number(page) || 1, 1);
    const from = (numericPage - 1) * numericLimit;
    const to = from + numericLimit - 1;

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (action) {
      query = query.eq('action', action);
    }

    if (table_name) {
      query = query.eq('table_name', table_name);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    const userIds = [...new Set((data || []).map((log: any) => log.user_id).filter(Boolean))];
    let usersById = new Map<string, { id: string; first_name: string; last_name: string; email: string; role?: string }>();

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .in('id', userIds);

      if (!usersError) {
        usersById = new Map((users || []).map((user: any) => [user.id, user]));
      }
    }

    const enrichedData = (data || []).map((log: any) => ({
      ...log,
      user: log.user_id ? (usersById.get(log.user_id) || null) : null,
    }));

    res.status(200).json({
      success: true,
      count: enrichedData.length,
      data: enrichedData
    });
  } catch (error) {
    logger.error('Failed to fetch audit logs', error);
    res.status(200).json({
      success: true,
      count: 0,
      data: []
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
    const { action, table_name, record_id, old_values, new_values, ip_address, user_agent } = req.body;

    const auditLog = {
      user_id: req.user?.id,
      action,
      table_name,
      record_id,
      old_values,
      new_values,
      ip_address: ip_address || req.ip,
      user_agent: user_agent || req.get('user-agent'),
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('audit_logs')
      .insert([auditLog])
      .select()
      .single();

    if (error) throw error;

    logger.info(`Audit log created: ${action} on ${table_name}#${record_id}`);

    res.status(201).json({
      success: true,
      data
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
    const { startDate, endDate } = req.query;

    let countQuery = supabase
      .from('audit_logs')
      .select('*', { count: 'planned', head: true });

    if (startDate) {
      countQuery = countQuery.gte('created_at', startDate);
    }

    if (endDate) {
      countQuery = countQuery.lte('created_at', endDate);
    }

    const { count, error: countError } = await countQuery;

    if (countError) throw countError;

    let summaryQuery = supabase
      .from('audit_logs')
      .select('action, table_name')
      .order('created_at', { ascending: false })
      .limit(500);

    if (startDate) {
      summaryQuery = summaryQuery.gte('created_at', startDate);
    }

    if (endDate) {
      summaryQuery = summaryQuery.lte('created_at', endDate);
    }

    const { data, error } = await summaryQuery;

    if (error) throw error;

    const stats = {
      totalActions: count || data?.length || 0,
      actionsByType: (data || []).reduce((acc: any, log: any) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {}),
      actionsByTable: (data || []).reduce((acc: any, log: any) => {
        acc[log.table_name] = (acc[log.table_name] || 0) + 1;
        return acc;
      }, {})
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to fetch audit stats', error);
    res.status(200).json({
      success: true,
      data: {
        totalActions: 0,
        actionsByType: {},
        actionsByTable: {}
      }
    });
  }
};
