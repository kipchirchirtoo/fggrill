import apiClient from './client';

export interface AuditorApprovalItem {
  id: string;
  category?: string;
  request_type?: string;
  status?: string;
  created_at?: string;
  notes?: string;
  amount?: number;
  metadata?: Record<string, any>;
  [key: string]: any;
}

const unwrapData = <T>(response: any, fallback: T): T => {
  const payload = response?.data?.data ?? response?.data;
  return (payload ?? fallback) as T;
};

const withFreshParams = <T extends Record<string, any> | undefined>(params?: T) => ({
  ...(params || {}),
  _ts: Date.now(),
});

export const auditorApi = {
  stats: () =>
    apiClient.get('/audit/stats', { params: withFreshParams() }).then((r) => unwrapData<Record<string, any>>(r, {})),

  logs: (params?: { page?: number; limit?: number; action?: string; table_name?: string; startDate?: string; endDate?: string }) =>
    apiClient.get('/audit/logs', { params: withFreshParams(params) }).then((r) => unwrapData<any[]>(r, [])),

  pendingApprovals: (branchId?: string) =>
    apiClient.get('/auditor/approvals/pending', {
      params: withFreshParams(branchId ? { branch_id: branchId } : undefined),
    }).then((r) => ({
      items: Array.isArray(r.data?.data) ? r.data.data : [],
      summary: r.data?.summary || {},
    })),

  handleApproval: (requestId: string, status: 'approved' | 'rejected', notes?: string) =>
    apiClient.post('/auditor/approvals/handle', { requestId, status, notes }).then((r) => r.data),

  watchlist: (params?: { status?: string; entity_type?: string }) =>
    apiClient.get('/auditor/watchlist', { params: withFreshParams(params) }).then((r) => unwrapData<any[]>(r, [])),

  resolveWatchlistItem: (id: string, data?: { status?: string; resolution_notes?: string }) =>
    apiClient.put(`/auditor/watchlist/${id}`, data || {}).then((r) => r.data),

  dailyLogs: (status: string = 'pending_audit') =>
    apiClient.get('/auditor/daily-logs', { params: withFreshParams({ status }) }).then((r) => unwrapData<any[]>(r, [])),

  verifyDailyLog: (id: string, action: 'verified' | 'rejected', notes?: string) =>
    apiClient.post(`/auditor/daily-logs/${id}/verify`, { action, notes }).then((r) => r.data),
};
