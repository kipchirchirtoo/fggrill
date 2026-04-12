import apiClient from './client';

export const systemApi = {
  // GET /api/system/branches (public)
  branches: () =>
    apiClient.get('/system/branches').then(r => r.data?.data || r.data),

  // GET /api/users
  users: (params?: { search?: string; role?: string }) =>
    apiClient.get('/users', { params }).then(r => r.data?.data || r.data),

  // PUT /api/users/:id
  updateUser: (id: string, data: object) =>
    apiClient.put(`/users/${id}`, data).then(r => r.data),

  // GET /api/audit (audit logs)
  auditLogs: (params?: { page?: number; limit?: number }) =>
    apiClient.get('/audit', { params }).then(r => r.data?.data || r.data),
};
