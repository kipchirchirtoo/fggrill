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
    const { user_id, action, table_name, startDate, endDate, limit = 100 } = req.query;

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        user:users(id, first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

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

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
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

    let query = supabase
      .from('audit_logs')
      .select('action, table_name, created_at');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate statistics
    const stats = {
      totalActions: data?.length || 0,
      actionsByType: data?.reduce((acc: any, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {}),
      actionsByTable: data?.reduce((acc: any, log) => {
        acc[log.table_name] = (acc[log.table_name] || 0) + 1;
        return acc;
      }, {})
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};
