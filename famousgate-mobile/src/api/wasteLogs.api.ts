import apiClient from './client';

// Wastage routes: /api/wastage
export const wasteApi = {
  // POST /api/wastage
  create: (data: {
    item_id?: string;
    item_name?: string;
    quantity: number;
    unit: string;
    reason: string;
    notes?: string;
    branch_id?: string;
    waste_date?: string;
  }) => apiClient.post('/wastage', data).then(r => r.data),

  // GET /api/wastage
  list: (params?: { branch_id?: string; limit?: number; page?: number }) =>
    apiClient.get('/wastage', { params }).then(r => r.data?.data || r.data),

  // GET /api/wastage/summary
  summary: (params?: { branch_id?: string; date_from?: string; date_to?: string }) =>
    apiClient.get('/wastage/summary', { params }).then(r => r.data),
};
