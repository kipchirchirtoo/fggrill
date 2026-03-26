'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { API_URL } from '@/lib/config';
import { ArrowLeft, RefreshCw, Package, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Calendar, FileDown, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
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
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSaveProgress = async () => {
    setIsSaving(true);
    try {
      const itemsToUpdate = Object.entries(editedStocks).map(([itemId, quantity]) => ({
        id: itemId,
        counted_quantity: quantity
      }));

      if (itemsToUpdate.length === 0) {
        toast.info('No changes to save');
        return;
      }

      const result = await stockTakeAPI.updateStockTake(id, { items: itemsToUpdate });
      if (result.success) {
        toast.success('Progress saved successfully');
        setEditedStocks({});
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

  const handleSubmitToAuditor = async () => {
    if (!confirm('Are you sure you want to submit this stock take to the auditor? You will not be able to edit it further.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      // First save any unsaved changes
      if (Object.keys(editedStocks).length > 0) {
        const itemsToUpdate = Object.entries(editedStocks).map(([itemId, quantity]) => ({
          id: itemId,
          counted_quantity: quantity
        }));
        await stockTakeAPI.updateStockTake(id, { items: itemsToUpdate });
      }

      const result = await stockTakeAPI.submitToAuditor(id);
      if (result.success) {
        toast.success('Stock take submitted to auditor');
        fetchStockTake();
      } else {
        toast.error(result.message || 'Failed to submit');
      }
    } catch (error) {
      toast.error('Error submitting stock take');
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
  const countedItems = items.filter(i => i.counted_quantity !== null);
  const itemsWithVariance = items.filter(i => i.variance !== 0);

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
                    onClick={handleSaveProgress}
                    leftIcon={<Save className="h-4 w-4" />}
                    loading={isSaving}
                    disabled={Object.keys(editedStocks).length === 0}
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
            <h2 className="text-lg font-bold mb-4">Stock Take Items</h2>
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
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium">{item.item?.name || item.item_sku}</p>
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
                          <p className={`font-bold ${getVarianceColor(item.variance)}`}>
                            {item.variance > 0 && '+'}
                            {item.variance}
                          </p>
                        </td>
                        <td className="text-right py-3 px-4">
                          <p className={`font-bold ${getVarianceColor(item.variance_value)}`}>
                            {item.variance_value >= 0 && '+'}
                            {item.variance_value.toFixed(2)}
                          </p>
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
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
