import { fetchAPI, buildQuery } from './core';
import { 
  ApiResponse, 
  InventoryItem,
  KitchenWastage,
  KitchenUsage 
} from './types';

// =====================================
// CONFERENCE & CATERING API
// =====================================

export const conferenceAPI = {
  getHalls: (branchId?: number) => fetchAPI<any[]>(`/conference/halls${buildQuery({ branch_id: branchId })}`),
  createHall: (data: any) => fetchAPI<any>('/conference/halls', { method: 'POST', body: JSON.stringify(data) }),
  updateHall: (id: string, data: any) => fetchAPI<any>(`/conference/halls/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  checkAvailability: (hallId: string, start: string, end: string) => 
    fetchAPI<any>(`/conference/halls/${hallId}/availability${buildQuery({ start_date: start, end_date: end })}`),

  getBookings: (params?: any) => fetchAPI<any[]>(`/conference/bookings${buildQuery(params)}`),
  createBooking: (data: any) => fetchAPI<any>('/conference/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBookingStatus: (id: string, status: string) => 
    fetchAPI<void>(`/conference/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getBookingInvoice: (id: string) => fetchAPI<any>(`/conference/bookings/${id}/invoice`),
  addPayment: (id: string, data: any) => fetchAPI<void>(`/conference/bookings/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),

  // Attendance
  recordAttendance: (id: string, data: any) => fetchAPI<void>(`/conference/bookings/${id}/attendance`, { method: 'POST', body: JSON.stringify(data) }),
  getAttendance: (id: string) => fetchAPI<any[]>(`/conference/bookings/${id}/attendance`),
  generateInvoiceWithAttendance: (id: string) => fetchAPI<any>(`/conference/bookings/${id}/invoice-with-attendance`),
  deleteAttendance: (id: string, date: string) => fetchAPI<void>(`/conference/bookings/${id}/attendance/${date}`, { method: 'DELETE' }),
};

export const cateringAPI = {
  // Catering bookings endpoints
  getBookings: (params?: any) => fetchAPI<any[]>(`/catering-bookings${buildQuery(params)}`),
  getBookingById: (id: string) => fetchAPI<any>(`/catering-bookings/${id}`),
  createBooking: (data: any) => fetchAPI<any>('/catering-bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id: string, data: any) => fetchAPI<any>(`/catering-bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancelBooking: (id: string) => fetchAPI<any>(`/catering-bookings/${id}/cancel`, { method: 'POST' }),
  deleteBooking: (id: string) => fetchAPI<void>(`/catering-bookings/${id}`, { method: 'DELETE' }),
  recordPayment: (id: string, amount: number) => fetchAPI<any>(`/catering-bookings/${id}/payment`, { method: 'POST', body: JSON.stringify({ amount }) }),
  getCalendar: (params?: any) => fetchAPI<any[]>(`/catering-bookings/calendar${buildQuery(params)}`),
  getStatistics: (params?: any) => fetchAPI<any>(`/catering-bookings/statistics${buildQuery(params)}`),
};

// =====================================
// HOUSEKEEPING API
// =====================================

export const housekeepingAPI = {
  // Appended for UI Compatibility
  getRoomsForInspection: (params?: any) => fetchAPI<any[]>('/housekeeping/rooms/inspection'),
  createStaff: (data: any) => fetchAPI<any>('/housekeeping/staff', { method: 'POST', body: JSON.stringify(data) }),

  getDashboard: (branchId?: number) => fetchAPI<any>(`/housekeeping/dashboard${buildQuery({ branch_id: branchId })}`),
  getRoomGrid: (branchId?: number) => fetchAPI<any[]>(`/housekeeping/dashboard/room-grid${buildQuery({ branch_id: branchId })}`),
  getStats: (branchId?: number) => fetchAPI<any>(`/housekeeping/dashboard/stats${buildQuery({ branch_id: branchId })}`),
  
  getTasks: (params?: any) => fetchAPI<any[]>(`/housekeeping/tasks${buildQuery(params)}`),
  getTask: (id: string) => fetchAPI<any>(`/housekeeping/tasks/${id}`),
  createTask: (data: any) => fetchAPI<any>('/housekeeping/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: any) => fetchAPI<any>(`/housekeeping/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id: string) => fetchAPI<void>(`/housekeeping/tasks/${id}`, { method: 'DELETE' }),
  
  updateTaskStatus: (id: string, data: string | { status: string }) => {
    const status = typeof data === 'string' ? data : data.status;
    return fetchAPI<void>(`/housekeeping/tasks/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  },
  
  assignTask: (id: string, data: string | { assignedTo: string; staff_id?: string }) => {
    const staffId = typeof data === 'string' ? data : (data.assignedTo || data.staff_id);
    return fetchAPI<void>(`/housekeeping/tasks/${id}/assign`, { method: 'PUT', body: JSON.stringify({ staff_id: staffId }) });
  },
  
  getStaff: (params?: any) => fetchAPI<any[]>(`/housekeeping/staff${buildQuery(params)}`),
  getRooms: (params?: any) => fetchAPI<any[]>(`/housekeeping/rooms${buildQuery(params)}`),
  updateRoomStatus: (id: string, status: string) => 
    fetchAPI<void>(`/housekeeping/rooms/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  
  getLostFoundItems: (params?: any) => fetchAPI<any[]>(`/housekeeping/lost-found${buildQuery(params)}`),
  createLostFoundItem: (data: any) => fetchAPI<any>('/housekeeping/lost-found', { method: 'POST', body: JSON.stringify(data) }),
  
  // Guest Requests
  createGuestRequest: (data: any) => fetchAPI<any>('/housekeeping/requests', { method: 'POST', body: JSON.stringify(data) }),
  getGuestRequests: (params?: any) => fetchAPI<any[]>(`/housekeeping/requests${buildQuery(params)}`),

  // Additional Methods from Errors
  getInspections: (params?: any) => fetchAPI<any[]>(`/housekeeping/inspections${buildQuery(params)}`),
  getInspectionQueue: (branchId?: number) => fetchAPI<any[]>(`/housekeeping/inspections/queue${buildQuery({ branch_id: branchId })}`),
  submitInspection: (data: any) => fetchAPI<any>('/housekeeping/inspections', { method: 'POST', body: JSON.stringify(data) }),
  updateLostFoundStatus: (id: string, status: string) => fetchAPI<void>(`/housekeeping/lost-found/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  assignRoomAttendant: (roomId: string, staffId: string) => fetchAPI<void>(`/housekeeping/rooms/${roomId}/assign`, { method: 'PUT', body: JSON.stringify({ staff_id: staffId }) }),
  getSchedules: (params?: any) => fetchAPI<any[]>(`/housekeeping/schedules${buildQuery(params)}`),
  getDailyReport: (params?: any) => fetchAPI<any>(`/housekeeping/reports/daily${buildQuery(params)}`),
  getStaffPerformanceReport: (params?: any) => fetchAPI<any>(`/housekeeping/reports/staff-performance${buildQuery(params)}`),
  getInspectionStats: (params?: any) => fetchAPI<any>(`/housekeeping/reports/inspections${buildQuery(params)}`),
};

export const maintenanceAPI = {
  getOrders: (params?: any) => housekeepingAPI.getTasks({ ...params, category: 'maintenance' }),
  getRequests: (branchId?: string | number, status?: string) => 
    housekeepingAPI.getTasks({ branch_id: branchId, status, category: 'maintenance' }),
  getOrder: (id: string) => housekeepingAPI.getTask(id),
  createOrder: (data: any) => housekeepingAPI.createTask({ ...data, category: 'maintenance' }),
  createRequest: (data: any) => maintenanceAPI.createOrder(data),
  updateOrder: (id: string, data: any) => housekeepingAPI.updateTaskStatus(id, data.status),
  updateRequest: (id: string, data: any) => maintenanceAPI.updateOrder(id, data),
  deleteRequest: (id: string) => fetchAPI<void>(`/housekeeping/tasks/${id}`, { method: 'DELETE' }),
  getAssets: (params?: any) => fetchAPI<any[]>(`/maintenance/assets${buildQuery(params)}`),
  getSchedules: (params?: any) => fetchAPI<any[]>(`/maintenance/schedules${buildQuery(params)}`),
};

// =====================================
// KITCHEN & INVENTORY API
// =====================================

export const kitchenAPI = {
  getDashboardStats: (branchId?: number) => fetchAPI<any>(`/kitchen/dashboard/stats${buildQuery({ branch_id: branchId })}`),
  getKitchenStock: (params?: any) => fetchAPI<any[]>(`/kitchen/stock${buildQuery(params)}`),
  getKitchenLedger: (params?: any) => fetchAPI<any[]>(`/kitchen/stock/ledger${buildQuery(params)}`),
  
  getRequisitions: (params?: any) => fetchAPI<any[]>(`/kitchen/requisitions${buildQuery(params)}`),
  createRequisition: (data: any) => fetchAPI<any>('/kitchen/requisitions', { method: 'POST', body: JSON.stringify(data) }),
  approveRequisition: (id: string) => fetchAPI<void>(`/kitchen/requisitions/${id}/approve`, { method: 'PUT' }),
  
  getRecipes: (params?: any) => fetchAPI<any[]>(`/kitchen/recipes${buildQuery(params)}`),
  createRecipe: (data: any) => fetchAPI<any>('/kitchen/recipes', { method: 'POST', body: JSON.stringify(data) }),
  
  recordUsage: (data: any) => fetchAPI<void>('/kitchen/usage', { method: 'POST', body: JSON.stringify(data) }),
  getUsageEntries: (branchId?: number) => fetchAPI<KitchenUsage[]>(`/kitchen/usage${buildQuery({ branch_id: branchId })}`),
  reviewUsage: (id: string, notes: string) => fetchAPI<any>(`/kitchen/usage/${id}/review`, { method: 'PUT', body: JSON.stringify({ notes }) }),
  
  recordWastage: (data: any) => fetchAPI<void>('/kitchen/wastage', { method: 'POST', body: JSON.stringify(data) }),
  getWastageRecords: (branchId?: number) => fetchAPI<KitchenWastage[]>(`/kitchen/wastage${buildQuery({ branch_id: branchId })}`),
  reviewWastage: (id: string, notes: string) => fetchAPI<any>(`/kitchen/usage/${id}/review`, { method: 'PUT', body: JSON.stringify({ notes }) }),

  // Food Controls & Variances
  getPortionStock: (params?: any) => fetchAPI<any[]>(`/kitchen/portions/stock${buildQuery(params)}`),
  getDailyVariance: (params?: any) => fetchAPI<any[]>(`/kitchen/variance/daily${buildQuery(params)}`),
  getVarianceReasons: () => fetchAPI<any[]>('/kitchen/variance/reasons'),
  submitVarianceReason: (data: any) => fetchAPI<void>('/kitchen/variance/reasons', { method: 'POST', body: JSON.stringify(data) }),
  approveVariance: (id: string, notes: string) => fetchAPI<void>(`/kitchen/variance/${id}/approve`, { method: 'POST', body: JSON.stringify({ notes }) }),
  
  getYieldReport: (params?: any) => fetchAPI<any>(`/kitchen/reports/yield${buildQuery(params)}`),
  getLossReport: (params?: any) => fetchAPI<any>(`/kitchen/reports/loss${buildQuery(params)}`),
  
  getFoodControls: (params?: any) => fetchAPI<any[]>(`/kitchen/controls${buildQuery(params)}`),
  createFoodControl: (data: any) => fetchAPI<any>('/kitchen/controls', { method: 'POST', body: JSON.stringify(data) }),
  updateFoodControl: (id: string, data: any) => fetchAPI<any>(`/kitchen/controls/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFoodControl: (id: string) => fetchAPI<void>(`/kitchen/controls/${id}`, { method: 'DELETE' }),

  // Ledger
  getStockLedger: (params?: any) => kitchenAPI.getKitchenLedger(params),
  getLedger: (params?: any) => kitchenAPI.getKitchenLedger(params),
  createLedgerEntry: (data: any) => fetchAPI<any>('/kitchen/stock/ledger', { method: 'POST', body: JSON.stringify(data) }),
  updateLedgerStatus: (id: string, status: string) => fetchAPI<void>(`/kitchen/stock/ledger/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const inventoryAPI = {
  getItems: (params?: any) => fetchAPI<InventoryItem[]>(`/inventory/items${buildQuery(params)}`),
  getItem: (id: string) => fetchAPI<InventoryItem>(`/inventory/items/${id}`),
  createItem: (data: any) => fetchAPI<InventoryItem>('/inventory/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: string, data: any) => fetchAPI<InventoryItem>(`/inventory/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id: string) => fetchAPI<void>(`/inventory/items/${id}`, { method: 'DELETE' }),
  
  addStockMovement: (id: string, data: any) => fetchAPI<void>(`/inventory/items/${id}/movement`, { method: 'POST', body: JSON.stringify(data) }),
  getLowStock: (params?: any) => fetchAPI<InventoryItem[]>(`/inventory/low-stock${buildQuery(params)}`),
};

export const barInventoryAPI = {
  getBarInventory: (params?: any) => fetchAPI<any[]>(`/bar/stock${buildQuery(params)}`),
  syncFromMaster: () => fetchAPI<void>('/bar/stock/sync', { method: 'POST' }),
};
