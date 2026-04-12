import apiClient from './client';

// All storekeeping routes are under /api/storekeeping
export const inventoryApi = {
  // GET /api/storekeeping/items?search=q
  search: (query: string) =>
    apiClient.get('/storekeeping/items', { params: { search: query, limit: 20 } }).then(r => r.data?.data || r.data),

  // GET /api/storekeeping/items?barcode=xxx
  searchByBarcode: (barcode: string) =>
    apiClient.get('/storekeeping/items', { params: { barcode } }).then(r => {
      const items = r.data?.data || r.data;
      return Array.isArray(items) ? items[0] : items;
    }),

  // GET /api/storekeeping/items
  list: (params?: { limit?: number; category?: string; page?: number }) =>
    apiClient.get('/storekeeping/items', { params }).then(r => r.data?.data || r.data),

  // GET /api/storekeeping/branch-stock
  branchStock: (branchId?: string) =>
    apiClient.get('/storekeeping/branch-stock', { params: { branch_id: branchId } }).then(r => r.data?.data || r.data),

  // GET /api/storekeeping/branch-stock/low
  lowStock: () =>
    apiClient.get('/storekeeping/branch-stock/low').then(r => r.data?.data || r.data),

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
    apiClient.get('/storekeeping/suppliers').then(r => r.data?.data || r.data),
};
