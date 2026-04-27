import { apiClient } from './core';

export interface SecurityConfig {
  // Authentication
  jwt_expiry_minutes: number;
  refresh_token_rotation: boolean;
  session_timeout_minutes: number;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  
  // Rate Limiting
  auth_rate_limit: number;
  financial_rate_limit: number;
  general_rate_limit: number;
  
  // Security Features
  require_2fa_for_admin: boolean;
  require_2fa_for_financial: boolean;
  ip_whitelist_enabled: boolean;
  geo_blocking_enabled: boolean;
  vpn_detection_enabled: boolean;
  
  // Audit & Monitoring
  log_all_api_calls: boolean;
  alert_on_suspicious_activity: boolean;
  alert_on_failed_logins: number;
  alert_on_role_changes: boolean;
  
  // Database Security
  rls_enabled: boolean;
  backup_frequency_hours: number;
  encryption_at_rest: boolean;
}

export interface RLSPolicy {
  table_name: string;
  policy_name: string;
  policy_type: string;
  enabled: boolean;
  violation_count?: number;
  last_violation?: string;
}

export interface APIEndpoint {
  endpoint: string;
  requests: number;
  errors: number;
  avgResponseTime: number;
}

export interface BlockedIP {
  id: string;
  ip_address: string;
  reason?: string;
  blocked_by?: string;
  blocked_at: string;
  expires_at?: string;
  is_permanent: boolean;
}

export const securityAPI = {
  /**
   * Get security configuration
   */
  getConfig: () => 
    apiClient.get<SecurityConfig>('/security/config'),

  /**
   * Update security configuration
   */
  updateConfig: (config: Partial<SecurityConfig>) => 
    apiClient.put<SecurityConfig>('/security/config', config),

  /**
   * Get RLS policies status
   */
  getRLSPolicies: () => 
    apiClient.get<RLSPolicy[]>('/security/rls-policies'),

  /**
   * Get API security metrics
   */
  getAPIMetrics: () => 
    apiClient.get<{
      rateLimitViolations: number;
      endpoints: APIEndpoint[];
      totalRequests: number;
    }>('/security/api-metrics'),

  /**
   * Get blocked IPs
   */
  getBlockedIPs: () => 
    apiClient.get<BlockedIP[]>('/security/blocked-ips'),

  /**
   * Block an IP address
   */
  blockIP: (ip_address: string, reason?: string) => 
    apiClient.post<BlockedIP>('/security/block-ip', { ip_address, reason }),

  /**
   * Unblock an IP address
   */
  unblockIP: (ip_address: string) => 
    apiClient.post<void>('/security/unblock-ip', { ip_address }),

  /**
   * Get active sessions
   */
  getActiveSessions: () => 
    apiClient.get<any[]>('/security/active-sessions'),

  /**
   * Terminate a user session
   */
  terminateSession: (user_id: string, session_id?: string) => 
    apiClient.post<void>('/security/terminate-session', { user_id, session_id }),

  /**
   * Terminate all sessions
   */
  terminateAllSessions: () => 
    apiClient.post<void>('/security/terminate-all-sessions', {})
};
