'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { API_URL } from '@/lib/config';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ShoppingCart, Plus, RefreshCw, Eye, Check, X, Clock, 
  Search, Filter, Package, Building2, Calendar, FileText,
  Truck, AlertTriangle, CheckCircle, XCircle, Edit, Trash2, Download, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { downloadPurchaseOrderPDF, printPurchaseOrderPDF } from '@/lib/purchase-order-pdf';


interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: number;
  supplier?: { id: number; name: string; contact_person?: string };
  status: string;
  total_amount: number;
  expected_delivery?: string;
  notes?: string;
  items: POItem[];
  created_at: string;
  created_by?: string;
}

interface POItem {
  id?: string;
  item_id: number;
  item?: { id: number; name: string; sku: string };
  quantity: number;
  unit_price: number;
  total: number;
}

interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
}

interface StoreItem {
  id?: number;
  sku: string;
  name?: string;
  description?: string;
  cost_price?: number;
  unit_price?: number;
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PurchaseOrdersContent />
    </Suspense>
  );
}

function PurchaseOrdersContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    supplier_id: '',
    expected_delivery: '',
    notes: '',
    items: [{ item_id: '', quantity: 1, unit_price: 0 }],
    auto_approve: true // Default to true for simplified workflow
  });

  useEffect(() => {
    fetchData();
    
    // Check for supplier_id in URL to auto-open creation
    const supplierId = searchParams.get('supplier_id');
    const autoCreate = searchParams.get('auto_create');
    if (supplierId && autoCreate === 'true') {
      setFormData(prev => ({ ...prev, supplier_id: supplierId }));
      setIsCreateModalOpen(true);
    }
  }, [statusFilter, searchParams]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [ordersRes, suppliersRes, itemsRes] = await Promise.all([
        fetch(`${API_URL}/api/store/purchase-orders?source_module=branch_store${statusFilter ? `&status=${statusFilter}` : ''}`, { headers }),
        fetch(`${API_URL}/api/store/suppliers?scope=branch`, { headers }), // BRANCH SPECIFIC SUPPLIERS
        fetch(`${API_URL}/api/store/items?limit=500`, { headers })
      ]);
      
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.data || []);
      }
      if (suppliersRes.ok) {
        const data = await suppliersRes.json();
        setSuppliers(data.data || []);
      }
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    try {
      const token = localStorage.getItem('token');
      const poDate = new Date().toISOString().split('T')[0];
      
      // Validate expected delivery date
      if (formData.expected_delivery && formData.expected_delivery < poDate) {
        toast.error('Expected delivery date cannot be before today');
        return;
      }
      
      const response = await fetch(`${API_URL}/api/store/purchase-orders?source_module=branch_store`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supplier_id: formData.supplier_id,
          po_date: poDate,
          expected_delivery_date: formData.expected_delivery || null,
          special_instructions: formData.notes || null,
          auto_approve: formData.auto_approve,
          items: formData.items.filter(i => i.item_id).map(i => ({
            item_id: i.item_id,
            quantity: i.quantity,
            unit_price: i.unit_price
          }))
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (formData.auto_approve) {
          toast.success('Purchase order created and approved automatically');
        } else {
          toast.success('Purchase order created');
        }
        setIsCreateModalOpen(false);
        setFormData({ supplier_id: '', expected_delivery: '', notes: '', items: [{ item_id: '', quantity: 1, unit_price: 0 }], auto_approve: true });
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.error || 'Failed to create order');
      }
    } catch (error) {
      toast.error('Failed to create order');
    }
  };

  const handleApprove = async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/purchase-orders/${orderId}/approve?source_module=branch_store`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('Order approved');
        fetchData();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || err.message || 'Failed to approve order');
      }
    } catch (error) {
      toast.error('Failed to approve order');
    }
  };

  const handleReceive = async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/purchase-orders/${orderId}/receive?source_module=branch_store`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('Order received - stock updated');
        fetchData();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || err.message || 'Failed to receive order');
      }
    } catch (error) {
      toast.error('Failed to receive order');
    }
  };

  const handlePrintPO = async (order: PurchaseOrder) => {
    try {
      await printPurchaseOrderPDF(order as any);
      toast.success('Opening print dialog...');
    } catch (error) {
      toast.error('Failed to print purchase order');
      console.error('Print error:', error);
    }
  };

  const handleDownloadPO = async (order: PurchaseOrder) => {
    try {
      await downloadPurchaseOrderPDF(order as any);
      toast.success('Purchase order downloaded');
    } catch (error) {
      toast.error('Failed to download purchase order');
      console.error('Download error:', error);
    }
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_id: '', quantity: 1, unit_price: 0 }]
    }));
  };

  const removeItemRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItemRow = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value };
          if (field === 'item_id') {
            const selectedItem = items.find(it => (it.sku || it.id) === value);
            if (selectedItem) {
              updated.unit_price = selectedItem.cost_price || (selectedItem as any).unit_price || 0;
            }
          }
          return updated;
        }
        return item;
      })
    }));
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'DRAFT': 'bg-gray-100 text-gray-700',
      'PENDING': 'bg-[#F2F2F7] text-[#3C3C43]',
      'APPROVED': 'bg-[#F2F2F7] text-[#000000]',
      'ORDERED': 'bg-[#F2F2F7] text-[#3C3C43]',
      'RECEIVED': 'bg-[#F2F2F7] text-[#000000]',
      'CANCELLED': 'bg-[#F2F2F7] text-[#000000]'
    };
    return colors[status] || 'bg-gray-100';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      'DRAFT': <FileText className="h-4 w-4" />,
      'PENDING': <Clock className="h-4 w-4" />,
      'APPROVED': <CheckCircle className="h-4 w-4" />,
      'ORDERED': <Truck className="h-4 w-4" />,
      'RECEIVED': <Package className="h-4 w-4" />,
      'CANCELLED': <XCircle className="h-4 w-4" />
    };
    return icons[status] || <Clock className="h-4 w-4" />;
  };

  const filteredOrders = orders.filter(o => 
    o.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOrderValue = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const canManage = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShoppingCart className="h-6 w-6 text-[#3C3C43]" />
                Purchase Orders
              </h1>
              <p className="text-gray-600">Manage stock procurement and orders</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </IOSButton>
              {canManage && (
                <IOSButton onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus />}>
                  New Order
                </IOSButton>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold">{orders.filter(o => o.status === 'PENDING').length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-[#8E8E93]0" />
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-2xl font-bold">{orders.filter(o => o.status === 'APPROVED').length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <Truck className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm text-gray-500">On Order</p>
                  <p className="text-2xl font-bold">{orders.filter(o => o.status === 'ORDERED').length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-[#8E8E93]0" />
                <div>
                  <p className="text-sm text-gray-500">Received</p>
                  <p className="text-2xl font-bold">{orders.filter(o => o.status === 'RECEIVED').length}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-ios-lg px-3 py-2"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="ORDERED">On Order</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </IOSCard>

          {/* Orders Table */}
          <IOSCard>
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No purchase orders found</p>
                {canManage && <IOSButton className="mt-4" onClick={() => setIsCreateModalOpen(true)}>Create First Order</IOSButton>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm font-medium">{order.po_number}</td>
                        <td className="px-4 py-4">{order.supplier?.name || '-'}</td>
                        <td className="px-4 py-4">
                          <IOSBadge className={getStatusColor(order.status)}>
                            <span className="flex items-center gap-1">{getStatusIcon(order.status)} {order.status}</span>
                          </IOSBadge>
                        </td>
                        <td className="px-4 py-4 text-right font-medium">KES {order.total_amount?.toLocaleString() || 0}</td>
                        <td className="px-4 py-4 text-sm">{order.expected_delivery ? formatDate(order.expected_delivery) : '-'}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{formatDate(order.created_at)}</td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2 flex-wrap">
                            <IOSButton size="sm" variant="outline" onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }} title="View Details">
                              <Eye className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton size="sm" variant="outline" onClick={() => handlePrintPO(order)} title="Print PO">
                              <Printer className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton size="sm" variant="outline" onClick={() => handleDownloadPO(order)} title="Download PDF">
                              <Download className="h-4 w-4" />
                            </IOSButton>
                            {order.status === 'PENDING' && canManage && (
                              <IOSButton size="sm" className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={() => handleApprove(order.id)}>
                                <Check className="h-4 w-4" />
                              </IOSButton>
                            )}
                            {order.status === 'APPROVED' && canManage && (
                              <IOSButton size="sm" className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={() => handleReceive(order.id)} leftIcon={<Package />}>
                                Receive
                              </IOSButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </IOSCard>
        </div>

        {/* Create Order Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Create Purchase Order
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 uppercase tracking-wide">
                    <Building2 className="inline h-4 w-4 mr-1" />
                    Supplier *
                  </label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                    className="w-full border-2 border-gray-300 focus:border-blue-500 rounded-lg px-4 py-3 text-sm font-medium bg-white"
                  >
                    <option value="">-- Select Branch Supplier --</option>
                    {suppliers.map((supplier, idx) => (
                      <option 
                        key={`supplier-${supplier.id ?? idx}`} 
                        value={supplier.id}
                      >
                        {supplier.name} {supplier.contact_person ? `(${supplier.contact_person})` : ''}
                      </option>
                    ))}
                  </select>
                  {suppliers.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      No suppliers available for your branch
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 uppercase tracking-wide">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Expected Delivery
                  </label>
                  <Input
                    type="date"
                    value={formData.expected_delivery}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="border-2 border-gray-300 focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold">Order Items *</label>
                  <IOSButton size="sm" variant="outline" onClick={addItemRow} leftIcon={<Plus />}>
                    Add Item
                  </IOSButton>
                </div>
                
                <div className="space-y-3">
                  {formData.items.map((item, index) => {
                    const selectedItem = items.find(it => (it.sku || it.id) === item.item_id);
                    const filteredItems = items.filter(storeItem => 
                      !itemSearchTerm || 
                      ((storeItem as any).description || storeItem.name || '')?.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
                      storeItem.sku?.toLowerCase().includes(itemSearchTerm.toLowerCase())
                    );
                    
                    return (
                      <div key={`po-item-${item.item_id || 'new'}-${index}`} className="bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-gray-200 p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start gap-3">
                          {/* Item Selection Section */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="h-4 w-4 text-blue-600" />
                              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                Item Selection
                              </label>
                            </div>
                            
                            {/* Search Input */}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                type="text"
                                placeholder="🔍 Type item name or SKU to search..."
                                value={itemSearchTerm}
                                onChange={(e) => setItemSearchTerm(e.target.value)}
                                className="pl-10 bg-white border-2 border-gray-300 focus:border-blue-500 rounded-lg text-sm font-medium"
                              />
                            </div>
                            
                            {/* Dropdown with filtered results */}
                            {itemSearchTerm && (
                              <div className="max-h-48 overflow-y-auto border-2 border-blue-200 rounded-lg bg-white shadow-lg">
                                {filteredItems.length > 0 ? (
                                  filteredItems.map((storeItem, itemIndex) => (
                                    <button
                                      key={`store-item-${storeItem.sku ?? itemIndex}`}
                                      type="button"
                                      onClick={() => {
                                        updateItemRow(index, 'item_id', storeItem.sku || storeItem.id);
                                        setItemSearchTerm('');
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="font-semibold text-gray-900 text-sm">
                                            {(storeItem as any).description || storeItem.name}
                                          </p>
                                          <p className="text-xs text-gray-500 mt-0.5">
                                            SKU: {storeItem.sku}
                                          </p>
                                        </div>
                                        <div className="text-xs text-blue-600 font-medium">
                                          Select →
                                        </div>
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-4 py-6 text-center text-gray-500 text-sm">
                                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    No items found matching "{itemSearchTerm}"
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Selected Item Display */}
                            {selectedItem ? (
                              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                      <span className="text-xs font-semibold text-green-700 uppercase">Selected Item</span>
                                    </div>
                                    <p className="font-bold text-gray-900 text-sm">
                                      {(selectedItem as any).description || selectedItem.name}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                      SKU: <span className="font-mono font-semibold">{selectedItem.sku}</span>
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => updateItemRow(index, 'item_id', '')}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3 text-center">
                                <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-yellow-600" />
                                <p className="text-xs text-yellow-700 font-medium">
                                  Please search and select an item
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* Quantity & Price Section */}
                          <div className="flex flex-col gap-3 min-w-[280px]">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase tracking-wide">
                                  Quantity
                                </label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={item.quantity}
                                  onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value) || 0)}
                                  className="text-center font-bold text-lg border-2 border-gray-300 focus:border-blue-500"
                                  min="1"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase tracking-wide">
                                  Unit Price
                                </label>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={item.unit_price}
                                  onChange={(e) => updateItemRow(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                  className="text-center font-bold text-lg border-2 border-gray-300 focus:border-blue-500"
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                            </div>
                            
                            {/* Line Total */}
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                              <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">Line Total</p>
                              <p className="text-2xl font-bold text-blue-900">
                                KES {(item.quantity * item.unit_price).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                            
                            {/* Remove Button */}
                            {formData.items.length > 1 && (
                              <IOSButton 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => removeItemRow(index)}
                                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border-2 border-red-200"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Item
                              </IOSButton>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Grand Total */}
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border-3 border-green-300 rounded-xl p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500 rounded-full p-2">
                          <Package className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Grand Total</p>
                          <p className="text-xs text-gray-500">{formData.items.length} item(s)</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-green-700">
                          KES {totalOrderValue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 uppercase tracking-wide">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Additional Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full border-2 border-gray-300 focus:border-blue-500 rounded-lg px-4 py-3 text-sm"
                  rows={3}
                  placeholder="Add any special instructions or notes for this purchase order..."
                />
              </div>

              {/* Auto-Approve Option */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_approve}
                    onChange={(e) => setFormData(prev => ({ ...prev, auto_approve: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-gray-900">Auto-Approve Purchase Order</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Automatically approve this PO upon creation (skips pending approval status)
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-200">
                <IOSButton 
                  variant="outline" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </IOSButton>
                <IOSButton 
                  onClick={handleCreateOrder} 
                  disabled={!formData.supplier_id || !formData.items.some(i => i.item_id)}
                  className="px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {formData.auto_approve ? 'Create & Approve' : 'Create Purchase Order'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Order Modal */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Purchase Order: {selectedOrder?.po_number}
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Supplier</p>
                    <p className="font-medium">{selectedOrder.supplier?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <IOSBadge className={getStatusColor(selectedOrder.status)}>{selectedOrder.status}</IOSBadge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="font-medium">{formatDate(selectedOrder.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Expected Delivery</p>
                    <p className="font-medium">{selectedOrder.expected_delivery ? formatDate(selectedOrder.expected_delivery) : '-'}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Order Items</p>
                  <div className="border rounded-ios-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Price</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(selectedOrder.items || []).map((item, idx) => (
                          <tr key={`selected-item-${item.id ?? item.item_id ?? idx}`}>
                            <td className="px-3 py-2">{item.item?.name || `Item #${item.item_id}`}</td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">KES {item.unit_price?.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-medium">KES {item.total?.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-bold">Total:</td>
                          <td className="px-3 py-2 text-right font-bold">KES {selectedOrder.total_amount?.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="text-sm">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
