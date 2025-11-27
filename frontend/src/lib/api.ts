/**
 * Unified API Service for Famous Gate Hotel Management System
 * All API calls should go through this service for consistency
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Helper to get auth headers
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

// Generic fetch wrapper with error handling
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options?.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.detail || 'Request failed');
  }

  return response.json();
}

// =====================================================
// STOREKEEPING API
// =====================================================

export const storeAPI = {
  // Dashboard endpoints
  getCentralDashboard: () => fetchAPI<any>('/store/dashboard/central'),
  getBranchDashboard: () => fetchAPI<any>('/store/dashboard/branch'),
  
  // Items/Inventory
  getItems: (params?: { search?: string; category?: string; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', params.category);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchAPI<any>(`/store/items?${query}`);
  },
  getItem: (id: string) => fetchAPI<any>(`/store/items/${id}`),
  createItem: (data: any) => fetchAPI<any>('/store/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: string, data: any) => fetchAPI<any>(`/store/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id: string) => fetchAPI<any>(`/store/items/${id}`, { method: 'DELETE' }),
  addStock: (id: string, data: { quantity: number; notes?: string }) => 
    fetchAPI<any>(`/store/items/${id}/add-stock`, { method: 'POST', body: JSON.stringify(data) }),
  getStockHistory: (id: string) => fetchAPI<any>(`/store/items/${id}/history`),
  
  // Categories and SKU
  getCategories: () => fetchAPI<any>('/store/categories'),
  previewSKU: (data: any) => fetchAPI<any>('/store/preview-sku', { method: 'POST', body: JSON.stringify(data) }),
  generateSKU: (data: any) => fetchAPI<any>('/store/generate-sku', { method: 'POST', body: JSON.stringify(data) }),
  
  // Branch Stock
  getBranchStock: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/store/branch-stock${query}`);
  },
  getLowStockItems: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/store/branch-stock/low${query}`);
  },
  recordStockOut: (data: { item_sku: string; quantity: number; reason: string; notes?: string }) =>
    fetchAPI<any>('/store/branch-stock/out', { method: 'POST', body: JSON.stringify(data) }),
  getStockMovements: (params?: { branch_id?: number; item_sku?: string; from_date?: string; to_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.item_sku) query.append('item_sku', params.item_sku);
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    return fetchAPI<any>(`/store/stock-movements?${query}`);
  },
  
  // Stock Requests
  createStockRequest: (data: { items: Array<{ item_sku: string; quantity: number }>; notes?: string; priority?: string }) =>
    fetchAPI<any>('/store/stock-requests', { method: 'POST', body: JSON.stringify(data) }),
  getBranchRequests: () => fetchAPI<any>('/store/stock-requests'),
  getPendingRequests: () => fetchAPI<any>('/store/stock-requests/pending'),
  reviewStockRequest: (id: string, data: { action: 'APPROVE' | 'REJECT'; notes?: string }) =>
    fetchAPI<any>(`/store/stock-requests/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  
  // Dispatch
  createDispatch: (data: { request_id?: string; to_branch_id: number; items: Array<{ item_sku: string; quantity: number }>; notes?: string }) =>
    fetchAPI<any>('/store/dispatch-notes', { method: 'POST', body: JSON.stringify(data) }),
  getDispatchHistory: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchAPI<any>(`/store/dispatch-notes${query}`);
  },
  dispatchItems: (id: string, data: { vehicle_id?: string; driver_id?: string }) =>
    fetchAPI<any>(`/store/dispatch-notes/${id}/dispatch`, { method: 'PUT', body: JSON.stringify(data) }),
  getIncomingDispatches: () => fetchAPI<any>('/store/incoming-dispatches'),
  confirmDelivery: (id: string, data: { received_items?: Array<{ item_sku: string; received_quantity: number }>; notes?: string }) =>
    fetchAPI<any>(`/store/dispatch-notes/${id}/confirm`, { method: 'PUT', body: JSON.stringify(data) }),
  
  // Branches
  getBranches: () => fetchAPI<any>('/store/branches'),
  getBranchesWithStock: () => fetchAPI<any>('/store/branches-stock'),
  
  // Master Catalog
  getMasterCatalog: () => fetchAPI<any>('/store/master-catalog'),
  
  // Vehicles
  getVehicles: () => fetchAPI<any>('/store/vehicles'),
  createVehicle: (data: any) => fetchAPI<any>('/store/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: any) => fetchAPI<any>(`/store/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVehicle: (id: string) => fetchAPI<any>(`/store/vehicles/${id}`, { method: 'DELETE' }),
  
  // Drivers
  getDrivers: () => fetchAPI<any>('/store/drivers'),
  createDriver: (data: any) => fetchAPI<any>('/store/drivers', { method: 'POST', body: JSON.stringify(data) }),
  updateDriver: (id: string, data: any) => fetchAPI<any>(`/store/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDriver: (id: string) => fetchAPI<any>(`/store/drivers/${id}`, { method: 'DELETE' }),
  
  // Suppliers
  getSuppliers: () => fetchAPI<any>('/store/suppliers'),
  createSupplier: (data: any) => fetchAPI<any>('/store/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: any) => fetchAPI<any>(`/store/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => fetchAPI<any>(`/store/suppliers/${id}`, { method: 'DELETE' }),
  
  // Stock Takes
  getStockTakes: () => fetchAPI<any>('/store/stock-takes'),
  createStockTake: (data: { branch_id: number; take_type: string; notes?: string }) =>
    fetchAPI<any>('/store/stock-takes', { method: 'POST', body: JSON.stringify(data) }),
  getStockTakeItems: (id: string) => fetchAPI<any>(`/store/stock-takes/${id}/items`),
  updateStockTakeItem: (id: string, data: { actual_quantity: number }) =>
    fetchAPI<any>(`/store/stock-take-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  completeStockTake: (id: string) => fetchAPI<any>(`/store/stock-takes/${id}/complete`, { method: 'PUT' }),
  
  // Config
  getAppConfig: () => fetchAPI<any>('/store/app_config'),
  getEditLockStatus: () => fetchAPI<any>('/store/get_edit_lock_status'),
  setEditLockStatus: (locked: boolean) => 
    fetchAPI<any>('/store/set_edit_lock_status', { method: 'POST', body: JSON.stringify({ locked }) }),
  
  // Kitchen Usage Tracking
  getTrackableItems: () => fetchAPI<any>('/store/kitchen-usage/trackable-items'),
  getKitchenUsageRecords: (params?: { from_date?: string; to_date?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    if (params?.status) query.append('status', params.status);
    return fetchAPI<any>(`/store/kitchen-usage?${query}`);
  },
  createKitchenUsageRecord: (data: { 
    item_sku: string; 
    received_quantity: number; 
    unit_cost?: number;
    expected_revenue?: number;
    dispatch_id?: string;
    usage_date?: string;
  }) => fetchAPI<any>('/store/kitchen-usage', { method: 'POST', body: JSON.stringify(data) }),
  recordKitchenUsageEntry: (usageRecordId: string, data: {
    usage_type: 'CONSUMED' | 'SPOILT' | 'LOST' | 'DAMAGED' | 'EXPIRED' | 'RETURNED';
    quantity: number;
    responsible_staff_id?: string;
    responsible_staff_name?: string;
    reason?: string;
    notes?: string;
    produced_item?: string;
    portions_produced?: number;
  }) => fetchAPI<any>(`/store/kitchen-usage/${usageRecordId}/entries`, { method: 'POST', body: JSON.stringify(data) }),
  getKitchenUsageEntries: (usageRecordId: string) => 
    fetchAPI<any>(`/store/kitchen-usage/${usageRecordId}/entries`),
  closeKitchenUsageRecord: (usageRecordId: string, data?: { actual_revenue?: number }) =>
    fetchAPI<any>(`/store/kitchen-usage/${usageRecordId}/close`, { method: 'PUT', body: JSON.stringify(data || {}) }),
  getBranchStaffForUsage: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/store/kitchen-usage/staff${query}`);
  },
  getStaffAccountability: (params?: { branch_id?: number; staff_id?: string; period_month?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.staff_id) query.append('staff_id', params.staff_id);
    if (params?.period_month) query.append('period_month', params.period_month);
    return fetchAPI<any>(`/store/kitchen-usage/accountability?${query}`);
  },
  getDailyUsageSummary: (params?: { branch_id?: number; from_date?: string; to_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    return fetchAPI<any>(`/store/kitchen-usage/summary?${query}`);
  },
};

// =====================================================
// SYSTEM API
// =====================================================

export const systemAPI = {
  getBranches: () => fetchAPI<any>('/system/branches'),
  createBranch: (data: any) => fetchAPI<any>('/system/branches', { method: 'POST', body: JSON.stringify(data) }),
  getDepartments: () => fetchAPI<any>('/system/departments'),
  getRoles: () => fetchAPI<any>('/system/roles'),
};

// =====================================================
// STAFF API
// =====================================================

export const staffAPI = {
  // Staff CRUD
  getStaff: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/staff${query}`);
  },
  getStaffMember: (id: string) => fetchAPI<any>(`/staff/${id}`),
  createStaffMember: (data: any) => fetchAPI<any>('/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaffMember: (id: string, data: any) => fetchAPI<any>(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaffMember: (id: string) => fetchAPI<any>(`/staff/${id}`, { method: 'DELETE' }),
  
  // Current user
  getCurrentUser: () => fetchAPI<any>('/staff/me'),
  updateProfile: (data: any) => fetchAPI<any>('/staff/me', { method: 'PUT', body: JSON.stringify(data) }),
  
  // Scheduling
  getSchedules: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/staff/schedules${query}`);
  },
  createSchedule: (data: any) => fetchAPI<any>('/staff/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id: string, data: any) => fetchAPI<any>(`/staff/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  // Performance
  getPerformanceReviews: (staffId?: string) => {
    const query = staffId ? `?staff_id=${staffId}` : '';
    return fetchAPI<any>(`/staff/performance${query}`);
  },
  submitPerformanceReview: (data: any) => fetchAPI<any>('/staff/performance', { method: 'POST', body: JSON.stringify(data) }),
  
  // Payroll
  getPayroll: (staffId?: string, month?: string) => {
    const query = new URLSearchParams();
    if (staffId) query.append('staff_id', staffId);
    if (month) query.append('month', month);
    return fetchAPI<any>(`/staff/payroll?${query}`);
  },
  processPayroll: (data: any) => fetchAPI<any>('/staff/payroll', { method: 'POST', body: JSON.stringify(data) }),
  getPayslips: (staffId: string) => fetchAPI<any>(`/staff/${staffId}/payslips`),
  
  // Attendance
  getAttendance: (params?: { branch_id?: number; date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.date) query.append('date', params.date);
    return fetchAPI<any>(`/staff/attendance?${query}`);
  },
  recordAttendance: (data: any) => fetchAPI<any>('/staff/attendance', { method: 'POST', body: JSON.stringify(data) }),
  getAttendanceSummary: (staffId?: string) => {
    const query = staffId ? `?staff_id=${staffId}` : '';
    return fetchAPI<any>(`/staff/attendance/summary${query}`);
  },
  
  // Leave Management
  getLeaveRequests: (params?: { staff_id?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.staff_id) query.append('staff_id', params.staff_id);
    if (params?.status) query.append('status', params.status);
    return fetchAPI<any>(`/staff/leave?${query}`);
  },
  submitLeaveRequest: (data: any) => fetchAPI<any>('/staff/leave', { method: 'POST', body: JSON.stringify(data) }),
  approveLeaveRequest: (id: string) => fetchAPI<any>(`/staff/leave/${id}/approve`, { method: 'PUT' }),
  rejectLeaveRequest: (id: string, reason?: string) => 
    fetchAPI<any>(`/staff/leave/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  getLeaveBalance: (staffId: string) => fetchAPI<any>(`/staff/${staffId}/leave-balance`),
  getLeaveHistory: (staffId?: string) => {
    const query = staffId ? `?staff_id=${staffId}` : '';
    return fetchAPI<any>(`/staff/leave/history${query}`);
  },
  
  // Documents
  getDocuments: (staffId: string) => fetchAPI<any>(`/staff/${staffId}/documents`),
  uploadDocument: (staffId: string, data: FormData) => 
    fetch(`${API_URL}/api/staff/${staffId}/documents`, { 
      method: 'POST', 
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: data 
    }).then(r => r.json()),
  
  // Training
  getTrainings: (staffId?: string) => {
    const query = staffId ? `?staff_id=${staffId}` : '';
    return fetchAPI<any>(`/staff/trainings${query}`);
  },
  assignTraining: (data: any) => fetchAPI<any>('/staff/trainings', { method: 'POST', body: JSON.stringify(data) }),
  completeTraining: (id: string) => fetchAPI<any>(`/staff/trainings/${id}/complete`, { method: 'PUT' }),
};

// =====================================================
// ROOMS API
// =====================================================

export const roomsAPI = {
  getRooms: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/rooms${query}`);
  },
  getRoom: (id: string) => fetchAPI<any>(`/rooms/${id}`),
  createRoom: (data: any) => fetchAPI<any>('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id: string, data: any) => fetchAPI<any>(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateRoomStatus: (id: string, status: string) => 
    fetchAPI<any>(`/rooms/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

// =====================================================
// BOOKINGS API
// =====================================================

export const bookingsAPI = {
  getBookings: (params?: { branch_id?: number; status?: string; from_date?: string; to_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.status) query.append('status', params.status);
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    return fetchAPI<any>(`/bookings?${query}`);
  },
  getBooking: (id: string) => fetchAPI<any>(`/bookings/${id}`),
  createBooking: (data: any) => fetchAPI<any>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id: string, data: any) => fetchAPI<any>(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancelBooking: (id: string, reason?: string) => 
    fetchAPI<any>(`/bookings/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  checkIn: (id: string, data: any) => fetchAPI<any>(`/bookings/${id}/checkin`, { method: 'POST', body: JSON.stringify(data) }),
  checkOut: (id: string, data: any) => fetchAPI<any>(`/bookings/${id}/checkout`, { method: 'POST', body: JSON.stringify(data) }),
};

// =====================================================
// HOUSEKEEPING API
// =====================================================

export const housekeepingAPI = {
  getTasks: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/housekeeping/tasks${query}`);
  },
  createTask: (data: any) => fetchAPI<any>('/housekeeping/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: any) => fetchAPI<any>(`/housekeeping/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  completeTask: (id: string, data?: any) => fetchAPI<any>(`/housekeeping/tasks/${id}/complete`, { method: 'PUT', body: JSON.stringify(data || {}) }),
  getRoomStatus: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/housekeeping/rooms${query}`);
  },
};

// =====================================================
// MAINTENANCE API
// =====================================================

export const maintenanceAPI = {
  getRequests: (branchId?: number, status?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.append('branch_id', String(branchId));
    if (status) query.append('status', status);
    return fetchAPI<any>(`/maintenance/requests?${query}`);
  },
  createRequest: (data: any) => fetchAPI<any>('/maintenance/requests', { method: 'POST', body: JSON.stringify(data) }),
  updateRequest: (id: string, data: any) => fetchAPI<any>(`/maintenance/requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  completeRequest: (id: string, data?: any) => fetchAPI<any>(`/maintenance/requests/${id}/complete`, { method: 'PUT', body: JSON.stringify(data || {}) }),
};

// =====================================================
// RESTAURANT API
// =====================================================

export const restaurantAPI = {
  getOrders: (branchId?: number, status?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.append('branch_id', String(branchId));
    if (status) query.append('status', status);
    return fetchAPI<any>(`/restaurant/orders?${query}`);
  },
  createOrder: (data: any) => fetchAPI<any>('/restaurant/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: any) => fetchAPI<any>(`/restaurant/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getMenuItems: () => fetchAPI<any>('/restaurant/menu'),
  getTables: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/restaurant/tables${query}`);
  },
};

// =====================================================
// FINANCE API
// =====================================================

export const financeAPI = {
  getDashboard: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/finance/dashboard${query}`);
  },
  getTransactions: (params?: { branch_id?: number; type?: string; from_date?: string; to_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.type) query.append('type', params.type);
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    return fetchAPI<any>(`/finance/transactions?${query}`);
  },
  createTransaction: (data: any) => fetchAPI<any>('/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
  getInvoices: () => fetchAPI<any>('/finance/invoices'),
  createInvoice: (data: any) => fetchAPI<any>('/finance/invoices', { method: 'POST', body: JSON.stringify(data) }),
};

// =====================================================
// REPORTS API
// =====================================================

export const reportsAPI = {
  getOccupancyReport: (params?: { branch_id?: number; from_date?: string; to_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    return fetchAPI<any>(`/reports/occupancy?${query}`);
  },
  getRevenueReport: (params?: { branch_id?: number; from_date?: string; to_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    return fetchAPI<any>(`/reports/revenue?${query}`);
  },
  getStockReport: (params?: { branch_id?: number }) => {
    const query = params?.branch_id ? `?branch_id=${params.branch_id}` : '';
    return fetchAPI<any>(`/reports/stock${query}`);
  },
  getStaffReport: (params?: { branch_id?: number }) => {
    const query = params?.branch_id ? `?branch_id=${params.branch_id}` : '';
    return fetchAPI<any>(`/reports/staff${query}`);
  },
};

// =====================================================
// AUDIT API
// =====================================================

export const auditAPI = {
  getAuditLogs: (params?: { module?: string; from_date?: string; to_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.module) query.append('module', params.module);
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    return fetchAPI<any>(`/audit/logs?${query}`);
  },
  getInventoryAudit: () => fetchAPI<any>('/audit/inventory'),
};

// Export all APIs as a single object
export const api = {
  store: storeAPI,
  system: systemAPI,
  staff: staffAPI,
  rooms: roomsAPI,
  bookings: bookingsAPI,
  housekeeping: housekeepingAPI,
  maintenance: maintenanceAPI,
  restaurant: restaurantAPI,
  finance: financeAPI,
  reports: reportsAPI,
  audit: auditAPI,
};

export default api;
