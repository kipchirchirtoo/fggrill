import { nodeClient } from './nodeClient';
import { pythonClient } from './pythonClient';
import { bridge } from '../../bridge';

/**
 * Unified API interface for the Desktop App.
 * Mirrors the production frontend's lib/api.ts structure but adapts
 * for the Tauri hybrid offline-first architecture.
 */

// =====================================================
// RESTAURANT API
// =====================================================
export const restaurantAPI = {
  getOrders: (params?: any) => nodeClient.get('/restaurant/orders', params),
  
  getTodayOrders: async (branchId?: number) => {
    // Attempt local query first for offline-first speed
    try {
      const today = new Date().toISOString().split('T')[0];
      const orders = await bridge.data.queryLocal('restaurant_orders', JSON.stringify({ branch_id: branchId, date: today }));
      if (orders) return { success: true, data: orders };
    } catch (e) {
      console.warn('Local query failed, falling back to network', e);
    }
    return nodeClient.get('/restaurant/orders', { branch_id: branchId, from_date: new Date().toISOString().split('T')[0] });
  },

  createOrder: async (data: any) => {
    // Use the bridge to support offline queuing
    return bridge.data.mutate({
      entity: 'restaurant_orders',
      operation: 'CREATE',
      endpoint: '/restaurant/orders',
      method: 'POST',
      payload: data
    });
  },

  addItemsToOrder: async (orderId: string, items: any[]) => {
    return bridge.data.mutate({
      entity: 'restaurant_orders',
      operation: 'UPDATE',
      endpoint: `/restaurant/orders/${orderId}/items`,
      method: 'POST',
      payload: { items }
    });
  },

  updateOrderStatus: async (id: string, status: string) => {
    return bridge.data.mutate({
      entity: 'restaurant_orders',
      operation: 'UPDATE',
      endpoint: `/restaurant/orders/${id}/status`,
      method: 'PUT',
      payload: { status }
    });
  },

  getCategories: (branchId?: number) => nodeClient.get('/restaurant/menu/categories', { branch_id: branchId }),
  
  getMenuItems: (categoryId?: string, branchId?: number) => 
    nodeClient.get('/restaurant/menu/items', { category: categoryId, branch_id: branchId }),

  getTables: (branchId?: number) => nodeClient.get('/restaurant/tables', { branch_id: branchId }),
  
  getKitchenOrders: (branchId?: number) => nodeClient.get('/restaurant/kitchen/orders', { branch_id: branchId }),
  
  generateBill: (receiptData: any) => pythonClient.post('/receipts/generate/base64', receiptData),
};

// =====================================================
// BAR API
// =====================================================
export const barAPI = {
  getOrders: (params?: any) => nodeClient.get('/bar/orders', params),
  
  createOrder: async (data: any) => {
    return bridge.data.mutate({
      entity: 'bar_orders',
      operation: 'CREATE',
      endpoint: '/bar/orders',
      method: 'POST',
      payload: data
    });
  },

  addToTab: async (tabId: string, items: any[]) => {
    return bridge.data.mutate({
      entity: 'bar_tabs',
      operation: 'UPDATE',
      endpoint: `/bar/tabs/${tabId}/items`,
      method: 'POST',
      payload: { items }
    });
  },

  updateOrderStatus: async (id: string, status: string) => {
    return bridge.data.mutate({
      entity: 'bar_orders',
      operation: 'UPDATE',
      endpoint: `/bar/orders/${id}/status`,
      method: 'PUT',
      payload: { status }
    });
  },

  getCategories: (branchId?: number) => nodeClient.get('/bar/categories', { branch_id: branchId }),
  
  getDrinks: (categoryId?: string, branchId?: number) => 
    nodeClient.get('/bar/drinks', { category_id: categoryId, branch_id: branchId }),
};

// =====================================================
// FINANCE API
// =====================================================
export const financeAPI = {
  getDashboard: (branchId?: number) => nodeClient.get('/finance/dashboard', { branch_id: branchId }),
  getTransactions: (params?: any) => nodeClient.get('/finance/transactions', params),
  getReports: (params?: any) => nodeClient.get('/finance/reports', params),
};

// =====================================================
// STAFF API
// =====================================================
export const staffAPI = {
  getWaiters: (branchId?: number) => nodeClient.get('/staff/waiters', { branch_id: branchId }),
  getClockedInStaff: (branchId?: number) => nodeClient.get('/staff/clocked-in', { branch_id: branchId }),
  getStaff: (branchId?: number) => nodeClient.get('/staff', { branch_id: branchId }),
  getLeaveRequests: (params?: any) => nodeClient.get('/staff/leave-requests', params),
};

// =====================================================
// AUDIT API
// =====================================================
export const auditAPI = {
  getAuditLogs: (params?: any) => nodeClient.get('/audit/logs', params),
  verifyRevenue: (params?: any) => nodeClient.get('/audit/revenue/verify', params),
  getAnomalies: (params?: any) => nodeClient.get('/audit/anomalies', params),
};

// =====================================================
// STORE API
// =====================================================
export const storeAPI = {
  getBranchRequests: (status?: string, branchId?: number) => 
    nodeClient.get('/store/requests', { status, branch_id: branchId }),
  getStockItems: (branchId?: number) => nodeClient.get('/store/stock', { branch_id: branchId }),
};

// =====================================================
// BOOKINGS API
// =====================================================
export const bookingsAPI = {
  getBookings: (params?: any) => nodeClient.get('/bookings', params),
  getBooking: (id: string) => nodeClient.get(`/bookings/${id}`),
};

// =====================================================
// HOUSEKEEPING API
// =====================================================
export const housekeepingAPI = {
  getTasks: (params?: any) => nodeClient.get('/housekeeping/tasks', params),
};

// =====================================================
// NOTIFICATIONS API
// =====================================================
export const notificationsAPI = {
  getNotifications: () => nodeClient.get('/notifications'),
};

// =====================================================
// SYSTEM API
// =====================================================
export const systemAPI = {
  getBranches: () => nodeClient.get('/system/branches'),
  getDepartments: () => nodeClient.get('/system/departments'),
};

// =====================================================
// PROCUREMENT API
// =====================================================
export const procurementAPI = {
  getSuppliers: () => nodeClient.get('/procurement/suppliers'),
};

// =====================================================
// RECEIPTS API (Python)
// =====================================================
export const receiptsAPI = {
  printReceipt: (data: any) => pythonClient.post('/receipts/printer/print', data),
  getPrinterStatus: () => pythonClient.get('/receipts/printer/status'),
};
