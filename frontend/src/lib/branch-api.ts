/**
 * Branch-aware API service
 * This service wraps the base API functionality to include branch context in all requests
 */

// Use the same API_URL as defined in api.ts, but default to the Node backend on 5000
import { API_URL } from './config';

// Safe localStorage access (handles SSR)
const getStorageValue = (key: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

// Generic fetch wrapper with error handling and SSR safety
// Maximum number of retries for API calls
const MAX_RETRIES = 2;

// Exponential backoff for retries (ms)
const getBackoffDelay = (retryCount: number) => Math.min(1000 * 2 ** retryCount, 5000);

export async function fetchWithBranchContext<T>(
  endpoint: string,
  options: RequestInit = {},
  branchId?: number | null,
  multiBranch: boolean = false
): Promise<T> {
  let retries = 0;
  let lastError: Error | null = null;

  try {
    // Get token from storage safely
    const token = getStorageValue('token');

    // Get active branch from storage if not provided and not in multi-branch mode
    if (!branchId && !multiBranch) {
      const storedBranchId = getStorageValue('activeBranchId');
      if (storedBranchId) {
        branchId = parseInt(storedBranchId);
      }
    }

    // Always ensure branchId is a number before using it
    if (branchId && typeof branchId === 'number' && !isNaN(branchId) && !multiBranch) {
      // console.log(`Using branch ID: ${branchId}`);
    } else if (!multiBranch) {
      // console.warn('No valid branch ID available for API request');
      branchId = null;
    } else {
      // In multi-branch mode, we don't need a specific branch ID
      // console.log('Using multi-branch mode for central operations');
      branchId = null;
    }

    while (retries <= MAX_RETRIES) {
      try {
        // If this is a retry, wait with exponential backoff
        if (retries > 0) {
          const delay = getBackoffDelay(retries - 1);
          // console.log(`Retry attempt ${retries} for ${endpoint} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Set up headers with authorization and branch context
        const headers = {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          ...(branchId ? { 'X-Branch-ID': branchId.toString() } : {}),
          ...options.headers
        };

        // Add branch_id as a query parameter if not already in the URL and we have a valid branchId
        // In multi-branch mode, don't add the branch_id param
        let modifiedEndpoint = endpoint;
        if (branchId && !endpoint.includes('branch_id=') && !multiBranch) {
          const separator = endpoint.includes('?') ? '&' : '?';
          modifiedEndpoint = `${endpoint}${separator}branch_id=${branchId}`;
        }

        // Make the API request with modified endpoint that includes branch_id
        const response = await fetch(`${API_URL}${modifiedEndpoint}`, {
          ...options,
          headers
        });

        // Handle response
        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
          console.error('API error response:', response.status, responseData);
          // Return error response instead of throwing for better handling
          return {
            success: false,
            message: responseData.message || `API request failed: ${response.status}`,
            error: responseData.error
          } as unknown as T;
        }

        return responseData;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Only retry on network errors or 500-level server errors
        const isNetworkError = lastError.message.includes('fetch') || lastError.message.includes('network');
        const isServerError = lastError.message.includes('500') || lastError.message.includes('refused');

        if (!isNetworkError && !isServerError) {
          console.error(`Branch API request error (not retrying):`, error);
          break; // Don't retry client errors or other issues
        }

        // console.warn(`Branch API request failed (attempt ${retries + 1}/${MAX_RETRIES + 1}):`, error);
        retries++;
      }
    }

    // If we get here, all retries have failed
    throw lastError || new Error('API request failed after retries');

  } catch (error) {
    console.error('Branch API request error after retries:', error);

    // If mock data is available for this endpoint in development, return it
    if (process.env.NODE_ENV === 'development') {
      const mockData = getMockData(endpoint);
      if (mockData) {
        console.info(`Using mock data for branch API ${endpoint}`);
        return mockData as unknown as T;
      }
    }

    // Return a standardized error response structure
    return {
      success: false,
      message: error instanceof Error ? error.message : 'API request failed',
      data: []
    } as unknown as T;
  }
}

// Helper to provide mock data for branch and central operations
function getMockData(endpoint: string): any {
  // Remove leading slash and parse path
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const pathParts = cleanEndpoint.split('/');


  // Branch operations and other endpoints
  const mockDataStore: Record<string, any> = {
    'api/branch-operations/staff': {
      success: true,
      message: 'Mock staff data retrieved successfully',
      data: [
        { id: '1', name: 'John Doe', email: 'john@example.com', role: 'manager', department: 'Management', status: 'active' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'reception', department: 'Front Desk', status: 'active' },
        { id: '3', name: 'Robert Johnson', email: 'robert@example.com', role: 'housekeeping', department: 'Housekeeping', status: 'active' }
      ]
    },
    'api/branch-operations/dashboard': {
      success: true,
      data: {
        rooms: { total: 50, available: 30, occupied: 15, maintenance: 5 },
        revenue: { today: 120000, week: 840000, month: 3600000 },
        bookings: { today: 5, tomorrow: 8, pending: 12 },
        tasks: { pending: 7, completed: 15 }
      }
    }
  };

  return mockDataStore[cleanEndpoint] || null;
}

// Branch Operations API - Combined functionality from Branch Store and Branch Manager
export const branchOperationsAPI = {
  // Dashboard
  getDashboard: (branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/dashboard', {}, branchId),

  // Staff Management
  getStaff: (params?: { department?: string; status?: string }, branchId?: number) => {
    const queryParams = new URLSearchParams();

    if (params?.department) {
      queryParams.append('department', params.department);
    }

    if (params?.status) {
      queryParams.append('status', params.status);
    }

    const endpoint = `/api/branch-operations/staff${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return fetchWithBranchContext<any>(endpoint, {}, branchId);
  },

  // Schedule Management
  getStaffSchedule: (params?: { startDate?: string; endDate?: string }, branchId?: number) => {
    const queryParams = new URLSearchParams();

    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }

    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }

    const endpoint = `/api/branch-operations/staff/schedule${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return fetchWithBranchContext<any>(endpoint, {}, branchId);
  },

  getStaffMember: (staffId: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/staff/${staffId}`, {}, branchId),

  createStaffMember: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/staff', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  updateStaffMember: (staffId: string, data: any, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/staff/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, branchId),

  deleteStaffMember: (staffId: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/staff/${staffId}`, {
      method: 'DELETE'
    }, branchId),

  // Inventory Management
  getInventory: (params?: { category?: string; lowStock?: boolean }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.lowStock) query.append('lowStock', 'true');
    return fetchWithBranchContext<any>(`/api/branch-operations/inventory?${query}`, {}, branchId);
  },

  // Enhanced Stock Requests (using new storekeeping API)
  createStockRequest: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/storekeeping/stock-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  getStockRequests: (params?: { status?: string; priority?: string; from_date?: string; to_date?: string }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.priority) query.append('priority', params.priority);
    if (params?.from_date) query.append('from_date', params.from_date);
    if (params?.to_date) query.append('to_date', params.to_date);

    return fetchWithBranchContext<any>(`/api/storekeeping/stock-requests?${query.toString()}`, {}, branchId);
  },

  getStockRequest: (id: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/storekeeping/stock-requests/${id}`, {}, branchId),

  cancelStockRequest: (id: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/storekeeping/stock-requests/${id}/cancel`, {
      method: 'PUT'
    }, branchId),

  // Reservations
  getReservations: (params?: { status?: string; from?: string; to?: string }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    return fetchWithBranchContext<any>(`/api/branch-operations/reservations?${query}`, {}, branchId).then(response => {
      // Transform response to match frontend expected format
      if (response.success && Array.isArray(response.data)) {
        response.data = response.data.map((booking: any) => ({
          id: booking.id,
          guest_name: booking.guest_name,
          room_number: booking.room_number,
          room_type: booking.room_type,
          check_in: booking.check_in_date,
          check_out: booking.check_out_date,
          status: booking.status,
          adults: booking.adults,
          children: booking.children,
          nights: booking.nights || calculateNights(booking.check_in_date, booking.check_out_date),
          total: booking.total_amount,
          balance: booking.balance,
          phone: booking.guest_phone,
          email: booking.guest_email
        }));
      }
      return response;
    });
  },

  createReservation: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/reservations', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  updateReservationStatus: (id: string, status: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/reservations/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }, branchId),

  // Operations - Note: This was a duplicate of the method at lines 200-205, so we've removed it

  // Financial Reports
  getFinancialSummary: (period: 'day' | 'week' | 'month' | 'year' = 'day', branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/finances/summary?period=${period}`, {}, branchId),

  getExpenses: (params?: any, branchId?: number) => {
    const query = new URLSearchParams(params);
    return fetchWithBranchContext<any>(`/api/branch-operations/finances/expenses?${query}`, {}, branchId);
  },

  getFinancialReports: (params?: { type?: string; startDate?: string; endDate?: string }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params?.type) query.append('type', params.type);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);

    // Real API endpoint – no sample data
    return fetchWithBranchContext<any>(
      `/api/branch-operations/finances/reports${query.toString() ? `?${query.toString()}` : ''}`,
      {},
      branchId,
    );
  },

  // Stock Tracking
  createStockTake: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/inventory/stock-takes', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  getStockTakes: (status?: string, branchId?: number) => {
    const query = status ? `?status=${status}` : '';
    return fetchWithBranchContext<any>(`/api/branch-operations/inventory/stock-takes${query}`, {}, branchId);
  },

  getIncomingStock: (branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/inventory/incoming', {}, branchId),

  confirmDelivery: (id: string, data: any, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/storekeeping/dispatch-notes/${id}/confirm-delivery`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, branchId),

  // Room Operations
  getRooms: (params?: { status?: string; floor?: number }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.floor) query.append('floor', params.floor.toString());
    return fetchWithBranchContext<any>(`/api/branch-operations/rooms?${query}`, {}, branchId);
  },

  updateRoomStatus: (roomId: string, status: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/rooms/${roomId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }, branchId),

  updateRoomCleanStatus: (roomId: string, isClean: boolean, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/rooms/${roomId}/clean-status`, {
      method: 'PUT',
      body: JSON.stringify({ isClean })
    }, branchId),

  getRoomDetails: (roomId: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/rooms/${roomId}`, {}, branchId),

  createRoom: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/rooms', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  deleteRoom: (roomId: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/rooms/${roomId}`, {
      method: 'DELETE'
    }, branchId),

  // Service Requests
  getServiceRequests: (params?: { type?: string; status?: string }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params?.type) query.append('type', params.type);
    if (params?.status) query.append('status', params.status);
    return fetchWithBranchContext<any>(`/api/branch-operations/service-requests?${query}`, {}, branchId);
  },

  createServiceRequest: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/service-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  updateServiceRequestStatus: (requestId: string, status: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/service-requests/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }, branchId),

  // Communications
  getCommunications: (branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/communications', {}, branchId),

  getNotifications: (branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/communications/notifications', {}, branchId),

  getMessages: (branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/communications/messages', {}, branchId),

  getAnnouncements: (branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/communications/announcements', {}, branchId),

  sendMessage: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/communications/messages', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  createAnnouncement: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/communications/announcements', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  markAsRead: (id: string, type: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/communications/${type}/${id}/read`, {
      method: 'PUT'
    }, branchId),

  // Staff Schedule Management
  getShiftTypes: (branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/staff/shift-types', {}, branchId),

  getShifts: (params?: { startDate?: string; endDate?: string }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    return fetchWithBranchContext<any>(`/api/branch-operations/staff/shifts?${query}`, {}, branchId);
  },

  createShift: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/staff/shifts', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  updateShift: (shiftId: string, data: any, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/staff/shifts/${shiftId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, branchId),

  deleteShift: (shiftId: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/staff/shifts/${shiftId}`, {
      method: 'DELETE'
    }, branchId),

  // Staff Attendance
  getAttendanceRecords: (params?: { startDate?: string; endDate?: string; staffId?: string }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.staffId) query.append('staffId', params.staffId);
    return fetchWithBranchContext<any>(`/api/branch-operations/staff/attendance?${query}`, {}, branchId);
  },

  recordAttendance: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/staff/attendance', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  // Financials and Reports
  createReport: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/finances/reports', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  getRevenueDetails: (params?: { startDate?: string; endDate?: string; period?: string }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.period) query.append('period', params.period);
    return fetchWithBranchContext<any>(`/api/branch-operations/finances/revenue?${query}`, {}, branchId);
  },

  // Note: The getExpenses method is already defined above at lines 167-170

  createExpense: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/branch-operations/finances/expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  approveExpense: (expenseId: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/finances/expenses/${expenseId}/approve`, {
      method: 'PUT'
    }, branchId),

  rejectExpense: (expenseId: string, branchId?: number) =>
    fetchWithBranchContext<any>(`/api/branch-operations/finances/expenses/${expenseId}/reject`, {
      method: 'PUT'
    }, branchId),

  // Statutory Deductions (Manual entry)
  getStatutoryDeductions: (params: { staffId?: string; month: number; year: number }, branchId?: number) => {
    const query = new URLSearchParams();
    if (params.staffId) query.append('staffId', params.staffId);
    query.append('month', params.month.toString());
    query.append('year', params.year.toString());
    return fetchWithBranchContext<any>(`/api/payroll-statutory?${query}`, {}, branchId);
  },

  saveStatutoryDeductions: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/payroll-statutory/monthly', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),

  getStaffPerformance: (params: { month: number; year: number }, branchId?: number | null) => {
    const isMultiBranch = branchId === undefined || branchId === null;
    return fetchWithBranchContext<any>(
      `/api/performance/staff-metrics?month=${params.month}&year=${params.year}`,
      { method: 'GET' },
      branchId,
      isMultiBranch
    );
  },

  getPayrollAdjustments: (params: any, branchId?: number) => {
    const qs = new URLSearchParams(params).toString();
    return fetchWithBranchContext<any>(`/api/payroll-adjustments?${qs}`, {
      method: 'GET'
    }, branchId);
  },

  createPayrollAdjustment: (data: any, branchId?: number) =>
    fetchWithBranchContext<any>('/api/payroll-adjustments', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId),
};


// Facilities Management API - Combined functionality from Housekeeping and Maintenance
// Helper function to calculate nights between two dates
function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  return Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
}

export const facilitiesAPI = {
  // Dashboard
  getDashboard: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/dashboard', {}, branchId || undefined),

  // Room Management - for dropdowns
  getRooms: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/rooms', {}, branchId || undefined),

  getRoomStatus: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/rooms/status', {}, branchId || undefined),

  // Dropdown lists
  getStaffList: (department?: string, branchId?: number | null) => {
    const query = department ? `?department=${department}` : '';
    return fetchWithBranchContext<any>(`/api/facilities/staff/list${query}`, {}, branchId || undefined);
  },

  getEquipmentList: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/equipment/list', {}, branchId || undefined),

  getSuppliesList: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/supplies/list', {}, branchId || undefined),

  updateRoomStatus: (roomId: string, data: { housekeeping_status?: string; status?: string }, branchId?: number | null) =>
    fetchWithBranchContext<any>(`/api/facilities/rooms/${roomId}/status`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, branchId || undefined),

  // Housekeeping Tasks
  getHousekeepingTasks: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/housekeeping/tasks', {}, branchId || undefined),

  createHousekeepingTask: (data: any, branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/housekeeping/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId || undefined),

  updateTaskStatus: (taskId: string, status: string, branchId?: number | null) =>
    fetchWithBranchContext<any>(`/api/facilities/housekeeping/tasks/${taskId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }, branchId || undefined),

  // Inspections
  getInspections: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/housekeeping/inspections', {}, branchId || undefined),

  createInspection: (data: any, branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/housekeeping/inspections', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId || undefined),

  // Maintenance Work Orders
  getWorkOrders: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/maintenance/work-orders', {}, branchId || undefined),

  createWorkOrder: (data: any, branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/maintenance/work-orders', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId || undefined),

  updateWorkOrderStatus: (orderId: string, status: string, branchId?: number | null) =>
    fetchWithBranchContext<any>(`/api/facilities/maintenance/work-orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }, branchId || undefined),

  // Assets
  getAssets: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/maintenance/assets', {}, branchId || undefined),

  createAsset: (data: any, branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/maintenance/assets', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId || undefined),

  // Staff
  getStaff: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/staff', {}, branchId || undefined),

  createStaff: (data: any, branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/staff', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId || undefined),

  // Inventory Management
  getInventory: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/inventory', {}, branchId || undefined),

  getInventoryCategories: () =>
    fetchWithBranchContext<any>('/api/facilities/inventory/categories', {}),

  // Quality & Compliance
  getQualityCompliance: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/quality-compliance', {}, branchId || undefined),

  requestSupplies: (data: any, branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/inventory/requests', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId || undefined),

  // Lost & Found
  getLostFound: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/housekeeping/lost-found', {}, branchId || undefined),

  createLostFoundItem: (data: any, branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/housekeeping/lost-found', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId || undefined),

  updateLostFoundStatus: (itemId: string, status: string, branchId?: number | null) =>
    fetchWithBranchContext<any>(`/api/facilities/housekeeping/lost-found/${itemId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }, branchId || undefined),

  // Maintenance Schedule
  getMaintenanceSchedule: (branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/maintenance/schedule', {}, branchId || undefined),

  createScheduledMaintenance: (data: any, branchId?: number | null) =>
    fetchWithBranchContext<any>('/api/facilities/maintenance/schedule', {
      method: 'POST',
      body: JSON.stringify(data)
    }, branchId || undefined),

  updateScheduledMaintenanceStatus: (scheduleId: string, status: string, branchId?: number | null) =>
    fetchWithBranchContext<any>(`/api/facilities/maintenance/schedule/${scheduleId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }, branchId || undefined)
};

export const branchManagerAPI = {
  // Incoming Dispatches
  getIncomingDispatches: () =>
    fetchWithBranchContext<any>('/api/storekeeping/dispatch-notes/incoming', {}, null, false),

  confirmDispatchDelivery: (id: string, data: any) =>
    fetchWithBranchContext<any>(`/api/storekeeping/dispatch-notes/${id}/confirm-delivery`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, null, false)
};
