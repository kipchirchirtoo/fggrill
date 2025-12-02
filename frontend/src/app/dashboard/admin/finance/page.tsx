'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { financeAPI } from '@/lib/api';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, BarChart3, PieChart, FileText } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function AdminFinancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>({ totalRevenue: 0, totalExpenses: 0, netProfit: 0 });
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

  const quickLinks = [
    { href: '/dashboard/finance/expenses', icon: TrendingDown, label: 'Expenses', color: 'bg-red-50 text-[#FF3B30]' },
    { href: '/dashboard/admin/finance/budgets', icon: PieChart, label: 'Budgets', color: 'bg-blue-50 text-[#007AFF]' },
    { href: '/dashboard/finance/profit-loss', icon: BarChart3, label: 'P&L', color: 'bg-green-50 text-[#34C759]' },
    { href: '/dashboard/finance/reports', icon: FileText, label: 'Reports', color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Finance</h1><p className="text-gray-500">Financial overview</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><DollarSign className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold text-[#34C759]">KES {data.totalRevenue?.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4"><TrendingDown className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Expenses</p><p className="text-xl font-bold text-[#FF3B30]">KES {data.totalExpenses?.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4"><TrendingUp className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Net Profit</p><p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>KES {data.netProfit?.toLocaleString()}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-8 w-8 mx-auto mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="font-medium">{link.label}</p>
                  </IOSCard>
                </Link>
              ))}
            </div>
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
