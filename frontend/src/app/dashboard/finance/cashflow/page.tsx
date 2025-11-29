'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Wallet, TrendingUp, TrendingDown, ArrowLeft, RefreshCw, 
  Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import Link from 'next/link';

export default function CashFlowPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [cashFlowData, setCashFlowData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchCashFlow();
  }, [dateRange]);

  const fetchCashFlow = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.getCashFlow({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      setCashFlowData(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load cash flow data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `KES ${amount?.toLocaleString() || 0}`;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/finance">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Wallet className="h-6 w-6 text-blue-600" />
                  Cash Flow Report
                </h1>
                <p className="text-gray-600">Track money coming in and going out</p>
              </div>
            </div>
            <Button onClick={fetchCashFlow} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Date Filter */}
          <Card className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium">Period:</span>
              </div>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm"
              />
              <span>to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </Card>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading cash flow data...</div>
          ) : cashFlowData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-green-50 border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700">Total Income</p>
                      <p className="text-2xl font-bold text-green-800">
                        {formatCurrency(cashFlowData.summary?.totalIncome)}
                      </p>
                    </div>
                    <ArrowUpRight className="h-8 w-8 text-green-600" />
                  </div>
                </Card>

                <Card className="p-4 bg-red-50 border-red-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-700">Total Expenses</p>
                      <p className="text-2xl font-bold text-red-800">
                        {formatCurrency(cashFlowData.summary?.totalExpenses)}
                      </p>
                    </div>
                    <ArrowDownRight className="h-8 w-8 text-red-600" />
                  </div>
                </Card>

                <Card className="p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-700">Net Cash Flow</p>
                      <p className={`text-2xl font-bold ${cashFlowData.summary?.netCashFlow >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                        {formatCurrency(cashFlowData.summary?.netCashFlow)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-600" />
                  </div>
                </Card>

                <Card className="p-4 bg-purple-50 border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700">Profit Margin</p>
                      <p className="text-2xl font-bold text-purple-800">
                        {cashFlowData.summary?.profitMargin}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                </Card>
              </div>

              {/* Income & Expense Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <ArrowUpRight className="h-5 w-5 text-green-600" />
                    Income by Category
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(cashFlowData.incomeByCategory || {}).map(([category, amount]) => (
                      <div key={category} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium">{category}</span>
                        <span className="font-bold text-green-700">{formatCurrency(amount as number)}</span>
                      </div>
                    ))}
                    {Object.keys(cashFlowData.incomeByCategory || {}).length === 0 && (
                      <p className="text-gray-500 text-center py-4">No income data</p>
                    )}
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <ArrowDownRight className="h-5 w-5 text-red-600" />
                    Expenses by Category
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(cashFlowData.expensesByCategory || {}).map(([category, amount]) => (
                      <div key={category} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <span className="text-sm font-medium">{category}</span>
                        <span className="font-bold text-red-700">{formatCurrency(amount as number)}</span>
                      </div>
                    ))}
                    {Object.keys(cashFlowData.expensesByCategory || {}).length === 0 && (
                      <p className="text-gray-500 text-center py-4">No expense data</p>
                    )}
                  </div>
                </Card>
              </div>

              {/* Daily Cash Flow */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Daily Cash Flow</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Income</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Expenses</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(cashFlowData.dailyCashFlow || []).map((day: any) => (
                        <tr key={day.date} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{formatDate(day.date)}</td>
                          <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">
                            {formatCurrency(day.income)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-red-600 font-medium">
                            {formatCurrency(day.expenses)}
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-bold ${day.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(day.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">No cash flow data available</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
