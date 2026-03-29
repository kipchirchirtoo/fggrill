import { apiClient, buildQuery } from './core';

export interface LogEntry {
    id: string;
    created_at: string;
    category: string;
    status: string;
    message: string;
    ip_address?: string;
    user_agent?: string;
    device_info?: any;
    auth_method?: string;
    email?: string;
    user?: {
        first_name: string;
        last_name: string;
        email: string;
    };
    actor?: any;
    action?: string;
    entity_type?: string;
    severity?: string;
    details?: any;
}

export interface LogsOverview {
    loginsToday: number;
    failedLoginsToday: number;
    securityAlertsToday: number;
    criticalEvents24h: number;
    activityTrend: Array<{ time: string; logins: number; alerts: number }>;
}

export const adminLogsAPI = {
    /**
     * Get logs overview statistics
     */
    getOverview: () => 
        apiClient.get<LogsOverview>('/admin-logs/overview'),

    /**
     * Get unified logs with filtering
     */
    getLogs: (params: {
        category: 'security' | 'audit' | 'finance' | 'alerts';
        page?: number;
        limit?: number;
        search?: string;
        startDate?: string;
        endDate?: string;
        severity?: string;
    }) => 
        apiClient.get<LogEntry[]>(`/admin-logs${buildQuery(params)}`),

    /**
     * Get system log files
     */
    getSystemLogs: (params: { type?: string; lines?: number }) => 
        apiClient.get<any[]>(`/admin-logs/system${buildQuery(params)}`)
};
