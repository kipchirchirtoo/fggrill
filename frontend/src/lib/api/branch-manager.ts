import { fetchAPI, buildQuery } from './core';
import { ApiResponse } from './types';

// =====================================
// STAFF AUDIT API
// =====================================

export const staffAuditAPI = {
  getAuditTrail: (params?: {
    branch_id?: string;
    staff_id?: string;
    action_type?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
  }) => fetchAPI<any>(`/staff/audit${buildQuery(params)}`),

  getCriticalActions: (params?: {
    branch_id?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
  }) => fetchAPI<any>(`/staff/audit/critical${buildQuery(params)}`),

  getStaffAuditSummary: (staffId: string, params?: {
    from_date?: string;
    to_date?: string;
  }) => fetchAPI<any>(`/staff/${staffId}/audit-summary${buildQuery(params)}`),
};

// =====================================
// PROFIT & LOSS API
// =====================================

export const profitLossAPI = {
  getProfitLossStatement: (params: {
    branch_id: string;
    from_date?: string;
    to_date?: string;
  }) => fetchAPI<any>(`/finance/profit-loss${buildQuery(params)}`),

  getExpenseBreakdown: (params: {
    branch_id: string;
    from_date?: string;
    to_date?: string;
  }) => fetchAPI<any>(`/finance/expense-breakdown${buildQuery(params)}`),
};

// =====================================
// STOCK ANALYTICS API
// =====================================

export const stockAnalyticsAPI = {
  getConsumptionTrends: (params: {
    branch_id: string;
    period?: string;
    category?: string;
  }) => fetchAPI<any>(`/store/consumption-trends${buildQuery(params)}`),

  getReorderSuggestions: (params: {
    branch_id: string;
  }) => fetchAPI<any>(`/store/reorder-suggestions${buildQuery(params)}`),

  getStockMovement: (params: {
    branch_id: string;
    item_sku?: string;
    days?: string;
  }) => fetchAPI<any>(`/store/stock-movement${buildQuery(params)}`),

  getWastageAnalytics: (params: {
    branch_id: string;
    days?: string;
  }) => fetchAPI<any>(`/store/wastage-analytics${buildQuery(params)}`),
};
