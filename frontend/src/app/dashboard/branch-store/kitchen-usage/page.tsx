'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { Utensils, RefreshCw, Plus, Calendar, AlertCircle, ChefHat, Eye, Package } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface KitchenUsage {
  id: string;
  item_name: string;
  item_sku: string;
  received_quantity: number;
  remaining_quantity: number;
  consumed_quantity: number;
  spoilt_quantity: number;
  lost_quantity: number;
  damaged_quantity: number;
  usage_date: string;
  recorded_by: string;
  status: string;
}

interface TrackableItem {
  item_sku: string;
  item_name: string;
  quantity: number;
  category: string;
  unit: string;
}

export default function BranchKitchenUsagePage() {
  const [records, setRecords] = useState<KitchenUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<KitchenUsage | null>(null);
  const [items, setItems] = useState<TrackableItem[]>([]);
  const [formData, setFormData] = useState({ 
    item_sku: '', 
    received_quantity: 1, 
    usage_date: new Date().toISOString().split('T')[0],
    unit_cost: 0,
    expected_revenue: 0
  });
  const [selectedItem, setSelectedItem] = useState<TrackableItem | null>(null);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('[Kitchen Usage] Fetching records...');
      const response = await storeAPI.getKitchenUsageRecords();
      console.log('[Kitchen Usage] Records response:', response);
      if (response.success) {
        console.log('[Kitchen Usage] Records loaded:', response.data?.length || 0);
        setRecords(response.data || []);
      } else {
        console.error('[Kitchen Usage] Failed to fetch records:', response);
      }
    } catch (error) {
      console.error('[Kitchen Usage] Error fetching records:', error);
    }
    finally { setIsLoading(false); }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      console.log('[Kitchen Usage] Fetching trackable items...');
      const response = await storeAPI.getTrackableItems();
      console.log('[Kitchen Usage] Trackable items response:', response);
      if (response.success) {
        console.log('[Kitchen Usage] Items loaded:', response.data?.length || 0);
        console.log('[Kitchen Usage] First item structure:', response.data?.[0]);
        console.log('[Kitchen Usage] Sample item_name:', response.data?.[0]?.item_name);
        setItems(response.data || []);
      } else {
        console.error('[Kitchen Usage] Failed to fetch items:', response);
        toast.error('Failed to load items');
      }
    } catch (error) {
      console.error('[Kitchen Usage] Error fetching items:', error);
      toast.error('Error loading items');
    }
  }, []);

  useEffect(() => { fetchRecords(); fetchItems(); }, [fetchRecords, fetchItems]);

  const handleItemSelect = (sku: string) => {
    const item = items.find(i => i.item_sku === sku);
    setSelectedItem(item || null);
    setFormData(prev => ({ ...prev, item_sku: sku, received_quantity: 1 }));
  };

  const handleRecordUsage = async () => {
    if (!formData.item_sku || !formData.received_quantity) { 
      toast.error('Please select an item and enter quantity'); 
      return; 
    }

    if (formData.received_quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    if (selectedItem && formData.received_quantity > selectedItem.quantity) {
      toast.error(`Only ${selectedItem.quantity} ${selectedItem.unit || 'units'} available in branch stock`);
      return;
    }

    try {
      await storeAPI.createKitchenUsageRecord({
        item_sku: formData.item_sku,
        received_quantity: formData.received_quantity,
        usage_date: formData.usage_date,
        unit_cost: formData.unit_cost,
        expected_revenue: formData.expected_revenue
      });
      toast.success('Items issued to kitchen successfully');
      setAddModalOpen(false);
      setFormData({ 
        item_sku: '', 
        received_quantity: 1, 
        usage_date: new Date().toISOString().split('T')[0],
        unit_cost: 0,
        expected_revenue: 0
      });
      setSelectedItem(null);
      fetchRecords();
      fetchItems();
    } catch (error: any) { 
      toast.error(error.message || 'Failed to issue items'); 
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-blue-50 text-blue-600';
      case 'PARTIAL': return 'bg-yellow-50 text-yellow-600';
      case 'COMPLETED': return 'bg-green-50 text-green-600';
      case 'CLOSED': return 'bg-gray-50 text-gray-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const viewDetails = (record: KitchenUsage) => {
    setSelectedRecord(record);
    setDetailsModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.POS_KITCHEN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kitchen Usage Tracking</h1>
              <p className="text-gray-500">Track items issued to kitchen and monitor usage</p>
            </div>
            <div className="flex gap-2">
              <IOSButton 
                variant="secondary" 
                onClick={() => { fetchRecords(); fetchItems(); }} 
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Refresh
              </IOSButton>
              <IOSButton 
                onClick={() => setAddModalOpen(true)} 
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Issue to Kitchen
              </IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-ios-lg bg-blue-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Tracking</p>
                  <p className="text-2xl font-bold">{records.filter(r => r.status !== 'CLOSED').length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-ios-lg bg-orange-100 flex items-center justify-center">
                  <ChefHat className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Items Available</p>
                  <p className="text-2xl font-bold">{items.length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-ios-lg bg-green-100 flex items-center justify-center">
                  <Utensils className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Records</p>
                  <p className="text-2xl font-bold">{records.length}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : records.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Utensils className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-2">No usage records yet</p>
              <p className="text-sm text-gray-400">Click "Issue to Kitchen" to start tracking items</p>
            </IOSCard>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <IOSCard key={record.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-ios-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Utensils className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{record.item_name}</p>
                        <div className="flex flex-wrap gap-3 mt-1">
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> 
                            {new Date(record.usage_date).toLocaleDateString()}
                          </p>
                          <p className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${getStatusColor(record.status)}`}>
                            {record.status}
                          </p>
                        </div>
                        {(record.consumed_quantity > 0 || record.spoilt_quantity > 0 || record.lost_quantity > 0) && (
                          <div className="flex gap-3 mt-2 text-xs">
                            {record.consumed_quantity > 0 && (
                              <span className="text-green-600">✓ {record.consumed_quantity} used</span>
                            )}
                            {record.spoilt_quantity > 0 && (
                              <span className="text-red-600">✗ {record.spoilt_quantity} spoilt</span>
                            )}
                            {record.lost_quantity > 0 && (
                              <span className="text-orange-600">⚠ {record.lost_quantity} lost</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">
                          {record.remaining_quantity} / {record.received_quantity}
                        </p>
                        <div className="w-32 h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              record.remaining_quantity === 0 
                                ? 'bg-green-500' 
                                : record.remaining_quantity < record.received_quantity * 0.3
                                ? 'bg-red-500'
                                : 'bg-orange-500'
                            }`}
                            style={{ width: `${(record.remaining_quantity / record.received_quantity) * 100}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Remaining</p>
                      </div>
                      <IOSButton
                        variant="secondary"
                        size="sm"
                        onClick={() => viewDetails(record)}
                        leftIcon={<Eye className="h-4 w-4" />}
                      >
                        View
                      </IOSButton>
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-orange-600" />
                Issue Items to Kitchen
              </DialogTitle>
              <DialogDescription>
                Select items from branch stock to issue to the kitchen for tracking
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Select Item <span className="text-red-500">*</span>
                </label>
                <select 
                  value={formData.item_sku} 
                  onChange={(e) => handleItemSelect(e.target.value)} 
                  className="w-full p-3 border border-gray-200 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                >
                  <option value="" key="empty">Choose item from branch stock...</option>
                  {items.length === 0 ? (
                    <option disabled key="no-items">No items available in stock</option>
                  ) : (
                    items.map((item) => {
                      console.log('[Dropdown] Rendering item:', { sku: item.item_sku, name: item.item_name, qty: item.quantity, unit: item.unit });
                      return (
                        <option key={item.item_sku} value={item.item_sku}>
                          {item.item_name} - {item.quantity} {item.unit || 'units'} available
                          {item.category && ` (${item.category})`}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              {selectedItem && (
                <div className="p-3 bg-blue-50 rounded-ios-lg border border-blue-100">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">{selectedItem.item_name}</p>
                      <p className="text-blue-700 mt-1">
                        Available: <span className="font-bold">{selectedItem.quantity} {selectedItem.unit || 'units'}</span>
                      </p>
                      {selectedItem.category && (
                        <p className="text-blue-600 text-xs mt-1">Category: {selectedItem.category}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Quantity to Issue <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={formData.received_quantity}
                  onChange={(e) => setFormData({ ...formData, received_quantity: parseInt(e.target.value) || 0 })}
                  min={1}
                  max={selectedItem?.quantity || 999999}
                  placeholder="Enter quantity"
                  className="text-lg"
                />
                {selectedItem && formData.received_quantity > selectedItem.quantity && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Exceeds available stock ({selectedItem.quantity} {selectedItem.unit || 'units'})
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Issue Date
                </label>
                <Input 
                  type="date" 
                  value={formData.usage_date} 
                  onChange={(e) => setFormData({ ...formData, usage_date: e.target.value })} 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Unit Cost (Optional)
                  </label>
                  <Input
                    type="number"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Expected Revenue (Optional)
                  </label>
                  <Input
                    type="number"
                    value={formData.expected_revenue}
                    onChange={(e) => setFormData({ ...formData, expected_revenue: parseFloat(e.target.value) || 0 })}
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <IOSButton 
                  variant="secondary" 
                  onClick={() => {
                    setAddModalOpen(false);
                    setSelectedItem(null);
                    setFormData({ 
                      item_sku: '', 
                      received_quantity: 1, 
                      usage_date: new Date().toISOString().split('T')[0],
                      unit_cost: 0,
                      expected_revenue: 0
                    });
                  }} 
                  className="flex-1"
                >
                  Cancel
                </IOSButton>
                <IOSButton 
                  onClick={handleRecordUsage} 
                  className="flex-1"
                  disabled={!formData.item_sku || formData.received_quantity <= 0 || (selectedItem ? formData.received_quantity > selectedItem.quantity : false)}
                >
                  Issue to Kitchen
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Usage Record Details</DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-gray-50 rounded-ios-lg">
                  <p className="font-bold text-lg text-gray-900">{selectedRecord.item_name}</p>
                  <p className="text-sm text-gray-500 mt-1">SKU: {selectedRecord.item_sku}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-ios-lg">
                    <p className="text-xs text-blue-600 uppercase font-medium">Received</p>
                    <p className="text-2xl font-bold text-blue-900">{selectedRecord.received_quantity}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-ios-lg">
                    <p className="text-xs text-orange-600 uppercase font-medium">Remaining</p>
                    <p className="text-2xl font-bold text-orange-900">{selectedRecord.remaining_quantity}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">Consumed</span>
                    <span className="font-medium text-green-600">{selectedRecord.consumed_quantity || 0}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">Spoilt</span>
                    <span className="font-medium text-red-600">{selectedRecord.spoilt_quantity || 0}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">Lost</span>
                    <span className="font-medium text-orange-600">{selectedRecord.lost_quantity || 0}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">Damaged</span>
                    <span className="font-medium text-yellow-600">{selectedRecord.damaged_quantity || 0}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Status</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full text-xs uppercase ${getStatusColor(selectedRecord.status)}`}>
                      {selectedRecord.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Issue Date</span>
                    <span className="font-medium">{new Date(selectedRecord.usage_date).toLocaleDateString()}</span>
                  </div>
                </div>

                <IOSButton 
                  variant="secondary" 
                  onClick={() => setDetailsModalOpen(false)} 
                  className="w-full"
                >
                  Close
                </IOSButton>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
