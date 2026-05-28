import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * @desc    Get logs summary statistics for dashboard
 * @route   GET /api/admin/logs/overview
 */
export const getLogsOverview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Total Logins Today
    const { count: loginCount } = await supabase
      .from('auth_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // 2. Failed Logins Today
    const { count: failedLoginCount } = await supabase
      .from('auth_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', today.toISOString());

    // 3. Security Alerts Today
    const { count: securityAlertCount } = await supabase
      .from('security_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // 4. Critical Events (last 24h)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: criticalEvents } = await supabase
        .from('security_events')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'CRITICAL')
        .gte('created_at', last24h.toISOString());

    // 5. Activity Trend (last 24h by hour)
    const { data: recentAuth } = await supabase
        .from('auth_logs')
        .select('created_at, status')
        .gte('created_at', last24h.toISOString());

    const { data: recentAlerts } = await supabase
        .from('security_events')
        .select('created_at, severity')
        .gte('created_at', last24h.toISOString());

    // Group by hour
    const activityTrend = Array.from({ length: 24 }).map((_, i) => {
        const hourDate = new Date(Date.now() - (23 - i) * 60 * 60 * 1000);
        const hourStr = hourDate.getHours().toString().padStart(2, '0') + ':00';
        
        const logins = (recentAuth || []).filter(l => 
            new Date(l.created_at).getHours() === hourDate.getHours() && 
            new Date(l.created_at).toDateString() === hourDate.toDateString()
        ).length;

        const alerts = (recentAlerts || []).filter(a => 
            new Date(a.created_at).getHours() === hourDate.getHours() && 
            new Date(a.created_at).toDateString() === hourDate.toDateString()
        ).length;

        return { time: hourStr, logins, alerts };
    });

    res.status(200).json({
      success: true,
      data: {
        loginsToday: loginCount || 0,
        failedLoginsToday: failedLoginCount || 0,
        securityAlertsToday: securityAlertCount || 0,
        criticalEvents24h: criticalEvents || 0,
        activityTrend
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get paginated and filtered logs from a specific category
 * @route   GET /api/admin/logs
 */
export const getUnifiedLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, page = 1, limit = 20, search, startDate, endDate, severity, status, threatLevel, ipAddress } = req.query;
    
    let query: any;
    let orderBy = 'created_at';
    let userIdField = 'user_id';

    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    // Determine target table based on category
    switch (category) {
      case 'security':
        query = supabase.from('auth_logs').select('*', { count: 'exact' });
        break;
      case 'audit':
        query = supabase.from('audit_trail').select('*', { count: 'exact' });
        orderBy = 'performed_at';
        break;
      case 'finance':
        query = supabase.from('audit_night_sessions').select('*', { count: 'exact' });
        orderBy = 'audit_date';
        userIdField = 'performed_by';
        break;
      case 'alerts':
        query = supabase.from('security_events').select('*', { count: 'exact' });
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid category' });
    }
    
    // Note: Error handling for these query builders is done when query is executed below

    // Apply common filters
    if (startDate) query = query.gte(orderBy, startDate);
    if (endDate) query = query.lte(orderBy, endDate);
    if (severity && category !== 'finance') query = query.eq('severity', severity);
    if (status && category === 'security') query = query.eq('status', status);
    if (threatLevel && category === 'alerts') query = query.eq('severity', threatLevel);
    if (ipAddress && category === 'security') query = query.eq('ip_address', ipAddress);
    
    // Search 
    if (search) {
        if (category === 'security') query = query.or(`email.ilike.%${search}%,ip_address.ilike.%${search}%`);
        if (category === 'audit') query = query.ilike('action', `%${search}%`);
        if (category === 'alerts') query = query.or(`event_type.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, count, error } = await query
      .order(orderBy, { ascending: false })
      .range(from, to);

    if (error) {
        logger.error(`Error fetching logs for category ${category}:`, error);
        throw error;
    }

    const userIds = [...new Set((data || [])
      .map((item: any) => item[userIdField] || item.user_id)
      .filter(Boolean))];
    const emails = [...new Set((data || [])
      .map((item: any) => String(item.email || '').trim().toLowerCase())
      .filter(Boolean))];

    const { data: users, error: usersError } = userIds.length
      ? await supabase
          .from('users')
          .select('id, email, first_name, last_name, role')
          .in('id', userIds)
      : { data: [], error: null };

    if (usersError) throw usersError;

    const { data: emailUsers, error: emailUsersError } = emails.length
      ? await supabase
          .from('users')
          .select('id, email, first_name, last_name, role')
          .in('email', emails)
      : { data: [], error: null };

    if (emailUsersError) throw emailUsersError;

    const userMap = new Map((users || []).map((user: any) => [String(user.id), user]));
    const emailUserMap = new Map((emailUsers || []).map((user: any) => [String(user.email || '').toLowerCase(), user]));

    // Normalize data for frontend consistency
    const normalizedData = (data || []).map((item: any) => {
        const actor =
          userMap.get(String(item[userIdField] || item.user_id)) ||
          emailUserMap.get(String(item.email || '').toLowerCase()) ||
          { email: item.email || 'System' };

        return {
          ...item,
          category,
          // Ensure a consistent timestamp field for the frontend
          created_at: item.created_at || item.performed_at || item.audit_date || item.started_at,
          actor,
          user: actor,
          user_name: `${actor.first_name || ''} ${actor.last_name || ''}`.trim(),
          user_role: actor.role || item.role || null
        };
    });

    res.status(200).json({
      success: true,
      count: count || 0,
      data: normalizedData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Read system log files from disk
 * @route   GET /api/admin/logs/system
 */
export const getSystemLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logType = req.query.type || 'error'; // error, combined, exceptions
    const linesToRead = Number(req.query.lines) || 100;
    
    const logPath = path.join(process.cwd(), 'logs', `${logType}.log`);

    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ success: false, message: 'Log file not found' });
    }

    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.trim().split('\n').reverse().slice(0, linesToRead);

    res.status(200).json({
      success: true,
      data: lines.map(line => {
          try {
              return JSON.parse(line);
          } catch {
              return { message: line, level: logType, timestamp: new Date().toISOString() };
          }
      })
    });
  } catch (error) {
    next(error);
  }
};
