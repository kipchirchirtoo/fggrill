import { fetchAPI, buildQuery } from './core';

// =====================================
// BAR OPERATIONS API
// =====================================

export const barStockRequestsAPI = {
  getRequests: (params?: any) => fetchAPI<any>(`/bar/stock-requests${buildQuery(params)}`),
  createRequest: (data: any) => fetchAPI<any>('/bar/stock-requests', { method: 'POST', body: JSON.stringify(data) }),
};

// =====================================
// CASHIER API
// =====================================

export const cashierAPI = {
  getStats: (branchId?: number) => fetchAPI<any>(`/cashier/stats${buildQuery({ branch_id: branchId })}`),
  getSummary: (params?: any) => fetchAPI<any>(`/cashier/summary${buildQuery(params)}`),
  getPayments: (params?: any) => fetchAPI<any[]>(`/payments-verification${buildQuery(params)}`),
  recordCollection: (data: any) => fetchAPI<any>('/cashier/collections', { method: 'POST', body: JSON.stringify(data) }),
  
  // Bills & Payments
  getBillDetails: (bookingId: string) => fetchAPI<any>(`/cashier/bill/${bookingId}`),
  processPayment: (data: any) => fetchAPI<any>('/cashier/pay', { method: 'POST', body: JSON.stringify(data) }),
  verifyPayment:  (paymentId: string) => fetchAPI<any>(`/cashier/verify-payment/${paymentId}`, { method: 'POST' }),
  
  // Unpaid Bills
  getUnpaidBills: (params?: any) => fetchAPI<any>(`/cashier/unpaid-bills${buildQuery(params)}`),
  createUnpaidBill: (data: any) => fetchAPI<any>('/cashier/unpaid-bills', { method: 'POST', body: JSON.stringify(data) }),
  recordBillPayment: (id: string, data: any) => fetchAPI<any>(`/cashier/unpaid-bills/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),
  confirmUnpaidBill: (id: string) => fetchAPI<any>(`/cashier/unpaid-bills/${id}/confirm`, { method: 'PATCH' }),
  downloadUnpaidBillInvoice: async (id: string) => {
    const response = await fetchAPI<Blob>(`/cashier/unpaid-bills/${id}/pdf`, {
      method: 'GET',
      responseType: 'blob'
    });
    return response;
  },
  downloadOutstandingCustomerCredits: async (params: { branch_id: number; search?: string }) => {
    const response = await fetchAPI<Blob>(`/cashier/unpaid-bills/outstanding/pdf${buildQuery(params)}`, {
      method: 'GET',
      responseType: 'blob'
    });
    return response;
  },

  // Credit Bills
  getCreditBills: (params?: any) => fetchAPI<any>(`/cashier/credit-bills${buildQuery(params)}`),
  createCreditBill: (data: any) => fetchAPI<any>('/cashier/credit-bills', { method: 'POST', body: JSON.stringify(data) }),
  confirmCreditBill: (id: string) => fetchAPI<any>(`/cashier/credit-bills/${id}/confirm`, { method: 'PATCH' }),
  recordCreditPayment: (id: string, data: any) => fetchAPI<any>(`/cashier/credit-bills/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),
  downloadCreditBillInvoice: async (id: string) => {
    const response = await fetchAPI<Blob>(`/cashier/credit-bills/${id}/pdf`, {
      method: 'GET',
      responseType: 'blob'
    });
    return response;
  },
  
  getLoans: (params?: any) => fetchAPI<any>(`/cashier/credit-bills/loans${buildQuery(params)}`),
  getAdvances: (params?: any) => fetchAPI<any>(`/cashier/credit-bills/advances${buildQuery(params)}`),

  // Shifts
  getShifts: (params?: any) => fetchAPI<any>(`/cashier/shifts${buildQuery(params)}`),
  startShift: (data: any) => fetchAPI<any>('/cashier/shifts/start', { method: 'POST', body: JSON.stringify(data) }),
  getShift: (id: string) => fetchAPI<any>(`/cashier/shifts/${id}`),
  closeShift: (id: string, data: any) => fetchAPI<any>(`/cashier/shifts/${id}/close`, { method: 'PUT', body: JSON.stringify(data) }),
  reconcileShift: (id: string, data: any) => fetchAPI<any>(`/cashier/shifts/${id}/reconcile`, { method: 'PUT', body: JSON.stringify(data) }),
  
  // Logbooks
  getLogbookToday: () => fetchAPI<any>('/cashier/logbook/today'),
  saveLogbook: (data: any) => fetchAPI<any>('/cashier/logbook', { method: 'POST', body: JSON.stringify(data) }),
};
