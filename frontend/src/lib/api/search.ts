import { fetchAPI, buildQuery } from './core';
import { ApiResponse } from './types';

// =====================================
// SEARCH API
// =====================================

export const searchAPI = {
  globalSearch: (query: string, modules?: string[]) => 
    fetchAPI<any[]>(`/search${buildQuery({ q: query, modules })}`),
};

// =====================================
// ATTENDANCE ANALYTICS API
// =====================================

export const attendanceAnalyticsAPI = {
  getStats: (params?: any) => fetchAPI<any>(`/attendance/analytics/stats${buildQuery(params)}`),
};

// =====================================
// AUTOMATION API
// =====================================

export const automationAPI = {
  getStatus: () => fetchAPI<any>('/automation/status'),
  start:     () => fetchAPI<void>('/automation/start', { method: 'POST' }),
  stop:      () => fetchAPI<void>('/automation/stop',  { method: 'POST' }),
  
  runLowStockCheck:    () => fetchAPI<void>('/automation/run/low-stock-check',    { method: 'POST' }),
  runComplianceCheck:  (days?: number) => fetchAPI<void>('/automation/run/compliance-check', { method: 'POST', body: JSON.stringify({ days }) }),
  runBudgetCheck:      (threshold?: number) => fetchAPI<void>('/automation/run/budget-check',     { method: 'POST', body: JSON.stringify({ threshold }) }),
  runPerformanceCheck: (threshold?: number) => fetchAPI<void>('/automation/run/performance-check', { method: 'POST', body: JSON.stringify({ threshold }) }),
  runGenerateReports:  (period?: string) => fetchAPI<void>('/automation/run/generate-reports',  { method: 'POST', body: JSON.stringify({ period }) }),
};

// =====================================
// ML FORECASTING API
// =====================================

export const forecastingAPI = {
  getSalesForecast:     (params?: any) => fetchAPI<any>(`/forecasting/sales${buildQuery(params)}`),
  getInventoryForecast: (params?: any) => fetchAPI<any>(`/forecasting/inventory${buildQuery(params)}`),
  getOccupancyForecast: (params?: any) => fetchAPI<any>(`/forecasting/occupancy${buildQuery(params)}`),
  getBudgetForecast:    (params?: any) => fetchAPI<any>(`/forecasting/budget${buildQuery(params)}`),
};
