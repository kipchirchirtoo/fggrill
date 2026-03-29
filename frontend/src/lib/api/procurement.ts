import { fetchAPI, buildQuery, getHeaders, API_URL } from './core';

// =====================================
// PROCUREMENT API
// =====================================

export const procurementAPI = {
  // Supplier Aliases (Anti-Regression Adapters)
  getSuppliers: (params?: { status?: string; category?: string; search?: string }) => fetchAPI<any>(`/suppliers${buildQuery(params)}`),
  getSupplier:  (id: string) => fetchAPI<any>(`/suppliers/${id}`),

  // Purchase Orders
  getPurchaseOrders: (params?: { 
    supplier_id?: string; 
    status?: string; 
    from_date?: string; 
    to_date?: string;
    limit?: number;
    page?: number;
  }) =>
    fetchAPI<any>(`/procurement/purchase-orders${buildQuery(params)}`),
  getPurchaseOrder:  (id: string) => fetchAPI<any>(`/procurement/purchase-orders/${id}`),
  createPurchaseOrder: (data: any) => fetchAPI<any>('/procurement/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  updatePurchaseOrder: (id: string, data: any) => fetchAPI<any>(`/procurement/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  approvePurchaseOrder:(id: string) => fetchAPI<any>(`/procurement/purchase-orders/${id}/approve`, { method: 'PUT' }),
  cancelPurchaseOrder: (id: string) => fetchAPI<any>(`/procurement/purchase-orders/${id}/cancel`,  { method: 'PUT' }),
  deletePurchaseOrder: (id: string) => fetchAPI<any>(`/procurement/purchase-orders/${id}`,         { method: 'DELETE' }),

  // GRNs
  getGRNs:    (params?: { supplier_id?: string; status?: string; po_id?: string; from_date?: string; to_date?: string }) =>
    fetchAPI<any>(`/procurement/grn${buildQuery(params)}`),
  getGRN:     (id: string) => fetchAPI<any>(`/procurement/grn/${id}`),
  createGRN:  (data: any)  => fetchAPI<any>('/procurement/grn', { method: 'POST', body: JSON.stringify(data) }),
  approveGRN: (id: string) => fetchAPI<any>(`/procurement/grn/${id}/approve`, { method: 'PUT' }),
  cancelGRN:  (id: string, reason?: string) =>
    fetchAPI<any>(`/procurement/grn/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }) }),

  // Invoices
  getInvoices:    (params?: { supplier_id?: string; status?: string }) =>
    fetchAPI<any>(`/procurement/invoices${buildQuery(params)}`),
  getInvoice:     (id: string) => fetchAPI<any>(`/procurement/invoices/${id}`),
  createInvoice:  (data: any)  => fetchAPI<any>('/procurement/invoices', { method: 'POST', body: JSON.stringify(data) }),
  approveInvoice: (id: string) => fetchAPI<any>(`/procurement/invoices/${id}/approve`, { method: 'PUT' }),
  rejectInvoice:  (id: string, reason: string) =>
    fetchAPI<any>(`/procurement/invoices/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),

  // Payments
  getPayments:   (params?: { supplier_id?: string; status?: string }) =>
    fetchAPI<any>(`/procurement/payments${buildQuery(params)}`),
  createPayment: (data: any) => fetchAPI<any>('/procurement/payments', { method: 'POST', body: JSON.stringify(data) }),

  // Ledger & Performance
  getSupplierLedger:      (supplierId: string) => fetchAPI<any>(`/procurement/ledger/${supplierId}`),
  getSupplierPerformance: (supplierId: string) => fetchAPI<any>(`/procurement/performance/${supplierId}`),

  // Reports
  getVATReport:     (params: { from_date: string; to_date: string; supplier_id?: string }) =>
    fetchAPI<any>(`/procurement/reports/vat${buildQuery(params)}`),
  getGRNIReport:    (params?: { status?: string }) =>
    fetchAPI<any>(`/procurement/reports/grni${buildQuery(params)}`),
  getAgingAnalysis: (params?: { supplier_id?: string }) =>
    fetchAPI<any>(`/procurement/reports/aging${buildQuery(params)}`),
  getAuditTrail:    (params?: { supplier_id?: string; entity_type?: string; entity_id?: string; from_date?: string; to_date?: string }) =>
    fetchAPI<any>(`/procurement/reports/audit-trail${buildQuery(params)}`),

  // PDF Exports
  exportSupplierStatement: (filters: any) =>
    import('./reports').then(m => m.reportsAPI.exportPdf('supplier_statement', filters)),
  exportVATReportPDF: (filters: any) =>
    import('./reports').then(m => m.reportsAPI.exportPdf('vat_report', filters)),
};

// =====================================================
// SUPPLIERS API
// =====================================

export const suppliersAPI = {
  getSuppliers:   (params?: { status?: string; category?: string; search?: string }) =>
    fetchAPI<any>(`/suppliers${buildQuery(params)}`),
  getSupplierById:   (id: string) => fetchAPI<any>(`/suppliers/${id}`),
  createSupplier:    (data: any)  => fetchAPI<any>('/suppliers',       { method: 'POST',   body: JSON.stringify(data) }),
  updateSupplier:    (id: string, data: any) => fetchAPI<any>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier:    (id: string) => fetchAPI<any>(`/suppliers/${id}`, { method: 'DELETE' }),

  getSupplierProducts:  (supplierId: string) => fetchAPI<any>(`/suppliers/${supplierId}/products`),
  addSupplierProduct:   (supplierId: string, data: any) =>
    fetchAPI<any>(`/suppliers/${supplierId}/products`, { method: 'POST', body: JSON.stringify(data) }),
  updateSupplierProduct:(productId: string, data: any) =>
    fetchAPI<any>(`/suppliers/products/${productId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplierProduct:(productId: string) =>
    fetchAPI<any>(`/suppliers/products/${productId}`, { method: 'DELETE' }),

  getSupplierPerformance: (supplierId: string, params?: { startDate?: string; endDate?: string }) =>
    fetchAPI<any>(`/suppliers/${supplierId}/performance${buildQuery(params)}`),
};
