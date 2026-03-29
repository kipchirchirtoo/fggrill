import { fetchAPI, buildQuery } from './core';

// =====================================
// EMPLOYEE PORTAL API
// =====================================

export const employeePortalAPI = {
  getDashboard: () => fetchAPI<any>('/employee-portal/dashboard'),
  getProfile:   () => fetchAPI<any>('/employee-portal/profile'),
  updateProfile: (data: any) => fetchAPI<any>('/employee-portal/profile', { method: 'PUT', body: JSON.stringify(data) }),

  getSchedules: (params?: any) => fetchAPI<any>(`/employee-portal/schedules${buildQuery(params)}`),
  
  clock: (action: 'clock_in' | 'clock_out', notes?: string) =>
    fetchAPI<any>('/employee-portal/clock', { method: 'POST', body: JSON.stringify({ action, notes }) }),
  getTimeClockHistory: (params?: any) => fetchAPI<any>(`/employee-portal/time-clock${buildQuery(params)}`),

  // Leave
  getLeaveRequests: () => fetchAPI<any>('/employee-portal/leave'),
  requestLeave:     (data: any) => fetchAPI<any>('/employee-portal/leave', { method: 'POST', body: JSON.stringify(data) }),
  cancelLeave:      (id: string) => fetchAPI<any>(`/employee-portal/leave/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (status?: string) => fetchAPI<any>(`/employee-portal/tasks${buildQuery({ status })}`),
  updateTaskStatus: (id: string, data: any) => fetchAPI<any>(`/employee-portal/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Content
  getPayslips:      () => fetchAPI<any>('/employee-portal/payslips'),
  getDocuments:     (type?: string) => fetchAPI<any>(`/employee-portal/documents${buildQuery({ type })}`),
  getAnnouncements: () => fetchAPI<any>('/employee-portal/announcements'),
  getTraining:      () => fetchAPI<any>('/employee-portal/training'),
  getPerformance:   () => fetchAPI<any>('/employee-portal/performance'),
};
