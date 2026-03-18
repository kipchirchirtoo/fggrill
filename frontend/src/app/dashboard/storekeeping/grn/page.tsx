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
  ClipboardCheck, Plus, RefreshCw, Eye, Check, X, Clock, 
  Search, Package, Building2, Calendar, FileText, Truck,
  AlertTriangle, CheckCircle, Camera, Barcode
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';


interface GRN {
  id: string;
  grn_number: string;
  po_id?: string;
  purchase_order?: { po_number: string };
  supplier_id: number;
  supplier?: { id: number; name: string };
  status: string;
  received_by?: string;
  received_at?: string;
  total_items: number;
  total_value: number;
  notes?: string;
  items: GRNItem[];
  created_at: string;
}

interface GRNItem {
  id?: string;
  item_id: number;
  item?: { id: number; name: string; sku: string };
  ordered_quantity: number;
  received_quantity: number;
  unit_price: number;
  condition: string;
  batch_number?: string;
  expiry_date?: string;
  notes?: string;
}

interface Supplier {
  id: number;
  name: string;
}

interface StoreItem {
  id: number;
  name: string;
  sku: string;
  cost_price?: number;
}

export default function GRNPage() {
  const { user } = useAuth();
  const [grns, setGrns] = useState<GRN[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  
  const [formData, setFormData] = useState({
    supplier_id: '',
    po_id: '',
    notes: '',
    items: [{ item_id: '', ordered_quantity: 0, received_quantity: 0, unit_price: 0, condition: 'GOOD', batch_number: '', expiry_date: '' }]
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [grnsRes, suppliersRes, itemsRes] = await Promise.all([
        fetch(`${API_URL}/api/store/grn${statusFilter ? `?status=${statusFilter}` : ''}`, { headers }),
        fetch(`${API_URL}/api/store/suppliers`, { headers }),
        fetch(`${API_URL}/api/store/items`, { headers })
      ]);
      
      if (grnsRes.ok) {
        const data = await grnsRes.json();
        setGrns(data.data || []);
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

  const handleCreateGRN = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/grn`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          items: formData.items.filter(i => i.item_id).map(i => ({
            item_id: parseInt(i.item_id),
            ordered_quantity: i.ordered_quantity,
            received_quantity: i.received_quantity,
            unit_price: i.unit_price,
            condition: i.condition,
            batch_number: i.batch_number || null,
            expiry_date: i.expiry_date || null
          }))
        })
      });
      
      if (response.ok) {
        toast.success('GRN created - stock updated');
        setIsCreateModalOpen(false);
        resetForm();
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.error || 'Failed to create GRN');
      }
    } catch (error) {
      toast.error('Failed to create GRN');
    }
  };

  const handleComplete = async (grnId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/grn/${grnId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('GRN completed');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to complete GRN');
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      po_id: '',
      notes: '',
      items: [{ item_id: '', ordered_quantity: 0, received_quantity: 0, unit_price: 0, condition: 'GOOD', batch_number: '', expiry_date: '' }]
    });
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { item_id: '', ordered_quantity: 0, received_quantity: 0, unit_price: 0, condition: 'GOOD', batch_number: '', expiry_date: '' }]
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
      'PARTIAL': 'bg-[#F2F2F7] text-[#3C3C43]',
      'COMPLETED': 'bg-[#F2F2F7] text-[#000000]',
      'CANCELLED': 'bg-[#F2F2F7] text-[#000000]'
    };
    return colors[status] || 'bg-gray-100';
  };

  const getConditionColor = (condition: string) => {
    const colors: Record<string, string> = {
      'GOOD': 'bg-[#F2F2F7] text-[#000000]',
      'DAMAGED': 'bg-[#F2F2F7] text-[#000000]',
      'EXPIRED': 'bg-[#F2F2F7] text-[#3C3C43]',
      'REJECTED': 'bg-[#F2F2F7] text-[#000000]'
    };
    return colors[condition] || 'bg-gray-100';
  };

  const filteredGRNs = grns.filter(g => 
    g.grn_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalReceivedValue = formData.items.reduce((sum, item) => sum + (item.received_quantity * item.unit_price), 0);

  const canManage = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardCheck className="h-6 w-6 text-[#3C3C43]" />
                Goods Received Notes
              </h1>
              <p className="text-gray-600">Record and track stock receipts</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </IOSButton>
              {canManage && (
                <IOSButton onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus />}>
                  New GRN
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
                  <p className="text-2xl font-bold">{grns.filter(g => g.status === 'PENDING').length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm text-gray-500">Partial</p>
                  <p className="text-2xl font-bold">{grns.filter(g => g.status === 'PARTIAL').length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-[#8E8E93]0" />
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-bold">{grns.filter(g => g.status === 'COMPLETED').length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-[#8E8E93]0" />
                <div>
                  <p className="text-sm text-gray-500">Total Items Received</p>
                  <p className="text-2xl font-bold">{grns.reduce((sum, g) => sum + (g.total_items || 0), 0)}</p>
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
                  placeholder="Search GRNs..."
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
                <option value="PARTIAL">Partial</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </IOSCard>

          {/* GRN Table */}
          <IOSCard>
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">Loading GRNs...</div>
            ) : filteredGRNs.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No goods received notes found</p>
                {canManage && <IOSButton className="mt-4" onClick={() => setIsCreateModalOpen(true)}>Create First GRN</IOSButton>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GRN Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Ref</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredGRNs.map((grn) => (
                      <tr key={grn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm font-medium">{grn.grn_number}</td>
                        <td className="px-4 py-4">{grn.supplier?.name || '-'}</td>
                        <td className="px-4 py-4 text-sm">{grn.purchase_order?.po_number || '-'}</td>
                        <td className="px-4 py-4">
                          <IOSBadge className={getStatusColor(grn.status)}>{grn.status}</IOSBadge>
                        </td>
                        <td className="px-4 py-4 text-center">{grn.total_items}</td>
                        <td className="px-4 py-4 text-right font-medium">KES {grn.total_value?.toLocaleString() || 0}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{grn.received_at ? formatDateTime(grn.received_at) : formatDate(grn.created_at)}</td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <IOSButton size="sm" variant="outline" onClick={() => { setSelectedGRN(grn); setIsViewModalOpen(true); }}>
                              <Eye className="h-4 w-4" />
                            </IOSButton>
                            {grn.status === 'PENDING' && canManage && (
                              <IOSButton size="sm" className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={() => handleComplete(grn.id)}>
                                <Check className="h-4 w-4" />
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

        {/* Create GRN Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Record Goods Received
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
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PO Reference (Optional)</label>
                  <Input
                    value={formData.po_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, po_id: e.target.value }))}
                    placeholder="PO number if applicable"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Items Received *</label>
                <div className="space-y-4 border rounded-ios-lg p-4 bg-gray-50">
                  {formData.items.map((item, index) => (
                    <div key={index} className="bg-[#FFFFFF] rounded-ios-lg p-4 border shadow-none 0_1px_3px_rgba(0,0,0,0.04)] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Item #{index + 1}</span>
                        {formData.items.length > 1 && (
                          <IOSButton size="sm" variant="ghost" onClick={() => removeItemRow(index)}>
                            <X className="h-4 w-4 text-[#8E8E93]0" />
                          </IOSButton>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Item</label>
                          <select
                            value={item.item_id}
                            onChange={(e) => updateItemRow(index, 'item_id', e.target.value)}
                            className="w-full border rounded-ios-lg px-3 py-2 text-sm"
                          >
                            <option value="">Select Item</option>
                            {items.map(i => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Condition</label>
                          <select
                            value={item.condition}
                            onChange={(e) => updateItemRow(index, 'condition', e.target.value)}
                            className="w-full border rounded-ios-lg px-3 py-2 text-sm"
                          >
                            <option value="GOOD">Good</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="EXPIRED">Expired</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Ordered Qty</label>
                          <Input
                            type="number"
                            value={item.ordered_quantity}
                            onChange={(e) => updateItemRow(index, 'ordered_quantity', parseInt(e.target.value) || 0)}
                            className="text-sm"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Received Qty</label>
                          <Input
                            type="number"
                            value={item.received_quantity}
                            onChange={(e) => updateItemRow(index, 'received_quantity', parseInt(e.target.value) || 0)}
                            className="text-sm"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Unit Price (KES)</label>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateItemRow(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="text-sm"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Line Total</label>
                          <div className="px-3 py-2 bg-gray-100 rounded-ios-lg text-sm font-medium">
                            KES {(item.received_quantity * item.unit_price).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Batch Number</label>
                          <Input
                            value={item.batch_number}
                            onChange={(e) => updateItemRow(index, 'batch_number', e.target.value)}
                            className="text-sm"
                            placeholder="Enter batch number"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Expiry Date</label>
                          <Input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => updateItemRow(index, 'expiry_date', e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between pt-3 border-t border-[#E5E5EA]">
                    <IOSButton size="sm" variant="outline" onClick={addItemRow} className="text-sm" leftIcon={<Plus />}>Add Another Item</IOSButton>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Value</p>
                      <p className="text-xl font-bold text-[#3C3C43]">KES {totalReceivedValue.toLocaleString()}</p>
                    </div>
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
                  placeholder="Delivery notes, discrepancies, etc..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <IOSButton variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</IOSButton>
                <IOSButton onClick={handleCreateGRN} disabled={!formData.supplier_id || !formData.items.some(i => i.item_id)} leftIcon={<CheckCircle />}>
                  Record Receipt
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View GRN Modal */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                GRN: {selectedGRN?.grn_number}
              </DialogTitle>
            </DialogHeader>
            {selectedGRN && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Supplier</p>
                    <p className="font-medium">{selectedGRN.supplier?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <IOSBadge className={getStatusColor(selectedGRN.status)}>{selectedGRN.status}</IOSBadge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">PO Reference</p>
                    <p className="font-medium">{selectedGRN.purchase_order?.po_number || '-'}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Items Received</p>
                  <div className="border rounded-ios-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-center">Ordered</th>
                          <th className="px-3 py-2 text-center">Received</th>
                          <th className="px-3 py-2 text-left">Condition</th>
                          <th className="px-3 py-2 text-left">Batch</th>
                          <th className="px-3 py-2 text-left">Expiry</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(selectedGRN.items || []).map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{item.item?.name || `Item #${item.item_id}`}</td>
                            <td className="px-3 py-2 text-center">{item.ordered_quantity}</td>
                            <td className="px-3 py-2 text-center font-medium">{item.received_quantity}</td>
                            <td className="px-3 py-2">
                              <IOSBadge className={getConditionColor(item.condition)}>{item.condition}</IOSBadge>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{item.batch_number || '-'}</td>
                            <td className="px-3 py-2">{item.expiry_date ? formatDate(item.expiry_date) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedGRN.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="text-sm">{selectedGRN.notes}</p>
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
