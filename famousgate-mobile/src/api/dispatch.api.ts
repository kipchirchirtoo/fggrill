import apiClient from './client';

export const dispatchApi = {
  // GET /api/storekeeping/dispatch-notes
  list: (params?: { status?: string; limit?: number }) =>
    apiClient.get('/storekeeping/dispatch-notes', { params }).then(r => r.data?.data || r.data),

  // POST /api/storekeeping/dispatch-notes
  create: (data: {
    to_branch_id: string;
    driver_name?: string;
    notes?: string;
    items: Array<{ item_id: string; quantity: number; unit: string }>;
  }) => apiClient.post('/storekeeping/dispatch-notes', data).then(r => r.data),

  // PUT /api/storekeeping/dispatch-notes/:id/dispatch  — generates OTP
  dispatch: (id: string, driverInfo?: { driver_name: string; vehicle_id?: string }) =>
    apiClient.put(`/storekeeping/dispatch-notes/${id}/dispatch`, driverInfo).then(r => r.data),

  // PUT /api/storekeeping/dispatch-notes/:id/logistics
  updateLogistics: (id: string, data: object) =>
    apiClient.put(`/storekeeping/dispatch-notes/${id}/logistics`, data).then(r => r.data),

  // GET /api/storekeeping/incoming-dispatches
  incoming: () =>
    apiClient.get('/storekeeping/incoming-dispatches').then(r => r.data?.data || r.data),

  // PUT /api/storekeeping/dispatch-notes/:id/confirm
  confirmDelivery: (id: string, data: {
    items_received: Array<{ item_id: string; quantity_received: number }>;
    has_discrepancy?: boolean;
    discrepancy_note?: string;
  }) => apiClient.put(`/storekeeping/dispatch-notes/${id}/confirm`, data).then(r => r.data),

  // GET /api/storekeeping/dashboard/central
  centralDashboard: () =>
    apiClient.get('/storekeeping/dashboard/central').then(r => r.data),

  // GET /api/storekeeping/dashboard/branch
  branchDashboard: () =>
    apiClient.get('/storekeeping/dashboard/branch').then(r => r.data),
};

export const stockRequestApi = {
  // POST /api/storekeeping/stock-requests
  create: (data: {
    items: Array<{ item_id: string; quantity_requested: number; unit: string }>;
    notes?: string;
    priority?: string;
  }) => apiClient.post('/storekeeping/stock-requests', data).then(r => r.data),

  // GET /api/storekeeping/stock-requests
  list: () =>
    apiClient.get('/storekeeping/stock-requests').then(r => r.data?.data || r.data),

  // GET /api/storekeeping/stock-requests/pending
  pending: () =>
    apiClient.get('/storekeeping/stock-requests/pending').then(r => r.data?.data || r.data),
};
