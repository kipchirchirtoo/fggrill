import apiClient from './client';

export const branchReceiptsApi = {
  create: (data: FormData | object) =>
    apiClient.post('/branch-receipts', data, {
      headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }).then(r => r.data),

  list: (branchId: string) =>
    apiClient.get(`/branch-receipts/${branchId}`).then(r => r.data),

  resolve: (id: string) =>
    apiClient.patch(`/branch-receipts/${id}/resolve`).then(r => r.data),
};
