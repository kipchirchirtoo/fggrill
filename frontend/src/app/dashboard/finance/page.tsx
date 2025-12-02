'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { financeAPI } from '@/lib/api';
import { 
  DollarSign, TrendingUp, TrendingDown, CreditCard, RefreshCw,
  ArrowUpRight, ArrowDownRight, PieChart, BarChart3, FileText, Receipt
} from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  pendingPayments: number;
  revenueChange: number;
  expenseChange: number;
}

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({ totalRevenue: 0, totalExpenses: 0, netProfit: 0, pendingPayments: 0, revenueChange: 0, expenseChange: 0 });
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
    { href: '/dashboard/finance/expenses', icon: Receipt, label: 'Expenses', desc: 'Manage expenses', color: 'bg-red-50 text-[#FF3B30]' },
    { href: '/dashboard/finance/invoices', icon: FileText, label: 'Invoices', desc: 'View invoices', color: 'bg-blue-50 text-[#007AFF]' },
    { href: '/dashboard/finance/profit-loss', icon: BarChart3, label: 'P&L', desc: 'Profit & Loss', color: 'bg-green-50 text-[#34C759]' },
    { href: '/dashboard/finance/cashflow', icon: TrendingUp, label: 'Cash Flow', desc: 'Track cash', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/finance/revenue-branches', icon: PieChart, label: 'Revenue', desc: 'By branch', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/finance/kpis', icon: BarChart3, label: 'KPIs', desc: 'Key metrics', color: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1><p className="text-gray-500">Financial overview and management</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-green-100 rounded-ios-lg"><DollarSign className="h-5 w-5 text-[#34C759]" /></div>
                {data.revenueChange >= 0 ? <ArrowUpRight className="h-5 w-5 text-[#34C759]" /> : <ArrowDownRight className="h-5 w-5 text-[#FF3B30]" />}
              </div>
              <p className="text-sm text-gray-500 mt-2">Total Revenue</p>
              <p className="text-xl font-bold">KES {data.totalRevenue?.toLocaleString()}</p>
              <p className={`text-xs ${data.revenueChange >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>{data.revenueChange >= 0 ? '+' : ''}{data.revenueChange}% from last month</p>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-red-100 rounded-ios-lg"><TrendingDown className="h-5 w-5 text-[#FF3B30]" /></div>
                {data.expenseChange <= 0 ? <ArrowDownRight className="h-5 w-5 text-[#34C759]" /> : <ArrowUpRight className="h-5 w-5 text-[#FF3B30]" />}
              </div>
              <p className="text-sm text-gray-500 mt-2">Total Expenses</p>
              <p className="text-xl font-bold">KES {data.totalExpenses?.toLocaleString()}</p>
              <p className={`text-xs ${data.expenseChange <= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>{data.expenseChange >= 0 ? '+' : ''}{data.expenseChange}% from last month</p>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="p-2 bg-blue-100 rounded-ios-lg w-fit"><TrendingUp className="h-5 w-5 text-[#007AFF]" /></div>
              <p className="text-sm text-gray-500 mt-2">Net Profit</p>
              <p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>KES {data.netProfit?.toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="p-2 bg-yellow-100 rounded-ios-lg w-fit"><CreditCard className="h-5 w-5 text-yellow-600" /></div>
              <p className="text-sm text-gray-500 mt-2">Pending Payments</p>
              <p className="text-xl font-bold text-yellow-600">KES {data.pendingPayments?.toLocaleString()}</p>
            </IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-8 w-8 mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="font-medium">{link.label}</p>
                    <p className="text-sm text-gray-500">{link.desc}</p>
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
