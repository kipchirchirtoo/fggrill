/**
 * Unified API Service for Famous Gate Hotel Management System
 * All API calls should go through this service for consistency
 */

import { API_URL, PYTHON_API_URL, PYTHON_SERVICE_URL, ROOM_SERVICE_URL, REPORTS_SERVICE_URL } from './config';

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

interface FetchOptions extends RequestInit {
  showToast?: boolean;
}

async function fetchAPI<T>(endpoint: string, options?: FetchOptions): Promise<T> {
  let retries = 0;
  let lastError: Error | null = null;
  const showToast = options?.showToast ?? false;

  while (retries <= MAX_RETRIES) {
    try {
      // If this is a retry, wait with exponential backoff
      if (retries > 0) {
        const delay = getBackoffDelay(retries - 1);
        console.log(`Retry attempt ${retries} for ${endpoint} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Add branch_id header if available
      const branchHeaders: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const branchId = localStorage.getItem('activeBranchId');
        if (branchId) {
          branchHeaders['x-branch-id'] = branchId;
        }
      }

      // Make the API request
      const response = await fetch(`${API_URL}/api${endpoint}`, {
        ...options,
        headers: {
          ...getHeaders(),
          ...branchHeaders,
          ...options?.headers
        }
      });

      if (!response.ok) {
        // Handle 401 Unauthorized - log but don't auto-redirect to prevent loops
        if (response.status === 401) {
          console.warn('401 Unauthorized - token may be invalid');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Only redirect if not already on a public page or login page
            const path = window.location.pathname;
            if (path.startsWith('/dashboard') || path.startsWith('/admin')) {
              window.location.href = '/login?expired=true';
            }
          }
        }

        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        const errorMessage = errorData.message || errorData.detail || errorData.error || `Request failed with status ${response.status}`;

        if (showToast && typeof window !== 'undefined') {
          const { toast } = await import('sonner');
          toast.error(errorMessage);
        }

        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Only retry on network errors or 500-level server errors
      // Don't retry 401 errors (token issues) or other client errors
      const isNetworkError = lastError.message.includes('fetch') || lastError.message.includes('NetworkError');
      const isServerError = lastError.message.includes('500') || lastError.message.includes('Internal Server Error');
      const isTokenError = lastError.message.includes('Invalid or expired token') || lastError.message.includes('Unauthorized');

      if (!isNetworkError && !isServerError || isTokenError) {
        if (showToast && typeof window !== 'undefined' && !isTokenError) {
          const { toast } = await import('sonner');
          toast.error(lastError.message);
        }
        console.error(`API request error (not retrying):`, error);
        break; // Don't retry client errors, token issues, or other problems
      }

      console.warn(`API request failed (attempt ${retries + 1}/${MAX_RETRIES + 1}):`, error);
      retries++;
    }
  }

  console.error('API request error after retries:', lastError);

  // Return a standardized error response structure
  return {
    success: false,
    message: lastError?.message || 'API request failed after retries',
    data: null
  } as unknown as T;
}

async function fetchPythonAPI<T>(endpoint: string, options?: FetchOptions): Promise<T> {
  let retries = 0;
  let lastError: Error | null = null;
  const showToast = options?.showToast ?? false;

  while (retries <= MAX_RETRIES) {
    try {
      if (retries > 0) {
        const delay = getBackoffDelay(retries - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const branchHeaders: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const branchId = localStorage.getItem('activeBranchId');
        if (branchId) {
          branchHeaders['x-branch-id'] = branchId;
        }
      }

      const response = await fetch(`${PYTHON_API_URL}/api${endpoint}`, {
        ...options,
        headers: {
          ...getHeaders(),
          ...branchHeaders,
          ...options?.headers
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        const errorMessage = errorData.message || errorData.detail || errorData.error || `Request failed with status ${response.status}`;

        if (showToast && typeof window !== 'undefined') {
          const { toast } = await import('sonner');
          toast.error(errorMessage);
        }

        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      const isNetworkError = lastError.message.includes('fetch') || lastError.message.includes('NetworkError');
      const isServerError = lastError.message.includes('500') || lastError.message.includes('Internal Server Error');

      if (!isNetworkError && !isServerError) {
        if (showToast && typeof window !== 'undefined') {
          const { toast } = await import('sonner');
          toast.error(lastError.message);
        }
        break;
      }
      retries++;
    }
  }

  return {
    success: false,
    message: lastError?.message || 'API request failed after retries',
    data: null
  } as unknown as T;
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
  getBranchRequests: (status?: string) => {
    const query = status && status !== 'all' ? `?status=${status}` : '';
    return fetchAPI<any>(`/store/stock-requests${query}`);
  },
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
  updateBranch: (id: number, data: any) => fetchAPI<any>(`/system/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBranch: (id: number) => fetchAPI<any>(`/system/branches/${id}`, { method: 'DELETE' }),
  getDepartments: () => fetchAPI<any>('/system/departments'),
  createDepartment: (data: any) => fetchAPI<any>('/system/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id: string, data: any) => fetchAPI<any>(`/system/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDepartment: (id: string) => fetchAPI<any>(`/system/departments/${id}`, { method: 'DELETE' }),
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

  // Waiters (includes waiter, waitress, head_waiter roles)
  getWaiters: async (branchId?: number) => {
    const query = new URLSearchParams();
    if (branchId) query.append('branch_id', String(branchId));
    // Fetch all staff and filter for waiter roles on client side
    const response = await fetchAPI<any>(`/staff?${query}`);
    if (response.success && response.data) {
      const waiterRoles = ['waiter', 'waitress', 'head_waiter'];
      response.data = response.data.filter((s: any) => waiterRoles.includes(s.role));
    }
    return response;
  },
  createWaiter: (data: any) => fetchAPI<any>('/staff', {
    method: 'POST',
    body: JSON.stringify({ ...data, role: 'waiter' })
  }),
  updateWaiter: (id: string, data: any) => fetchAPI<any>(`/staff/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteWaiter: (id: string) => fetchAPI<any>(`/staff/${id}`, { method: 'DELETE' }),

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
  clockIn: (staffId: string, notes?: string) => fetchAPI<any>('/staff/attendance/clock-in', { method: 'POST', body: JSON.stringify({ staff_id: staffId, notes }) }),
  clockOut: (staffId: string, notes?: string) => fetchAPI<any>('/staff/attendance/clock-out', { method: 'POST', body: JSON.stringify({ staff_id: staffId, notes }) }),
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
  getRooms: (params?: number | { status?: string; branch_id?: number }) => {
    let query = '';
    if (typeof params === 'number') {
      query = `?branch_id=${params}`;
    } else if (params && typeof params === 'object') {
      const queryParams = new URLSearchParams();
      if (params.branch_id) queryParams.append('branch_id', String(params.branch_id));
      if (params.status) queryParams.append('status', params.status);
      query = queryParams.toString() ? `?${queryParams}` : '';
    }
    return fetchAPI<any>(`/rooms${query}`).then(response => {
      // Transform response to match frontend expected format
      if (response.success && Array.isArray(response.data)) {
        response.data = response.data.map((room: any) => ({
          id: room.id,
          roomNumber: room.room_number,
          type: room.type,
          typeName: room.type_name || room.type?.name,
          floor: room.floor,
          status: room.status,
          currentGuest: room.current_guest,
          checkIn: room.check_in,
          checkOut: room.check_out,
          basePrice: room.base_price,
          currentPrice: room.current_price || room.base_price,
          description: room.description,
          amenities: room.amenities || [],
          photos: room.photos || [],
          maxOccupancy: room.max_occupancy,
          bedConfiguration: room.bed_configuration,
          squareMeters: room.square_meters,
          view: room.view,
          accessible: room.accessible,
          smoking: room.smoking,
          cleaningStatus: room.cleaning_status || room.housekeeping_status,
          lastCleaned: room.last_cleaned,
          nextCleaning: room.next_cleaning,
          branchId: room.branch_id
        }));
      }
      return response;
    });
  },
  getRoom: (id: string) => fetchAPI<any>(`/rooms/${id}`).then(response => {
    // Transform response to match frontend expected format
    if (response.success && response.data) {
      const room = response.data;
      response.data = {
        id: room.id,
        roomNumber: room.room_number,
        type: room.type,
        typeName: room.type_name || room.type?.name,
        floor: room.floor,
        status: room.status,
        currentGuest: room.current_guest,
        checkIn: room.check_in,
        checkOut: room.check_out,
        basePrice: room.base_price,
        currentPrice: room.current_price || room.base_price,
        description: room.description,
        amenities: room.amenities || [],
        photos: room.photos || [],
        maxOccupancy: room.max_occupancy,
        bedConfiguration: room.bed_configuration,
        squareMeters: room.square_meters,
        view: room.view,
        accessible: room.accessible,
        smoking: room.smoking,
        cleaningStatus: room.cleaning_status || room.housekeeping_status,
        lastCleaned: room.last_cleaned,
        nextCleaning: room.next_cleaning,
        branchId: room.branch_id
      };
    }
    return response;
  }),
  getRoomTypes: () => fetchAPI<any>('/rooms/types').then(response => {
    // Transform response to match frontend expected format
    if (response.success && Array.isArray(response.data)) {
      response.data = response.data.map((type: any) => ({
        id: type.id,
        name: type.name,
        description: type.description,
        basePrice: type.base_price,
        maxOccupancy: type.max_occupancy,
        bedConfiguration: type.bed_configuration,
        amenities: type.amenities || [],
        photos: type.photos || []
      }));
    }
    return response;
  }),
  createRoom: (data: any) => {
    // Transform frontend format to backend expected format
    const backendData = {
      room_number: data.roomNumber || data.room_number,
      type_id: data.typeId || data.type_id,
      floor: data.floor,
      status: data.status,
      base_price: data.basePrice || data.base_price,
      description: data.description,
      amenities: data.amenities,
      max_occupancy: data.maxOccupancy || data.max_occupancy,
      bed_configuration: data.bedConfiguration || data.bed_configuration,
      square_meters: data.squareMeters || data.square_meters,
      view: data.view,
      accessible: data.accessible,
      smoking: data.smoking,
      branch_id: data.branchId || data.branch_id
    };
    return fetchAPI<any>('/branch-operations/rooms', { method: 'POST', body: JSON.stringify(backendData) });
  },
  updateRoom: (id: string, data: any) => {
    // Transform frontend format to backend expected format
    const backendData: Record<string, any> = {};

    // Map common fields that might be in different formats
    if (data.roomNumber || data.room_number) backendData.room_number = data.roomNumber || data.room_number;
    if (data.typeId || data.type_id) backendData.type_id = data.typeId || data.type_id;
    if (data.basePrice || data.base_price) backendData.base_price = data.basePrice || data.base_price;
    if (data.maxOccupancy || data.max_occupancy) backendData.max_occupancy = data.maxOccupancy || data.max_occupancy;
    if (data.bedConfiguration || data.bed_configuration) backendData.bed_configuration = data.bedConfiguration || data.bed_configuration;
    if (data.squareMeters || data.square_meters) backendData.square_meters = data.squareMeters || data.square_meters;
    if (data.cleaningStatus || data.cleaning_status || data.housekeeping_status)
      backendData.cleaning_status = data.cleaningStatus || data.cleaning_status || data.housekeeping_status;

    // Copy remaining fields
    ['floor', 'status', 'description', 'amenities', 'view', 'accessible', 'smoking', 'branch_id'].forEach(key => {
      if (data[key] !== undefined) backendData[key] = data[key];
    });

    return fetchAPI<any>(`/branch-operations/rooms/${id}`, { method: 'PUT', body: JSON.stringify(backendData) });
  },
  updateRoomStatus: (id: string, status: string) =>
    fetchAPI<any>(`/branch-operations/rooms/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteRoom: (id: string) =>
    fetchAPI<any>(`/branch-operations/rooms/${id}`, { method: 'DELETE' }),
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
  getGuests: (search?: string, branchId?: number, checkedInOnly?: boolean) => {
    const query = new URLSearchParams();
    if (search) query.append('search', search);
    if (branchId) query.append('branch_id', String(branchId));
    if (checkedInOnly) query.append('checked_in_only', 'true');
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchAPI<any>(`/guests${queryString}`).then(response => {
      console.log('Guest API response:', response);
      // Transform response to match frontend expected format
      if (response.success && Array.isArray(response.data)) {
        response.data = response.data.map((guest: any) => ({
          id: guest.id,
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email,
          phone: guest.phone,
          idType: guest.idType,
          idNumber: guest.idNumber,
          nationality: guest.nationality,
          address: guest.address,
          city: guest.city,
          country: guest.country,
          dateOfBirth: guest.dateOfBirth,
          isVip: guest.isVip,
          notes: guest.notes,
          totalStays: guest.totalStays || 0,
          totalSpent: guest.totalSpent || 0,
          createdAt: guest.createdAt,
          lastStay: guest.lastStay
        }));
      }
      return response;
    });
  },
  getGuest: (id: string) => fetchAPI<any>(`/guests/${id}`).then(response => {
    // Transform response to match frontend expected format
    if (response.success && response.data) {
      const guest = response.data;
      response.data = {
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        idType: guest.idType,
        idNumber: guest.idNumber,
        nationality: guest.nationality,
        address: guest.address,
        city: guest.city,
        country: guest.country,
        dateOfBirth: guest.dateOfBirth,
        isVip: guest.isVip,
        notes: guest.notes,
        totalStays: guest.totalStays || 0,
        totalSpent: guest.totalSpent || 0,
        createdAt: guest.createdAt,
        lastStay: guest.lastStay
      };
    }
    return response;
  }),
  createGuest: (data: any) => {
    // Transform frontend format to backend expected format
    const backendData = {
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      idType: data.id_type,
      idNumber: data.id_number,
      nationality: data.nationality,
      address: data.address,
      city: data.city,
      country: data.country,
      dateOfBirth: data.date_of_birth,
      isVip: data.vip_status,
      notes: data.notes
    };
    return fetchAPI<any>('/guests', { method: 'POST', body: JSON.stringify(backendData) });
  },
  updateGuest: (id: string, data: any) => {
    // Transform frontend format to backend expected format
    const backendData = {
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      idType: data.id_type,
      idNumber: data.id_number,
      nationality: data.nationality,
      address: data.address,
      city: data.city,
      country: data.country,
      dateOfBirth: data.date_of_birth,
      isVip: data.vip_status,
      notes: data.notes
    };
    return fetchAPI<any>(`/guests/${id}`, { method: 'PUT', body: JSON.stringify(backendData) });
  },
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
  },
  exportReport: (data: { reportType: string; format: 'pdf' | 'excel'; filters?: any; data?: any }) => {
    return fetch(`${API_URL}/api/reports/export`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(async (res) => {
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FG_${data.reportType}_${new Date().toISOString().split('T')[0]}.${data.format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      return { success: true };
    });
  }
};

// =====================================================
// BOOKINGS API
// =====================================================

export const bookingsAPI = {
  getBookings: (params?: { status?: string; checkIn?: string; checkOut?: string; roomType?: string; branch_id?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.checkIn) query.append('checkIn', params.checkIn);
    if (params?.checkOut) query.append('checkOut', params.checkOut);
    if (params?.roomType) query.append('roomType', params.roomType);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.limit) query.append('limit', String(params.limit));
    return fetchAPI<any>(`/bookings?${query}`).then(response => {
      // Transform response to match frontend expected format
      if (response.success) {
        // Handle nested data structure from backend
        const bookingsData = Array.isArray(response.data) ? response.data :
          (response.data && Array.isArray(response.data.data)) ? response.data.data : [];

        response.data = bookingsData.map((booking: any) => {
          // Handle different property naming conventions
          const guestInfo: Record<string, any> = booking.guest || {};
          const roomInfo: Record<string, any> = booking.room || {};
          const roomType: Record<string, any> = roomInfo.type || {};

          return {
            id: booking.id,
            guest_id: booking.guest_id,
            guest_name: booking.guest_name || `${guestInfo.first_name || ''} ${guestInfo.last_name || ''}`.trim(),
            guest_phone: booking.guest_phone || guestInfo.phone,
            guest_email: booking.guest_email || guestInfo.email,
            room_id: booking.room_id,
            room_number: booking.room_number || roomInfo.room_number,
            room_type: booking.room_type || (roomInfo.type && roomInfo.type.name) || '',
            check_in: booking.check_in_date || booking.check_in || booking.checkInDate,
            check_out: booking.check_out_date || booking.check_out || booking.checkOutDate,
            status: booking.status,
            adults: booking.adults || 1,
            children: booking.children || 0,
            infants: booking.infants || 0,
            nights: booking.nights || calculateNights(booking.check_in_date || booking.check_in || '',
              booking.check_out_date || booking.check_out || ''),
            total_amount: booking.total_amount,
            amount_paid: booking.amount_paid || booking.deposit_amount || 0,
            balance: booking.balance || (booking.total_amount - (booking.amount_paid || booking.deposit_amount || 0)),
            special_requests: booking.special_requests || booking.specialRequests,
            meal_plan: booking.meal_plan || booking.mealPlan,
            payment_method: booking.payment_method || booking.paymentMethod,
            created_at: booking.created_at
          };
        });
      }
      return response;
    });
  },
  getBooking: (id: string) => fetchAPI<any>(`/bookings/${id}`).then(response => {
    // Transform response to match frontend expected format
    if (response.success && response.data) {
      const booking: Record<string, any> = response.data;
      const guestInfo: Record<string, any> = booking.guest || {};
      const roomInfo: Record<string, any> = booking.room || {};
      const roomType: Record<string, any> = roomInfo.type || {};

      response.data = {
        id: booking.id,
        guest_id: booking.guest_id,
        guest_name: booking.guest_name || `${guestInfo.first_name || ''} ${guestInfo.last_name || ''}`.trim(),
        room_id: booking.room_id,
        room_number: booking.room_number || roomInfo.room_number,
        room_type: booking.room_type || roomType.name || '',
        check_in_date: booking.check_in_date || booking.check_in,
        check_out_date: booking.check_out_date || booking.check_out,
        check_in: booking.check_in_date || booking.check_in,
        check_out: booking.check_out_date || booking.check_out,
        status: booking.status,
        adults: booking.adults || 1,
        children: booking.children || 0,
        nights: booking.nights || calculateNights(
          booking.check_in_date || booking.check_in || '',
          booking.check_out_date || booking.check_out || ''
        ),
        total_amount: booking.total_amount || 0,
        balance: booking.balance || (booking.total_amount || 0) - (booking.deposit_amount || booking.amount_paid || 0),
        guest_phone: booking.guest_phone || guestInfo.phone,
        guest_email: booking.guest_email || guestInfo.email,
        special_requests: booking.special_requests || booking.specialRequests
      };
    }
    return response;
  }),
  createBooking: (data: Record<string, any>) => {
    // Map frontend field names to backend expected names
    const backendData: Record<string, any> = {
      room_id: data.room_id || data.roomId,
      guest_id: data.guest_id || data.guestId,
      rate_plan_id: data.rate_plan_id || data.ratePlanId,
      checkInDate: data.check_in || data.check_in_date || data.checkInDate,
      checkOutDate: data.check_out || data.check_out_date || data.checkOutDate,
      adults: data.adults,
      children: data.children,
      meal_plan: data.meal_plan || data.mealPlan,
      special_requests: data.special_requests || data.specialRequests,
      total_amount: data.total_amount || data.totalAmount,
      deposit_amount: data.deposit_amount || data.amount_paid || data.depositAmount,
      payment_method: data.payment_method || data.paymentMethod,
      notes: data.notes,
      branch_id: data.branch_id || data.branchId
    };
    return fetchAPI<any>('/bookings', { method: 'POST', body: JSON.stringify(backendData) });
  },
  updateBooking: (id: string, data: any) => {
    // Map frontend field names to backend expected names
    const backendData: Record<string, any> = {};

    // Map common fields that might be in different formats
    if (data.room_id || data.roomId) backendData['room_id'] = data.room_id || data.roomId;
    if (data.check_in || data.check_in_date || data.checkInDate)
      backendData['checkInDate'] = data.check_in || data.check_in_date || data.checkInDate;
    if (data.check_out || data.check_out_date || data.checkOutDate)
      backendData['checkOutDate'] = data.check_out || data.check_out_date || data.checkOutDate;
    if (data.special_requests || data.specialRequests)
      backendData['special_requests'] = data.special_requests || data.specialRequests;

    // Copy remaining fields
    Object.keys(data).forEach(key => {
      if (!backendData[key]) {
        // Convert camelCase to snake_case for backend
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        backendData[snakeKey] = data[key];
      }
    });

    return fetchAPI<any>(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(backendData) });
  },
  cancelBooking: (id: string, reason?: string) =>
    fetchAPI<any>(`/bookings/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  checkIn: (id: string) => fetchAPI<any>(`/bookings/${id}/check-in`, { method: 'PUT' }),
  checkOut: (id: string) => fetchAPI<any>(`/bookings/${id}/check-out`, { method: 'PUT' }),
  getBookingByConfirmation: (confirmationNumber: string, email: string) =>
    fetchAPI<any>(`/bookings/confirmation/${confirmationNumber}?email=${encodeURIComponent(email)}`),
  getAvailableRooms: (checkInOrParams: string | { checkIn: string; checkOut: string; guests?: number; branchId?: number }, checkOut?: string, guests?: number, branchId?: number) => {
    let params: { checkIn: string; checkOut: string; guests?: number; branchId?: number };

    if (typeof checkInOrParams === 'object') {
      params = checkInOrParams;
    } else {
      params = { checkIn: checkInOrParams, checkOut: checkOut!, guests, branchId };
    }

    const query = new URLSearchParams({ checkIn: params.checkIn, checkOut: params.checkOut });
    if (params.guests) query.append('guests', String(params.guests));
    if (params.branchId) query.append('branch_id', String(params.branchId));

    return fetchAPI<any>(`/bookings/available?${query}`, { showToast: true }).then(response => {
      if (response.success && Array.isArray(response.data)) {
        response.data = response.data.map((room: any) => ({
          id: room.id,
          room_number: room.room_number,
          room_type: room.type?.name || room.room_type,
          room_type_id: room.room_type_id,
          price_per_night: room.price_override || room.type?.base_price || 0,
          price_override: room.price_override,
          max_occupancy: room.type?.max_occupancy || room.max_occupancy || 0,
          status: room.status,
          type: room.type
        }));
      }
      return response;
    });
  },
};

// Helper function to calculate nights between two dates
function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  return Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
}

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
  getTasks: (params?: { status?: string; priority?: string; assignedTo?: string; taskType?: string; floor?: number; date?: string; roomNumber?: string; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.priority) query.append('priority', params.priority);
    if (params?.assignedTo) query.append('assignedTo', params.assignedTo);
    if (params?.taskType) query.append('taskType', params.taskType);
    if (params?.floor) query.append('floor', String(params.floor));
    if (params?.date) query.append('date', params.date);
    if (params?.roomNumber) query.append('roomNumber', params.roomNumber);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
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
  // Full task update
  updateTask: (id: string, data: any) => fetchAPI<any>(`/housekeeping/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
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
  createGuestRequest: (data: {
    room_number: string;
    guest_name?: string;
    request_type: string;
    priority: string;
    description: string;
    source: string;
    branch_id?: number;
  }) => fetchAPI<any>('/housekeeping/guest-requests', { method: 'POST', body: JSON.stringify(data) }),
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
    return fetchAPI<any>(`/maintenance/tasks?${query}`);
  },
  createRequest: (data: {
    room_number: string;
    location: string;
    issue_type: string;
    priority: string;
    description: string;
    reported_by: string;
    branch_id?: number;
  }) => fetchAPI<any>('/maintenance/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateRequest: (id: string, data: any) => fetchAPI<any>(`/maintenance/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  completeRequest: (id: string, data?: any) => fetchAPI<any>(`/maintenance/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify(data || {}) }),
  deleteRequest: (id: string) => fetchAPI<any>(`/maintenance/tasks/${id}`, { method: 'DELETE' }),
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
  getKitchenOrders: (branchId?: number) => {
    const query = branchId ? `?branch_id=${branchId}` : '';
    return fetchAPI<any>(`/restaurant/kitchen/orders${query}`);
  },
  markItemReady: (orderId: string, itemId: string) => fetchAPI<any>(`/restaurant/kitchen/orders/${orderId}/items/${itemId}/ready`, { method: 'PUT' }),

  // Receipts & Billing
  generateReceipt: (orderId: string) => fetchAPI<any>(`/restaurant/orders/${orderId}/receipt`),
  processPayment: (orderId: string, data: any) => fetchAPI<any>(`/restaurant/orders/${orderId}/payment`, { method: 'POST', body: JSON.stringify(data) }),
  generateBill: (receiptData: any) => {
    return fetch('http://localhost:5001/api/receipts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(receiptData)
    });
  },

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

  // Wastage Recording
  getWastageItems: () => fetchAPI<any>('/restaurant/wastage/items'),
  getWastageRecords: (params?: { from_date?: string; to_date?: string; reason?: string }) => {
    const query = new URLSearchParams();
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);
    if (params?.reason) query.append('reason', params.reason);
    const qs = query.toString();
    return fetchAPI<any>(`/restaurant/wastage${qs ? `?${qs}` : ''}`);
  },
  getWastageSummary: (period?: 'today' | 'week' | 'month') => {
    const query = period ? `?period=${period}` : '';
    return fetchAPI<any>(`/restaurant/wastage/summary${query}`);
  },
  createWastageRecord: (data: {
    item_name: string;
    item_id?: string;
    quantity: number;
    unit: string;
    reason: 'spoilage' | 'expiry' | 'damage' | 'overcooking' | 'customer_return' | 'quality_control' | 'other';
    cost_impact?: number;
    description?: string;
  }) => fetchAPI<any>('/restaurant/wastage', { method: 'POST', body: JSON.stringify(data) }),
  updateWastageRecord: (id: string, data: {
    item_name?: string;
    quantity?: number;
    unit?: string;
    reason?: 'spoilage' | 'expiry' | 'damage' | 'overcooking' | 'customer_return' | 'quality_control' | 'other';
    cost_impact?: number;
    description?: string;
  }) => fetchAPI<any>(`/restaurant/wastage/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWastageRecord: (id: string) => fetchAPI<any>(`/restaurant/wastage/${id}`, { method: 'DELETE' }),

  // Today's Orders Log
  getTodayOrders: (branchId?: number) => {
    const query = new URLSearchParams();
    if (branchId) query.append('branch_id', String(branchId));
    query.append('date', new Date().toISOString().split('T')[0]);
    return fetchAPI<any>(`/restaurant/orders?${query}`);
  },
};

export const wastageAPI = {
  createWastageRecord: (data: any) =>
    fetchAPI<{ success: boolean; data: any }>('/wastage', {
      method: 'POST',
      body: JSON.stringify(data),
      showToast: true
    }),

  bulkCreateWastageRecords: (records: any[]) =>
    fetchAPI<{ success: boolean; message: string; data: any }>('/wastage/bulk', {
      method: 'POST',
      body: JSON.stringify({ records }),
      showToast: true
    }),

  getWastageRecords: (filters?: any) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value as string);
      });
    }
    return fetchAPI<{ success: boolean; data: any }>(`/wastage?${params.toString()}`);
  },

  getWastageSummary: (period: string = '30d') =>
    fetchAPI<{ success: boolean; data: any }>(`/wastage/summary?period=${period}`),

  updateWastageRecord: (id: string, data: any) =>
    fetchAPI<{ success: boolean; data: any }>(`/wastage/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      showToast: true
    }),

  deleteWastageRecord: (id: string) =>
    fetchAPI<{ success: boolean; data: any }>(`/wastage/${id}`, {
      method: 'DELETE',
      showToast: true
    }),
};

// =====================================================
// RECEIPTS API (Python Microservice)
// =====================================================

export const receiptsAPI = {
  // Generate receipt PDF
  generateReceipt: async (receiptData: {
    receipt_type?: 'sale' | 'refund' | 'invoice';
    receipt_number: string;
    date?: string;
    table_number?: string;
    room_number?: string;
    customer_name?: string;
    cashier_name?: string;
    items: Array<{
      name: string;
      quantity: number;
      unit_price: number;
      total: number;
    }>;
    total_amount: number;
    payment_method: string;
    amount_paid?: number;
    change_amount?: number;
    payment_reference?: string;
  }) => {
    const response = await fetch(`${PYTHON_API_URL}/api/receipts/generate/base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData)
    });
    return response.json();
  },

  // Print receipt to thermal printer
  printReceipt: async (receiptData: any) => {
    const response = await fetch(`${PYTHON_API_URL}/api/receipts/printer/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData)
    });
    return response.json();
  },

  // Print and generate PDF
  printAndGenerate: async (receiptData: any) => {
    const response = await fetch(`${PYTHON_API_URL}/api/receipts/printer/print-and-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptData)
    });
    return response.json();
  },

  // Configure thermal printer
  configurePrinter: async (config: {
    connection_type: 'network' | 'usb' | 'serial';
    printer_ip?: string;
    printer_port?: number;
  }) => {
    const response = await fetch(`${PYTHON_API_URL}/api/receipts/printer/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return response.json();
  },

  // Get printer status
  getPrinterStatus: async () => {
    const response = await fetch(`${PYTHON_API_URL}/api/receipts/printer/status`);
    return response.json();
  },

  // Discover printers on network
  discoverPrinters: async (ipRange?: string) => {
    const query = ipRange ? `?ip_range=${ipRange}` : '';
    const response = await fetch(`${PYTHON_API_URL}/api/receipts/printer/discover${query}`);
    return response.json();
  },

  // Test print
  testPrint: async () => {
    const response = await fetch(`${PYTHON_API_URL}/api/receipts/printer/test`, {
      method: 'POST'
    });
    return response.json();
  },

  // Health check
  healthCheck: async () => {
    const response = await fetch(`${PYTHON_API_URL}/api/receipts/health`);
    return response.json();
  }
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
  uploadDrinkImage: (id: string, imageBase64: string, contentType: string, fileName?: string) =>
    fetchAPI<any>(`/bar/drinks/${id}/image`, {
      method: 'POST',
      body: JSON.stringify({ imageBase64, contentType, fileName })
    }),

  // Tabs (for customers running a tab)
  getTabs: (branchId?: number, status?: string) => {
    const query = new URLSearchParams();
    if (branchId) query.append('branch_id', String(branchId));
    if (status) query.append('status', status);
    return fetchAPI<any>(`/bar/tabs?${query}`);
  },
  createTab: (data: any) => fetchAPI<any>('/bar/tabs', { method: 'POST', body: JSON.stringify(data) }),
  updateTab: (tabId: string, data: any) => fetchAPI<any>(`/bar/tabs/${tabId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTab: (tabId: string) => fetchAPI<any>(`/bar/tabs/${tabId}`, { method: 'DELETE' }),
  addToTab: (tabId: string, items: any[]) => fetchAPI<any>(`/bar/tabs/${tabId}/items`, { method: 'POST', body: JSON.stringify({ items }) }),
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
  getDashboard: (params?: { branch_id?: number; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    return fetchAPI<any>(`/finance/dashboard?${query}`);
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
  verifyPayment: (paymentId: string, status: 'completed' | 'failed', notes?: string) =>
    fetchAPI<any>(`/cashier/verify-payment/${paymentId}`, { method: 'POST', body: JSON.stringify({ status, notes }) }),

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
  approveExpense: (id: string) => fetchAPI<any>(`/finance/expenses/${id}/approve`, { method: 'PUT' }),

  getInvoices: (params?: { branch_id?: number; startDate?: string; endDate?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.status) query.append('status', params.status);
    return fetchAPI<any>(`/finance/invoices?${query}`);
  },
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
  getRevenueByBranch: (params?: { startDate?: string; endDate?: string; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchAPI<any>(`/finance/revenue-by-branch?${query}`);
  },
  getBudgetAnalysis: (params?: { year?: number; month?: number; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.year) query.append('year', String(params.year));
    if (params?.month) query.append('month', String(params.month));
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchPythonAPI<any>(`/finance/budget-analysis?${query}`);
  },
  getTaxSummary: (params?: { startDate?: string; endDate?: string; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchAPI<any>(`/finance/tax-summary?${query}`);
  },
  getForecast: (params?: { months?: number; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.months) query.append('months', String(params.months));
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchPythonAPI<any>(`/finance/forecast?${query}`);
  },
  getArAp: (params?: { branch_id?: number }) => {
    const query = params?.branch_id ? `?branch_id=${params.branch_id}` : '';
    return fetchPythonAPI<any>(`/finance/ar-ap${query}`);
  },
  getKPIs: (params?: { period?: string; branch_id?: number }) => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    return fetchAPI<any>(`/finance/kpis?${query}`);
  },
  getAnomalyDetection: (params?: { branch_id?: number }) => {
    const query = params?.branch_id ? `?branch_id=${params.branch_id}` : '';
    return fetchPythonAPI<any>(`/finance/anomalies${query}`);
  },
  getFinancialRatios: (params?: { branch_id?: number }) => {
    const query = params?.branch_id ? `?branch_id=${params.branch_id}` : '';
    return fetchPythonAPI<any>(`/finance/financial-ratios${query}`);
  },

  getBudgets: () => fetchAPI<any>('/finance/budgets'),
  createBudget: (data: any) => fetchAPI<any>('/finance/budgets', { method: 'POST', body: JSON.stringify(data) }),
  updateBudget: (id: string, data: any) => fetchAPI<any>(`/finance/budgets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBudget: (id: string) => fetchAPI<any>(`/finance/budgets/${id}`, { method: 'DELETE' }),

  // Advanced Accounting Features
  getBalanceSheet: (params?: { branch_id?: number; as_of_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.as_of_date) query.append('as_of_date', params.as_of_date);
    return fetchPythonAPI<any>(`/finance/balance-sheet?${query}`);
  },
  getTrialBalance: (params?: { branch_id?: number; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return fetchPythonAPI<any>(`/finance/trial-balance?${query}`);
  },
  getJournalEntries: (params?: { branch_id?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.limit) query.append('limit', String(params.limit));
    return fetchPythonAPI<any>(`/finance/journal-entries?${query}`);
  },
  createJournalEntry: (data: any) => fetchPythonAPI<any>('/finance/journal-entries', { method: 'POST', body: JSON.stringify(data) }),

  getAgingReport: (type: 'receivable' | 'payable' = 'receivable') => fetchPythonAPI<any>(`/finance/aging-report?type=${type}`),
  getExpenseBreakdown: (params?: { branch_id?: number; start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    return fetchPythonAPI<any>(`/finance/expense-breakdown?${query}`);
  },
  getRevenueAnalysis: (params?: { branch_id?: number }) => {
    const query = params?.branch_id ? `?branch_id=${params.branch_id}` : '';
    return fetchPythonAPI<any>(`/finance/revenue-analysis${query}`);
  },
  getComparativeAnalysis: (params?: { type?: 'period' | 'branch'; branch_id?: number; days?: number }) => {
    const query = new URLSearchParams();
    if (params?.type) query.append('type', params.type);
    if (params?.branch_id) query.append('branch_id', String(params.branch_id));
    if (params?.days) query.append('days', String(params.days));
    return fetchPythonAPI<any>(`/finance/comparative-analysis?${query}`);
  },
  generateReport: (data: { report_type: string; branch_id?: number }) =>
    fetchPythonAPI<any>('/finance/reports/generate', { method: 'POST', body: JSON.stringify(data) }),
  getBranches: () => fetchAPI<any>('/finance/branches'),
};

// receiptsAPI is defined above with Python microservice integration

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
  exportReport: (data: { reportType: string; format: 'pdf' | 'excel'; filters?: any; data?: any }) => {
    return fetch(`${API_URL}/api/reports/export`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(async (res) => {
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FG_${data.reportType}_${new Date().toISOString().split('T')[0]}.${data.format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      return { success: true };
    });
  }
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

  deleteJournalEntry: async (id: string) => {
    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/journal-entries/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
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
  },

  getAuditTrail: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.user) params.append('user', filters.user);
    if (filters?.action) params.append('action', filters.action);

    const response = await fetch(`${PYTHON_SERVICE_URL}/api/accounting/audit-trail?${params}`);
    return response.json();
  },

  getWorkpapers: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.period) params.append('period', filters.period);

    const response = await fetch(`${PYTHON_SERVICE_URL}/api/audit/workpapers?${params}`);
    return response.json();
  }
};

// ==================== ROOM SERVICE API (Python Microservice) ====================

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

// Export the fetchAPI function for direct use
export { fetchAPI };

// Attendance Analytics API (Python Service)

export const attendanceAnalyticsAPI = {
  analyze: (branchId: number, date?: string) => {
    const query = new URLSearchParams();
    query.append('branch_id', String(branchId));
    if (date) query.append('date', date);
    return fetch(`${PYTHON_API_URL}/api/attendance/analyze?${query}`).then(res => res.json());
  },
  monitor: (branchId: number) => {
    return fetch(`${PYTHON_API_URL}/api/attendance/monitoring?branch_id=${branchId}`).then(res => res.json());
  }
};
