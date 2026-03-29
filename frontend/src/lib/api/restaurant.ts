import { fetchAPI, fetchPythonAPI, buildQuery, PYTHON_API_URL } from './core';

// =====================================
// RESTAURANT / DINING API
// =====================================

export const restaurantAPI = {
  // Appended for UI Compatibility
  getWastageRecords: (params?: any) => fetchAPI<any[]>('/kitchen/wastage', { method: 'GET' }),
  getWastageSummary: (params?: any) => fetchAPI<any>('/kitchen/wastage/summary', { method: 'GET' }),
  createWastageRecord: (data: any) => fetchAPI<any>('/kitchen/wastage', { method: 'POST', body: JSON.stringify(data) }),
  updateWastageRecord: (id: any, data: any) => fetchAPI<any>(`/kitchen/wastage/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWastageRecord: (id: any) => fetchAPI<void>(`/kitchen/wastage/${id}`, { method: 'DELETE' }),
  createCategory: (data: any) => fetchAPI<any>('/restaurant/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: any, data: any) => fetchAPI<any>(`/restaurant/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: any) => fetchAPI<void>(`/restaurant/categories/${id}`, { method: 'DELETE' }),

  // Orders
  getOrders: (params?: { branchId?: number; status?: string; from_date?: string; to_date?: string }) =>
    fetchAPI<any>(`/restaurant/orders${buildQuery({
      branch_id: params?.branchId,
      status: params?.status,
      from_date: params?.from_date,
      to_date: params?.to_date,
    })}`),
  getOrder: (id: string) => fetchAPI<any>(`/restaurant/orders/${id}`),

  createOrder: async (data: any) => {
    // Offline / Electron Proxy
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
        const orderId = `local-${Date.now()}`;
        const orderData = {
          id: orderId,
          order_number: orderNumber,
          branch_id: data.branch_id || 0,
          order_type: data.order_type,
          table_number: data.table_number || null,
          room_number: data.room_number || null,
          guest_name: data.customer_name || null,
          payment_method: data.payment_method,
          waiter_id: data.waiter_id || null,
          waiter_name: data.waiter_name || null,
          total_amount: data.total,
          payment_status: 'pending',
          status: data.status || 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await (window as any).electronAPI.db.upsert('restaurant_orders', orderData);
        if (data.items && Array.isArray(data.items)) {
          for (const item of data.items) {
            await (window as any).electronAPI.db.upsert('restaurant_order_items', {
              id: `item-${Date.now()}-${Math.random()}`,
              order_id: orderId,
              menu_item_id: item.menu_item_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_amount,
              special_instructions: item.notes || null,
              created_at: new Date().toISOString()
            });
          }
        }
        await (window as any).electronAPI.sync.queue(
          'pos:createRestaurantOrder', '/restaurant/orders', 'POST', data,
          data.branch_id || 0, localStorage.getItem('token') || ''
        );
        return { success: true, data: { ...orderData, items: data.items }, message: 'Order created successfully (offline)' };
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Offline order failed', data: null };
      }
    }
    return fetchAPI<any>('/restaurant/orders', { method: 'POST', body: JSON.stringify(data) });
  },

  updateOrder: (id: string, data: any) => fetchAPI<any>(`/restaurant/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateOrderStatus: (id: string, status: string) => fetchAPI<any>(`/restaurant/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  addItemsToOrder: (id: string, items: any[]) => fetchAPI<any>(`/restaurant/orders/${id}/items`, { method: 'POST', body: JSON.stringify({ items }) }),

  getTodayOrders: (branchId?: number) => {
    const today = new Date().toISOString().split('T')[0];
    return restaurantAPI.getOrders({ branchId, from_date: today, to_date: today });
  },

  // Menu Management
  getMenuCategories: (branchId?: number) => fetchAPI<any>(`/restaurant/menu/categories${buildQuery({ branch_id: branchId })}`),
  getMenuItems: (categoryId?: string, branchId?: number, onlyAvailable = false) =>
    fetchAPI<any>(`/restaurant/menu/items${buildQuery({ category: categoryId, branch_id: branchId, available: onlyAvailable })}`),
  createMenuItem: (data: any) => fetchAPI<any>('/restaurant/menu/items', { method: 'POST', body: JSON.stringify(data) }),
  updateMenuItem: (id: string, data: any) => fetchAPI<any>(`/restaurant/menu/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMenuItem: (id: string) => fetchAPI<any>(`/restaurant/menu/items/${id}`, { method: 'DELETE' }),
  toggleItemAvailability: (id: string) => fetchAPI<any>(`/restaurant/menu/items/${id}/toggle`, { method: 'PUT' }),

  // Kitchen / Tables
  getTables: (branchId?: number) => fetchAPI<any>(`/restaurant/tables${buildQuery({ branch_id: branchId })}`),
  getKitchenOrders: (branchId?: number) => fetchAPI<any>(`/restaurant/kitchen/orders${buildQuery({ branch_id: branchId })}`),
  markItemReady: (orderId: string, itemId: string) => fetchAPI<any>(`/restaurant/kitchen/orders/${orderId}/items/${itemId}/ready`, { method: 'PUT' }),

  // Billing (Uses Python microservice for PDF generation)
  generateBill: (receiptData: any) => fetchPythonAPI<any>('/receipts/generate/base64', { method: 'POST', body: JSON.stringify(receiptData) }),

  // Reports
  getDailySales: (params?: any) => fetchAPI<any>(`/restaurant/reports/daily-sales${buildQuery(params)}`),

  // Reservations
  getRestaurantReservations: (params?: { branch_id?: number; status?: string; date?: string }) =>
    fetchAPI<any>(`/restaurant/reservations${buildQuery(params)}`),
  createRestaurantReservation: (data: any) => fetchAPI<any>('/restaurant/reservations', { method: 'POST', body: JSON.stringify(data) }),
  confirmRestaurantReservation: (id: string) => fetchAPI<any>(`/restaurant/reservations/${id}/confirm`, { method: 'PUT' }),
  cancelRestaurantReservation: (id: string) => fetchAPI<any>(`/restaurant/reservations/${id}/cancel`, { method: 'PUT' }),

  // POS Extensions
  getTerminals: (branchId?: number) => fetchAPI<any>(`/restaurant/terminals${buildQuery({ branch_id: branchId })}`),
  getCategories: (branchId?: number) => restaurantAPI.getMenuCategories(branchId),
  getWastageItems: (params?: any) => fetchAPI<any[]>(`/restaurant/wastage/items${buildQuery(params)}`),
  getMyOrders: () => fetchAPI<any[]>('/restaurant/my-orders'),

  uploadMenuItemImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return fetchAPI<any>(`/restaurant/menu/items/${id}/image`, { method: 'POST', body: formData });
  },
};

// =====================================
// BAR / DRINKS API
// =====================================

export const barAPI = {
  getOrders: (params?: { branchId?: number; status?: string; from_date?: string; to_date?: string }) =>
    fetchAPI<any>(`/bar/orders${buildQuery({
      branch_id: params?.branchId,
      status: params?.status,
      from_date: params?.from_date,
      to_date: params?.to_date,
    })}`),
  createOrder: (data: any) => fetchAPI<any>('/bar/orders', { method: 'POST', body: JSON.stringify(data) }),

  getCategories: (branchId?: number) => fetchAPI<any>(`/bar/categories${buildQuery({ branch_id: branchId })}`),
  getDrinks: (categoryId?: string, branchId?: number) =>
    fetchAPI<any>(`/bar/drinks${buildQuery({ category_id: categoryId, branch_id: branchId })}`),
  toggleDrinkAvailability: (id: string) => fetchAPI<any>(`/bar/drinks/${id}/toggle`, { method: 'PUT' }),

  getTabs: (branchId?: number, status?: string) => fetchAPI<any>(`/bar/tabs${buildQuery({ branch_id: branchId, status })}`),
  createTab: (data: any) => fetchAPI<any>('/bar/tabs', { method: 'POST', body: JSON.stringify(data) }),
  closeTab: (tabId: string, paymentMethod: string) =>
    fetchAPI<any>(`/bar/tabs/${tabId}/close`, { method: 'POST', body: JSON.stringify({ payment_method: paymentMethod }) }),

  getStock: (branchId?: number) => fetchAPI<any>(`/bar/stock${buildQuery({ branch_id: branchId })}`),
  getLowStockItems: (branchId?: number) => fetchAPI<any>(`/bar/stock-requests/low-stock${buildQuery({ branch_id: branchId })}`),
  
  // Menu Management
  createDrink: (data: any) => fetchAPI<any>('/bar/drinks', { method: 'POST', body: JSON.stringify(data) }),
  updateDrink: (id: string, data: any) => fetchAPI<any>(`/bar/drinks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDrink: (id: string) => fetchAPI<any>(`/bar/drinks/${id}`, { method: 'DELETE' }),
  uploadDrinkImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return fetchAPI<any>(`/bar/drinks/${id}/image`, { method: 'POST', body: formData });
  },
  
  // Category Management
  createCategory: (data: any) => fetchAPI<any>('/bar/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: any) => fetchAPI<any>(`/bar/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) => fetchAPI<any>(`/bar/categories/${id}`, { method: 'DELETE' }),
};

// =====================================
// WASTAGE API
// =====================================

export const wastageAPI = {
  getRecords: (params?: { from_date?: string; to_date?: string; reason?: string }) =>
    fetchAPI<any>(`/restaurant/wastage${buildQuery(params)}`),
  createRecord: (data: any) => fetchAPI<any>('/restaurant/wastage', { method: 'POST', body: JSON.stringify(data) }),
  getSummary: (period = '30d') => fetchAPI<any>(`/restaurant/wastage/summary${buildQuery({ period })}`),

  // Aliases for legacy component satisfaction
  getWastageRecords: (params?: any) => wastageAPI.getRecords(params),
  getWastageSummary: (params?: any) => wastageAPI.getSummary(params?.period),
  createWastageRecord: (data: any) => wastageAPI.createRecord(data),
  updateWastageRecord: (id: string, data: any) => fetchAPI<any>(`/restaurant/wastage/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWastageRecord: (id: string) => fetchAPI<any>(`/restaurant/wastage/${id}`, { method: 'DELETE' }),
};

