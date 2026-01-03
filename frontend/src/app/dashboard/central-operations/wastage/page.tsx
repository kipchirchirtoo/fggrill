'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { restaurantAPI, systemAPI } from '@/lib/api';
import { 
  Trash2, RefreshCw, AlertTriangle, TrendingDown, Building2,
  Flame, Timer, Ban, RotateCcw, Search, HelpCircle, Filter
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

const wasteReasonConfig: Record<WasteReason, { label: string; color: string; icon: any; bgColor: string }> = {
  spoilage: { label: 'Spoilage', color: 'text-red-700', icon: AlertTriangle, bgColor: 'bg-red-100' },
  expiry: { label: 'Expired', color: 'text-purple-700', icon: Timer, bgColor: 'bg-purple-100' },
  damage: { label: 'Damaged', color: 'text-orange-700', icon: Ban, bgColor: 'bg-orange-100' },
  overcooking: { label: 'Overcooked', color: 'text-amber-700', icon: Flame, bgColor: 'bg-amber-100' },
  customer_return: { label: 'Customer Return', color: 'text-blue-700', icon: RotateCcw, bgColor: 'bg-blue-100' },
  quality_control: { label: 'Quality Control', color: 'text-yellow-700', icon: Search, bgColor: 'bg-yellow-100' },
  other: { label: 'Other', color: 'text-gray-700', icon: HelpCircle, bgColor: 'bg-gray-100' },
};

export default function CentralWastagePage() {
  const { user } = useAuth();
  const [wastageRecords, setWastageRecords] = useState<WastageRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
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
        records.forEach((r: WastageRecord) => {
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
        });

        setStats({
          totalRecords: recordsRes.summary?.totalRecords || records.length,
          totalCost: recordsRes.summary?.totalCost || records.reduce((sum: number, r: WastageRecord) => sum + (r.cost_impact || 0), 0),
          byReason: recordsRes.summary?.byReason || {},
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

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">Central Wastage Overview</h1>
              <p className="text-stone-500">Monitor food waste across all branches</p>
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

          {/* Overall Stats */}
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
                <div className="p-2 bg-blue-100 rounded-ios-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branches</p>
                  <p className="text-2xl font-bold text-blue-600">{Object.keys(stats.byBranch).length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-ios-lg">
                  <AlertTriangle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg per Branch</p>
                  <p className="text-2xl font-bold text-purple-600">
                    KES {Object.keys(stats.byBranch).length > 0 
                      ? Math.round(stats.totalCost / Object.keys(stats.byBranch).length).toLocaleString() 
                      : 0}
                  </p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Branch Comparison */}
          <IOSCard className="p-6">
            <h3 className="font-semibold mb-4">Wastage by Branch</h3>
            {Object.keys(stats.byBranch).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No branch data available</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(stats.byBranch)
                  .sort(([, a], [, b]) => b.cost - a.cost)
                  .map(([branchId, data]) => (
                    <div 
                      key={branchId} 
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                        selectedBranch === Number(branchId) ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedBranch(selectedBranch === Number(branchId) ? 'all' : Number(branchId))}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{data.name}</span>
                        </div>
                        <span className="text-sm text-gray-500">{data.count} incidents</span>
                      </div>
                      <p className="text-xl font-bold text-red-600">-KES {data.cost.toLocaleString()}</p>
                      <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500"
                          style={{ width: `${Math.min((data.cost / stats.totalCost) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </IOSCard>

          {/* Wastage by Reason */}
          <div className="grid lg:grid-cols-2 gap-6">
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
                          <span className="font-medium">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-red-400`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </IOSCard>

            {/* Recent Records */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Recent Records</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="text-sm bg-gray-100 border-0 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Trash2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>No records found</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredRecords.slice(0, 10).map((record) => {
                    const reasonConfig = wasteReasonConfig[record.reason as WasteReason] || wasteReasonConfig.other;
                    const Icon = reasonConfig.icon;
                    
                    return (
                      <div key={record.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded ${reasonConfig.bgColor} flex items-center justify-center`}>
                            <Icon className={`h-4 w-4 ${reasonConfig.color}`} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{record.item_name}</p>
                            <p className="text-xs text-gray-500">
                              {record.branch_name || 'Unknown'} • {record.quantity} {record.unit}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600 text-sm">-KES {(record.cost_impact || 0).toLocaleString()}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(record.logged_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </IOSCard>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
