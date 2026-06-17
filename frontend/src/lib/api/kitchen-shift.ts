import { fetchAPI, buildQuery } from './core';

export const kitchenShiftAPI = {
  // Shifts
  getShifts: (params?: { branch_id?: string | number; status?: string; shift_date?: string; from_date?: string; to_date?: string }) =>
    fetchAPI<any[]>(`/kitchen/shifts${buildQuery(params)}`),
  getShift: (id: string) => fetchAPI<any>(`/kitchen/shifts/${id}`),
  openShift: (data: any) => fetchAPI<any>('/kitchen/shifts', { method: 'POST', body: JSON.stringify(data) }),

  // Stock operations
  addStock: (shiftId: string, data: any) => fetchAPI<any>(`/kitchen/shifts/${shiftId}/stock`, { method: 'POST', body: JSON.stringify(data) }),
  recordProduction: (shiftId: string, data: any) => fetchAPI<any>(`/kitchen/shifts/${shiftId}/production`, { method: 'POST', body: JSON.stringify(data) }),
  recordSpoilage: (shiftId: string, data: any) => fetchAPI<any>(`/kitchen/shifts/${shiftId}/spoilage`, { method: 'POST', body: JSON.stringify(data) }),

  // Shift lifecycle
  closeShift: (shiftId: string, data: any) => fetchAPI<any>(`/kitchen/shifts/${shiftId}/close`, { method: 'POST', body: JSON.stringify(data) }),
  submitForApproval: (shiftId: string) => fetchAPI<any>(`/kitchen/shifts/${shiftId}/submit`, { method: 'POST' }),
  chefConfirm: (shiftId: string, data: { confirmed: boolean; notes?: string }) => fetchAPI<any>(`/kitchen/shifts/${shiftId}/chef-confirm`, { method: 'POST', body: JSON.stringify(data) }),
  accountantReview: (shiftId: string, data: { approved: boolean; notes?: string }) => fetchAPI<any>(`/kitchen/shifts/${shiftId}/accountant-review`, { method: 'POST', body: JSON.stringify(data) }),

  // Stats & Reports
  getStats: (params: { branch_id: string | number; from_date?: string; to_date?: string }) =>
    fetchAPI<any>(`/kitchen/shifts/stats${buildQuery(params)}`),

  // Recipes
  getRecipes: (params?: { branch_id?: string | number }) =>
    fetchAPI<any[]>(`/kitchen/shifts/recipes/list${buildQuery(params)}`),
  createRecipe: (data: any) => fetchAPI<any>('/kitchen/shifts/recipes', { method: 'POST', body: JSON.stringify(data) }),
};
