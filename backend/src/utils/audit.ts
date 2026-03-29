import { Request } from 'express';
import { supabase } from '../config/supabase';
import { logger } from './logger';

interface LogAuthParams {
  email: string;
  status: 'success' | 'failed' | 'locked' | 'invalid_pin';
  userId?: string;
  req: Request;
  message?: string;
  authMethod?: 'password' | 'pos_pin' | 'oauth';
}

/**
 * Logs every authentication attempt (Historical tracking)
 */
export const logAuthAttempt = async ({
  email,
  status,
  userId,
  req,
  message,
  authMethod = 'password'
}: LogAuthParams) => {
  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Simple device/browser parsing (In a real app, use a more robust parser)
    const deviceInfo = {
      userAgent,
      platform: req.headers['sec-ch-ua-platform'] || 'Unknown'
    };

    const { error } = await supabase.from('auth_logs').insert({
      user_id: userId,
      email,
      status,
      ip_address: typeof ipAddress === 'string' ? ipAddress : JSON.stringify(ipAddress),
      user_agent: userAgent,
      device_info: deviceInfo,
      auth_method: authMethod,
      message,
      created_at: new Date().toISOString()
    });

    if (error) {
      logger.error('Failed to insert auth_log:', error);
    }
  } catch (err) {
    logger.error('Error in logAuthAttempt utility:', err);
  }
};

/**
 * Records a security anomaly event
 */
export const logSecurityEvent = async (params: {
  eventType: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  userId?: string;
  description: string;
  metadata?: any;
}) => {
  try {
    const { error } = await supabase.from('security_events').insert({
      event_type: params.eventType,
      severity: params.severity,
      user_id: params.userId,
      description: params.description,
      metadata: params.metadata || {},
      status: 'open',
      created_at: new Date().toISOString()
    });

    if (error) {
      logger.error('Failed to insert security_event:', error);
    }
  } catch (err) {
    logger.error('Error in logSecurityEvent utility:', err);
  }
};

/**
 * Standardized Audit Trail insertion (wraps existing logic if any)
 */
export const recordAuditTrail = async (params: {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  req?: Request;
}) => {
  try {
    const ipAddress = params.req ? (params.req.ip || params.req.headers['x-forwarded-for'] || params.req.socket.remoteAddress) : null;
    
    await supabase.from('audit_trail').insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_values: params.oldValues,
      new_values: params.newValues,
      ip_address: typeof ipAddress === 'string' ? ipAddress : JSON.stringify(ipAddress),
      user_agent: params.req?.headers['user-agent'],
      performed_at: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Error recording audit trail:', err);
  }
};
