'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { financeAPI } from '@/lib/api';
import { Building2, RefreshCw, TrendingUp, DollarSign, PieChart } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface BranchRevenue { branch_id: number; branch_name: string; revenue: number; expenses: number; profit: number; occupancy: number; }

export default function RevenueBranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getRevenueByBranch();
      if (response.success) setBranches(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = branches.reduce((sum, b) => sum + b.revenue, 0);
  const totalProfit = branches.reduce((sum, b) => sum + b.profit, 0);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Revenue by Branch</h1><p className="text-gray-500">Compare branch performance</p></div>
            <div className="flex gap-2">
              {(['week', 'month', 'quarter'] as const).map((p) => (
                <IOSButton key={p} variant={period === p ? 'primary' : 'secondary'} size="sm" onClick={() => setPeriod(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </IOSButton>
              ))}
              <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4" /></IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-ios-lg"><DollarSign className="h-5 w-5 text-[#34C759]" /></div>
                <div><p className="text-sm text-gray-500">Total Revenue</p><p className="text-xl font-bold">KES {totalRevenue.toLocaleString()}</p></div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-ios-lg"><TrendingUp className="h-5 w-5 text-[#007AFF]" /></div>
                <div><p className="text-sm text-gray-500">Total Profit</p><p className="text-xl font-bold text-[#007AFF]">KES {totalProfit.toLocaleString()}</p></div>
              </div>
            </IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : branches.length === 0 ? (
            <IOSCard className="p-12 text-center"><Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No data available</p></IOSCard>
          ) : (
            <div className="space-y-4">
              {branches.map((branch) => {
                const revenuePercent = totalRevenue > 0 ? (branch.revenue / totalRevenue) * 100 : 0;
                return (
                  <IOSCard key={branch.branch_id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Building2 className="h-5 w-5 text-[#007AFF]" /></div>
                        <div><p className="font-bold">{branch.branch_name}</p><p className="text-sm text-gray-500">{revenuePercent.toFixed(1)}% of total</p></div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">KES {branch.revenue.toLocaleString()}</p>
                        <p className={`text-sm ${branch.profit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>Profit: KES {branch.profit.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Revenue</p><p className="font-medium">KES {branch.revenue.toLocaleString()}</p></div>
                      <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Expenses</p><p className="font-medium">KES {branch.expenses.toLocaleString()}</p></div>
                      <div className="p-2 bg-gray-50 rounded"><p className="text-gray-500">Occupancy</p><p className="font-medium">{branch.occupancy}%</p></div>
                    </div>
                    <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#007AFF]" style={{ width: `${revenuePercent}%` }} />
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
