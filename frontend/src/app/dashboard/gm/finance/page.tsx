'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { financeAPI } from '@/lib/api';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight, PieChart, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function GMFinancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>({ totalRevenue: 0, totalExpenses: 0, netProfit: 0, revenueChange: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getDashboard();
      if (response.success) setData(response.data || {});
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Financial Overview</h1><p className="text-gray-500">All branches financial summary</p></div>
            <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-5 w-5 text-[#34C759]" />
                {data.revenueChange >= 0 ? <ArrowUpRight className="h-4 w-4 text-[#34C759]" /> : <ArrowDownRight className="h-4 w-4 text-[#FF3B30]" />}
              </div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold">KES {data.totalRevenue?.toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <TrendingDown className="h-5 w-5 text-[#FF3B30] mb-2" />
              <p className="text-sm text-gray-500">Total Expenses</p>
              <p className="text-xl font-bold">KES {data.totalExpenses?.toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <TrendingUp className="h-5 w-5 text-[#007AFF] mb-2" />
              <p className="text-sm text-gray-500">Net Profit</p>
              <p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>KES {data.netProfit?.toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <BarChart3 className="h-5 w-5 text-purple-600 mb-2" />
              <p className="text-sm text-gray-500">Growth</p>
              <p className={`text-xl font-bold ${data.revenueChange >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>{data.revenueChange >= 0 ? '+' : ''}{data.revenueChange}%</p>
            </IOSCard>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Links</h2>
              <div className="space-y-3">
                <Link href="/dashboard/finance/profit-loss"><IOSButton variant="secondary" className="w-full justify-start" leftIcon={<BarChart3 />}>Profit & Loss</IOSButton></Link>
                <Link href="/dashboard/finance/revenue-branches"><IOSButton variant="secondary" className="w-full justify-start" leftIcon={<PieChart />}>Revenue by Branch</IOSButton></Link>
                <Link href="/dashboard/finance/expenses"><IOSButton variant="secondary" className="w-full justify-start" leftIcon={<TrendingDown />}>Expenses</IOSButton></Link>
              </div>
            </IOSCard>
            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-50 rounded-ios-lg"><span>Revenue</span><span className="font-bold text-[#34C759]">KES {data.totalRevenue?.toLocaleString()}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-ios-lg"><span>Expenses</span><span className="font-bold text-[#FF3B30]">KES {data.totalExpenses?.toLocaleString()}</span></div>
                <div className="flex justify-between p-3 bg-blue-50 rounded-ios-lg font-bold"><span>Net Profit</span><span className={data.netProfit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}>KES {data.netProfit?.toLocaleString()}</span></div>
              </div>
            </IOSCard>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
