import { fetchAPI, buildQuery, API_URL } from './core';
import { 
  ApiResponse, 
  InventoryItem, 
  StockRequest 
} from './types';

// =====================================================
// STORE / STOREKEEPING API
// =====================================================

export const storeAPI = {
  // Dashboard
  getCentralDashboard: () => fetchAPI<any>('/store/dashboard/central'),
  getBranchDashboard:  () => fetchAPI<any>('/store/dashboard/branch'),

  // Stock Requests
  approveStockRequest: (id: string, data?: any) =>
    fetchAPI<void>(`/store/stock-requests/${id}/approve`, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  rejectStockRequest: (id: string, data?: any) =>
    fetchAPI<void>(`/store/stock-requests/${id}/reject`, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  reviewStockRequest: (id: string, data: { action: 'APPROVE' | 'REJECT'; review_notes?: string; approved_items?: any[] }) =>
    fetchAPI<void>(`/store/stock-requests/${id}/review`, { method: 'PUT', body: JSON.stringify(data) }),
  getBranchPerformance: (branchId: number, days = 1) =>
    fetchAPI<any>(`/store/stock-requests/branch-performance/${branchId}${buildQuery({ days })}`),

  // Items / Inventory
  getItems: (params?: { search?: string; category?: string; branch_id?: number; limit?: number; page?: number }) =>
    fetchAPI<InventoryItem[]>(`/store/items${buildQuery(params)}`),
  getItem:    (id: string)           => fetchAPI<InventoryItem>(`/store/items/${id}`),
  createItem: (data: any)            => fetchAPI<InventoryItem>('/store/items',      { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: string, data: any)=> fetchAPI<InventoryItem>(`/store/items/${id}`,{ method: 'PUT',  body: JSON.stringify(data) }),
  deleteItem: (id: string)           => fetchAPI<void>(`/store/items/${id}`,{ method: 'DELETE' }),
  addStock:   (id: string, data: { quantity: number; notes?: string }) =>
    fetchAPI<void>(`/store/items/${id}/add-stock`, { method: 'POST', body: JSON.stringify(data) }),
  getStockHistory: (id: string) => fetchAPI<any[]>(`/store/items/${id}/history`),

  // Categories / SKU
  getCategories:     () => fetchAPI<any[]>('/store/categories'),
  previewSKU:        (data: any) => fetchAPI<{ sku: string }>('/store/preview-sku',   { method: 'POST', body: JSON.stringify(data) }),
  generateSKU:       (data: any) => fetchAPI<{ sku: string }>('/store/generate-sku',  { method: 'POST', body: JSON.stringify(data) }),
  suggestAttributes: (item_name: string) =>
    fetchAPI<any>('/storekeeping/items/suggest', { method: 'POST', body: JSON.stringify({ item_name }) }),
  getMasterCatalog: (params?: { category?: string; search?: string }) =>
    fetchAPI<InventoryItem[]>(`/store/master-catalog${buildQuery(params)}`),

  // Branch Stock
  getBranchStock:   (branch_id?: number) => fetchAPI<any[]>(`/store/branch-stock${buildQuery({ branch_id })}`),
  getLowStockItems: (branch_id?: number) => fetchAPI<any[]>(`/store/branch-stock/low${buildQuery({ branch_id })}`),
  recordStockOut:   (data: any)          => fetchAPI<void>('/store/branch-stock/out',        { method: 'POST', body: JSON.stringify(data) }),
  adjustBranchStock:(data: any)          => fetchAPI<void>('/store/branch-stock/adjustment', { method: 'POST', body: JSON.stringify(data) }),

  getStockMovements: (params?: { branch_id?: number; item_sku?: string; from_date?: string; to_date?: string }) =>
    fetchAPI<any[]>(`/store/stock-movements${buildQuery(params)}`),

  // Stock Requests (list / create)
  createStockRequest: (data: {
    requesting_branch_id?: number;
    items: Array<{ item_sku: string; quantity?: number; requested_quantity?: number; current_branch_stock?: number }>;
    request_type?: string; priority?: string; reason?: string; notes?: string; needed_by_date?: string;
  }) => fetchAPI<StockRequest>('/store/stock-requests', {
    method: 'POST',
    body: JSON.stringify({
      items: data.items.map(i => ({
        item_sku: i.item_sku,
        requested_quantity: i.requested_quantity ?? i.quantity ?? 0,
        current_branch_stock: i.current_branch_stock ?? 0,
      })),
      request_type: data.request_type,
      priority:     data.priority,
      reason:       data.reason ?? data.notes,
      needed_by_date: data.needed_by_date,
    }),
  }),

  getBranchRequests: (status?: string, branch_id?: number) =>
    fetchAPI<StockRequest[]>(`/store/stock-requests${buildQuery({
      ...(status && status !== 'all' ? { status } : {}),
      branch_id,
    })}`),
  getPendingRequests: () => fetchAPI<StockRequest[]>('/store/stock-requests/pending'),
  getStockRequests: (params?: { status?: string; branch_id?: number; from_date?: string; to_date?: string }) =>
    fetchAPI<StockRequest[]>(`/store/stock-requests${buildQuery(params)}`),

  // Kitchen Requisitions
  getKitchenRequisitions: (params?: { branch_id?: number; status?: string }) =>
    fetchAPI<any[]>(`/kitchen/requisitions${buildQuery(params)}`),
  fulfillKitchenRequisition: (id: string | number, items: any[]) =>
    fetchAPI<void>(`/kitchen/requisitions/${id}/fulfill`, { method: 'POST', body: JSON.stringify({ issued_quantities: items }) }),
  rejectKitchenRequisition: (id: string | number, reason: string) =>
    fetchAPI<void>(`/kitchen/requisitions/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Dispatch
  createDispatch: (data: any) => fetchAPI<any>('/store/dispatch-notes', { method: 'POST', body: JSON.stringify(data) }),
  getDispatchHistory: (status?: string) => fetchAPI<any[]>(`/store/dispatch-notes${buildQuery({ status })}`),
  dispatchItems: (id: string, data?: any) =>
    fetchAPI<any>(`/store/dispatch-notes/${id}/dispatch`, { method: 'PUT', ...(data ? { body: JSON.stringify(data) } : {}) }),
  updateDispatchLogistics: (id: string, data: any) =>
    fetchAPI<any>(`/store/dispatch-notes/${id}/logistics`, { method: 'PUT', body: JSON.stringify(data) }),
  getIncomingDispatches: () => fetchAPI<any[]>('/store/incoming-dispatches'),
  receiveDispatch:   (id: string, data: any) => fetchAPI<void>(`/store/dispatch-notes/${id}/confirm`, { method: 'PUT', body: JSON.stringify(data) }),
  confirmDelivery:   (id: string, data: any) => fetchAPI<void>(`/store/dispatch-notes/${id}/confirm`, { method: 'PUT', body: JSON.stringify(data) }),

  // Transfer Cart
  getTransferItems: (params?: { search?: string }) =>
    fetchAPI<any[]>(`/store/transfer_items${buildQuery(params)}`),
  transferItem: (data: { sku: string; transfer_quantity: number }) =>
    fetchAPI<void>('/store/transfer', { method: 'POST', body: JSON.stringify(data) }),
  submitTransferRequest: () => fetchAPI<void>('/store/submit-transfer-request', { method: 'POST' }),
  completeTransfer: (data: { sku: string; quantity: number; shop_user_id: string; cancel?: boolean }) =>
    fetchAPI<void>('/store/complete-transfer', { method: 'POST', body: JSON.stringify({ ...data, cancel: data.cancel ?? false }) }),

  // Branches
  getBranches:          () => fetchAPI<any[]>('/store/branches'),
  getBranchesWithStock: () => fetchAPI<any[]>('/store/branches-stock'),

  // Vehicles
  getVehicles:                         () => fetchAPI<any[]>('/store/vehicles'),
  createVehicle: (data: any)           => fetchAPI<any>('/store/vehicles',      { method: 'POST',   body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: any)=> fetchAPI<void>(`/store/vehicles/${id}`,{ method: 'PUT',    body: JSON.stringify(data) }),
  deleteVehicle: (id: string)          => fetchAPI<void>(`/store/vehicles/${id}`,{ method: 'DELETE' }),

  // Drivers
  getDrivers:                          () => fetchAPI<any[]>('/store/drivers'),
  createDriver: (data: any)            => fetchAPI<any>('/store/drivers',      { method: 'POST',   body: JSON.stringify(data) }),
  updateDriver: (id: string, data: any)=> fetchAPI<void>(`/store/drivers/${id}`,{ method: 'PUT',    body: JSON.stringify(data) }),
  deleteDriver: (id: string)           => fetchAPI<void>(`/store/drivers/${id}`,{ method: 'DELETE' }),

  // Suppliers
  getSuppliers: (params?: { scope?: 'branch' | 'global' | 'all'; status?: string; category?: string; search?: string }) => 
    fetchAPI<any[]>(`/store/suppliers${buildQuery(params)}`),
  getSupplier:  (id: string)             => fetchAPI<any>(`/store/suppliers/${id}`),
  createSupplier: (data: any)            => fetchAPI<any>('/store/suppliers',       { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: any)=> fetchAPI<void>(`/store/suppliers/${id}`, { method: 'PUT',  body: JSON.stringify(data) }),
  deleteSupplier: (id: string)           => fetchAPI<void>(`/store/suppliers/${id}`, { method: 'DELETE' }),
  receiveFromSupplier: (data: {
    supplier_id: string;
    items: Array<{
      item_sku: string;
      quantity: number;
      unit_price?: number;
      batch_number?: string;
      expiry_date?: string;
    }>;
    delivery_note_number?: string;
    invoice_number?: string;
    remarks?: string;
  }) => fetchAPI<any>('/store/branch-stock/receive-supplier', { method: 'POST', body: JSON.stringify(data) }),

  // Stock Takes
  getStockTakes:       () => fetchAPI<any[]>('/store/stock-takes'),
  getStockTake:        (id: string) => fetchAPI<any>(`/stock-takes/${id}`),
  createStockTake:     (data: { branch_id: number; take_type: string; notes?: string }) =>
    fetchAPI<any>('/store/stock-takes', { method: 'POST', body: JSON.stringify(data) }),
  getStockTakeItems:   (id: string) => fetchAPI<any[]>(`/store/stock-takes/${id}/items`),
  updateStockTakeItem: (id: string, data: { actual_quantity: number }) =>
    fetchAPI<void>(`/store/stock-take-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  submitStockTakeToAuditor: (id: string) => fetchAPI<void>(`/store/stock-takes/${id}/complete`, { method: 'PUT' }),
  completeStockTake:        (id: string) => fetchAPI<void>(`/store/stock-takes/${id}/complete`, { method: 'PUT' }),

  // Config
  getAppConfig:       () => fetchAPI<any>('/store/app_config'),
  getEditLockStatus:  () => fetchAPI<{ locked: boolean }>('/store/get_edit_lock_status'),
  setEditLockStatus:  (locked: boolean) =>
    fetchAPI<void>('/store/set_edit_lock_status', { method: 'POST', body: JSON.stringify({ locked }) }),

  exportData: () => fetchAPI<any>('/store/export_data'),
  importData: (formData: FormData) => fetchAPI<void>('/store/import_data', {
    method: 'POST',
    body: formData,
  }),

  // Conversions
  convertStock: (data: any) => fetchAPI<void>('/store/conversions', { method: 'POST', body: JSON.stringify(data) }),
  getYieldRules: () => fetchAPI<any[]>('/store/yield-rules'),

  // Kitchen Usage Tracking
  getTrackableItems: (branch_id?: number) =>
    fetchAPI<any[]>(`/store/kitchen-usage/trackable-items${buildQuery({ branch_id })}`),
  getKitchenUsageRecords: (params?: { from_date?: string; to_date?: string; status?: string }) =>
    fetchAPI<any[]>(`/store/kitchen-usage${buildQuery(params)}`),
  createKitchenUsageRecord: (data: any) =>
    fetchAPI<any>('/store/kitchen-usage', { method: 'POST', body: JSON.stringify(data) }),
  recordKitchenUsageEntry: (usageRecordId: string, data: any) =>
    fetchAPI<void>(`/store/kitchen-usage/${usageRecordId}/entries`, { method: 'POST', body: JSON.stringify(data) }),
  getKitchenUsageEntries: (usageRecordId: string) =>
    fetchAPI<any[]>(`/store/kitchen-usage/${usageRecordId}/entries`),
  closeKitchenUsageRecord: (usageRecordId: string, data?: any) =>
    fetchAPI<void>(`/store/kitchen-usage/${usageRecordId}/close`, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  getBranchStaffForUsage: (branch_id?: number) =>
    fetchAPI<any[]>(`/store/kitchen-usage/staff${buildQuery({ branch_id })}`),
  getStaffAccountability: (params?: { branch_id?: number; staff_id?: string; period_month?: string }) =>
    fetchAPI<any[]>(`/store/kitchen-usage/accountability${buildQuery(params)}`),
  getDailyUsageSummary: (params?: { branch_id?: number; from_date?: string; to_date?: string }) =>
    fetchAPI<any>(`/store/kitchen-usage/summary${buildQuery(params)}`),

  generateDispatchPDF: async (dispatch: any) => {
    try {
      const { downloadDispatchPDF } = await import('../dispatch-pdf');
      await downloadDispatchPDF(dispatch);
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Generation failed' };
    }
  },

  // Aliases for legacy component satisfaction
  getInventory: (params?: any) => storeAPI.getItems(params),
  updateStock: (id: string, data: any) => storeAPI.addStock(id, data),
};

// =====================================================
// STOCK TAKE API
// =====================================================

export const stockTakeAPI = {
  getStockTakes:   () => fetchAPI<any[]>('/stock-takes'),
  getStockTake:    (id: string) => fetchAPI<any>(`/stock-takes/${id}`),
  createStockTake: (data: any)  => fetchAPI<any>('/stock-takes',      { method: 'POST',   body: JSON.stringify(data) }),
  updateStockTake: (id: string, data: any) => fetchAPI<void>(`/stock-takes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  submitToAuditor: (id: string) => fetchAPI<void>(`/stock-takes/${id}/submit`, { method: 'POST' }),
  deleteStockTake: (id: string) => fetchAPI<void>(`/stock-takes/${id}`,        { method: 'DELETE' }),

  downloadWorksheet: async (id?: string, params?: { branch_id?: number; category?: string }) => {
    const endpoint = id ? `/stock-takes/${id}/worksheet` : '/stock-takes/worksheet';
    const result = await fetchAPI<Blob>(`${endpoint}${buildQuery(params)}`, {
      responseType: 'blob'
    });

    if (result.success && result.data && typeof window !== 'undefined') {
      const blobUrl = window.URL.createObjectURL(result.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `StockTakeWorksheet_${id ?? 'All'}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      return { success: true };
    }
    return { success: false, message: result.message ?? 'Download failed' };
  },
};

// Alias
export const storekeepingAPI = storeAPI;
