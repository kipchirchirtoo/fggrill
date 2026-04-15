import { Request } from 'express';
import { supabase } from '../config/supabase';
import { logger } from './logger';
import { getRealIP, normalizeIP, getGeolocation, getDeviceFingerprint, checkIPReputation } from '../services/geolocation.service';

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
    // Get real IP address (handles proxies, load balancers, etc.)
    const rawIP = getRealIP(req);
    const ipAddress = normalizeIP(rawIP);
    
    const userAgent = req.headers['user-agent'] || '';

    // Get device fingerprint
    const deviceInfo = getDeviceFingerprint(userAgent);

    // Get geolocation data (async, don't block the request)
    let geoData = null;
    let ipReputation = null;
    
    try {
      [geoData, ipReputation] = await Promise.all([
        getGeolocation(ipAddress),
        checkIPReputation(ipAddress)
      ]);
    } catch (geoError) {
      logger.warn('Failed to fetch geolocation/reputation data:', geoError);
    }

    // Prepare log entry
    const logEntry: any = {
      user_id: userId,
      email,
      status,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_info: deviceInfo,
      auth_method: authMethod,
      message: message || (status === 'success' ? 'Login successful' : 'Login failed'),
      created_at: new Date().toISOString()
    };

    // Add geolocation data if available
    if (geoData) {
      logEntry.geo_country = geoData.country;
      logEntry.geo_country_code = geoData.country_code;
      logEntry.geo_region = geoData.region;
      logEntry.geo_city = geoData.city;
      logEntry.geo_latitude = geoData.latitude;
      logEntry.geo_longitude = geoData.longitude;
      logEntry.geo_timezone = geoData.timezone;
      logEntry.geo_isp = geoData.isp;
      logEntry.is_proxy = geoData.is_proxy;
      logEntry.is_vpn = geoData.is_vpn;
      logEntry.is_datacenter = geoData.is_datacenter;
    }

    // Add reputation data if available
    if (ipReputation) {
      logEntry.threat_score = ipReputation.threat_score;
      logEntry.is_suspicious = ipReputation.is_suspicious;
      logEntry.threat_reason = ipReputation.reason;
    }

    const { error } = await supabase.from('auth_logs').insert(logEntry);

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
    // Get real IP address if request is provided
    let ipAddress = 'system';
    if (params.req) {
      const rawIP = getRealIP(params.req);
      ipAddress = normalizeIP(rawIP);
    }
    
    await supabase.from('audit_trail').insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_values: params.oldValues,
      new_values: params.newValues,
      ip_address: ipAddress,
      user_agent: params.req?.headers['user-agent'],
      performed_at: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Error recording audit trail:', err);
  }
};
