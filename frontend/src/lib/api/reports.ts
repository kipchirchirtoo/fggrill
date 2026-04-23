import { fetchAPI, fetchPythonAPI, buildQuery, REPORTS_SERVICE_URL, PYTHON_SERVICE_URL } from './core';
import { 
  ApiResponse, 
  ReportTemplate, 
  AuditLog 
} from './types';

// =====================================
// REPORTS API (Node & Python)
// =====================================

const reportsBase = {
  getReports: (params?: any) => fetchAPI<ReportTemplate[]>(`/reports${buildQuery(params)}`),
  getReport: (id: string | number) => fetchAPI<ReportTemplate>(`/reports/${id}`),
  createReport: (data: any) => fetchAPI<ReportTemplate>('/reports', { method: 'POST', body: JSON.stringify(data) }),
  updateReport: (id: string | number, data: any) => fetchAPI<ReportTemplate>(`/reports/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReport: (id: string | number) => fetchAPI<void>(`/reports/${id}`, { method: 'DELETE' }),
  
  generateReport: (id: string | number, data: any) => fetchAPI<any>(`/reports/${id}/generate`, { method: 'POST', body: JSON.stringify(data) }),
  scheduleReport: (id: string | number, data: any) => fetchAPI<void>(`/reports/${id}/schedule`, { method: 'POST', body: JSON.stringify(data) }),
  sendReport: (id: string | number, emails: string[]) => fetchAPI<void>(`/reports/${id}/send`, { method: 'POST', body: JSON.stringify({ emails }) }),
  getReportHistory: (id: string | number) => fetchAPI<any[]>(`/reports/${id}/history`),
  
  // Specific Report Types
  getDashboardReport: (params?: any) => fetchAPI<any>(`/reports/dashboard${buildQuery(params)}`),
  getOccupancyReport: (params?: any) => fetchAPI<any>(`/reports/occupancy${buildQuery(params)}`),
  getRevenueReport:   (params?: any) => fetchAPI<any>(`/reports/revenue${buildQuery(params)}`),
  getInventoryReport: (params?: any) => fetchAPI<any>(`/reports/inventory${buildQuery(params)}`),
  getHousekeepingReport: (params?: any) => fetchAPI<any>(`/reports/housekeeping${buildQuery(params)}`),
  getMaintenanceReport: (params?: any) => fetchAPI<any>(`/reports/maintenance${buildQuery(params)}`),
  getConferenceReport: (params?: any) => fetchAPI<any>(`/reports/conference${buildQuery(params)}`),
  
  // Analytics & Stats
  getStats: () => fetchAPI<any>('/reports/stats/overview'),

  // Python Service Endpoints
  getReportData: async (reportType: string, filters: any = {}) => {
    const result = await fetchAPI<any>(`/reports/data?type=${reportType}${buildQuery(filters).replace('?', '&')}`, {}, REPORTS_SERVICE_URL);
    return result.data;
  },
  
  exportPdf: async (reportType: string, filters: any = {}) => {
    // Extract useRealData and data from filters if provided
    const { useRealData = true, data: passedData, ...otherFilters } = filters;
    
    const payload: any = { 
      reportType, 
      filters: otherFilters, 
      useRealData 
    };
    
    // Include passed data if useRealData is false
    if (!useRealData && passedData) {
      payload.data = passedData;
    }
    
    const result = await fetchAPI<Blob>('/reports/generate/branded-pdf', {
      method: 'POST',
      body: JSON.stringify(payload),
      responseType: 'blob'
    }, REPORTS_SERVICE_URL);
    
    if (result.success && result.data && typeof window !== 'undefined') {
      const blob = result.data;
      
      // Check if blob has content
      if (blob.size === 0) {
        console.error('Received empty blob from server');
        throw new Error('Received empty PDF file from server');
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Append to body, click, and cleanup
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      return true;
    }
    
    throw new Error('Failed to generate PDF report');
  },
};

export const reportsAPI = {
  ...reportsBase,
  // Type-safe aliases
  exportReport: (reportId: string | number, params?: any) => reportsBase.exportPdf(String(reportId), params),
  downloadReport: (reportId: string | number, params?: any) => reportsBase.exportPdf(String(reportId), params),
};

// =====================================
// AUDIT & COMPLIANCE API
// =====================================

export const auditAPI = {
  // Appended for UI Compatibility
  getDailyLogsStatus: (params?: any) => fetchAPI<any>(`/auditor/daily-logs${buildQuery(params)}`, { method: 'GET' }),
  verifyDailyLog: (id: any, data?: any) => fetchAPI<any>(`/auditor/daily-logs/${id}/verify`, { method: 'POST', body: JSON.stringify(data) }),
  getRoleMigrations: (params?: any) => fetchAPI<any[]>('/system/roles/migration', { method: 'GET' }),
  executeRoleMigration: (data: any) => fetchAPI<any>('/system/roles/migration/execute', { method: 'POST', body: JSON.stringify(data) }),
  revertRoleMigration: (id: any) => fetchAPI<any>(`/system/roles/migration/${id}/revert`, { method: 'POST' }),
  getSoldItemsAnalytics: (params?: any) => fetchAPI<any>(`/auditor/verify/sold-items${buildQuery({
    ...params,
    start_date: params?.start_date ?? params?.from_date,
    end_date: params?.end_date ?? params?.to_date
  })}`, { method: 'GET' }),
  downloadBrandedPdf: (reportId: any, params?: any) => fetchAPI<Blob>(`/reports/${reportId}/pdf-branded`, { method: 'GET' }),

  getAuditLogs: (params?: any) => fetchAPI<AuditLog[]>(`/audit/logs${buildQuery(params)}`),
  
  // Operational Audit
  getConsumptionVariances: (params: any) => fetchAPI<any[]>(`/auditor/consumption/variances${buildQuery(params)}`),
  getWatchlist: (params?: any) => fetchAPI<any[]>(`/auditor/watchlist${buildQuery(params)}`),
  
  // Approvals
  getPendingApprovals: (branchId?: number) => fetchAPI<any[]>(`/auditor/approvals/pending${buildQuery({ branch_id: branchId })}`),
  approveRequest: (id: string, type: string, notes?: string) =>
    fetchAPI<void>('/auditor/approvals/approve', { method: 'POST', body: JSON.stringify({ id, type, notes }) }),
  
  // Verification
  verifySales: (params: any) => fetchAPI<any>(`/auditor/verify/sales${buildQuery(params)}`),
  verifyStockLevels: (params: any) => fetchAPI<any>(`/auditor/verify/stock-levels${buildQuery(params)}`),
  createException: (data: any) => fetchAPI<any>('/auditor/exceptions', { method: 'POST', body: JSON.stringify(data) }),
  verifyAnomaly: (data: any) => fetchAPI<any>('/auditor/verify/clear', { method: 'POST', body: JSON.stringify(data) }),
  
  // Staff Audit
  getStaffAudit: (params: { 
    branch_id?: string | number; 
    staff_id?: string; 
    start_date?: string; 
    end_date?: string; 
  }) => fetchAPI<any>(`/auditor/staff-audit${buildQuery(params)}`),

  // Cashier Logbooks
  getPendingLogbooks: (params?: any) => fetchAPI<any[]>(`/cashier/logbook/pending${buildQuery(params)}`),
  auditLogbook: (id: string | number, action: 'approve' | 'reject', notes?: string) => 
    fetchAPI<void>(`/cashier/logbook/${id}/audit`, { method: 'POST', body: JSON.stringify({ action, notes }) }),

  // Aliases and Extensions for Legacy Compliance
  getAuditTrail: (params?: any) => auditAPI.getAuditLogs(params),
  verifyFinances: (params?: any) => fetchAPI<any>(`/auditor/verify/finances${buildQuery(params)}`),
  getAnomalyDetail: (id: string, type?: string) => fetchAPI<any>(`/auditor/anomalies/${id}${type ? `?type=${type}` : ''}`),
  clearAnomaly: (id: string, notes: string, type?: string) => fetchAPI<void>(`/auditor/anomalies/${id}/clear${type ? `?type=${type}` : ''}`, { method: 'POST', body: JSON.stringify({ notes, type }) }),
  verifyRevenue: (params?: any) => fetchAPI<any>(`/auditor/verify/revenue${buildQuery(params)}`),
  verifyBranchOrders: (params?: any) => fetchAPI<any>(`/auditor/verify/branch-orders${buildQuery(params)}`),
  verifySoldItems: (params?: any) => fetchAPI<any>(`/auditor/verify/sold-items${buildQuery(params)}`),
  getBarStockAudits: (params?: any) => fetchAPI<any[]>(`/auditor/bar/stock-audits${buildQuery(params)}`),
  verifyBarStockTake: (id: string, status: string) => fetchAPI<void>(`/auditor/bar/stock-audits/${id}/verify`, { method: 'POST', body: JSON.stringify({ status }) }),
  flagItem: (type: string, id: string, reason: string) => fetchAPI<void>('/auditor/flag', { method: 'POST', body: JSON.stringify({ type, id, reason }) }),
  exportStockLedger: (params?: any) => fetchAPI<Blob>('/auditor/export/stock-ledger', { method: 'POST', body: JSON.stringify(params), responseType: 'blob' }),
};

export const auditorReportsAPI = {
  // Export Endpoints (Returning Blobs for Excel/PDF)
  exportAuditorReport: (reportId: string, params?: any) => 
    fetchAPI<Blob>(`/reports/auditor/export/${reportId}${buildQuery(params)}`, { responseType: 'blob' }),

  exportExceptionSummary:      (params?: any) => fetchAPI<Blob>(`/auditor-reports/export/exception_summary${buildQuery(params)}`, { responseType: 'blob' }),
  exportComplianceAudit:       (params?: any) => fetchAPI<Blob>(`/auditor-reports/export/compliance_audit${buildQuery(params)}`, { responseType: 'blob' }),
  exportVoidAnalytics:         (params?: any) => fetchAPI<Blob>(`/auditor-reports/export/void_analytics${buildQuery(params)}`, { responseType: 'blob' }),
  exportRevenueReconciliation: (params?: any) => fetchAPI<Blob>(`/auditor-reports/export/revenue_reconciliation${buildQuery(params)}`, { responseType: 'blob' }),
  exportLeakageReport:         (params?: any) => fetchAPI<Blob>(`/auditor-reports/export/leakage_report${buildQuery(params)}`, { responseType: 'blob' }),
  exportExpenditureAudit:      (params?: any) => fetchAPI<Blob>(`/auditor-reports/export/expenditure_audit${buildQuery(params)}`, { responseType: 'blob' }),
  exportVarianceReport:        (params?: any) => fetchAPI<Blob>(`/auditor-reports/export/variance_report${buildQuery(params)}`, { responseType: 'blob' }),
  exportConsumptionAudit:      (params?: any) => fetchAPI<Blob>(`/auditor-reports/export/consumption_audit${buildQuery(params)}`, { responseType: 'blob' }),
  exportGrnAudit:              (params?: any) => fetchAPI<Blob>(`/auditor-reports/export/grn_audit${buildQuery(params)}`, { responseType: 'blob' }),

  // Branded PDF Export
  exportBrandedPdf: async (reportType: string, params: any) => {
    // Start download tracking
    let downloadId: string | null = null;
    try {
      const manager = (window as any).__downloadManager;
      if (manager) {
        const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
        downloadId = manager.addDownload(filename);
      }
    } catch (e) {
      // Download manager not available
    }

    const result = await fetchAPI<Blob>(`/reports/auditor/export/${reportType}${buildQuery(params)}`, {
      responseType: 'blob'
    }, REPORTS_SERVICE_URL);
    
    if (result.success && result.data && typeof window !== 'undefined') {
      const blob = result.data;
      
      // Check if blob has content
      if (blob.size === 0) {
        if (downloadId) {
          const manager = (window as any).__downloadManager;
          manager?.updateDownload(downloadId, { status: 'failed', error: 'Empty PDF file received' });
        }
        console.error('Received empty blob from server');
        throw new Error('Received empty PDF file from server');
      }
      
      // Use Tauri downloads if available, otherwise fallback to browser
      const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      try {
        // Dynamic import to avoid bundling issues
        const { exportPDF } = await import('../tauri-downloads');
        const success = await exportPDF(blob, filename);
        if (success) {
          if (downloadId) {
            const manager = (window as any).__downloadManager;
            manager?.updateDownload(downloadId, { status: 'completed' });
          }
          return true;
        }
        // If Tauri download fails, fall through to browser method
      } catch (importError) {
        // Tauri downloads not available, use browser method
        console.log('Using browser download method');
      }
      
      // Browser fallback method
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      
      // Append to body, click, and cleanup
      document.body.appendChild(a);
      a.click();
      
      // Update download manager
      if (downloadId) {
        const manager = (window as any).__downloadManager;
        manager?.updateDownload(downloadId, { status: 'completed' });
      }
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      return true;
    }
    
    // Update download manager on failure
    if (downloadId) {
      const manager = (window as any).__downloadManager;
      manager?.updateDownload(downloadId, { status: 'failed', error: 'Failed to generate PDF report' });
    }
    
    throw new Error('Failed to generate PDF report');
  },

  // Specialized Reports
  getBranchPerformance: (params: any) => fetchAPI<any>(`/auditor-reports/performance${buildQuery(params)}`),
  getStockUsage:        (params: any) => fetchAPI<any>(`/auditor-reports/stock-usage${buildQuery(params)}`),
  getEmployeeCredit:    (params: any) => fetchAPI<any>(`/auditor-reports/employee-credit${buildQuery(params)}`),
};
