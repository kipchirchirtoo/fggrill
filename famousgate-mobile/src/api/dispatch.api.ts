import apiClient from './client';

export interface DispatchItem {
  id: string;
  dispatch_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  barcode?: string;
  received_quantity?: number;
  discrepancy_notes?: string;
}

export interface Dispatch {
  id: string;
  dispatch_number: string;
  from_branch_id: string;
  to_branch_id: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  driver_otp?: string;
  branch_otp?: string;
  otp_expires_at?: string;
  created_by: string;
  created_at: string;
  items?: DispatchItem[];
}

export interface DispatchDocument {
  id: string;
  dispatch_id: string;
  document_type: 'stock_sheet' | 'delivery_note' | 'other';
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface AuditorReview {
  id: string;
  dispatch_id: string;
  status: 'approved' | 'flagged' | 'pending';
  notes?: string;
  reviewed_by: string;
  reviewed_at: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  location?: string;
  address?: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive';
}

// All dispatch routes are under /api/dispatch
export const dispatchApi = {
  // ── Dashboard Stats ──────────────────────────────────────────────────────────
  
  // GET /api/dispatch/dashboard/central
  centralDashboard: () =>
    apiClient.get('/dispatch/dashboard/central').then(r => r.data?.data || r.data),

  // ── Item Receiving & Barcode Management ──────────────────────────────────────
  
  // POST /api/dispatch/items/receive
  receiveItem: (data: {
    item_id: string;
    quantity: number;
    unit: string;
    branch_id: string;
    barcode?: string;
    notes?: string;
  }) =>
    apiClient.post('/dispatch/items/receive', data).then(r => r.data),

  // POST /api/dispatch/items/generate-barcode
  generateBarcode: (itemId: string) =>
    apiClient.post('/dispatch/items/generate-barcode', { item_id: itemId }).then(r => r.data),

  // GET /api/dispatch/items/search?barcode=xxx
  searchByBarcode: (barcode: string) =>
    apiClient.get('/dispatch/items/search', { params: { barcode } }).then(r => r.data?.data || r.data),

  // ── Dispatch Management ──────────────────────────────────────────────────────
  
  // POST /api/dispatch/dispatches
  createDispatch: (data: {
    destination_branch: string;
    driver_id?: string;
    items: Array<{
      item_id: string;
      quantity: number;
      notes?: string;
    }>;
    notes?: string;
  }) =>
    apiClient.post('/dispatch/dispatches', data).then(r => r.data),

  // GET /api/dispatch/dispatches?status=pending&branch_id=xxx
  getDispatches: (params?: {
    status?: 'pending' | 'in_transit' | 'completed' | 'cancelled';
    branch_id?: string;
    from_branch_id?: string;
    to_branch_id?: string;
  }) =>
    apiClient.get('/dispatch/dispatches', { params }).then(r => r.data?.data || r.data),

  // GET /api/dispatch/dispatches/:id
  getDispatchById: (dispatchId: string) =>
    apiClient.get(`/dispatch/dispatches/${dispatchId}`).then(r => r.data?.data || r.data),

  // ── OTP Verification ─────────────────────────────────────────────────────────
  
  // POST /api/dispatch/dispatches/:id/verify-driver-otp
  verifyDriverOtp: (dispatchId: string, driver_otp: string) =>
    apiClient.post(`/dispatch/dispatches/${dispatchId}/verify-driver-otp`, { driver_otp }).then(r => r.data),

  // POST /api/dispatch/dispatches/:id/verify-branch-otp
  verifyBranchOtp: (dispatchId: string, branch_otp: string) =>
    apiClient.post(`/dispatch/dispatches/${dispatchId}/verify-branch-otp`, { branch_otp }).then(r => r.data),

  // ── Document Upload ──────────────────────────────────────────────────────────
  
  // POST /api/dispatch/dispatches/:id/upload-document
  uploadDocument: async (dispatchId: string, file: {
    uri: string;
    name: string;
    type: string;
  }, documentType: 'stock_sheet' | 'delivery_note' | 'other' = 'stock_sheet') => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('document_type', documentType);

    return apiClient.post(`/dispatch/dispatches/${dispatchId}/upload-document`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(r => r.data);
  },

  // GET /api/dispatch/dispatches/:id/documents
  getDispatchDocuments: (dispatchId: string) =>
    apiClient.get(`/dispatch/dispatches/${dispatchId}/documents`).then(r => r.data?.data || r.data),

  // ── Auditor Review ───────────────────────────────────────────────────────────
  
  // GET /api/dispatch/auditor/deliveries?status=completed
  getAuditorDeliveries: (params?: {
    status?: 'pending' | 'approved' | 'flagged';
    branch_id?: string;
  }) =>
    apiClient.get('/dispatch/auditor/deliveries', { params }).then(r => r.data?.data || r.data),

  // GET /api/dispatch/auditor/deliveries/:id
  getAuditorDeliveryDetail: (dispatchId: string) =>
    apiClient.get(`/dispatch/auditor/deliveries/${dispatchId}`).then(r => r.data?.data || r.data),

  // POST /api/dispatch/auditor/deliveries/:id/review
  reviewDelivery: (dispatchId: string, data: {
    status: 'approved' | 'flagged';
    notes?: string;
  }) =>
    apiClient.post(`/dispatch/auditor/deliveries/${dispatchId}/review`, data).then(r => r.data),

  // ── POS Barcode Integration ──────────────────────────────────────────────────
  
  // POST /api/dispatch/pos/generate-barcode
  generatePOSBarcode: (data: {
    order_id?: string;
    bill_id?: string;
    branch_id: string;
  }) =>
    apiClient.post('/dispatch/pos/generate-barcode', data).then(r => r.data),

  // GET /api/dispatch/pos/scan?barcode=xxx
  scanPOSBarcode: (barcode: string) =>
    apiClient.get('/dispatch/pos/scan', { params: { barcode } }).then(r => r.data?.data || r.data),

  // ── NEW WORKFLOW: Stock Requests ─────────────────────────────────────────────
  
  // POST /api/storekeeping/stock-requests
  createStockRequest: (data: {
    requesting_branch_id: number;
    request_type?: 'ROUTINE' | 'URGENT';
    priority?: 'NORMAL' | 'HIGH' | 'URGENT';
    reason?: string;
    needed_by_date?: string;
    items: Array<{
      item_sku: string;
      requested_quantity: number;
    }>;
  }) =>
    apiClient.post('/storekeeping/stock-requests', data).then(r => r.data),

  // GET /api/storekeeping/stock-requests?status=PENDING_AUDIT
  getStockRequests: (params?: {
    status?: 'PENDING_AUDIT' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    branch_id?: number;
  }) =>
    apiClient.get('/storekeeping/stock-requests', { params }).then(r => r.data?.data || r.data),

  // GET /api/storekeeping/stock-requests/:id
  getStockRequestById: (requestId: string) =>
    apiClient.get(`/storekeeping/stock-requests/${requestId}`).then(r => r.data?.data || r.data),

  // GET /api/storekeeping/stock-requests/approved (Central Store)
  getApprovedRequests: () =>
    apiClient.get('/storekeeping/stock-requests/approved').then(r => r.data?.data || r.data),

  // PUT /api/storekeeping/stock-requests/:id/review (Auditor)
  reviewStockRequest: (requestId: string, data: {
    action: 'APPROVE' | 'REJECT' | 'UNDER_REVIEW';
    review_notes?: string;
    approved_items?: Array<{
      id: string;
      approved_quantity: number;
      status: 'APPROVED' | 'REJECTED';
    }>;
  }) =>
    apiClient.put(`/storekeeping/stock-requests/${requestId}/review`, data).then(r => r.data),

  // ── NEW WORKFLOW: 6-Digit OTP System ─────────────────────────────────────────
  
  // POST /api/dispatch/dispatches/:id/generate-otp
  generateOTP: (dispatchId: string, expiry_hours: number = 24) =>
    apiClient.post(`/dispatch/dispatches/${dispatchId}/generate-otp`, { expiry_hours }).then(r => r.data),

  // POST /api/dispatch/dispatches/:id/verify-otp
  verifyOTP: (dispatchId: string, otp_code: string) =>
    apiClient.post(`/dispatch/dispatches/${dispatchId}/verify-otp`, { otp_code }).then(r => r.data),

  // GET /api/dispatch/dispatches/:id/otp
  getOTP: (dispatchId: string) =>
    apiClient.get(`/dispatch/dispatches/${dispatchId}/otp`).then(r => r.data?.data || r.data),

  // ── GPS Tracking ─────────────────────────────────────────────────────────────
  
  // POST /api/dispatch/dispatches/:id/location
  updateDispatchLocation: (dispatchId: string, location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  }) =>
    apiClient.post(`/dispatch/dispatches/${dispatchId}/location`, location).then(r => r.data),

