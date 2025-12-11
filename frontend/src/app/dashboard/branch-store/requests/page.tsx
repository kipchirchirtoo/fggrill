'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { ShoppingCart, RefreshCw, Plus, Clock, CheckCircle, XCircle, Package, Search, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface StockRequest { id: string; request_number: string; status: string; priority: string; items_count: number; created_at: string; }
interface StockItem { id: string; sku: string; item_code: string; name: string; category: string; quantity: number; min_quantity: number; unit: string; }
interface RequestItem { item_sku: string; name: string; requested_quantity: number; current_stock: number; unit: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  approved: { label: 'Approved', color: 'text-blue-700', bg: 'bg-blue-100' },
  fulfilled: { label: 'Fulfilled', color: 'text-green-700', bg: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function BranchRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // New Request Modal State
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [availableItems, setAvailableItems] = useState<StockItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<RequestItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchRequests();
      if (response.success) {
        const data = response.data || [];
        setRequests(statusFilter === 'all' ? data : data.filter((r: StockRequest) => r.status === statusFilter));
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  
  // Fetch available items when modal opens
  const openNewRequestModal = async () => {
    setShowNewRequestModal(true);
    try {
      const response = await storeAPI.getBranchStock();
      if (response.success) {
        setAvailableItems(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };
  
  const addItemToRequest = (item: StockItem) => {
    const sku = item.sku || item.item_code;
    if (selectedItems.find(i => i.item_sku === sku)) {
      toast.error('Item already added');
      return;
    }
    setSelectedItems([...selectedItems, {
      item_sku: sku,
      name: item.name,
      requested_quantity: Math.max(item.min_quantity * 2 - item.quantity, 10),
      current_stock: item.quantity,
      unit: item.unit || 'pcs'
    }]);
  };
  
  const removeItemFromRequest = (sku: string) => {
    setSelectedItems(selectedItems.filter(i => i.item_sku !== sku));
  };
  
  const updateItemQuantity = (sku: string, quantity: number) => {
    setSelectedItems(selectedItems.map(i => 
      i.item_sku === sku ? { ...i, requested_quantity: quantity } : i
    ));
  };
  
  const handleSubmitRequest = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await storeAPI.createStockRequest({
        items: selectedItems.map(item => ({
          item_sku: item.item_sku,
          requested_quantity: item.requested_quantity,
          current_branch_stock: item.current_stock
        })),
        priority,
        reason: reason || 'Stock replenishment request'
      });
      toast.success('Stock request submitted successfully!');
      setShowNewRequestModal(false);
      setSelectedItems([]);
      setReason('');
      setPriority('normal');
      fetchRequests();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const filteredAvailableItems = availableItems.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.item_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = { pending: requests.filter(r => r.status === 'pending').length, approved: requests.filter(r => r.status === 'approved').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Requests</h1><p className="text-gray-500">Request stock from central</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchRequests} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={openNewRequestModal} leftIcon={<Plus />}>New Request</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Approved</p><p className="text-xl font-bold text-[#007AFF]">{stats.approved}</p></IOSCard>
          </div>

          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'fulfilled', 'rejected'].map((status) => (
              <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                {status === 'all' ? 'All' : statusConfig[status]?.label || status}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : requests.length === 0 ? (
            <IOSCard className="p-12 text-center"><ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No requests</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const status = statusConfig[request.status] || statusConfig.pending;
                return (
                  <IOSCard key={request.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Package className="h-6 w-6 text-[#007AFF]" /></div>
                        <div>
                          <p className="font-bold">#{request.request_number}</p>
                          <p className="text-sm text-gray-500">{request.items_count} items • {new Date(request.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {request.priority === 'urgent' && <IOSBadge variant="light" color="danger">Urgent</IOSBadge>}
                        <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
        
        {/* New Request Modal */}
        <Dialog open={showNewRequestModal} onOpenChange={setShowNewRequestModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>New Stock Request</DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto space-y-4 mt-4">
              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div className="bg-blue-50 rounded-ios-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-3">Selected Items ({selectedItems.length})</h3>
                  <div className="space-y-2">
                    {selectedItems.map((item) => (
                      <div key={item.item_sku} className="flex items-center justify-between bg-[#FFFFFF] rounded-ios-lg p-3">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-500">Current stock: {item.current_stock} {item.unit}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            value={item.requested_quantity}
                            onChange={(e) => updateItemQuantity(item.item_sku, parseInt(e.target.value) || 0)}
                            className="w-24 text-center"
                            min={1}
                          />
                          <span className="text-sm text-gray-500">{item.unit}</span>
                          <IOSButton size="sm" variant="destructive" onClick={() => removeItemFromRequest(item.item_sku)}>
                            <Trash2 className="h-4 w-4" />
                          </IOSButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Priority & Reason */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <div className="flex gap-2 mt-1">
                    <IOSButton 
                      size="sm" 
                      variant={priority === 'normal' ? 'primary' : 'secondary'}
                      onClick={() => setPriority('normal')}
                      className="flex-1"
                    >
                      Normal
                    </IOSButton>
                    <IOSButton 
                      size="sm" 
                      variant={priority === 'urgent' ? 'destructive' : 'secondary'}
                      onClick={() => setPriority('urgent')}
                      className="flex-1"
                      leftIcon={<AlertTriangle />}
                    >
                      Urgent
                    </IOSButton>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Reason (optional)</label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Low stock, Special event"
                    className="mt-1"
                  />
                </div>
              </div>
              
              {/* Search Available Items */}
              <div>
                <label className="text-sm font-medium mb-2 block">Add Items to Request</label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search items by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="border rounded-ios-lg max-h-60 overflow-y-auto">
                  {filteredAvailableItems.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No items found</div>
                  ) : (
                    <div className="divide-y">
                      {filteredAvailableItems.slice(0, 20).map((item) => {
                        const isLow = item.quantity <= item.min_quantity;
                        const isSelected = selectedItems.some(i => i.item_sku === (item.sku || item.item_code));
                        return (
                          <div 
                            key={item.id} 
                            className={`p-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                            onClick={() => !isSelected && addItemToRequest(item)}
                          >
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-gray-500">{item.sku || item.item_code} • {item.category}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`font-medium ${isLow ? 'text-[#FF3B30]' : ''}`}>{item.quantity} {item.unit}</p>
                                <p className="text-xs text-gray-500">Min: {item.min_quantity}</p>
                              </div>
                              {isSelected ? (
                                <IOSBadge variant="light" color="success">Added</IOSBadge>
                              ) : (
                                <IOSButton size="sm" variant="secondary">
                                  <Plus className="h-4 w-4" />
                                </IOSButton>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex gap-3 pt-4 border-t mt-4">
              <IOSButton variant="secondary" onClick={() => setShowNewRequestModal(false)} className="flex-1">
                Cancel
              </IOSButton>
              <IOSButton 
                onClick={handleSubmitRequest} 
                disabled={selectedItems.length === 0 || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Submitting...' : `Submit Request (${selectedItems.length} items)`}
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
