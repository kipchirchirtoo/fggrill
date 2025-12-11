'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
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
  Truck, AlertTriangle, CheckCircle, XCircle, Edit, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
  id: number;
  name: string;
  sku: string;
  cost_price?: number;
}

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    supplier_id: '',
    expected_delivery: '',
    notes: '',
    items: [{ item_id: '', quantity: 1, unit_price: 0 }]
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [ordersRes, suppliersRes, itemsRes] = await Promise.all([
        fetch(`${API_URL}/api/store/purchase-orders${statusFilter ? `?status=${statusFilter}` : ''}`, { headers }),
        fetch(`${API_URL}/api/store/suppliers`, { headers }),
        fetch(`${API_URL}/api/store/items`, { headers })
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
      const response = await fetch(`${API_URL}/api/store/purchase-orders`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          items: formData.items.filter(i => i.item_id).map(i => ({
            item_id: parseInt(i.item_id),
            quantity: i.quantity,
            unit_price: i.unit_price,
            total: i.quantity * i.unit_price
          }))
        })
      });
      
      if (response.ok) {
        toast.success('Purchase order created');
        setIsCreateModalOpen(false);
        setFormData({ supplier_id: '', expected_delivery: '', notes: '', items: [{ item_id: '', quantity: 1, unit_price: 0 }] });
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
      const response = await fetch(`${API_URL}/api/store/purchase-orders/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('Order approved');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to approve order');
    }
  };

  const handleReceive = async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/purchase-orders/${orderId}/receive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('Order received - stock updated');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to receive order');
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
            const selectedItem = items.find(it => it.id === parseInt(value));
            if (selectedItem) {
              updated.unit_price = selectedItem.cost_price || 0;
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
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
                          <div className="flex gap-2">
                            <IOSButton size="sm" variant="outline" onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}>
                              <Eye className="h-4 w-4" />
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
                  <label className="block text-sm font-medium mb-1">Supplier *</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                    className="w-full border rounded-ios-lg px-3 py-2"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((supplier, idx) => (
                      <option 
                        key={`supplier-${supplier.id ?? idx}`} 
                        value={supplier.id}
                      >
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expected Delivery</label>
                  <Input
                    type="date"
                    value={formData.expected_delivery}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected_delivery: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Order Items *</label>
                  <IOSButton size="sm" variant="outline" onClick={addItemRow} leftIcon={<Plus />}>Add Item</IOSButton>
                </div>
                <div className="space-y-2 border rounded-ios-lg p-3 bg-gray-50">
                  {formData.items.map((item, index) => (
                    <div key={`po-item-${item.item_id || 'new'}-${index}`} className="flex items-center gap-2">
                      <select
                        value={item.item_id}
                        onChange={(e) => updateItemRow(index, 'item_id', e.target.value)}
                        className="flex-1 border rounded-ios-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select Item</option>
                        {items.map((storeItem, itemIndex) => (
                          <option 
                            key={`store-item-${storeItem.id ?? itemIndex}`} 
                            value={storeItem.id}
                          >
                            {storeItem.name} ({storeItem.sku})
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                      <Input
                        type="number"
                        placeholder="Price"
                        value={item.unit_price}
                        onChange={(e) => updateItemRow(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-28"
                      />
                      <span className="text-sm font-medium w-24 text-right">
                        KES {(item.quantity * item.unit_price).toLocaleString()}
                      </span>
                      {formData.items.length > 1 && (
                        <IOSButton size="sm" variant="ghost" onClick={() => removeItemRow(index)}>
                          <X className="h-4 w-4 text-[#8E8E93]0" />
                        </IOSButton>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end pt-2 border-t">
                    <span className="font-bold">Total: KES {totalOrderValue.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full border rounded-ios-lg px-3 py-2"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <IOSButton variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</IOSButton>
                <IOSButton onClick={handleCreateOrder} disabled={!formData.supplier_id || !formData.items.some(i => i.item_id)}>
                  Create Order
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
