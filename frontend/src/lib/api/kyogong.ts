import { fetchAPI, buildQuery } from './core';
import { 
  ApiResponse, 
  SalesPoint, 
  Shift, 
  KyogongTransaction, 
  DynamicService,
  PettyCashEntry
} from './types';

// =====================================
// KYOGONG POS API
// =====================================

export const kyogongAPI = {
  getSalesPoints: (params?: any) => fetchAPI<SalesPoint[]>(`/kyogong/sales-points${buildQuery(params)}`),
  getSalesPointDetails: (id: string) => fetchAPI<SalesPoint>(`/kyogong/sales-points/${id}`),
  
  // Shifts
  openShift:  (data: any) => fetchAPI<Shift>('/kyogong/shifts/open', { method: 'POST', body: JSON.stringify(data) }),
  getCurrentShift: () => fetchAPI<Shift>('/kyogong/shifts/current'),
  getShifts:  (params?: any) => fetchAPI<Shift[]>(`/kyogong/shifts${buildQuery(params)}`),
  getShiftDetails: (id: string) => fetchAPI<Shift>(`/kyogong/shifts/${id}`),
  closeShift: (id: string, data: any) => fetchAPI<Shift>(`/kyogong/shifts/${id}/close`, { method: 'PUT', body: JSON.stringify(data) }),
  approveShift: (id: string) => fetchAPI<void>(`/kyogong/shifts/${id}/approve`, { method: 'PUT' }),
  flagShift: (id: string) => fetchAPI<void>(`/kyogong/shifts/${id}/flag`, { method: 'PUT' }),
  
  // Transactions
  createTransaction: (shiftId: string, data: any) => 
    fetchAPI<KyogongTransaction>(`/kyogong/shifts/${shiftId}/transactions`, { method: 'POST', body: JSON.stringify(data) }),
  getShiftTransactions: (shiftId: string) => fetchAPI<KyogongTransaction[]>(`/kyogong/shifts/${shiftId}/transactions`),
  getTransactionDetails: (id: string) => fetchAPI<KyogongTransaction>(`/kyogong/transactions/${id}`),
  voidTransaction: (id: string) => fetchAPI<void>(`/kyogong/transactions/${id}/void`, { method: 'PUT' }),
  
  // Float Tracking
  getCurrentFloat: (shiftId: string) => fetchAPI<any>(`/kyogong/shifts/${shiftId}/float`),
  adjustFloat: (shiftId: string, data: any) => fetchAPI<void>(`/kyogong/shifts/${shiftId}/float/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  getFloatHistory: (shiftId: string) => fetchAPI<any[]>(`/kyogong/shifts/${shiftId}/float/history`),
  
  // SPA Services
  getSpaCategories: () => fetchAPI<any[]>('/kyogong/spa-services/categories'),
  getSpaServices:   (params?: any) => fetchAPI<any[]>(`/kyogong/spa-services${buildQuery(params)}`),
  
  // Petty Cash
  getPettyCashEntries:    (params?: any) => fetchAPI<PettyCashEntry[]>(`/kyogong/petty-cash${buildQuery(params)}`),
  recordPettyCash:        (data: any)     => fetchAPI<PettyCashEntry>('/kyogong/petty-cash', { method: 'POST', body: JSON.stringify(data) }),

  // Dynamic Services
  getDynamicServices: (params?: any) => fetchAPI<DynamicService[]>(`/kyogong/dynamic-services${buildQuery(params)}`),
  createDynamicService: (data: any) => fetchAPI<DynamicService>('/kyogong/dynamic-services', { method: 'POST', body: JSON.stringify(data) }),
  updateDynamicService: (id: string | number, data: any) => fetchAPI<DynamicService>(`/kyogong/dynamic-services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
