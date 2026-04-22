'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { stockAnalyticsAPI } from '@/lib/api/branch-manager';
import { storeAPI } from '@/lib/api/store';
import { 
  TrendingUp, TrendingDown, Minus, Package, AlertTriangle, 
  RefreshCw, Building2, BarChart3, ShoppingCart, Trash2 
} from 'lucide-react';
import { toast } from 'sonner';

interface ConsumptionTrend {
  item_sku: string;
  item_name: string;
  category: string;
  unit: string;
  total_quantity: number;
  daily_average: number;
  weekly_average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  last_7_days: number;
  previous_7_days: number;
}

interface ReorderSuggestion {
  item_sku: string;
  item_name: string;
  category: string;
  current_quantity: number;
  reorder_level: number;
  daily_consumption_rate: number;
  days_until_stockout: number;
  suggested_order_quantity: number;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  unit: string;
}

export default function StockAnalyticsPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [trends, setTrends] = useState<ConsumptionTrend[]>([]);
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [wastage, setWastage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trends' | 'reorder' | 'wastage'>('trends');
  const [period, setPeriod] = useState('30');

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchAnalytics = useCallback(async () => {
    if (!currentBranchId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch consumption trends
      const trendsResponse = await stockAnalyticsAPI.getConsumptionTrends({
        branch_id: currentBranchId,
        period: period
      });
      
      if (trendsResponse.success && trendsResponse.data) {
        setTrends(trendsResponse.data.trends || []);
      }

      // Fetch reorder suggestions
      const suggestionsResponse = await stockAnalyticsAPI.getReorderSuggestions({
        branch_id: currentBranchId
      });
      
      if (suggestionsResponse.success && suggestionsResponse.data) {
        setSuggestions(suggestionsResponse.data.suggestions || []);
      }

      // Fetch wastage analytics
      const wastageResponse = await stockAnalyticsAPI.getWastageAnalytics({
        branch_id: currentBranchId,
        days: period
      });
      
      if (wastageResponse.success && wastageResponse.data) {
        setWastage(wastageResponse.data);
      }
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      toast.error(error.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-600" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'danger';
      case 'decreasing':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'default';
      default:
        return 'success';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleRequestStock = async (suggestion: ReorderSuggestion) => {
    try {
      await storeAPI.createStockRequest({
        items: [{
          item_sku: suggestion.item_sku,
          requested_quantity: suggestion.suggested_order_quantity,
          current_branch_stock: suggestion.current_quantity
        }],
        priority: suggestion.priority === 'urgent' ? 'urgent' : suggestion.priority === 'high' ? 'high' : 'normal',
        reason: `Reorder suggestion - ${suggestion.days_until_stockout} days until stockout`,
        request_type: 'regular'
      });
      
      toast.success(`Stock request created for ${suggestion.item_name}`);
      fetchAnalytics(); // Refresh data
    } catch (error: any) {
      console.error('Error creating stock request:', error);
      toast.error(error.message || 'Failed to create stock request');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-[#007AFF]" />
                Stock Analytics
              </h1>
              <p className="text-gray-500 flex items-center gap-1 mt-1">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch?.name || 'Select a branch'}
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="60">Last 60 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
              <IOSButton
                variant="secondary"
                leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                onClick={fetchAnalytics}
              >
                Refresh
              </IOSButton>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Package className="h-5 w-5 text-[#007AFF]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Items Tracked</p>
                  <p className="text-2xl font-bold">{trends.length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4 border-l-4 border-red-500">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-[#FF3B30]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reorder Needed</p>
                  <p className="text-2xl font-bold text-[#FF3B30]">{suggestions.length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4 border-l-4 border-yellow-500">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Trash2 className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Wastage Value</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {wastage ? formatCurrency(wastage.summary?.total_value || 0) : '-'}
                  </p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'trends'
                  ? 'border-[#007AFF] text-[#007AFF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Consumption Trends
            </button>
            <button
              onClick={() => setActiveTab('reorder')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'reorder'
                  ? 'border-[#007AFF] text-[#007AFF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Reorder Suggestions ({suggestions.length})
            </button>
            <button
              onClick={() => setActiveTab('wastage')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'wastage'
                  ? 'border-[#007AFF] text-[#007AFF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Wastage Analysis
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Consumption Trends Tab */}
              {activeTab === 'trends' && (
                <IOSCard className="overflow-hidden">
                  {trends.length === 0 ? (
                    <div className="p-12 text-center">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Consumption Data</h3>
                      <p className="text-gray-500">No stock consumption records found for the selected period.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Consumed</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Daily Avg</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Weekly Avg</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trend</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {trends.map((trend) => (
                            <tr key={trend.item_sku} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-gray-900">{trend.item_name}</p>
                                <p className="text-xs text-gray-500">{trend.item_sku}</p>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{trend.category}</td>
                              <td className="px-4 py-3 text-right">
                                <p className="text-sm font-semibold text-gray-900">{trend.total_quantity.toFixed(2)}</p>
                                <p className="text-xs text-gray-500">{trend.unit}</p>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-600">
                                {trend.daily_average.toFixed(2)} {trend.unit}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-600">
                                {trend.weekly_average.toFixed(2)} {trend.unit}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {getTrendIcon(trend.trend)}
                                  <IOSBadge variant="light" color={getTrendColor(trend.trend)}>
                                    {trend.trend}
                                  </IOSBadge>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </IOSCard>
              )}

              {/* Reorder Suggestions Tab */}
              {activeTab === 'reorder' && (
                <IOSCard className="overflow-hidden">
                  {suggestions.length === 0 ? (
                    <div className="p-12 text-center">
                      <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Reorder Suggestions</h3>
                      <p className="text-gray-500">All items are adequately stocked.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Daily Rate</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days Left</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Suggested Order</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {suggestions.map((suggestion) => (
                            <tr key={suggestion.item_sku} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-gray-900">{suggestion.item_name}</p>
                                <p className="text-xs text-gray-500">{suggestion.category}</p>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <p className="text-sm font-semibold text-gray-900">{suggestion.current_quantity}</p>
                                <p className="text-xs text-gray-500">{suggestion.unit}</p>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-600">
                                {suggestion.daily_consumption_rate.toFixed(2)} {suggestion.unit}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <IOSBadge 
                                  variant="light" 
                                  color={suggestion.days_until_stockout <= 3 ? 'danger' : suggestion.days_until_stockout <= 7 ? 'warning' : 'default'}
                                >
                                  {suggestion.days_until_stockout} days
                                </IOSBadge>
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                                {suggestion.suggested_order_quantity} {suggestion.unit}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <IOSBadge variant="light" color={getPriorityColor(suggestion.priority)}>
                                  {suggestion.priority.toUpperCase()}
                                </IOSBadge>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <IOSButton 
                                  size="sm" 
                                  leftIcon={<ShoppingCart />}
                                  onClick={() => handleRequestStock(suggestion)}
                                >
                                  Request
                                </IOSButton>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </IOSCard>
              )}

              {/* Wastage Analysis Tab */}
              {activeTab === 'wastage' && (
                <div className="space-y-4">
                  {!wastage || !wastage.summary || wastage.summary.total_incidents === 0 ? (
                    <IOSCard className="p-12 text-center">
                      <Trash2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Wastage Data</h3>
                      <p className="text-gray-500">No wastage records found for the selected period.</p>
                    </IOSCard>
                  ) : (
                    <>
                      {/* Summary Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <IOSCard className="p-4">
                          <p className="text-sm text-gray-500 mb-1">Total Incidents</p>
                          <p className="text-2xl font-bold text-gray-900">{wastage.summary.total_incidents}</p>
                        </IOSCard>
                        <IOSCard className="p-4">
                          <p className="text-sm text-gray-500 mb-1">Total Value</p>
                          <p className="text-2xl font-bold text-red-600">{formatCurrency(wastage.summary.total_value)}</p>
                        </IOSCard>
                        <IOSCard className="p-4">
                          <p className="text-sm text-gray-500 mb-1">Avg per Incident</p>
                          <p className="text-2xl font-bold text-gray-900">{formatCurrency(wastage.summary.average_value_per_incident)}</p>
                        </IOSCard>
                      </div>

                      {/* Category and Reason Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IOSCard className="p-6">
                          <h3 className="text-lg font-bold text-gray-900 mb-4">By Category</h3>
                          {Object.keys(wastage.summary?.by_category || {}).length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No category data available</p>
                          ) : (
                            <div className="space-y-3">
                              {Object.entries(wastage.summary.by_category).map(([category, value]: [string, any]) => (
                                <div key={category} className="flex items-center justify-between py-2 border-b border-gray-100">
                                  <span className="text-sm text-gray-600 capitalize">{category}</span>
                                  <span className="font-semibold text-red-600">{formatCurrency(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </IOSCard>

                        <IOSCard className="p-6">
                          <h3 className="text-lg font-bold text-gray-900 mb-4">By Reason</h3>
                          {Object.keys(wastage.summary?.by_reason || {}).length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No reason data available</p>
                          ) : (
                            <div className="space-y-3">
                              {Object.entries(wastage.summary.by_reason).map(([reason, value]: [string, any]) => (
                                <div key={reason} className="flex items-center justify-between py-2 border-b border-gray-100">
                                  <span className="text-sm text-gray-600 capitalize">{reason.replace(/_/g, ' ')}</span>
                                  <span className="font-semibold text-red-600">{formatCurrency(value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </IOSCard>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
