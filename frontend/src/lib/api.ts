/**
 * Unified API Service for Famous Gate Hotel Management System
 * All API calls should go through this service for consistency
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:5001';

// Helper to get auth headers - safe for SSR
const getHeaders = () => {
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  }
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

// Generic fetch wrapper with error handling and SSR safety
// Maximum number of retries for API calls
const MAX_RETRIES = 2;

// Exponential backoff for retries (ms)
const getBackoffDelay = (retryCount: number) => Math.min(1000 * 2 ** retryCount, 5000);

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let retries = 0;
  let lastError: Error | null = null;
  
  while (retries <= MAX_RETRIES) {
    try {
      // If this is a retry, wait with exponential backoff
      if (retries > 0) {
        const delay = getBackoffDelay(retries - 1);
        console.log(`Retry attempt ${retries} for ${endpoint} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Make the API request
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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Only retry on network errors or 500-level server errors
      const isNetworkError = lastError.message.includes('fetch');
      const isServerError = lastError.message.includes('500');
      
      if (!isNetworkError && !isServerError) {
        console.error(`API request error (not retrying):`, error);
        break; // Don't retry client errors or other issues
      }
      
      console.warn(`API request failed (attempt ${retries+1}/${MAX_RETRIES+1}):`, error);
      retries++;
    }
  }

  console.error('API request error after retries:', lastError);
  
  // If mock data is available for this endpoint in development, return it
  if (process.env.NODE_ENV === 'development') {
    const mockData = getMockData(endpoint);
    if (mockData) {
      console.info(`Using mock data for ${endpoint}`);
      return mockData as unknown as T;
    }
  }
  
  // Return a standardized error response structure
  return { 
    success: false, 
    message: lastError?.message || 'API request failed after retries',
    data: null 
  } as unknown as T;
}

// Helper to provide mock data for common endpoints in development
function getMockData(endpoint: string): any {
  // Remove leading slash and query params
  const cleanEndpoint = endpoint.replace(/^\//, '').split('?')[0];
  
  // Simple mock data store
  const mockDataStore: Record<string, any> = {
    'notifications/unread-count': { count: 0 },
    'staff': { data: [
      { id: '1', name: 'John Doe', email: 'john@example.com', role: 'manager', department: 'Management' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'reception', department: 'Front Desk' }
    ]},
    'branch-operations/staff': { 
      success: true, 
      data: [
        { id: '1', name: 'John Doe', email: 'john@example.com', role: 'manager', department: 'Management' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'reception', department: 'Front Desk' }
      ]
    }
  };
  
  return mockDataStore[cleanEndpoint] || null;
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
  createStockRequest: (data: {
    items: Array<{
      item_sku: string;
      quantity?: number;
      requested_quantity?: number;
      current_branch_stock?: number;
    }>;
    request_type?: string;
    priority?: string;
    reason?: string;
    notes?: string;
    needed_by_date?: string;
  }) => {
    const payload = {
      items: data.items.map((item) => ({
        item_sku: item.item_sku,
        requested_quantity: item.requested_quantity ?? item.quantity ?? 0,
        current_branch_stock: item.current_branch_stock ?? 0,
      })),
      request_type: data.request_type,
      priority: data.priority,
      reason: data.reason ?? data.notes,
      needed_by_date: data.needed_by_date,
    };

    return fetchAPI<any>('/store/stock-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
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
  dispatchItems: (id: string, data?: { vehicle_id?: string; driver_id?: string }) =>
    fetchAPI<any>(`/store/dispatch-notes/${id}/dispatch`, {
      method: 'PUT',
      ...(data ? { body: JSON.stringify(data) } : {}),
    }),
  getIncomingDispatches: () => fetchAPI<any>('/store/incoming-dispatches'),
  confirmDelivery: (id: string, data: {
    received_items: Array<{
      id: string;
      received_quantity: number;
      damaged_quantity?: number;
      missing_quantity?: number;
      discrepancy_reason?: string;
    }>;
    delivery_notes?: string;
  }) =>
    fetchAPI<any>(`/store/dispatch-notes/${id}/confirm`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Transfer cart / simple_transfer_items
  getTransferItems: (params?: { search?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    const qs = query.toString();
    return fetchAPI<any>(`/store/transfer_items${qs ? `?${qs}` : ''}`);
  },
  transferItem: (data: { sku: string; transfer_quantity: number }) =>
    fetchAPI<any>('/store/transfer', { method: 'POST', body: JSON.stringify(data) }),
  submitTransferRequest: () =>
    fetchAPI<any>('/store/submit-transfer-request', { method: 'POST' }),
  completeTransfer: (data: { sku: string; quantity: number; shop_user_id: string; cancel?: boolean }) =>
    fetchAPI<any>('/store/complete-transfer', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        cancel: data.cancel ?? false,
      }),
    }),
  
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
  
  // Roles
  getRoles: () => fetchAPI<any>('/staff/roles'),
  
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
  getLeaveRequests: (params?: { staff_id?: string; employee_id?: string; branch_id?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.staff_id) query.append('staff_id', params.staff_id);
    if (params?.employee_id) query.append('employee_id', params.employee_id);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.status) query.append('status', params.status);
    return fetchAPI<any>(`/staff/leave?${query}`);
  },
  submitLeaveRequest: (data: any) => fetchAPI<any>('/staff/leave', { method: 'POST', body: JSON.stringify(data) }),
  createLeaveRequest: (data: any) => fetchAPI<any>('/staff/leave', { method: 'POST', body: JSON.stringify(data) }),
  updateLeaveRequest: (id: string, data: any) => fetchAPI<any>(`/staff/leave/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
  getRoomTypes: () => fetchAPI<any>('/rooms/types'),
  createRoom: (data: any) => fetchAPI<any>('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id: string, data: any) => fetchAPI<any>(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateRoomStatus: (id: string, status: string) => 
    fetchAPI<any>(`/rooms/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteRoom: (id: string) =>
    fetchAPI<any>(`/rooms/${id}`, { method: 'DELETE' }),
  getRoomBookings: (id: string) =>
    fetchAPI<any>(`/rooms/${id}/bookings`),
  getRoomMaintenance: (id: string) =>
    fetchAPI<any>(`/rooms/${id}/maintenance`),
  getRoomReviews: (id: string) =>
    fetchAPI<any>(`/rooms/${id}/reviews`),
};

// =====================================================
// GUEST API
// =====================================================

export const guestAPI = {
  getGuests: (search?: string) => {
    const query = search ? `?search=${search}` : '';
    return fetchAPI<any>(`/guests${query}`);
  },
  getGuest: (id: string) => fetchAPI<any>(`/guests/${id}`),
  createGuest: (data: any) => fetchAPI<any>('/guests', { method: 'POST', body: JSON.stringify(data) }),
  updateGuest: (id: string, data: any) => fetchAPI<any>(`/guests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGuest: (id: string) => fetchAPI<any>(`/guests/${id}`, { method: 'DELETE' }),
  updatePreferences: (id: string, preferences: any) => 
    fetchAPI<any>(`/guests/${id}/preferences`, { method: 'PUT', body: JSON.stringify({ preferences }) })
};

// =====================================================
// FOLIO API
// =====================================================

export const folioAPI = {
  getFolio: (reservationId: string) => fetchAPI<any>(`/folios/reservation/${reservationId}`),
  addTransaction: (reservationId: string, data: any) => 
    fetchAPI<any>(`/folios/reservation/${reservationId}/transaction`, { method: 'POST', body: JSON.stringify(data) })
};

// =====================================================
// =====================================================
// REPORTS API
// =====================================================

export const reportAPI = {
  getReports: () => fetchAPI<any>('/reports'),
  createReport: (data: any) => fetchAPI<any>('/reports', { method: 'POST', body: JSON.stringify(data) }),
  generateReport: (id: string) => fetchAPI<any>(`/reports/${id}/generate`, { method: 'POST' }),
  getDashboard: () => fetchAPI<any>('/reports/dashboard'),
  getRevenueReport: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params);
    return fetchAPI<any>(`/reports/revenue?${query}`);
  },
  getOccupancyReport: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params);
    return fetchAPI<any>(`/reports/occupancy?${query}`);
  }
};

// =====================================================
// BOOKINGS API
// =====================================================

export const bookingsAPI = {
  getBookings: (params?: { status?: string; checkIn?: string; checkOut?: string; roomType?: string; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.checkIn) query.append('checkIn', params.checkIn);
    if (params?.checkOut) query.append('checkOut', params.checkOut);
    if (params?.roomType) query.append('roomType', params.roomType);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchAPI<any>(`/bookings?${query}`);
  },
  getBooking: (id: string) => fetchAPI<any>(`/bookings/${id}`),
  createBooking: (data: any) => fetchAPI<any>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id: string, data: any) => fetchAPI<any>(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancelBooking: (id: string, reason?: string) => 
    fetchAPI<any>(`/bookings/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  checkIn: (id: string) => fetchAPI<any>(`/bookings/${id}/check-in`, { method: 'PUT' }),
  checkOut: (id: string) => fetchAPI<any>(`/bookings/${id}/check-out`, { method: 'PUT' }), 
  getAvailableRooms: (checkIn: string, checkOut: string, guests?: number) => {
    const query = new URLSearchParams({ checkIn, checkOut });
    if (guests) query.append('guests', String(guests));
    return fetchAPI<any>(`/bookings/available?${query}`);
  }
};

// =====================================================
// RATE PLANS API
// =====================================================

export const ratePlansAPI = {
  getRatePlans: () => fetchAPI<any>('/rate-plans'),
  getRatePlan: (id: string) => fetchAPI<any>(`/rate-plans/${id}`),
  createRatePlan: (data: any) => fetchAPI<any>('/rate-plans', { method: 'POST', body: JSON.stringify(data) }),
  updateRatePlan: (id: string, data: any) => fetchAPI<any>(`/rate-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRatePlan: (id: string) => fetchAPI<any>(`/rate-plans/${id}`, { method: 'DELETE' })
};

// =====================================================
// PRICING API (AI Engine)
// =====================================================

export const pricingAPI = {
  getQuote: (data: { checkIn: string; checkOut: string; roomTypeId: string; guests: number }) => 
    fetchAPI<any>('/pricing/quote', { method: 'POST', body: JSON.stringify(data) })
};

// =====================================================
// DOCUMENTS API
// =====================================================

export const documentsAPI = {
  uploadDocument: async (file: File, guestId: string, documentType: string, reservationId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('guestId', guestId);
    formData.append('documentType', documentType);
    if (reservationId) formData.append('reservationId', reservationId);
    
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_URL}/api/documents/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    return response.json();
  },
  getGuestDocuments: (guestId: string) => fetchAPI<any>(`/documents/guest/${guestId}`),
  deleteDocument: (id: string) => fetchAPI<any>(`/documents/${id}`, { method: 'DELETE' })
};

// =====================================================
// GUEST LOYALTY API
// =====================================================

export const guestLoyaltyAPI = {
  getHistory: (guestId: string) => fetchAPI<any>(`/guests/${guestId}/history`),
  
  getLoyalty: (guestId: string) => fetchAPI<any>(`/guests/${guestId}/loyalty`),
  
  updatePoints: (guestId: string, data: { points: number; reason: string; type: 'earn' | 'redeem' }) =>
    fetchAPI<any>(`/guests/${guestId}/loyalty/points`, { method: 'POST', body: JSON.stringify(data) }),
  
  getVIPGuests: () => fetchAPI<any>('/guests/vip/list'),
};

// =====================================================
// CHANNEL MANAGER API
// =====================================================

export const channelManagerAPI = {
  getChannels: () => fetchAPI<any>('/channel-manager'),
  
  getSyncStatus: () => fetchAPI<any>('/channel-manager/status'),
  
  configureChannel: (channelId: string, config: Record<string, any>) =>
    fetchAPI<any>(`/channel-manager/${channelId}/configure`, { 
      method: 'PUT', 
      body: JSON.stringify(config) 
    }),
  
  toggleChannel: (channelId: string, enabled: boolean) =>
    fetchAPI<any>(`/channel-manager/${channelId}/toggle`, { 
      method: 'PATCH', 
      body: JSON.stringify({ enabled }) 
    }),
  
  pushAvailability: (channelId: string, availability: any[]) =>
    fetchAPI<any>(`/channel-manager/${channelId}/push-availability`, { 
      method: 'POST', 
      body: JSON.stringify({ availability }) 
    }),
  
  pushRates: (channelId: string, rates: any[]) =>
    fetchAPI<any>(`/channel-manager/${channelId}/push-rates`, { 
      method: 'POST', 
      body: JSON.stringify({ rates }) 
    }),
  
  pullBookings: (channelId: string) =>
    fetchAPI<any>(`/channel-manager/${channelId}/pull-bookings`, { method: 'POST' }),
  
  syncAllChannels: () =>
    fetchAPI<any>('/channel-manager/sync-all', { method: 'POST' }),
  
  importBooking: (booking: any) =>
    fetchAPI<any>('/channel-manager/import-booking', { 
      method: 'POST', 
      body: JSON.stringify(booking) 
    }),
};

// =====================================================
// COMMUNICATIONS API
// =====================================================

export const communicationsAPI = {
  sendBookingConfirmation: (bookingId: string, sendSms: boolean = false) =>
    fetchAPI<any>('/communications/booking-confirmation', { 
      method: 'POST', 
      body: JSON.stringify({ bookingId, sendSms }) 
    }),
  
  sendCheckInReminder: (bookingId: string, sendSms: boolean = false) =>
    fetchAPI<any>('/communications/check-in-reminder', { 
      method: 'POST', 
      body: JSON.stringify({ bookingId, sendSms }) 
    }),
  
  sendInvoice: (folioId: string) =>
    fetchAPI<any>('/communications/invoice', { 
      method: 'POST', 
      body: JSON.stringify({ folioId }) 
    }),
  
  sendEmail: (data: { to: string; subject: string; body: string }) =>
    fetchAPI<any>('/communications/email', { method: 'POST', body: JSON.stringify(data) }),
  
  sendSMS: (data: { phoneNumber: string; message: string }) =>
    fetchAPI<any>('/communications/sms', { method: 'POST', body: JSON.stringify(data) }),
  
  sendBulkSMS: (data: { recipients: string[]; message: string }) =>
    fetchAPI<any>('/communications/sms/bulk', { method: 'POST', body: JSON.stringify(data) }),
  
  getMessageLog: (limit: number = 50) =>
    fetchAPI<any>(`/communications/log?limit=${limit}`),
  
  healthCheck: () =>
    fetchAPI<any>('/communications/health'),
};

// =====================================================
// PAYMENTS API
// =====================================================

export const paymentsAPI = {
  createFolioIntent: (data: { folioId: string; amount: number; paymentMethod: string; guestId?: string }) =>
    fetchAPI<any>('/payments/folio/intent', { method: 'POST', body: JSON.stringify(data) }),
  
  confirmPayment: (paymentIntentId: string) =>
    fetchAPI<any>(`/payments/folio/confirm/${paymentIntentId}`, { method: 'POST' }),
  
  getPaymentStatus: (reference: string) =>
    fetchAPI<any>(`/payments/status/${reference}`),
  
  getFolioPayments: (folioId: string) =>
    fetchAPI<any>(`/payments/folio/${folioId}/history`),
  
  initiateBookingPayment: (data: { bookingId: string; phoneNumber?: string; amount: number; paymentMethod: string }) =>
    fetchAPI<any>('/payments/booking/initiate', { method: 'POST', body: JSON.stringify(data) }),
  
  initiateMpesa: (data: { phoneNumber: string; amount: number; folioId?: string; reservationId?: string }) =>
    fetchAPI<any>('/payments/mpesa/stk-push', { method: 'POST', body: JSON.stringify(data) }),
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
// INVENTORY API (legacy inventory module)
// =====================================================

export const inventoryAPI = {
  // Item Management
  createItem: (data: any) =>
    fetchAPI<any>('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getItems: (branch: string) =>
    fetchAPI<any>(`/inventory/items?branch=${encodeURIComponent(branch)}`),

  // Stock Transfers
  createTransfer: (data: any) =>
    fetchAPI<any>('/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getTransfers: (branch: string) =>
    fetchAPI<any>(`/inventory/transfers?branch=${encodeURIComponent(branch)}`),

  // Consumption Records
  recordConsumption: (data: any) =>
    fetchAPI<any>('/inventory/consumption', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getConsumptionRecords: (params: {
    branch: string;
    department?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const search = new URLSearchParams({ branch: params.branch });
    if (params.department) search.append('department', params.department);
    if (params.startDate) search.append('startDate', params.startDate);
    if (params.endDate) search.append('endDate', params.endDate);
    return fetchAPI<any>(`/inventory/consumption?${search.toString()}`);
  },

  // Stock Alerts
  getLowStockAlerts: (branch: string) =>
    fetchAPI<any>(`/inventory/alerts/low-stock?branch=${encodeURIComponent(branch)}`),

  // Reports
  generateInventoryReport: (branch: string, type: 'daily' | 'weekly' | 'monthly') =>
    fetchAPI<any>(`/inventory/reports?branch=${encodeURIComponent(branch)}&type=${type}`),

  // Requests (used by InventoryModals)
  createRequest: (data: { branchId: string; items: Array<{ itemId: string; requestedQuantity: number }> }) =>
    fetchAPI<any>('/inventory/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
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
  getMenuItems: (categoryId?: string, branchId?: number, onlyAvailable: boolean = false) => {
    const query = new URLSearchParams();
    if (categoryId) query.append('category', categoryId);
    if (branchId) query.append('branch_id', String(branchId));
    if (onlyAvailable) query.append('available', 'true');

    const qs = query.toString();
    const suffix = qs ? `?${qs}` : '';
    return fetchAPI<any>(`/restaurant/menu/items${suffix}`);
  },
  getMenuItem: (id: string) => fetchAPI<any>(`/restaurant/menu/items/${id}`),
  createMenuItem: (data: any) => fetchAPI<any>('/restaurant/menu/items', { method: 'POST', body: JSON.stringify(data) }),
  updateMenuItem: (id: string, data: any) => fetchAPI<any>(`/restaurant/menu/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMenuItem: (id: string) => fetchAPI<any>(`/restaurant/menu/items/${id}`, { method: 'DELETE' }),
  toggleItemAvailability: (id: string) => fetchAPI<any>(`/restaurant/menu/items/${id}/toggle`, { method: 'PUT' }),
  
  // Menu Item Images
  uploadMenuItemImage: (id: string, imageBase64: string, contentType: string, fileName?: string) => 
    fetchAPI<any>(`/restaurant/menu/items/${id}/image`, { 
      method: 'POST', 
      body: JSON.stringify({ imageBase64, contentType, fileName }) 
    }),
  deleteMenuItemImage: (id: string) => 
    fetchAPI<any>(`/restaurant/menu/items/${id}/image`, { method: 'DELETE' }),
  
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
  getDailySales: (branchId?: number, date?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.append('branch_id', String(branchId));
    if (date) query.append('date', date);
    const qs = query.toString();
    return fetchAPI<any>(`/restaurant/reports/daily-sales${qs ? `?${qs}` : ''}`);
  },
  getPopularItems: (days?: number) => {
    const query = days ? `?days=${days}` : '';
    return fetchAPI<any>(`/restaurant/reports/popular-items${query}`);
  },
  getTerminals: (branchId?: number) => fetchAPI<any>(`/restaurant/terminals${branchId ? `?branch_id=${branchId}` : ''}`),
  
  // Room Service
  createRoomServiceOrder: (data: { 
    room_number: string; 
    items: Array<{ menu_item_id: string; quantity: number; notes?: string }>; 
    special_instructions?: string;
    guest_name?: string;
  }) => fetchAPI<any>('/restaurant/room-service', { method: 'POST', body: JSON.stringify(data) }),
  getRoomServiceOrders: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchAPI<any>(`/restaurant/room-service${query}`);
  },
  updateRoomServiceStatus: (orderId: string, status: string) => 
    fetchAPI<any>(`/restaurant/room-service/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
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

  // Stock Requests
  getStockRequests: (params?: { status?: string; branch_id?: number; date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    return fetchAPI<any>(`/bar/stock-requests?${query}`);
  },
  getStockRequest: (id: string) => fetchAPI<any>(`/bar/stock-requests/${id}`),
  createStockRequest: (data: any) => fetchAPI<any>('/bar/stock-requests', { method: 'POST', body: JSON.stringify(data) }),
  updateRequestStatus: (id: string, data: any) => fetchAPI<any>(`/bar/stock-requests/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  fulfillStockRequest: (id: string, data: any) => fetchAPI<any>(`/bar/stock-requests/${id}/fulfill`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStockRequest: (id: string) => fetchAPI<any>(`/bar/stock-requests/${id}`, { method: 'DELETE' }),
  getLowStockItems: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/bar/stock-requests/low-stock${query}`);
  },
};

// =====================================================
// FINANCE API - Uses Node.js backend
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
  
  // Expense Management
  getExpenses: (params?: any) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.status) query.append('status', params.status);
    if (params?.category) query.append('category', params.category);
    return fetchAPI<any>(`/finance/expenses?${query}`);
  },
  createExpense: (data: any) => fetchAPI<any>('/finance/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: any) => fetchAPI<any>(`/finance/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => fetchAPI<any>(`/finance/expenses/${id}`, { method: 'DELETE' }),
  
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
  approveExpense: (id: string) => fetchAPI<any>(`/finance/expenses/${id}/approve`, { method: 'PUT' }),
  getBudgets: () => fetchAPI<any>('/finance/budgets'),
  createBudget: (data: any) => fetchAPI<any>('/finance/budgets', { method: 'POST', body: JSON.stringify(data) }),
  
  // Advanced Accounting Features
  getBalanceSheet: (params?: { branch_id?: number; as_of_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.as_of_date) query.append('as_of_date', params.as_of_date);
    return fetchAPI<any>(`/finance/balance-sheet?${query}`);
  },
  getTrialBalance: (params?: { branch_id?: number; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return fetchAPI<any>(`/finance/trial-balance?${query}`);
  },
  getJournalEntries: (params?: { branch_id?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.limit) query.append('limit', String(params.limit));
    return fetchAPI<any>(`/finance/journal-entries?${query}`);
  },
  createJournalEntry: (data: any) => fetchAPI<any>('/finance/journal-entries', { method: 'POST', body: JSON.stringify(data) }),
  getFinancialRatios: (params?: { branch_id?: number }) => {
    const query = params?.branch_id ? `?branch_id=${params.branch_id}` : '';
    return fetchAPI<any>(`/finance/financial-ratios${query}`);
  },
  getAgingReport: (type: 'receivable' | 'payable' = 'receivable') => fetchAPI<any>(`/finance/aging-report?type=${type}`),
  getExpenseBreakdown: (params?: { branch_id?: number; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return fetchAPI<any>(`/finance/expense-breakdown?${query}`);
  },
  getRevenueAnalysis: (params?: { branch_id?: number }) => {
    const query = params?.branch_id ? `?branch_id=${params.branch_id}` : '';
    return fetchAPI<any>(`/finance/revenue-analysis${query}`);
  },
  getComparativeAnalysis: (params?: { type?: 'period' | 'branch'; branch_id?: number; days?: number }) => {
    const query = new URLSearchParams();
    if (params?.type) query.append('type', params.type);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.days) query.append('days', String(params.days));
    return fetchAPI<any>(`/finance/comparative-analysis?${query}`);
  },
  generateReport: (data: { report_type: string; branch_id?: number }) => 
    fetchAPI<any>('/finance/reports/generate', { method: 'POST', body: JSON.stringify(data) }),
  getBranches: () => fetchAPI<any>('/finance/branches'),
};

// =====================================================
// RECEIPTS API
// =====================================================

const PYTHON_SERVICE_URL = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:5001';

export const receiptsAPI = {
  // Get receipts with filters
  getReceipts: (params?: { branch_id?: string; receipt_type?: string; payment_status?: string; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.receipt_type) query.append('receipt_type', params.receipt_type);
    if (params?.payment_status) query.append('payment_status', params.payment_status);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return fetchAPI<any>(`/receipts?${query}`);
  },
  
  // Get single receipt
  getReceipt: (id: string) => fetchAPI<any>(`/receipts/${id}`),
  
  // Create receipt
  createReceipt: (data: any) => fetchAPI<any>('/receipts', { method: 'POST', body: JSON.stringify(data) }),
  
  // Update receipt
  updateReceipt: (id: string, data: any) => fetchAPI<any>(`/receipts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  // Get receipt stats
  getStats: (params?: { branch_id?: string; period?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.period) query.append('period', params.period);
    return fetchAPI<any>(`/receipts/stats?${query}`);
  },
  
  // Get daily revenue
  getDailyRevenue: (params?: { branch_id?: string; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return fetchAPI<any>(`/receipts/revenue?${query}`);
  },
  
  // Generate PDF receipt via Python service
  generatePDF: async (receiptData: any): Promise<Blob> => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/receipts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData),
    });
    if (!response.ok) throw new Error('Failed to generate PDF');
    return response.blob();
  },
  
  // Generate PDF as base64 for preview
  generatePDFBase64: async (receiptData: any): Promise<{ pdf_base64: string; filename: string }> => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/receipts/generate/base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData),
    });
    if (!response.ok) throw new Error('Failed to generate PDF');
    const data = await response.json();
    return data.data;
  },
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
  getReports: () => fetchAPI<any>('/audit/reports'),
  getComplianceItems: () => fetchAPI<any>('/audit/compliance'),
  getRoleMigrations: () => fetchAPI<any>('/admin/role-migrations'),
  executeRoleMigration: (id: number) => fetchAPI<any>(`/admin/role-migrations/${id}/execute`, { method: 'POST' }),
  revertRoleMigration: (id: number) => fetchAPI<any>(`/admin/role-migrations/${id}/revert`, { method: 'POST' }),
};

// =====================================================
// USER MANAGEMENT API
// =====================================================

export const userAPI = {
  // User CRUD operations
  getUsers: () => fetchAPI<any>('/users'),
  getUser: (id: string) => fetchAPI<any>(`/users/${id}`),
  createUser: (data: any) => fetchAPI<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => fetchAPI<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => fetchAPI<any>(`/users/${id}`, { method: 'DELETE' }),
  
  // User profile operations
  getUserProfile: () => fetchAPI<any>('/users/profile'),
  updateUserProfile: (data: any) => fetchAPI<any>('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
  updateUserPassword: (data: any) => fetchAPI<any>('/users/password', { method: 'PUT', body: JSON.stringify(data) }),
  
  // User photo upload
  uploadProfilePhoto: (formData: FormData) => fetchAPI<any>('/users/profile/photo', { 
    method: 'POST', 
    body: formData,
    headers: {} // Let browser set Content-Type for FormData
  }),
};

// =====================================================
// AUTH API
// =====================================================

export const authAPI = {
  // Authentication
  register: (data: any) => fetchAPI<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => fetchAPI<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => fetchAPI<any>('/auth/logout', { method: 'POST' }),
  refreshToken: (data: any) => fetchAPI<any>('/auth/refresh-token', { method: 'POST', body: JSON.stringify(data) }),
  
  // User account management
  getMe: () => fetchAPI<any>('/auth/me'),
  updateDetails: (data: any) => fetchAPI<any>('/auth/updatedetails', { method: 'PUT', body: JSON.stringify(data) }),
  updatePassword: (data: any) => fetchAPI<any>('/auth/updatepassword', { method: 'PUT', body: JSON.stringify(data) }),
  forgotPassword: (data: any) => fetchAPI<any>('/auth/forgotpassword', { method: 'POST', body: JSON.stringify(data) }),
};

// =====================================================
// PAYROLL API
// =====================================================

export const payrollAPI = {
  getSummary: (params?: { startDate?: string; endDate?: string; department?: string; branch?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.department) query.append('department', params.department);
    if (params?.branch) query.append('branch', params.branch);
    return fetchAPI<any>(`/payroll/summary?${query}`);
  },
  calculate: (data: any) => fetchAPI<any>('/payroll/calculate', { method: 'POST', body: JSON.stringify(data) }),
  pay: (data: { payrollRecordId: string; paymentMethod: 'mpesa' | 'paystack'; employeePhone?: string; employeeEmail?: string; bankDetails?: any }) =>
    fetchAPI<any>('/payroll/pay', { method: 'POST', body: JSON.stringify(data) }),
  bulkPay: (data: { payrollRecordIds: string[]; paymentMethod: 'mpesa' | 'paystack' }) =>
    fetchAPI<any>('/payroll/bulk-pay', { method: 'POST', body: JSON.stringify(data) }),
  getBanks: () => fetchAPI<any>('/payroll/banks'),
  verifyBankAccount: (data: { accountNumber: string; bankCode: string }) =>
    fetchAPI<any>('/payroll/verify-bank', { method: 'POST', body: JSON.stringify(data) }),
};

// =====================================================
// NOTIFICATIONS API
// =====================================================

export const notificationsAPI = {
  getNotifications: (params?: { is_read?: boolean; type?: string; category?: string; priority?: string }) => {
    const query = new URLSearchParams();
    if (params?.is_read !== undefined) query.append('is_read', String(params.is_read));
    if (params?.type) query.append('type', params.type);
    if (params?.category) query.append('category', params.category);
    if (params?.priority) query.append('priority', params.priority);
    return fetchAPI<any>(`/notifications?${query}`);
  },
  getUnreadCount: () => fetchAPI<any>('/notifications/unread-count'),
  markAsRead: (notificationId: number) => 
    fetchAPI<any>(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
  markAllAsRead: () =>
    fetchAPI<any>('/notifications/mark-all-read', { method: 'PATCH' }),
  createNotification: (data: any) => 
    fetchAPI<any>('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  bulkCreate: (notifications: any[]) =>
    fetchAPI<any>('/notifications/bulk', { method: 'POST', body: JSON.stringify({ notifications }) }),
  deleteNotification: (notificationId: number) =>
    fetchAPI<any>(`/notifications/${notificationId}`, { method: 'DELETE' }),
  notifyRole: (data: any) => 
    fetchAPI<any>('/notifications/notify-role', { method: 'POST', body: JSON.stringify(data) }),
  notifyBranch: (data: any) => 
    fetchAPI<any>('/notifications/notify-branch', { method: 'POST', body: JSON.stringify(data) }),
  notifyUser: (data: any) => 
    fetchAPI<any>('/notifications/notify-user', { method: 'POST', body: JSON.stringify(data) }),
  cleanup: () => fetchAPI<any>('/notifications/cleanup', { method: 'POST' }),
};

// =====================================================
// REPORTS SERVICE (Python Microservice)
// =====================================================

const REPORTS_SERVICE_URL = process.env.NEXT_PUBLIC_REPORTS_SERVICE_URL || 'http://localhost:5001';

export const reportsService = {
  // Health check
  healthCheck: async () => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/health`);
    return response.json();
  },

  // Generate branded PDF report (with FG styling)
  exportBrandedPdf: async (reportType: string, filters: Record<string, any> = {}, useRealData: boolean = true) => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/generate/branded-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType, filters, useRealData }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate PDF report' }));
      throw new Error(error.error || 'Failed to generate PDF report');
    }

    return response.blob();
  },

  // Generate standard PDF report
  exportPdf: async (reportType: string, filters: Record<string, any> = {}) => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/generate/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType, filters }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate PDF report' }));
      throw new Error(error.error || 'Failed to generate PDF report');
    }

    return response.blob();
  },

  // Generate Excel report
  exportExcel: async (reportType: string, filters: Record<string, any> = {}) => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/generate/excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType, filters }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate Excel report' }));
      throw new Error(error.error || 'Failed to generate Excel report');
    }

    return response.blob();
  },

  // Get available report types
  getReportTypes: async () => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/types`);
    return response.json();
  },

  // Schedule a report
  scheduleReport: async (data: {
    name?: string;
    reportType: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    scheduleTime?: string;
    scheduleDay?: number;
    recipients?: string[];
    parameters?: Record<string, any>;
    branchId?: number;
  }) => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  // Get scheduled reports
  getScheduledReports: async () => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/schedules`);
    return response.json();
  },

  // Delete scheduled report
  deleteScheduledReport: async (scheduleId: string) => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // Toggle scheduled report active/inactive
  toggleScheduledReport: async (scheduleId: string) => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/schedules/${scheduleId}/toggle`, {
      method: 'PUT',
    });
    return response.json();
  },

  // Run a scheduled report immediately
  runReportNow: async (scheduleId: string) => {
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/run-now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId }),
    });
    return response.json();
  },

  // Get report history
  getReportHistory: async (limit?: number, reportType?: string) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (reportType) params.append('type', reportType);
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/reports/history?${params}`);
    return response.json();
  },

  // Download helper - triggers browser download
  downloadReport: async (reportType: string, filters: Record<string, any> = {}, format: 'pdf' | 'excel' = 'pdf') => {
    try {
      let blob: Blob;
      let filename: string;
      
      if (format === 'pdf') {
        blob = await reportsService.exportBrandedPdf(reportType, filters);
        filename = `FG_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
      } else {
        blob = await reportsService.exportExcel(reportType, filters);
        filename = `FG_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { success: true, filename };
    } catch (error) {
      throw error;
    }
  },

  // Get KPI dashboard data
  getKPIDashboard: async (branchId?: number, period?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.append('branch_id', String(branchId));
    if (period) params.append('period', period);
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/kpi/dashboard?${params}`);
    return response.json();
  },

  // Get KPI summary cards
  getKPISummary: async (branchId?: number) => {
    const params = new URLSearchParams();
    if (branchId) params.append('branch_id', String(branchId));
    const response = await fetch(`${REPORTS_SERVICE_URL}/api/kpi/summary?${params}`);
    return response.json();
  },
};

// Export all APIs as a single object
// Accounting API
export const accountingAPI = {
  // Journal Entries
  getJournalEntries: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.department) params.append('department', filters.department);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
    
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/journal-entries?${params}`);
    return response.json();
  },

  createJournalEntry: async (entry: any) => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/journal-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    return response.json();
  },

  updateJournalEntry: async (id: string, entry: any) => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/journal-entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    return response.json();
  },

  submitJournalEntry: async (id: string, user?: string) => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/journal-entries/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    });
    return response.json();
  },

  getReviewQueue: async () => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/review-queue`);
    return response.json();
  },

  reviewJournalEntry: async (id: string, review: { action: string; notes?: string; reviewer?: string }) => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/journal-entries/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review)
    });
    return response.json();
  },

  postJournalEntry: async (id: string, user?: string) => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/journal-entries/${id}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    });
    return response.json();
  },

  getReconciliations: async () => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/reconciliations`);
    return response.json();
  },

  getTrialBalance: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
    
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/reports/trial-balance?${params}`);
    return response.json();
  },

  getFinancialStatements: async (type: string, filters?: any) => {
    const params = new URLSearchParams();
    params.append('type', type);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
    
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/reports/financial-statements?${params}`);
    return response.json();
  }
};

// ==================== ROOM SERVICE API (Python Microservice) ====================
const ROOM_SERVICE_URL = process.env.NEXT_PUBLIC_ROOM_SERVICE_URL || 'http://localhost:8003';

export const roomServiceAPI = {
  // Check room availability
  checkAvailability: async (checkIn: string, checkOut: string, guests: number = 1, branchId?: string) => {
    const params = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      guests: String(guests)
    });
    if (branchId) params.append('branch_id', branchId);
    
    const response = await fetch(`${ROOM_SERVICE_URL}/api/rooms/availability?${params}`);
    return response.json();
  },

  // Get current occupancy stats
  getCurrentOccupancy: async (branchId?: string) => {
    const params = branchId ? `?branch_id=${branchId}` : '';
    const response = await fetch(`${ROOM_SERVICE_URL}/api/rooms/occupancy${params}`);
    return response.json();
  },

  // Get occupied rooms list
  getOccupiedRooms: async (branchId?: string) => {
    const params = branchId ? `?branch_id=${branchId}` : '';
    const response = await fetch(`${ROOM_SERVICE_URL}/api/rooms/occupied${params}`);
    return response.json();
  },

  // Get occupancy history
  getOccupancyHistory: async (startDate: string, endDate: string, branchId?: string) => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate
    });
    if (branchId) params.append('branch_id', branchId);
    
    const response = await fetch(`${ROOM_SERVICE_URL}/api/rooms/occupancy/history?${params}`);
    return response.json();
  },

  // Get vacancy forecast
  getVacancyForecast: async (daysAhead: number = 30, branchId?: string) => {
    const params = new URLSearchParams({ days_ahead: String(daysAhead) });
    if (branchId) params.append('branch_id', branchId);
    
    const response = await fetch(`${ROOM_SERVICE_URL}/api/rooms/vacancy/forecast?${params}`);
    return response.json();
  },

  // Get all rooms
  getAllRooms: async (branchId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.append('branch_id', branchId);
    if (status) params.append('status', status);
    
    const response = await fetch(`${ROOM_SERVICE_URL}/api/rooms?${params}`);
    return response.json();
  },

  // Update room status
  updateRoomStatus: async (roomId: string, status: string, notes?: string) => {
    const response = await fetch(`${ROOM_SERVICE_URL}/api/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId, status, notes })
    });
    return response.json();
  },

  // Get room types
  getRoomTypes: async () => {
    const response = await fetch(`${ROOM_SERVICE_URL}/api/room-types`);
    return response.json();
  },

  // Get branch stats
  getBranchStats: async () => {
    const response = await fetch(`${ROOM_SERVICE_URL}/api/rooms/branches/stats`);
    return response.json();
  },

  // Get today's quick stats
  getTodayStats: async (branchId?: string) => {
    const params = branchId ? `?branch_id=${branchId}` : '';
    const response = await fetch(`${ROOM_SERVICE_URL}/api/rooms/stats/today${params}`);
    return response.json();
  },

  // Health check
  healthCheck: async () => {
    const response = await fetch(`${ROOM_SERVICE_URL}/health`);
    return response.json();
  }
};

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
  accounting: accountingAPI,
  reports: reportsAPI,
  audit: auditAPI,
  users: userAPI,
  auth: authAPI,
  payroll: payrollAPI,
  bar: barAPI,
  notifications: notificationsAPI,
  reportsService: reportsService,
  roomService: roomServiceAPI,
};

export default api;
