'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { API_URL } from '@/lib/config';
import { ArrowLeft, RefreshCw, Package, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';

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
                onClick={fetchStockTake}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Refresh
              </IOSButton>
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
                          <p className="font-medium">
                            {item.counted_quantity !== null ? item.counted_quantity : '-'}
                          </p>
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
