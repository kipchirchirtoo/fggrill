'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { Building2, RefreshCw, TrendingUp, DollarSign } from 'lucide-react';

interface BranchRevenue { branch_id: number; branch_name: string; revenue: number; expenses: number; profit: number; occupancy: number; }

export default function RevenueBranchesPage() {
  const [branches, setBranches] = useState<BranchRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getRevenueByBranch();
      if (response.success && Array.isArray(response.data)) {
        setBranches(response.data);
      } else {
        setBranches([]);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = Array.isArray(branches) ? branches.reduce((sum, b) => sum + (b.revenue || 0), 0) : 0;
  const totalProfit = Array.isArray(branches) ? branches.reduce((sum, b) => sum + (b.profit || 0), 0) : 0;

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Revenue by Branch</h1>
              <p className="text-sm text-gray-500 mt-1">Compare branch performance</p>
            </div>
            <div className="flex gap-2">
              {(['week', 'month', 'quarter'] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${period === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
              <button onClick={fetchData} disabled={isLoading} className="p-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><DollarSign className="h-5 w-5 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Revenue</p>
                  <p className="text-xl font-semibold text-gray-900">KES {totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><TrendingUp className="h-5 w-5 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Profit</p>
                  <p className="text-xl font-semibold text-gray-900">KES {totalProfit.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : branches.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No data available</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {branches.map((branch) => {
                const revenuePercent = totalRevenue > 0 ? (branch.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={branch.branch_id} className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{branch.branch_name}</p>
                          <p className="text-sm text-gray-500">{revenuePercent.toFixed(1)}% of total</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">KES {branch.revenue.toLocaleString()}</p>
                        <p className="text-sm text-gray-500">Profit: KES {branch.profit.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div className="p-2 bg-gray-50 rounded-lg"><p className="text-gray-500">Revenue</p><p className="font-medium text-gray-900">KES {branch.revenue.toLocaleString()}</p></div>
                      <div className="p-2 bg-gray-50 rounded-lg"><p className="text-gray-500">Expenses</p><p className="font-medium text-gray-900">KES {branch.expenses.toLocaleString()}</p></div>
                      <div className="p-2 bg-gray-50 rounded-lg"><p className="text-gray-500">Occupancy</p><p className="font-medium text-gray-900">{branch.occupancy}%</p></div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-400" style={{ width: `${revenuePercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
