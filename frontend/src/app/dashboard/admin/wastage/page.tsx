'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { restaurantAPI, systemAPI } from '@/lib/api';
import { 
  Trash2, RefreshCw, AlertTriangle, TrendingDown, Building2,
  Flame, Timer, Ban, RotateCcw, Search, HelpCircle, Filter,
  Download, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface WastageRecord {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  reason: string;
  cost_impact: number;
  description?: string;
  logged_by_name?: string;
  logged_at: string;
  branch_id?: number;
  branch_name?: string;
}

interface Branch {
  id: number;
  name: string;
}

type WasteReason = 'spoilage' | 'expiry' | 'damage' | 'overcooking' | 'customer_return' | 'quality_control' | 'other';

const wasteReasonConfig: Record<WasteReason, { label: string; color: string; icon: any; bgColor: string; chartColor: string }> = {
  spoilage: { label: 'Spoilage', color: 'text-red-700', icon: AlertTriangle, bgColor: 'bg-red-100', chartColor: '#ef4444' },
  expiry: { label: 'Expired', color: 'text-purple-700', icon: Timer, bgColor: 'bg-purple-100', chartColor: '#a855f7' },
  damage: { label: 'Damaged', color: 'text-orange-700', icon: Ban, bgColor: 'bg-orange-100', chartColor: '#f97316' },
  overcooking: { label: 'Overcooked', color: 'text-amber-700', icon: Flame, bgColor: 'bg-amber-100', chartColor: '#f59e0b' },
  customer_return: { label: 'Customer Return', color: 'text-blue-700', icon: RotateCcw, bgColor: 'bg-blue-100', chartColor: '#3b82f6' },
  quality_control: { label: 'Quality Control', color: 'text-yellow-700', icon: Search, bgColor: 'bg-yellow-100', chartColor: '#eab308' },
  other: { label: 'Other', color: 'text-gray-700', icon: HelpCircle, bgColor: 'bg-gray-100', chartColor: '#6b7280' },
};

export default function AdminWastagePage() {
  const { user } = useAuth();
  const [wastageRecords, setWastageRecords] = useState<WastageRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [selectedBranch, setSelectedBranch] = useState<number | 'all'>('all');
  const [filterReason, setFilterReason] = useState<string>('all');
  
  // Stats
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalCost: 0,
    byReason: {} as Record<string, number>,
    byBranch: {} as Record<number, { name: string; count: number; cost: number }>,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recordsRes, branchesRes, summaryRes] = await Promise.all([
        restaurantAPI.getWastageRecords(),
        systemAPI.getBranches(),
        restaurantAPI.getWastageSummary(period),
      ]);

      if (branchesRes.success) {
        setBranches(branchesRes.data || []);
      }

      if (recordsRes.success) {
        const records = recordsRes.data || [];
        setWastageRecords(records);
        
        // Calculate stats by branch
        const byBranch: Record<number, { name: string; count: number; cost: number }> = {};
        const byReason: Record<string, number> = {};
        
        records.forEach((r: WastageRecord) => {
          // By branch
          const branchId = r.branch_id || 0;
          if (!byBranch[branchId]) {
            byBranch[branchId] = { 
              name: r.branch_name || `Branch ${branchId}`, 
              count: 0, 
              cost: 0 
            };
          }
          byBranch[branchId].count++;
          byBranch[branchId].cost += r.cost_impact || 0;
          
          // By reason
          const reason = r.reason || 'other';
          byReason[reason] = (byReason[reason] || 0) + 1;
        });

        setStats({
          totalRecords: records.length,
          totalCost: records.reduce((sum: number, r: WastageRecord) => sum + (r.cost_impact || 0), 0),
          byReason,
          byBranch,
        });
      }
      
      if (summaryRes.success && summaryRes.data) {
        setStats(prev => ({
          ...prev,
          totalRecords: summaryRes.data.totalRecords || prev.totalRecords,
          totalCost: summaryRes.data.totalCost || prev.totalCost,
          byReason: summaryRes.data.byReason || prev.byReason,
        }));
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

  const filteredRecords = wastageRecords.filter(record => {
    const matchesBranch = selectedBranch === 'all' || record.branch_id === selectedBranch;
    const matchesReason = filterReason === 'all' || record.reason === filterReason;
    return matchesBranch && matchesReason;
  });

  // Top wasted items across all branches
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
    .slice(0, 10);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">System Wastage Analytics</h1>
              <p className="text-stone-500">Comprehensive wastage analysis across all branches</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['today', 'week', 'month'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      period === p 
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

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <div className="p-2 bg-blue-100 rounded-ios-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branches Affected</p>
                  <p className="text-2xl font-bold text-blue-600">{Object.keys(stats.byBranch).length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-ios-lg">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg per Incident</p>
                  <p className="text-2xl font-bold text-purple-600">
                    KES {stats.totalRecords > 0 
                      ? Math.round(stats.totalCost / stats.totalRecords).toLocaleString() 
                      : 0}
                  </p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-ios-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Top Reason</p>
                  <p className="text-lg font-bold text-amber-600">
                    {Object.entries(stats.byReason).sort(([,a], [,b]) => b - a)[0]?.[0] 
                      ? wasteReasonConfig[Object.entries(stats.byReason).sort(([,a], [,b]) => b - a)[0][0] as WasteReason]?.label || 'N/A'
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Branch Comparison Table */}
          <IOSCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Branch Wastage Comparison</h3>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="text-sm bg-gray-100 border-0 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
            
            {Object.keys(stats.byBranch).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No branch data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Branch</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Incidents</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Total Loss</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">% of Total</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.byBranch)
                      .sort(([, a], [, b]) => b.cost - a.cost)
                      .map(([branchId, data]) => {
                        const percentage = stats.totalCost > 0 ? (data.cost / stats.totalCost) * 100 : 0;
                        return (
                          <tr key={branchId} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-gray-400" />
                                <span className="font-medium">{data.name}</span>
                              </div>
                            </td>
                            <td className="text-right py-3 px-4">{data.count}</td>
                            <td className="text-right py-3 px-4 font-bold text-red-600">
                              KES {data.cost.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-4">{percentage.toFixed(1)}%</td>
                            <td className="py-3 px-4">
                              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-red-500"
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="py-3 px-4">Total</td>
                      <td className="text-right py-3 px-4">{stats.totalRecords}</td>
                      <td className="text-right py-3 px-4 text-red-600">KES {stats.totalCost.toLocaleString()}</td>
                      <td className="text-right py-3 px-4">100%</td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </IOSCard>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Wastage by Reason */}
            <IOSCard className="p-6">
              <h3 className="font-semibold mb-4">Wastage by Reason</h3>
              <div className="space-y-3">
                {Object.entries(wasteReasonConfig).map(([key, config]) => {
                  const count = stats.byReason[key] || 0;
                  const total = stats.totalRecords || 1;
                  const percentage = Math.round((count / total) * 100);
                  const Icon = config.icon;
                  
                  return (
                    <div 
                      key={key} 
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                        filterReason === key ? 'bg-gray-100' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setFilterReason(filterReason === key ? 'all' : key)}
                    >
                      <div className={`p-1.5 rounded ${config.bgColor}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{config.label}</span>
                          <span className="font-medium">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full"
                            style={{ width: `${percentage}%`, backgroundColor: config.chartColor }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </IOSCard>

            {/* Top Wasted Items */}
            <IOSCard className="p-6">
              <h3 className="font-semibold mb-4">Top 10 Wasted Items</h3>
              {sortedTopItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Trash2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No wastage data available</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {sortedTopItems.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        index < 3 ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.count} units</p>
                      </div>
                      <p className="font-bold text-red-600">-KES {item.cost.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </IOSCard>
          </div>

          {/* Recent Records */}
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Item</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Branch</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Reason</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Quantity</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Loss</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Logged By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.slice(0, 20).map((record) => {
                      const reasonConfig = wasteReasonConfig[record.reason as WasteReason] || wasteReasonConfig.other;
                      const Icon = reasonConfig.icon;
                      
                      return (
                        <tr key={record.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{record.item_name}</td>
                          <td className="py-3 px-4 text-gray-600">{record.branch_name || 'Unknown'}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${reasonConfig.bgColor}`}>
                                <Icon className={`h-3 w-3 ${reasonConfig.color}`} />
                              </div>
                              <span className="text-sm">{reasonConfig.label}</span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">{record.quantity} {record.unit}</td>
                          <td className="text-right py-3 px-4 font-bold text-red-600">
                            -KES {(record.cost_impact || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {new Date(record.logged_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-gray-600">{record.logged_by_name || '-'}</td>
                        </tr>
                      );
                    })}
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
