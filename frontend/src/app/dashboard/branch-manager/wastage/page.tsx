'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { wastageAPI } from '@/lib/api';
import {
  Trash2, RefreshCw, AlertTriangle, TrendingDown, Calendar,
  Flame, Timer, Ban, RotateCcw, Search, HelpCircle, Download,
  Filter, ChevronDown, Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';

interface WastageRecord {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  reason: string;
  cost_impact: number;
  description?: string;
  logged_by_name?: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  logged_at: string;
  branch_id?: number;
  branch_name?: string;
}

type WasteReason = 'spoilage' | 'expiry' | 'damage' | 'overcooking' | 'customer_return' | 'quality_control' | 'damaged_in_transit' | 'other';

const wasteReasonConfig: Record<WasteReason, { label: string; color: string; icon: any; bgColor: string }> = {
  spoilage: { label: 'Spoilage', color: 'text-red-700', icon: AlertTriangle, bgColor: 'bg-red-100' },
  expiry: { label: 'Expired', color: 'text-purple-700', icon: Timer, bgColor: 'bg-purple-100' },
  damage: { label: 'Damaged', color: 'text-orange-700', icon: Ban, bgColor: 'bg-orange-100' },
  overcooking: { label: 'Overcooked', color: 'text-amber-700', icon: Flame, bgColor: 'bg-amber-100' },
  customer_return: { label: 'Customer Return', color: 'text-blue-700', icon: RotateCcw, bgColor: 'bg-blue-100' },
  quality_control: { label: 'Quality Control', color: 'text-yellow-700', icon: Search, bgColor: 'bg-yellow-100' },
  damaged_in_transit: { label: 'Damaged in Transit', color: 'text-indigo-700', icon: Truck, bgColor: 'bg-indigo-100' },
  other: { label: 'Other', color: 'text-gray-700', icon: HelpCircle, bgColor: 'bg-gray-100' },
};

export default function BranchManagerWastagePage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [wastageRecords, setWastageRecords] = useState<WastageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [filterReason, setFilterReason] = useState<string>('all');

  // Stats
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalCost: 0,
    byReason: {} as Record<string, number>,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recordsRes, summaryRes] = await Promise.all([
        wastageAPI.getWastageRecords(),
        wastageAPI.getWastageSummary(period === 'today' ? '1d' : period === 'week' ? '7d' : '30d'),
      ]);

      if (recordsRes.success) {
        setWastageRecords(recordsRes.data || []);
      }

      if (summaryRes.success && summaryRes.data) {
        setStats({
          totalRecords: summaryRes.data.totalItems || 0,
          totalCost: summaryRes.data.totalCost || 0,
          byReason: summaryRes.data.byReason || {},
        });
      }
    } catch (error) {
      console.error('Error fetching wastage data:', error);
      toast.error('Failed to load wastage data');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRecords = wastageRecords.filter(record =>
    filterReason === 'all' || record.reason === filterReason
  );

  const topWastedItems = wastageRecords.reduce((acc, record) => {
    const key = record.item_name;
    if (!acc[key]) {
      acc[key] = { name: key, count: 0, cost: 0 };
    }
    acc[key].count += record.quantity;
    acc[key].cost += record.cost_impact || 0;
    return acc;
  }, {} as Record<string, { name: string; count: number; cost: number }>);

  const sortedTopItems = Object.values(topWastedItems)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">Wastage Reports</h1>
              <p className="text-stone-500">Monitor and analyze food waste in your branch</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['today', 'week', 'month'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${period === p
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>
                Refresh
              </IOSButton>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-ios-lg">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Incidents</p>
                  <p className="text-2xl font-bold text-red-600">{stats.totalRecords}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-ios-lg">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Loss</p>
                  <p className="text-2xl font-bold text-orange-600">KES {stats.totalCost.toLocaleString()}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-ios-lg">
                  <AlertTriangle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Spoilage</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.byReason['spoilage'] || 0}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-ios-lg">
                  <Flame className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Overcooking</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.byReason['overcooking'] || 0}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Wastage by Reason Chart */}
            <IOSCard className="p-6">
              <h3 className="font-semibold mb-4">Wastage by Reason</h3>
              <div className="space-y-3">
                {Object.entries(wasteReasonConfig).map(([key, config]) => {
                  const count = stats.byReason[key] || 0;
                  const total = stats.totalRecords || 1;
                  const percentage = Math.round((count / total) * 100);
                  const Icon = config.icon;

                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className={`p-1.5 rounded ${config.bgColor}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{config.label}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${config.bgColor.replace('100', '500')}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </IOSCard>

            {/* Top Wasted Items */}
            <IOSCard className="p-6 lg:col-span-2">
              <h3 className="font-semibold mb-4">Top Wasted Items</h3>
              {sortedTopItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Trash2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No wastage data available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedTopItems.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.count} units wasted</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">-KES {item.cost.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </IOSCard>
          </div>

          {/* Filter & Records List */}
          <IOSCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recent Wastage Records</h3>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={filterReason}
                  onChange={(e) => setFilterReason(e.target.value)}
                  className="text-sm bg-gray-100 border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Reasons</option>
                  {Object.entries(wasteReasonConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Trash2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No wastage records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((record) => {
                  const reasonConfig = wasteReasonConfig[record.reason as WasteReason] || wasteReasonConfig.other;
                  const Icon = reasonConfig.icon;

                  return (
                    <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg ${reasonConfig.bgColor} flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 ${reasonConfig.color}`} />
                        </div>
                        <div>
                          <p className="font-medium">{record.item_name}</p>
                          <p className="text-sm text-gray-500">
                            {record.quantity} {record.unit} • {reasonConfig.label}
                          </p>
                          {record.description && (
                            <p className="text-xs text-gray-400 mt-0.5">{record.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">-KES {(record.cost_impact || 0).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(record.logged_at).toLocaleDateString()}
                        </p>
                        {record.user ? (
                          <p className="text-xs text-gray-400">by {record.user.first_name} {record.user.last_name}</p>
                        ) : record.logged_by_name ? (
                          <p className="text-xs text-gray-400">by {record.logged_by_name}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