  // GET /api/dispatch/dispatches/:id/location
  getDispatchLocation: (dispatchId: string) =>
    apiClient.get(`/dispatch/dispatches/${dispatchId}/location`).then(r => r.data?.data || r.data),

  // ── Branches (System API) ────────────────────────────────────────────────────
  
  // GET /api/system/branches
  getBranches: (params?: { status?: 'active' | 'inactive' }) =>
    apiClient.get('/system/branches', { params }).then(r => r.data?.data || r.data),

  // ── Backward Compatibility Aliases ───────────────────────────────────────────
  
  // Alias for getDispatches (used in many screens)
  list: (params?: {
    status?: 'pending' | 'in_transit' | 'completed' | 'cancelled';
    branch_id?: string;
    from_branch_id?: string;
    to_branch_id?: string;
  }) =>
    apiClient.get('/dispatch/dispatches', { params }).then(r => r.data?.data || r.data),

  // ── Dispatch Notes (Correct API used by web app) ────────────────────────────
  
  // GET /api/storekeeping/dispatch-notes?status=pending
  getDispatchNotes: (params?: { status?: string }) =>
    apiClient.get('/storekeeping/dispatch-notes', { params }).then(r => r.data?.data || r.data),

  // ── Vehicles & Drivers ───────────────────────────────────────────────────────
  
  // GET /api/storekeeping/vehicles
  getVehicles: () =>
    apiClient.get('/storekeeping/vehicles').then(r => ({ success: true, data: r.data?.data || r.data || [] })),

  // GET /api/storekeeping/drivers
  getDrivers: () =>
    apiClient.get('/storekeeping/drivers').then(r => ({ success: true, data: r.data?.data || r.data || [] })),

  // PUT /api/storekeeping/dispatch-notes/:id/assign
  assignVehicleDriver: (dispatchId: string, data: {
    vehicle_id: string;
    driver_id: string;
  }) =>
    apiClient.put(`/storekeeping/dispatch-notes/${dispatchId}/assign`, data).then(r => r.data),
};
