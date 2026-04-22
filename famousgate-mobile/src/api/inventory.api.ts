import apiClient from './client';

// All storekeeping routes are under /api/storekeeping
export const inventoryApi = {
  // GET /api/storekeeping/items?search=q
  search: (query: string) =>
    apiClient.get('/storekeeping/items', { params: { search: query, limit: 20 } }).then(r => r.data?.data || r.data),

  // GET /api/storekeeping/items?search=xxx (searches barcode, SKU, name)
  searchByBarcode: (barcode: string) =>
    apiClient.get('/storekeeping/items', { params: { search: barcode, limit: 10 } }).then(r => {
      const items = r.data?.data || r.data;
      const itemsArray = Array.isArray(items) ? items : [];
      // Prioritize exact barcode match
      const exactMatch = itemsArray.find(i => i.barcode?.toLowerCase() === barcode.toLowerCase());
      return exactMatch || itemsArray[0];
    }),

  // GET /api/storekeeping/items
  list: (params?: { limit?: number; category?: string; page?: number; search?: string }) =>
    apiClient.get('/storekeeping/items', { params }).then(r => r.data?.data || r.data),

  // GET /api/storekeeping/branch-stock
  branchStock: (branchId?: string) =>
    apiClient.get('/storekeeping/branch-stock', { params: { branch_id: branchId } }).then(r => r.data?.data || r.data),

  // GET /api/storekeeping/branch-stock/low
  lowStock: () =>
    apiClient.get('/inventory/low-stock').then(r => r.data?.data || r.data || []),

  // POST /api/storekeeping/items/:id/add-stock
  addStock: (itemId: string, quantity: number, notes?: string) =>
    apiClient.post(`/storekeeping/items/${itemId}/add-stock`, { quantity, notes }).then(r => r.data),

  // GET /api/storekeeping/master-catalog
  masterCatalog: () =>
    apiClient.get('/storekeeping/master-catalog').then(r => r.data?.data || r.data),

  // GET /api/storekeeping/categories
  categories: () =>
    apiClient.get('/storekeeping/categories').then(r => r.data),

  // GET /api/storekeeping/suppliers
  suppliers: () =>
    apiClient.get('/storekeeping/suppliers').then(r => {
      const payload = r.data?.data || r.data || [];
      return Array.isArray(payload) ? payload : [];
    }),

  // POST /api/storekeeping/generate-barcode
  generateBarcode: () =>
    apiClient.post('/storekeeping/generate-barcode').then(r => r.data),

  // POST /api/storekeeping/items (create new item)
  receiveItem: (data: any) =>
    apiClient.post('/storekeeping/items', data).then(r => r.data),

  // GET /api/storekeeping/vehicles
  getVehicles: () =>
    apiClient.get('/storekeeping/vehicles').then(r => ({ success: true, data: r.data?.data || r.data || [] })),

  // GET /api/storekeeping/drivers
  getDrivers: () =>
    apiClient.get('/storekeeping/drivers').then(r => ({ success: true, data: r.data?.data || r.data || [] })),

  // GET /api/storekeeping/items/:id
  getById: (itemId: string) =>
    apiClient.get(`/storekeeping/items/${itemId}`).then(r => r.data?.data || r.data),
};
