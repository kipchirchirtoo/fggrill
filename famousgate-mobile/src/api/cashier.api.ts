import apiClient from './client';

export const cashierApi = {
  // GET /api/cashier/bill/:bookingId
  getBill: (bookingId: string) =>
    apiClient.get(`/cashier/bill/${bookingId}`).then(r => r.data),

  // GET /api/cashier/unpaid-bills
  unpaidBills: (params?: { branch_id?: string; search?: string }) =>
    apiClient.get('/cashier/unpaid-bills', { params }).then(r => r.data?.data || r.data),

  // POST /api/cashier/pay
  processPayment: (data: {
    booking_id: string;
    amount: number;
    payment_method: 'cash' | 'mpesa' | 'card' | 'split';
    mpesa_phone?: string;
  }) => apiClient.post('/cashier/pay', data).then(r => r.data),

  // POST /api/cashier/unpaid-bills/:id/payment
  recordBillPayment: (billId: string, data: {
    amount: number;
    payment_method: string;
    reference?: string;
  }) => apiClient.post(`/cashier/unpaid-bills/${billId}/payment`, data).then(r => r.data),

  // GET /api/cashier/stats
  stats: () =>
    apiClient.get('/cashier/stats').then(r => r.data),

  // GET /api/cashier/shifts
  shifts: () =>
    apiClient.get('/cashier/shifts').then(r => r.data?.data || r.data),

  // POST /api/cashier/shifts/start
  startShift: () =>
    apiClient.post('/cashier/shifts/start').then(r => r.data),

  // PUT /api/cashier/shifts/:id/close
  closeShift: (shiftId: string) =>
    apiClient.put(`/cashier/shifts/${shiftId}/close`).then(r => r.data),

  // GET /api/cashier/shifts/:id
  getShift: (shiftId: string) =>
    apiClient.get(`/cashier/shifts/${shiftId}`).then(r => r.data),
};

// M-Pesa payment
export const mpesaApi = {
  // POST /api/payments/mpesa/initiate
  initiate: (data: { phone: string; amount: number; booking_id?: string; reference?: string }) =>
    apiClient.post('/payments/mpesa/initiate', data).then(r => r.data),

  // GET /api/payments/mpesa/status/:checkoutRequestId
  checkStatus: (checkoutRequestId: string) =>
    apiClient.get(`/payments/mpesa/status/${checkoutRequestId}`).then(r => r.data),
};
