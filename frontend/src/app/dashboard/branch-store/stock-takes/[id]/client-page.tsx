'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { API_URL } from '@/lib/config';
import { ArrowLeft, RefreshCw, Package, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Calendar, FileDown, Save, Send, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { storeAPI, stockTakeAPI } from '@/lib/api';

interface StockTakeItem {
  id: string;
  item_sku: string;
  system_quantity: number;
  counted_quantity: number | null;
  variance: number;
  variance_value: number;
  unit_cost: number;
  variance_reason?: string;
  notes?: string;
  status: string;
  is_manually_added?: boolean;
  item?: {
    name: string;
    unit: string;
  };
}

interface StockTake {
  id: string;
  take_number: string;
  branch_id: number;
  take_type: string;
  status: string;
  started_at: string;
  completed_at?: string;
  started_by: string;
  completed_by?: string;
  notes?: string;
  total_items_counted: number;
  items_with_variance: number;
  total_variance_value: number;
  branch?: {
    name: string;
  };
  items?: StockTakeItem[];
}

export default function StockTakeDetailClientV2({ id }: { id: string }) {
  const router = useRouter();
  const [stockTake, setStockTake] = useState<StockTake | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({});
  const [editedReasons, setEditedReasons] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(0);
  const [availableItems, setAvailableItems] = useState<any[]>([]);

  const fetchStockTake = async () => {
    setIsLoading(true);
    try {
      const result = await storeAPI.getStockTake(id);
      // console.log('Stock take data (consolidated):', result);

      if (result.success) {
        setStockTake(result.data);
      } else {
        toast.error(result.message || 'Failed to load stock take');
      }
    } catch (error) {
      console.error('Error fetching stock take:', error);
      toast.error('Error loading stock take details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStockTake();
  }, [id]);

  // Fetch available items for manual addition
  useEffect(() => {
    const fetchAvailableItems = async () => {
      try {
        const result = await storeAPI.getItems({ limit: 500 });
        if (result.success) {
          setAvailableItems(result.data || []);
        }
      } catch (error) {
        console.error('Error fetching items:', error);
      }
    };
    fetchAvailableItems();
  }, []);

  const handleDownloadWorksheet = async () => {
    toast.info('Preparing worksheet...');
    try {
      const result = await stockTakeAPI.downloadWorksheet(id);
      if (!result.success) throw new Error(result.message);
      toast.success('Download complete');
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error(error.message || 'Failed to download worksheet');
    }
  };

  const handleStockChange = (itemId: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setEditedStocks(prev => ({
      ...prev,
      [itemId]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const handleReasonChange = (itemId: string, value: string) => {
    setEditedReasons(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const getEffectiveCount = (item: StockTakeItem) =>
    editedStocks[item.id] !== undefined ? editedStocks[item.id] : item.counted_quantity;

  const getEffectiveReason = (item: StockTakeItem) =>
    editedReasons[item.id] !== undefined ? editedReasons[item.id] : (item.variance_reason || item.notes || '');

  const getEffectiveVariance = (item: StockTakeItem) => {
    const counted = getEffectiveCount(item);
    if (counted === null || counted === undefined) return null;
    return counted - Number(item.system_quantity || 0);
  };

  const handleSaveProgress = async () => {
    setIsSaving(true);
    try {
      const changedItemIds = Array.from(new Set([
        ...Object.keys(editedStocks),
        ...Object.keys(editedReasons)
      ]));

      if (changedItemIds.length === 0) {
        toast.info('No changes to save');
        return;
      }

      const itemsToUpdate = changedItemIds.map((itemId) => {
        const item = items.find((row) => row.id === itemId);
        return {
          id: itemId,
          counted_quantity: editedStocks[itemId] !== undefined ? editedStocks[itemId] : item?.counted_quantity,
          variance_reason: editedReasons[itemId] !== undefined ? editedReasons[itemId] : item?.variance_reason
        };
      });

      const result = await stockTakeAPI.updateStockTake(id, { items: itemsToUpdate });
      if (result.success) {
        toast.success('Progress saved successfully');
        setEditedStocks({});
        setEditedReasons({});
        fetchStockTake();
      } else {
        toast.error(result.message || 'Failed to save progress');
      }
    } catch (error) {
      toast.error('Error saving progress');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddManualItem = async () => {
    if (!newItemSku || newItemQuantity === null) {
      toast.error('Please select an item and enter quantity');
      return;
    }

    try {
      const result = await stockTakeAPI.updateStockTake(id, {
        items: [{
          item_sku: newItemSku,
          counted_quantity: newItemQuantity,
          is_new: true
        }]
      });

      if (result.success) {
        toast.success('Item added successfully');
        setIsAddItemModalOpen(false);
        setNewItemSku('');
        setNewItemQuantity(0);
        fetchStockTake();
      } else {
        toast.error(result.message || 'Failed to add item');
      }
    } catch (error) {
      toast.error('Error adding item');
    }
  };

  const handleSubmitToAuditor = async () => {
    const missingCounts = items.filter(item => getEffectiveCount(item) === null || getEffectiveCount(item) === undefined);
    if (missingCounts.length > 0) {
      toast.error(`Count all items before submitting. Missing counts: ${missingCounts.length}`);
      return;
    }

    const missingReasons = items.filter((item) => {
      const variance = getEffectiveVariance(item);
      return variance !== null && variance !== 0 && !getEffectiveReason(item).trim();
    });
    if (missingReasons.length > 0) {
      toast.error(`Add reasons for all variances before submitting. Missing reasons: ${missingReasons.length}`);
      return;
    }

    if (!confirm('Are you sure you want to submit this stock take to the auditor? You will not be able to edit it further.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      // First save any unsaved changes
      const changedItemIds = Array.from(new Set([
        ...Object.keys(editedStocks),
        ...Object.keys(editedReasons)
      ]));

      if (changedItemIds.length > 0) {
        const itemsToUpdate = changedItemIds.map((itemId) => {
          const item = items.find((row) => row.id === itemId);
          return {
            id: itemId,
            counted_quantity: editedStocks[itemId] !== undefined ? editedStocks[itemId] : item?.counted_quantity,
            variance_reason: editedReasons[itemId] !== undefined ? editedReasons[itemId] : item?.variance_reason
          };
        });
        await stockTakeAPI.updateStockTake(id, { items: itemsToUpdate });
      }

      const result = await stockTakeAPI.submitToAuditor(id);
      if (result.success) {
        toast.success('Stock take submitted to auditor');
        fetchStockTake();
      } else {
        toast.error(result.message || 'Failed to submit');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Error submitting stock take');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_progress': return 'bg-blue-50 text-blue-600';
      case 'completed': return 'bg-green-50 text-green-600';
      case 'approved': return 'bg-emerald-50 text-emerald-600';
      case 'rejected': return 'bg-red-50 text-red-600';
      case 'draft': return 'bg-orange-50 text-orange-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return 'text-gray-600';
    return variance > 0 ? 'text-green-600' : 'text-red-600';
  };

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
        <DashboardLayout>
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!stockTake) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
        <DashboardLayout>
          <div className="space-y-6">
            <IOSButton
              variant="secondary"
              onClick={() => router.back()}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back
            </IOSButton>
            <IOSCard className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Stock take not found</p>
            </IOSCard>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  const items = stockTake.items || [];
  const countedItems = items.filter(i => getEffectiveCount(i) !== null && getEffectiveCount(i) !== undefined);
  const itemsWithVariance = items.filter(i => {
    const variance = getEffectiveVariance(i);
    return variance !== null && variance !== 0;
  });
  const hasUnsavedChanges = Object.keys(editedStocks).length > 0 || Object.keys(editedReasons).length > 0;
  
  // Filter items by search term
  const filteredItems = items.filter(item => 
    item.item_sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <IOSButton
                variant="secondary"
                onClick={() => router.back()}
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back
              </IOSButton>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {stockTake.take_number || `ST-${stockTake.id.substring(0, 8).toUpperCase()}`}
                </h1>
                <p className="text-gray-500">Stock Take Details</p>
              </div>
            </div>
            <div className="flex gap-2">
              <IOSButton
                variant="secondary"
                onClick={handleDownloadWorksheet}
                leftIcon={<FileDown className="h-4 w-4" />}
              >
                Download PDF
              </IOSButton>
              <IOSButton
                variant="secondary"
                onClick={fetchStockTake}
                leftIcon={<RefreshCw className="h-4 w-4" />}
                disabled={isLoading}
              >
                Refresh
              </IOSButton>
              {(stockTake.status?.toLowerCase() === 'draft' || stockTake.status?.toLowerCase() === 'in_progress') && (
                <>
                  <IOSButton
                    variant="secondary"
                    onClick={() => setIsAddItemModalOpen(true)}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Add Item
                  </IOSButton>
                  <IOSButton
                    variant="secondary"
                    onClick={handleSaveProgress}
                    leftIcon={<Save className="h-4 w-4" />}
                    loading={isSaving}
                    disabled={!hasUnsavedChanges}
                  >
                    Save Progress
                  </IOSButton>
                  <IOSButton
                    onClick={handleSubmitToAuditor}
                    leftIcon={<Send className="h-4 w-4" />}
                    loading={isSubmitting}
                  >
                    Submit to Auditor
                  </IOSButton>
                </>
              )}
            </div>

          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-ios-lg bg-blue-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold">{items.length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-ios-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Counted</p>
                  <p className="text-2xl font-bold">{countedItems.length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-ios-lg bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Variances</p>
                  <p className="text-2xl font-bold">{itemsWithVariance.length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-ios-lg flex items-center justify-center ${stockTake.total_variance_value >= 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                  {stockTake.total_variance_value >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Variance Value</p>
                  <p className={`text-2xl font-bold ${getVarianceColor(stockTake.total_variance_value || 0)}`}>
                    {stockTake.total_variance_value >= 0 ? '+' : ''}{(stockTake.total_variance_value ?? 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Stock Take Info */}
          <IOSCard className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <IOSBadge className={`${getStatusColor(stockTake.status)} px-3 py-1`}>
                  {stockTake.status.replace('_', ' ')}
                </IOSBadge>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Type</p>
                <p className="font-medium capitalize">{stockTake.take_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Started</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {new Date(stockTake.started_at).toLocaleString()}
                </p>
              </div>
              {stockTake.completed_at && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Completed</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {new Date(stockTake.completed_at).toLocaleString()}
                  </p>
                </div>
              )}
              {stockTake.branch && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Branch</p>
                  <p className="font-medium">{stockTake.branch.name}</p>
                </div>
              )}
              {stockTake.notes && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="font-medium">{stockTake.notes}</p>
                </div>
              )}
            </div>
          </IOSCard>

          {/* Items List */}
          <IOSCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Stock Take Items</h2>
              {(stockTake.status?.toLowerCase() === 'draft' || stockTake.status?.toLowerCase() === 'in_progress') && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              )}
            </div>
            {items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">No items in this stock take</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Item</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">System Qty</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Counted Qty</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Variance</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Value Impact</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Variance Reason</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{item.item?.name || item.item_sku}</p>
                            {item.is_manually_added && (
                              <IOSBadge className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5">Manual</IOSBadge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{item.item_sku}</p>
                          {item.variance_reason && (
                            <p className="text-xs text-orange-600 mt-1">Reason: {item.variance_reason}</p>
                          )}
                        </td>
                        <td className="text-right py-3 px-4">
                          <p className="font-medium">{item.system_quantity}</p>
                          <p className="text-xs text-gray-500">{item.item?.unit || 'units'}</p>
                        </td>
                        <td className="text-right py-3 px-4">
                          {(stockTake.status?.toLowerCase() === 'draft' || stockTake.status?.toLowerCase() === 'in_progress') ? (
                            <input
                              type="number"
                              className="w-24 px-2 py-1 border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editedStocks[item.id] !== undefined ? editedStocks[item.id] : (item.counted_quantity ?? '')}
                              onChange={(e) => handleStockChange(item.id, e.target.value)}
                              placeholder="0"
                            />
                          ) : (
                            <p className="font-medium">
                              {item.counted_quantity !== null ? item.counted_quantity : '-'}
                            </p>
                          )}
                        </td>

                        <td className="text-right py-3 px-4">
                          {(() => {
                            const effectiveVariance = getEffectiveVariance(item);
                            const displayVariance = effectiveVariance !== null ? effectiveVariance : item.variance;
                            return (
                          <p className={`font-bold ${getVarianceColor(displayVariance)}`}>
                            {displayVariance > 0 && '+'}
                            {displayVariance}
                          </p>
                            );
                          })()}
                        </td>
                        <td className="text-right py-3 px-4">
                          <p className={`font-bold ${getVarianceColor(item.variance_value)}`}>
                            {item.variance_value >= 0 && '+'}
                            {item.variance_value.toFixed(2)}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          {(stockTake.status?.toLowerCase() === 'draft' || stockTake.status?.toLowerCase() === 'in_progress') ? (
                            <input
                              type="text"
                              className="w-48 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editedReasons[item.id] !== undefined ? editedReasons[item.id] : (item.variance_reason || '')}
                              onChange={(e) => handleReasonChange(item.id, e.target.value)}
                              placeholder="Required if variance"
                            />
                          ) : (
                            <p className="text-sm text-gray-700">{item.variance_reason || '-'}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <IOSBadge className={`${item.status === 'COUNTED' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                            } px-2 py-1 text-xs`}>
                            {item.status}
                          </IOSBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </IOSCard>

          {/* Add Item Modal */}
          <Dialog open={isAddItemModalOpen} onOpenChange={setIsAddItemModalOpen}>
            <DialogContent className="max-w-md w-[95vw]">
              <DialogHeader>
                <DialogTitle>Add Manual Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Item</label>
                  <select
                    value={newItemSku}
                    onChange={(e) => setNewItemSku(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2.5"
                  >
                    <option value="">Select an item...</option>
                    {availableItems.map(item => (
                      <option key={item.sku} value={item.sku}>
                        {item.item_name || item.description} ({item.sku})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Counted Quantity</label>
                  <input
                    type="number"
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 0)}
                    className="w-full border rounded-lg px-3 py-2.5"
                    placeholder="Enter quantity"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <IOSButton variant="outline" onClick={() => setIsAddItemModalOpen(false)}>Cancel</IOSButton>
                  <IOSButton onClick={handleAddManualItem} disabled={!newItemSku}>Add Item</IOSButton>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
