import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

/**
 * Get security configuration
 */
export const getSecurityConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Fetch from a security_config table or return defaults
    const { data, error } = await supabase
      .from('security_config')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return default config if none exists
    const config = data || {
      jwt_expiry_minutes: 15,
      refresh_token_rotation: true,
      session_timeout_minutes: 480,
      max_failed_attempts: 5,
      lockout_duration_minutes: 15,
      auth_rate_limit: 20,
      financial_rate_limit: 30,
      general_rate_limit: 100,
      require_2fa_for_admin: true,
      require_2fa_for_financial: false,
      ip_whitelist_enabled: false,
      geo_blocking_enabled: false,
      vpn_detection_enabled: true,
      log_all_api_calls: true,
      alert_on_suspicious_activity: true,
      alert_on_failed_logins: 3,
      alert_on_role_changes: true,
      rls_enabled: true,
      backup_frequency_hours: 24,
      encryption_at_rest: true
    };

    res.json({ success: true, data: config });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update security configuration
 */
export const updateSecurityConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = req.body;

    // Upsert configuration
    const { data, error } = await supabase
      .from('security_config')
      .upsert({ id: 1, ...config, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;

    // Log configuration change
    await supabase.from('audit_logs').insert({
      user_id: req.user?.id,
      action: 'security_config_updated',
      resource: 'security_config',
      resource_id: '1',
      metadata: { changes: config },
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({ success: true, data, message: 'Security configuration updated successfully' });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get RLS policies status
 */
export const getRLSPolicies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Query PostgreSQL system tables for RLS policies using the function
    const { data, error } = await supabase.rpc('get_rls_policies');

    if (error) {
      console.error('RLS policies fetch error:', error);
      // Return empty array if function doesn't exist or fails
      return res.json({ success: true, data: [] });
    }

    // Get violation counts from audit log
    const { data: violations } = await supabase
      .from('rls_audit_log')
      .select('table_name')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const violationCounts = (violations || []).reduce((acc: any, v: any) => {
      acc[v.table_name] = (acc[v.table_name] || 0) + 1;
      return acc;
    }, {});

    const policies = (data || []).map((policy: any) => ({
      ...policy,
      violation_count: violationCounts[policy.table_name] || 0
    }));

    res.json({ success: true, data: policies });
  } catch (error: any) {
    console.error('RLS policies error:', error);
    // Return empty array on error
    res.json({ success: true, data: [] });
  }
};

/**
 * Get API security metrics
 */
export const getAPISecurityMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get rate limit violations from logs
    const { data: rateLimitViolations } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'rate_limit_exceeded')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Get API endpoint stats
    const { data: apiCalls } = await supabase
      .from('audit_logs')
      .select('metadata')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1000);

    const endpointStats = (apiCalls || []).reduce((acc: any, call: any) => {
      const endpoint = call.metadata?.endpoint || 'unknown';
      if (!acc[endpoint]) {
        acc[endpoint] = { endpoint, requests: 0, errors: 0, avgResponseTime: 0 };
      }
      acc[endpoint].requests++;
      if (call.metadata?.error) acc[endpoint].errors++;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        rateLimitViolations: rateLimitViolations?.length || 0,
        endpoints: Object.values(endpointStats),
        totalRequests: apiCalls?.length || 0
      }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Block IP address
 */
export const blockIP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ip_address, reason } = req.body;

    if (!ip_address) {
      return res.status(400).json({ success: false, error: 'IP address is required' });
    }

    // Add to blocked IPs table
    const { data, error } = await supabase
      .from('blocked_ips')
      .insert({
        ip_address,
        reason,
        blocked_by: req.user?.id,
        blocked_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: req.user?.id,
      action: 'ip_blocked',
      resource: 'blocked_ips',
      resource_id: data.id,
      metadata: { ip_address, reason },
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({ success: true, data, message: `IP address ${ip_address} has been blocked` });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Unblock IP address
 */
export const unblockIP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ip_address } = req.body;

    if (!ip_address) {
      return res.status(400).json({ success: false, error: 'IP address is required' });
    }

    const { error } = await supabase
      .from('blocked_ips')
      .delete()
      .eq('ip_address', ip_address);

    if (error) throw error;

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: req.user?.id,
      action: 'ip_unblocked',
      resource: 'blocked_ips',
      metadata: { ip_address },
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({ success: true, message: `IP address ${ip_address} has been unblocked` });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get blocked IPs
 */
export const getBlockedIPs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('blocked_ips')
      .select('*')
      .order('blocked_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Terminate user session
 */
export const terminateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, session_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    // Revoke all sessions for the user
    const { error } = await supabase.auth.admin.signOut(user_id);

    if (error) throw error;

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: req.user?.id,
      action: 'session_terminated',
      resource: 'user_sessions',
      resource_id: user_id,
      metadata: { terminated_user_id: user_id, session_id },
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Session terminated successfully' });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Terminate all sessions
 */
export const terminateAllSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all active users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) throw usersError;

    // Terminate all sessions (this is a nuclear option)
    const terminationPromises = (users || []).map((user: any) =>
      supabase.auth.admin.signOut(user.id).catch(() => null)
    );

    await Promise.all(terminationPromises);

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: req.user?.id,
      action: 'all_sessions_terminated',
      resource: 'user_sessions',
      metadata: { count: users?.length || 0 },
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: `All ${users?.length || 0} sessions terminated successfully`
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get active sessions
 */
export const getActiveSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get recent successful logins (last 24 hours) from audit_logs
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, user:users(*)')
      .eq('action', 'login')
      .eq('status', 'success')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Deduplicate by user + IP
    const sessions = new Map();
    (data || []).forEach((log: any) => {
      const key = `${log.user_id}-${log.ip_address}`;
      if (!sessions.has(key)) {
        sessions.set(key, log);
      }
    });

    res.json({ success: true, data: Array.from(sessions.values()) });
  } catch (error: any) {
    next(error);
  }
};
