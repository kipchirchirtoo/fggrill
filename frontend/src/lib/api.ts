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
// HOUSEKEEPING API (Enhanced)
// =====================================================

export const housekeepingAPI = {
  // Dashboard
  getDashboard: (branchId?: string) => {
    const query = branchId ? `?branchId=${branchId}` : '';
    return fetchAPI<any>(`/housekeeping/dashboard${query}`);
  },
  getRoomGrid: (branchId?: string, floor?: number) => {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);
    if (floor) params.append('floor', String(floor));
    return fetchAPI<any>(`/housekeeping/dashboard/room-grid?${params}`);
  },
  getStats: (branchId?: string) => {
    const query = branchId ? `?branchId=${branchId}` : '';
    return fetchAPI<any>(`/housekeeping/dashboard/stats${query}`);
  },
  getWorkloadDistribution: (branchId?: string) => {
    const query = branchId ? `?branchId=${branchId}` : '';
    return fetchAPI<any>(`/housekeeping/dashboard/workload${query}`);
  },

  // Tasks
  getTasks: (params?: { status?: string; priority?: string; assignedTo?: string; taskType?: string; floor?: number; date?: string; roomNumber?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.priority) query.append('priority', params.priority);
    if (params?.assignedTo) query.append('assignedTo', params.assignedTo);
    if (params?.taskType) query.append('taskType', params.taskType);
    if (params?.floor) query.append('floor', String(params.floor));
    if (params?.date) query.append('date', params.date);
    if (params?.roomNumber) query.append('roomNumber', params.roomNumber);
    return fetchAPI<any>(`/housekeeping/tasks?${query}`);
  },
  getMyTasks: () => fetchAPI<any>('/housekeeping/tasks/my-tasks'),
  getTask: (id: string) => fetchAPI<any>(`/housekeeping/tasks/${id}`),
  createTask: (data: any) => fetchAPI<any>('/housekeeping/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTaskStatus: (id: string, data: any) => fetchAPI<any>(`/housekeeping/tasks/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  assignTask: (id: string, data: any) => fetchAPI<any>(`/housekeeping/tasks/${id}/assign`, { method: 'PUT', body: JSON.stringify(data) }),
  updateChecklist: (id: string, data: any) => fetchAPI<any>(`/housekeeping/tasks/${id}/checklist`, { method: 'PUT', body: JSON.stringify(data) }),
  bulkAssignTasks: (data: { taskIds: string[]; assignedTo: string }) => fetchAPI<any>('/housekeeping/tasks/bulk-assign', { method: 'POST', body: JSON.stringify(data) }),
  autoAssignTasks: (floor?: number) => {
    const query = floor ? `?floor=${floor}` : '';
    return fetchAPI<any>(`/housekeeping/tasks/auto-assign${query}`, { method: 'POST' });
  },
  deleteTask: (id: string) => fetchAPI<any>(`/housekeeping/tasks/${id}`, { method: 'DELETE' }),
  // Legacy compatibility
  updateTask: (id: string, data: any) => fetchAPI<any>(`/housekeeping/tasks/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  completeTask: (id: string, data?: any) => fetchAPI<any>(`/housekeeping/tasks/${id}/status`, { 
    method: 'PUT', 
    body: JSON.stringify({ status: 'completed', ...(data || {}) }) 
  }),

  // Rooms
  getRooms: (params?: { floor?: number; status?: string; priority?: string }) => {
    const query = new URLSearchParams();
    if (params?.floor) query.append('floor', String(params.floor));
    if (params?.status) query.append('status', params.status);
    if (params?.priority) query.append('priority', params.priority);
    return fetchAPI<any>(`/housekeeping/rooms?${query}`);
  },
  getRoomsByFloor: (branchId?: string) => {
    const query = branchId ? `?branchId=${branchId}` : '';
    return fetchAPI<any>(`/housekeeping/rooms/by-floor${query}`);
  },
  getRoomsForInspection: (branchId?: string) => {
    const query = branchId ? `?branchId=${branchId}` : '';
    return fetchAPI<any>(`/housekeeping/rooms/for-inspection${query}`);
  },
  getRoom: (id: string) => fetchAPI<any>(`/housekeeping/rooms/${id}`),
  getRoomHistory: (id: string) => fetchAPI<any>(`/housekeeping/rooms/${id}/history`),
  updateRoomStatus: (id: string, data: any) => fetchAPI<any>(`/housekeeping/rooms/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  setRoomDND: (id: string, enable: boolean) => fetchAPI<any>(`/housekeeping/rooms/${id}/dnd`, { method: 'PUT', body: JSON.stringify({ enable }) }),
  assignRoomAttendant: (id: string, attendantId: string) => fetchAPI<any>(`/housekeeping/rooms/${id}/assign`, { method: 'PUT', body: JSON.stringify({ attendantId }) }),
  bulkUpdateRoomStatus: (data: { roomIds: string[]; status: string; reason?: string }) => fetchAPI<any>('/housekeeping/rooms/bulk-status', { method: 'PUT', body: JSON.stringify(data) }),
  getRoomStatus: (roomId: string) => fetchAPI<any>(`/housekeeping/rooms/${roomId}`),

  // Inspections
  getInspections: (params?: { result?: string; inspectedBy?: string; date?: string }) => {
    const query = new URLSearchParams();
    if (params?.result) query.append('result', params.result);
    if (params?.inspectedBy) query.append('inspectedBy', params.inspectedBy);
    if (params?.date) query.append('date', params.date);
    return fetchAPI<any>(`/housekeeping/inspections?${query}`);
  },
  getInspectionQueue: () => fetchAPI<any>('/housekeeping/inspections/queue'),
  getInspectionStats: (startDate?: string, endDate?: string) => {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    return fetchAPI<any>(`/housekeeping/inspections/stats?${query}`);
  },
  getInspection: (id: string) => fetchAPI<any>(`/housekeeping/inspections/${id}`),
  submitInspection: (data: any) => fetchAPI<any>('/housekeeping/inspections', { method: 'POST', body: JSON.stringify(data) }),

  // Staff
  getStaff: (params?: { available?: boolean; designation?: string; floor?: number }) => {
    const query = new URLSearchParams();
    if (params?.available !== undefined) query.append('available', String(params.available));
    if (params?.designation) query.append('designation', params.designation);
    if (params?.floor) query.append('floor', String(params.floor));
    return fetchAPI<any>(`/housekeeping/staff?${query}`);
  },
  getStaffWorkload: () => fetchAPI<any>('/housekeeping/staff/workload'),
  getStaffMember: (id: string) => fetchAPI<any>(`/housekeeping/staff/${id}`),
  getStaffPerformance: (id: string, period?: number) => {
    const query = period ? `?period=${period}` : '';
    return fetchAPI<any>(`/housekeeping/staff/${id}/performance${query}`);
  },
  createStaffProfile: (data: any) => fetchAPI<any>('/housekeeping/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaffProfile: (id: string, data: any) => fetchAPI<any>(`/housekeeping/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStaffAvailability: (id: string, data: any) => fetchAPI<any>(`/housekeeping/staff/${id}/availability`, { method: 'PUT', body: JSON.stringify(data) }),
  staffCheckIn: (id: string) => fetchAPI<any>(`/housekeeping/staff/${id}/check-in`, { method: 'POST' }),
  staffCheckOut: (id: string) => fetchAPI<any>(`/housekeeping/staff/${id}/check-out`, { method: 'POST' }),

  // Linen Management
  getLinenTypes: (category?: string) => {
    const query = category ? `?category=${category}` : '';
    return fetchAPI<any>(`/housekeeping/linen/types${query}`);
  },
  getLinenInventory: (params?: { locationType?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.locationType) query.append('locationType', params.locationType);
    if (params?.status) query.append('status', params.status);
    return fetchAPI<any>(`/housekeeping/linen/inventory?${query}`);
  },
  getLinenTransactions: (params?: { linenTypeId?: string; transactionType?: string; date?: string }) => {
    const query = new URLSearchParams();
    if (params?.linenTypeId) query.append('linenTypeId', params.linenTypeId);
    if (params?.transactionType) query.append('transactionType', params.transactionType);
    if (params?.date) query.append('date', params.date);
    return fetchAPI<any>(`/housekeeping/linen/transactions?${query}`);
  },
  getLinenParLevels: () => fetchAPI<any>('/housekeeping/linen/par-levels'),
  recordLinenTransaction: (data: any) => fetchAPI<any>('/housekeeping/linen/transactions', { method: 'POST', body: JSON.stringify(data) }),
  issueLinen: (data: any) => fetchAPI<any>('/housekeeping/linen/issue', { method: 'POST', body: JSON.stringify(data) }),
  returnLinen: (data: any) => fetchAPI<any>('/housekeeping/linen/return', { method: 'POST', body: JSON.stringify(data) }),

  // Lost & Found
  getLostFoundItems: (params?: { status?: string; category?: string; valuable?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.category) query.append('category', params.category);
    if (params?.valuable !== undefined) query.append('valuable', String(params.valuable));
    return fetchAPI<any>(`/housekeeping/lost-found?${query}`);
  },
  getExpiringLostFound: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return fetchAPI<any>(`/housekeeping/lost-found/expiring${query}`);
  },
  getLostFoundStats: (startDate?: string, endDate?: string) => {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    return fetchAPI<any>(`/housekeeping/lost-found/stats?${query}`);
  },
  getLostFoundItem: (id: string) => fetchAPI<any>(`/housekeeping/lost-found/${id}`),
  createLostFoundItem: (data: any) => fetchAPI<any>('/housekeeping/lost-found', { method: 'POST', body: JSON.stringify(data) }),
  updateLostFoundItem: (id: string, data: any) => fetchAPI<any>(`/housekeeping/lost-found/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateLostFoundStatus: (id: string, data: any) => fetchAPI<any>(`/housekeeping/lost-found/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  addContactAttempt: (id: string, data: any) => fetchAPI<any>(`/housekeeping/lost-found/${id}/contact`, { method: 'POST', body: JSON.stringify(data) }),

  // Maintenance Requests
  getMaintenanceRequests: (params?: { status?: string; priority?: string; category?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.priority) query.append('priority', params.priority);
    if (params?.category) query.append('category', params.category);
    return fetchAPI<any>(`/housekeeping/maintenance?${query}`);
  },
  getMaintenanceStats: () => fetchAPI<any>('/housekeeping/maintenance/stats'),
  getRoomMaintenance: (roomId: string) => fetchAPI<any>(`/housekeeping/maintenance/room/${roomId}`),
  getMaintenanceRequest: (id: string) => fetchAPI<any>(`/housekeeping/maintenance/${id}`),
  createMaintenanceRequest: (data: any) => fetchAPI<any>('/housekeeping/maintenance', { method: 'POST', body: JSON.stringify(data) }),
  updateMaintenanceStatus: (id: string, data: any) => fetchAPI<any>(`/housekeeping/maintenance/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  verifyMaintenanceCompletion: (id: string, data: any) => fetchAPI<any>(`/housekeeping/maintenance/${id}/verify`, { method: 'PUT', body: JSON.stringify(data) }),

  // Guest Requests
  getGuestRequests: (params?: { status?: string; requestType?: string; vip?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.requestType) query.append('requestType', params.requestType);
    if (params?.vip !== undefined) query.append('vip', String(params.vip));
    return fetchAPI<any>(`/housekeeping/guest-requests?${query}`);
  },
  getRequestTypesSummary: () => fetchAPI<any>('/housekeeping/guest-requests/types-summary'),
  getRoomGuestRequests: (roomId: string) => fetchAPI<any>(`/housekeeping/guest-requests/room/${roomId}`),
  getGuestRequest: (id: string) => fetchAPI<any>(`/housekeeping/guest-requests/${id}`),
  createGuestRequest: (data: any) => fetchAPI<any>('/housekeeping/guest-requests', { method: 'POST', body: JSON.stringify(data) }),
  assignGuestRequest: (id: string, assignedTo: string) => fetchAPI<any>(`/housekeeping/guest-requests/${id}/assign`, { method: 'PUT', body: JSON.stringify({ assignedTo }) }),
  completeGuestRequest: (id: string, data?: any) => fetchAPI<any>(`/housekeeping/guest-requests/${id}/complete`, { method: 'PUT', body: JSON.stringify(data || {}) }),
  recordGuestFeedback: (id: string, data: any) => fetchAPI<any>(`/housekeeping/guest-requests/${id}/feedback`, { method: 'PUT', body: JSON.stringify(data) }),

  // Scheduling
  getShiftDefinitions: () => fetchAPI<any>('/housekeeping/scheduling/shifts'),
  getSchedules: (startDate: string, endDate: string, staffId?: string) => {
    const query = new URLSearchParams({ startDate, endDate });
    if (staffId) query.append('staffId', staffId);
    return fetchAPI<any>(`/housekeeping/scheduling/schedules?${query}`);
  },
  getTodayRoster: () => fetchAPI<any>('/housekeeping/scheduling/today-roster'),
  getLeaveRequests: (params?: { status?: string; staffId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.staffId) query.append('staffId', params.staffId);
    return fetchAPI<any>(`/housekeeping/scheduling/leave-requests?${query}`);
  },
  getShiftSwaps: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchAPI<any>(`/housekeeping/scheduling/shift-swaps${query}`);
  },
  createSchedule: (data: any) => fetchAPI<any>('/housekeeping/scheduling/schedules', { method: 'POST', body: JSON.stringify(data) }),
  bulkCreateSchedules: (schedules: any[]) => fetchAPI<any>('/housekeeping/scheduling/schedules/bulk', { method: 'POST', body: JSON.stringify({ schedules }) }),
  updateSchedule: (id: string, data: any) => fetchAPI<any>(`/housekeeping/scheduling/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSchedule: (id: string) => fetchAPI<any>(`/housekeeping/scheduling/schedules/${id}`, { method: 'DELETE' }),
  createLeaveRequest: (data: any) => fetchAPI<any>('/housekeeping/scheduling/leave-requests', { method: 'POST', body: JSON.stringify(data) }),
  reviewLeaveRequest: (id: string, data: { approved: boolean; reviewNotes?: string }) => fetchAPI<any>(`/housekeeping/scheduling/leave-requests/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  createShiftSwap: (data: any) => fetchAPI<any>('/housekeeping/scheduling/shift-swaps', { method: 'POST', body: JSON.stringify(data) }),
  respondToShiftSwap: (id: string, accepted: boolean) => fetchAPI<any>(`/housekeeping/scheduling/shift-swaps/${id}/respond`, { method: 'PUT', body: JSON.stringify({ accepted }) }),
  approveShiftSwap: (id: string, approved: boolean) => fetchAPI<any>(`/housekeeping/scheduling/shift-swaps/${id}/approve`, { method: 'PUT', body: JSON.stringify({ approved }) }),

  // Reports
  getDailyReport: (date?: string) => {
    const query = date ? `?date=${date}` : '';
    return fetchAPI<any>(`/housekeeping/reports/daily${query}`);
  },
  getStaffPerformanceReport: (startDate: string, endDate: string) => {
    return fetchAPI<any>(`/housekeeping/reports/staff-performance?startDate=${startDate}&endDate=${endDate}`);
  },
  getProductivityReport: (startDate: string, endDate: string) => {
    return fetchAPI<any>(`/housekeeping/reports/productivity?startDate=${startDate}&endDate=${endDate}`);
  },
  getTurnaroundReport: (date?: string) => {
    const query = date ? `?date=${date}` : '';
    return fetchAPI<any>(`/housekeeping/reports/turnaround${query}`);
  },
  getSupplyUsageReport: (startDate: string, endDate: string) => {
    return fetchAPI<any>(`/housekeeping/reports/supply-usage?startDate=${startDate}&endDate=${endDate}`);
  },
  exportReport: (params: { reportType: string; format: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any);
    return fetchAPI<any>(`/housekeeping/reports/export?${query}`);
  },

  // =====================================================
  // SMART ASSIGNMENT
  // =====================================================
  smartAssignTask: (taskId: string) => fetchAPI<any>(`/housekeeping/smart-assign/task/${taskId}`, { method: 'POST' }),
  smartAssignBatch: (taskIds: string[]) => fetchAPI<any>('/housekeeping/smart-assign/batch', { method: 'POST', body: JSON.stringify({ taskIds }) }),
  getAssignmentRecommendations: (taskId: string, limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return fetchAPI<any>(`/housekeeping/smart-assign/recommendations/${taskId}${query}`);
  },

  // =====================================================
  // GAMIFICATION
  // =====================================================
  getLeaderboard: (period?: 'week' | 'month' | 'all', limit?: number) => {
    const query = new URLSearchParams();
    if (period) query.append('period', period);
    if (limit) query.append('limit', String(limit));
    return fetchAPI<any>(`/housekeeping/gamification/leaderboard?${query}`);
  },
  getStaffGamificationStats: (staffId: string) => fetchAPI<any>(`/housekeeping/gamification/staff/${staffId}/stats`),
  getAllAchievements: () => fetchAPI<any>('/housekeeping/gamification/achievements'),
  getStaffBadges: (staffId: string) => fetchAPI<any>(`/housekeeping/gamification/staff/${staffId}/achievements`),
  getTeamChallenges: (activeOnly?: boolean) => {
    const query = activeOnly !== undefined ? `?active=${activeOnly}` : '';
    return fetchAPI<any>(`/housekeeping/gamification/challenges${query}`);
  },
  awardBonusPoints: (staffId: string, type: string, description?: string) => 
    fetchAPI<any>('/housekeeping/gamification/award-bonus', { method: 'POST', body: JSON.stringify({ staffId, type, description }) }),

  // =====================================================
  // GUEST PORTAL
  // =====================================================
  submitGuestPortalRequest: (data: any) => fetchAPI<any>('/housekeeping/guest-portal/request', { method: 'POST', body: JSON.stringify(data) }),
  getGuestPortalRequestStatus: (requestId: string) => fetchAPI<any>(`/housekeeping/guest-portal/request/${requestId}/status`),
  requestCleanNow: (roomNumber: string, guestName?: string, reason?: string) => 
    fetchAPI<any>('/housekeeping/guest-portal/clean-now', { method: 'POST', body: JSON.stringify({ roomNumber, guestName, reason }) }),
  setDndSchedule: (roomNumber: string, startTime: string, endTime: string) => 
    fetchAPI<any>('/housekeeping/guest-portal/dnd-schedule', { method: 'POST', body: JSON.stringify({ roomNumber, startTime, endTime }) }),
  saveGuestPortalPreferences: (roomNumber: string, preferences: any) => 
    fetchAPI<any>('/housekeeping/guest-portal/preferences', { method: 'POST', body: JSON.stringify({ roomNumber, preferences }) }),
  getGuestPortalPreferences: (roomNumber: string) => fetchAPI<any>(`/housekeeping/guest-portal/preferences/${roomNumber}`),
  submitGuestPortalFeedback: (requestId: string, rating: number, feedback?: string) => 
    fetchAPI<any>(`/housekeeping/guest-portal/feedback/${requestId}`, { method: 'POST', body: JSON.stringify({ rating, feedback }) }),

  // =====================================================
  // SUSTAINABILITY
  // =====================================================
  recordSustainabilityMetrics: (taskId: string, metrics: any) => 
    fetchAPI<any>(`/housekeeping/sustainability/task/${taskId}/metrics`, { method: 'POST', body: JSON.stringify(metrics) }),
  getSustainabilityDailySummary: (date?: string, branchId?: number) => {
    const query = new URLSearchParams();
    if (date) query.append('date', date);
    if (branchId) query.append('branchId', String(branchId));
    return fetchAPI<any>(`/housekeeping/sustainability/daily-summary?${query}`);
  },
  getSustainabilityTrends: (days?: number, branchId?: number) => {
    const query = new URLSearchParams();
    if (days) query.append('days', String(days));
    if (branchId) query.append('branchId', String(branchId));
    return fetchAPI<any>(`/housekeeping/sustainability/trends?${query}`);
  },
  registerGreenGuest: (bookingId: string, roomNumber: string, options: any) => 
    fetchAPI<any>('/housekeeping/sustainability/green-guest', { method: 'POST', body: JSON.stringify({ bookingId, roomNumber, options }) }),
  getGreenGuestStats: (bookingId: string) => fetchAPI<any>(`/housekeeping/sustainability/green-guest/${bookingId}/stats`),
  generateGreenCertificate: (bookingId: string) => fetchAPI<any>(`/housekeeping/sustainability/green-guest/${bookingId}/certificate`),
  getStaffSustainabilityRanking: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return fetchAPI<any>(`/housekeeping/sustainability/staff-ranking${query}`);
  },

  // =====================================================
  // PREDICTIVE ANALYTICS
  // =====================================================
  getDemandForecast: (date?: string, branchId?: number) => {
    const query = new URLSearchParams();
    if (date) query.append('date', date);
    if (branchId) query.append('branchId', String(branchId));
    return fetchAPI<any>(`/housekeeping/analytics/demand-forecast?${query}`);
  },
  getStaffPrediction: (date?: string, shiftType?: string, branchId?: number) => {
    const query = new URLSearchParams();
    if (date) query.append('date', date);
    if (shiftType) query.append('shiftType', shiftType);
    if (branchId) query.append('branchId', String(branchId));
    return fetchAPI<any>(`/housekeeping/analytics/staff-prediction?${query}`);
  },
  getQualityAlerts: (branchId?: number) => {
    const query = branchId ? `?branchId=${branchId}` : '';
    return fetchAPI<any>(`/housekeeping/analytics/quality-alerts${query}`);
  },
  getForecastAccuracy: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return fetchAPI<any>(`/housekeeping/analytics/forecast-accuracy${query}`);
  },
  getSupplyPrediction: (supplyId: string, days?: number, branchId?: number) => {
    const query = new URLSearchParams();
    if (days) query.append('days', String(days));
    if (branchId) query.append('branchId', String(branchId));
    return fetchAPI<any>(`/housekeeping/analytics/supply-prediction/${supplyId}?${query}`);
  },

  // =====================================================
  // PMS INTEGRATION
  // =====================================================
  processBookingEvent: (event: any) => fetchAPI<any>('/housekeeping/pms/booking-event', { method: 'POST', body: JSON.stringify(event) }),
  syncPmsGuestPreferences: (bookingId: string, roomNumber: string, preferences: any) => 
    fetchAPI<any>('/housekeeping/pms/sync-preferences', { method: 'POST', body: JSON.stringify({ bookingId, roomNumber, preferences }) }),
  getPmsTodayArrivals: () => fetchAPI<any>('/housekeeping/pms/today-arrivals'),
  getPmsTodayDepartures: () => fetchAPI<any>('/housekeeping/pms/today-departures'),
  autoGenerateTasksFromBookings: () => fetchAPI<any>('/housekeeping/pms/auto-generate-tasks', { method: 'POST' }),
  notifyRoomReady: (roomNumber: string, bookingId?: string) => 
    fetchAPI<any>('/housekeeping/pms/notify-room-ready', { method: 'POST', body: JSON.stringify({ roomNumber, bookingId }) }),
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
  // Orders
  getOrders: (branchId?: number, status?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.append('branch_id', String(branchId));
    if (status) query.append('status', status);
    return fetchAPI<any>(`/restaurant/orders?${query}`);
  },
  getOrder: (id: string) => fetchAPI<any>(`/restaurant/orders/${id}`),
  createOrder: (data: any) => fetchAPI<any>('/restaurant/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: any) => fetchAPI<any>(`/restaurant/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateOrderStatus: (id: string, status: string) => fetchAPI<any>(`/restaurant/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  
  // Menu Categories
  getCategories: () => fetchAPI<any>('/restaurant/menu/categories'),
  createCategory: (data: any) => fetchAPI<any>('/restaurant/menu/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) => fetchAPI<any>(`/restaurant/menu/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) => fetchAPI<any>(`/restaurant/menu/categories/${id}`, { method: 'DELETE' }),
  
  // Menu Items
  getMenuItems: (categoryId?: string, branchId?: number) => {
    const query = new URLSearchParams();
    if (categoryId) query.append('category_id', categoryId);
    if (branchId) query.append('branch_id', String(branchId));
    return fetchAPI<any>(`/restaurant/menu/items?${query}`);
  },
  getMenuItem: (id: string) => fetchAPI<any>(`/restaurant/menu/items/${id}`),
  createMenuItem: (data: any) => fetchAPI<any>('/restaurant/menu/items', { method: 'POST', body: JSON.stringify(data) }),
  updateMenuItem: (id: string, data: any) => fetchAPI<any>(`/restaurant/menu/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMenuItem: (id: string) => fetchAPI<any>(`/restaurant/menu/items/${id}`, { method: 'DELETE' }),
  toggleItemAvailability: (id: string) => fetchAPI<any>(`/restaurant/menu/items/${id}/toggle`, { method: 'PUT' }),
  
  // Tables
  getTables: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/restaurant/tables${query}`);
  },
  updateTableStatus: (id: string, status: string) => fetchAPI<any>(`/restaurant/tables/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  
  // Kitchen Display
  getKitchenOrders: () => fetchAPI<any>('/restaurant/kitchen/orders'),
  markItemReady: (orderId: string, itemId: string) => fetchAPI<any>(`/restaurant/kitchen/orders/${orderId}/items/${itemId}/ready`, { method: 'PUT' }),
  
  // Receipts & Billing
  generateReceipt: (orderId: string) => fetchAPI<any>(`/restaurant/orders/${orderId}/receipt`),
  processPayment: (orderId: string, data: any) => fetchAPI<any>(`/restaurant/orders/${orderId}/payment`, { method: 'POST', body: JSON.stringify(data) }),
  
  // Reports
  getDailySales: (date?: string) => {
    const query = date ? `?date=${date}` : '';
    return fetchAPI<any>(`/restaurant/reports/daily-sales${query}`);
  },
  getPopularItems: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return fetchAPI<any>(`/restaurant/reports/popular-items${query}`);
  },
};

// =====================================================
// BAR API
// =====================================================

export const barAPI = {
  // Orders
  getOrders: (branchId?: number, status?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.append('branch_id', String(branchId));
    if (status) query.append('status', status);
    return fetchAPI<any>(`/bar/orders?${query}`);
  },
  getOrder: (id: string) => fetchAPI<any>(`/bar/orders/${id}`),
  createOrder: (data: any) => fetchAPI<any>('/bar/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: string, data: any) => fetchAPI<any>(`/bar/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateOrderStatus: (id: string, status: string) => fetchAPI<any>(`/bar/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  
  // Drink Categories
  getCategories: () => fetchAPI<any>('/bar/categories'),
  createCategory: (data: any) => fetchAPI<any>('/bar/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) => fetchAPI<any>(`/bar/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) => fetchAPI<any>(`/bar/categories/${id}`, { method: 'DELETE' }),
  
  // Drinks Menu
  getDrinks: (categoryId?: string) => {
    const query = categoryId ? `?category_id=${categoryId}` : '';
    return fetchAPI<any>(`/bar/drinks${query}`);
  },
  getDrink: (id: string) => fetchAPI<any>(`/bar/drinks/${id}`),
  createDrink: (data: any) => fetchAPI<any>('/bar/drinks', { method: 'POST', body: JSON.stringify(data) }),
  updateDrink: (id: string, data: any) => fetchAPI<any>(`/bar/drinks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDrink: (id: string) => fetchAPI<any>(`/bar/drinks/${id}`, { method: 'DELETE' }),
  toggleDrinkAvailability: (id: string) => fetchAPI<any>(`/bar/drinks/${id}/toggle`, { method: 'PUT' }),
  
  // Tabs (for customers running a tab)
  getTabs: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/bar/tabs${query}`);
  },
  createTab: (data: any) => fetchAPI<any>('/bar/tabs', { method: 'POST', body: JSON.stringify(data) }),
  addToTab: (tabId: string, items: any) => fetchAPI<any>(`/bar/tabs/${tabId}/items`, { method: 'POST', body: JSON.stringify(items) }),
  closeTab: (tabId: string, paymentMethod: string) => fetchAPI<any>(`/bar/tabs/${tabId}/close`, { method: 'POST', body: JSON.stringify({ payment_method: paymentMethod }) }),
  
  // Stock & Inventory
  getStock: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/bar/stock${query}`);
  },
  updateStock: (id: string, quantity: number) => fetchAPI<any>(`/bar/stock/${id}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),
  
  // Reports
  getDailySales: (date?: string, branchId?: number) => {
    const query = new URLSearchParams();
    if (date) query.append('date', date);
    if (branchId) query.append('branch_id', String(branchId));
    return fetchAPI<any>(`/bar/reports/daily-sales?${query}`);
  },
  getPopularDrinks: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return fetchAPI<any>(`/bar/reports/popular-drinks${query}`);
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
  
  // Advanced Financial Tools
  getCashFlow: (params?: { startDate?: string; endDate?: string; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchAPI<any>(`/finance/cashflow?${query}`);
  },
  getProfitLoss: (params?: { startDate?: string; endDate?: string; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchAPI<any>(`/finance/profit-loss?${query}`);
  },
  getRevenueByBranch: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    return fetchAPI<any>(`/finance/revenue-by-branch?${query}`);
  },
  getBudgetAnalysis: (params?: { year?: number; month?: number; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.year) query.append('year', String(params.year));
    if (params?.month) query.append('month', String(params.month));
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchAPI<any>(`/finance/budget-analysis?${query}`);
  },
  getTaxSummary: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    return fetchAPI<any>(`/finance/tax-summary?${query}`);
  },
  getForecast: (months?: number) => {
    const query = months ? `?months=${months}` : '';
    return fetchAPI<any>(`/finance/forecast${query}`);
  },
  getArAp: () => fetchAPI<any>('/finance/ar-ap'),
  getKPIs: (period?: string) => {
    const query = period ? `?period=${period}` : '';
    return fetchAPI<any>(`/finance/kpis${query}`);
  },
  getExpenses: () => fetchAPI<any>('/finance/expenses'),
  createExpense: (data: any) => fetchAPI<any>('/finance/expenses', { method: 'POST', body: JSON.stringify(data) }),
  approveExpense: (id: string) => fetchAPI<any>(`/finance/expenses/${id}/approve`, { method: 'PUT' }),
  getBudgets: () => fetchAPI<any>('/finance/budgets'),
  createBudget: (data: any) => fetchAPI<any>('/finance/budgets', { method: 'POST', body: JSON.stringify(data) }),
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
