import { fetchAPI, buildQuery, API_URL } from './core';
import { 
  ApiResponse, 
  StaffMember, 
  AttendanceRecord, 
  LeaveRequest, 
  PayrollRecord,
  Role
} from './types';

// =====================================
// STAFF / HR API
// =====================================

// =====================================
// ATTENDANCE API
// =====================================

// ─── Attendance ─────────────────────────────────────────────────────────────

const attendanceBase = {
  getAttendance: (params?: any) => fetchAPI<AttendanceRecord[]>(`/staff/attendance${buildQuery(params)}`),
  clockIn:  () => fetchAPI<AttendanceRecord>('/staff/attendance/clock-in',  { method: 'POST' }),
  clockOut: () => fetchAPI<AttendanceRecord>('/staff/attendance/clock-out', { method: 'POST' }),
  getSummary: (staffId?: string | number) => fetchAPI<any>(`/staff/attendance/summary${buildQuery({ staff_id: staffId })}`),
  updateAttendance: (id: string | number, data: any) => fetchAPI<AttendanceRecord>(`/staff/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  approveAttendance: (id: string | number, data?: { approved?: boolean; rejection_reason?: string }) => fetchAPI<void>(`/staff/attendance/${id}/approve`, { method: 'PUT', body: JSON.stringify(data ?? { approved: true }) }),
  confirmAttendance: () => fetchAPI<void>('/staff/attendance/confirm', { method: 'POST' }),
  getReports: (params?: any) => fetchAPI<any[]>(`/staff/attendance/reports${buildQuery(params)}`),
};

export const attendanceAPI = {
  ...attendanceBase,
};

// ─── Payroll ──────────────────────────────────────────────────────────────

const payrollBase = {
  getSummary: (params?: any) => fetchAPI<any>(`/payroll/summary${buildQuery(params)}`),
  getDraft:   (params: { month: number; year: number; branch_id?: number }) => fetchAPI<any>(`/payroll/draft${buildQuery(params)}`),
  generate:   (data: { month: number; year: number; branch_id?: number }) => fetchAPI<any>('/payroll/generate', { method: 'POST', body: JSON.stringify(data) }),
  approveDraft: (data: any) => fetchAPI<any>('/payroll/approve', { method: 'POST', body: JSON.stringify(data) }),

  // Adjustments (Loans, Advances, etc.)
  createAdjustment: (data: any) => fetchAPI<any>('/payroll-adjustments', { method: 'POST', body: JSON.stringify(data) }),
  getAdjustments:   (params: any) => fetchAPI<any>(`/payroll-adjustments${buildQuery(params)}`),
  voidAdjustment:   (id: string | number)   => fetchAPI<void>(`/payroll-adjustments/${id}/void`, { method: 'PATCH' }),
};

export const payrollAPI = {
  ...payrollBase,
  downloadPayslipsZip: (runId: string | number) => {
    window.location.href = `${API_URL}/api/payroll/run/${runId}/payslips-zip`;
  },
};

export const payrollPoliciesAPI = {
  getPolicies: () => fetchAPI<any[]>('/payroll-policies'),
  createPolicy: (data: any) => fetchAPI<any>('/payroll-policies', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Shifts & Schedules ────────────────────────────────────────────────────

const shiftsBase = {
  getShifts: (params?: any) => fetchAPI<any[]>(`/staff/schedules${buildQuery(params)}`),
  create: (data: any)   => fetchAPI<any>('/staff/schedules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string | number, data: any) => fetchAPI<any>(`/staff/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const shiftsAPI = {
  ...shiftsBase,
};

// ─── Staff Directory ───────────────────────────────────────────────────────

const staffBase = {
  getStaff: async (params?: any): Promise<ApiResponse<StaffMember[]>> => {
    // Legacy Electron Support
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const query: any = {};
        if (typeof params === 'number') query.branch_id = params;
        else if (params) {
          if (params.branchId) query.branch_id = params.branchId;
          if (params.role) query.role = params.role;
        }
        const rows = await (window as any).electronAPI.db.get('cached_pins', query);
        if (rows) {
          const staff = rows.map((r: any) => (typeof r.user_data === 'string' ? JSON.parse(r.user_data) : r.user_data));
          return { success: true, data: staff };
        }
      } catch (e) {}
    }
    return fetchAPI<StaffMember[]>(`/staff${buildQuery(params)}`);
  },

  getStaffMember: (id: string | number) => fetchAPI<StaffMember>(`/staff/${id}`),
  createStaffMember: (data: any) => fetchAPI<StaffMember>('/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaffMember: (id: string | number, data: any) => fetchAPI<StaffMember>(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaffMember: (id: string | number) => fetchAPI<void>(`/staff/${id}`, { method: 'DELETE' }),
  
  // Performance
  getPerformance: (params?: { branch_id?: string; period?: string; staff_id?: string }) =>
    fetchAPI<any>(`/staff/performance${buildQuery(params)}`),
  archiveStaff: (id: string | number, notes: string) => fetchAPI<StaffMember>(`/staff/${id}/archive`, { method: 'POST', body: JSON.stringify({ notes }) }),
  
  // Leave & Performance
  getLeaveRequests: (params?: any) => fetchAPI<LeaveRequest[]>(`/staff/leave${buildQuery(params)}`),
  submitLeaveRequest: (data: any) => fetchAPI<LeaveRequest>('/staff/leave', { method: 'POST', body: JSON.stringify(data) }),
  approveLeaveRequest: (id: string | number) => fetchAPI<void>(`/staff/leave/${id}/approve`, { method: 'PUT' }),
  rejectLeaveRequest: (id: string | number) => fetchAPI<void>(`/staff/leave/${id}/reject`, { method: 'PUT' }),
  reportToDuty: (id: string | number, data: any) => fetchAPI<void>(`/staff/leave/${id}/report-to-duty`, { method: 'PUT', body: JSON.stringify(data) }),
  
  getPerformanceReviews: (staffId?: string | number) => fetchAPI<any[]>(`/staff/performance${buildQuery({ staff_id: staffId })}`),
  submitPerformanceReview: (data: any) => fetchAPI<any>('/staff/performance', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Simple Payroll ──────────────────────────────────────────────────────────
// NOTE: Must be declared BEFORE staffAPI to avoid TDZ initialization error

export const simplePayrollAPI = {
  getCreditBills: (params?: any) => fetchAPI<ApiResponse<any[]>>(`/payroll/credit-bills${buildQuery(params)}`),
  createCreditBill: (data: any) => fetchAPI<ApiResponse<any>>('/payroll/credit-bills', { method: 'POST', body: JSON.stringify(data) }),
  updateCreditBillStatus: (id: string | number, status: string) => fetchAPI<ApiResponse<void>>(`/payroll/credit-bills/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  partialPayCreditBill: (id: string | number, data: { amount: number; payment_method?: string; reference?: string; notes?: string }) => fetchAPI<ApiResponse<any>>(`/payroll/credit-bills/${id}/partial-payment`, { method: 'POST', body: JSON.stringify(data) }),
  getCreditBillPayments: (id: string | number) => fetchAPI<ApiResponse<any[]>>(`/payroll/credit-bills/${id}/payments`),
  getLoans: (params?: any) => fetchAPI<ApiResponse<any[]>>(`/payroll/loans${buildQuery(params)}`),
  createLoan: (data: any) => fetchAPI<ApiResponse<any>>('/payroll/loans', { method: 'POST', body: JSON.stringify(data) }),
  getAdvances: (params?: any) => fetchAPI<ApiResponse<any[]>>(`/payroll/advances${buildQuery(params)}`),
  createAdvance: (data: any) => fetchAPI<ApiResponse<any>>('/payroll/advances', { method: 'POST', body: JSON.stringify(data) }),
  approveAdvance: (id: string | number) => fetchAPI<ApiResponse<void>>(`/payroll/advances/${id}/approve`, { method: 'PATCH' }),
  rejectAdvance: (id: string | number) => fetchAPI<ApiResponse<void>>(`/payroll/advances/${id}/reject`, { method: 'POST' }),
  approveLoan: (id: string | number) => fetchAPI<ApiResponse<void>>(`/payroll/loans/${id}/approve`, { method: 'POST' }),
  rejectLoan: (id: string | number) => fetchAPI<ApiResponse<void>>(`/payroll/loans/${id}/reject`, { method: 'POST' }),
  triggerPendingBillsMigration: (branch_id?: number) => fetchAPI<ApiResponse<void>>('/payroll/credit-bills/migrate-pending', { method: 'POST', body: JSON.stringify({ branch_id }) }),
};

export const staffAPI = {
  // Appended for UI Compatibility
  getStaffHistory: (id: any) => fetchAPI<any[]>(`/staff/${id}/history`),
  getStaffDocuments: (id: any) => fetchAPI<any[]>(`/staff/${id}/documents`),
  archiveStaff: (id: any) => fetchAPI<void>(`/staff/${id}/archive`),
  uploadStaffDocument: (id: any, file: any) => fetchAPI<any>(`/staff/${id}/documents`, { method: 'POST' }),
  uploadStaffPhoto: async (id: string | number, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('photo', file);
    
    const response = await fetch(`${API_URL}/api/staff/${id}/photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }
    
    return response.json();
  },
  clockIn: (data?: any) => fetchAPI<any>('/staff/attendance/clock-in', { method: 'POST', body: JSON.stringify(data) }),
  clockOut: (data?: any) => fetchAPI<any>('/staff/attendance/clock-out', { method: 'POST', body: JSON.stringify(data) }),
  getStaffByIdentifier: (identifier: string) => fetchAPI<any>(`/staff/by-identifier/${encodeURIComponent(identifier)}`),
  getAttendance: (params?: any) => fetchAPI<any[]>(`/staff/attendance${buildQuery(params)}`),
  // Attendance summary for individual staff member
  getAttendanceSummary: (staffId?: string | number) => attendanceAPI.getSummary(staffId),
  getAttendanceReports: (params?: any) => fetchAPI<any[]>(`/staff/attendance/reports${buildQuery(params)}`),
  approveAttendance: (id: any) => fetchAPI<void>(`/staff/attendance/${id}/approve`, { method: 'PUT' }),
  getRoles: () => fetchAPI<any[]>('/staff/roles'),
  updateLeaveRequest: (id: any, data: any) => fetchAPI<any>(`/staff/leave/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  simplePayroll: simplePayrollAPI,

  ...staffBase,
  
  // Compatibility Aliases
  getAll: (params?: any) => staffBase.getStaff(params),
  getStaffMembers: (params?: any) => staffBase.getStaff(params),
  updateProfile: (id: string | number, data: any) => staffBase.updateStaffMember(id, data),
  
  // Leave Aliases
  createLeaveRequest: (data: any) => staffBase.submitLeaveRequest(data),
  
  // Performance Aliases
  createPerformanceReview: (data: any) => staffBase.submitPerformanceReview(data),
  
  // Payroll Aliases
  processPayroll: (data: any) => payrollBase.getDraft(data),
  
  // Schedule Aliases
  createSchedule: (data: any) => shiftsBase.create(data),

  // Sub-modules
  attendance: attendanceAPI,
  payroll: payrollAPI,
  shifts: shiftsAPI,
};

// simplePayrollAPI has been moved above staffAPI to fix initialization order (TDZ issue)
