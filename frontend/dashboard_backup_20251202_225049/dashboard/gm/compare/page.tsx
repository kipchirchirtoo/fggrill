'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { financeAPI } from '@/lib/api';
import { BarChart3, RefreshCw, Building2, TrendingUp, DollarSign, Bed, Users } from 'lucide-react';

interface BranchData { branch_id: number; branch_name: string; revenue: number; expenses: number; profit: number; occupancy: number; staff_count: number; }

export default function GMComparePage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metric, setMetric] = useState<'revenue' | 'profit' | 'occupancy'>('revenue');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getRevenueByBranch();
      if (response.success) setBranches(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxValue = Math.max(...branches.map(b => b[metric] || 0));

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Branch Comparison</h1><p className="text-gray-500">Compare performance across branches</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="flex gap-2">
            {(['revenue', 'profit', 'occupancy'] as const).map((m) => (
              <IOSButton key={m} variant={metric === m ? 'primary' : 'secondary'} size="sm" onClick={() => setMetric(m)}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : branches.length === 0 ? (
            <IOSCard className="p-12 text-center"><BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No data available</p></IOSCard>
          ) : (
            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-6">{metric.charAt(0).toUpperCase() + metric.slice(1)} Comparison</h2>
              <div className="space-y-4">
                {branches.sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).map((branch, i) => {
                  const value = branch[metric] || 0;
                  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
                  return (
                    <div key={branch.branch_id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">{i + 1}</span>
                          <span className="font-medium">{branch.branch_name}</span>
                        </div>
                        <span className="font-bold">
                          {metric === 'occupancy' ? `${value}%` : `KES ${value.toLocaleString()}`}
                        </span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${i === 0 ? 'bg-green-500' : i === 1 ? 'bg-blue-500' : 'bg-gray-400'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </IOSCard>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <IOSCard key={branch.branch_id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <p className="font-bold">{branch.branch_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Revenue</p><p className="font-bold">KES {branch.revenue?.toLocaleString()}</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Profit</p><p className={`font-bold ${branch.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>KES {branch.profit?.toLocaleString()}</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Occupancy</p><p className="font-bold">{branch.occupancy}%</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Staff</p><p className="font-bold">{branch.staff_count}</p></div>
                </div>
              </IOSCard>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
