'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { financeAPI } from '@/lib/api';

export default function GMFinancePage() {
  const [stats, setStats] = useState({ revenue: 0, expenses: 0, profit: 0, pending: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [dashRes, transRes] = await Promise.all([
        financeAPI.getDashboard().catch(() => ({})),
        financeAPI.getTransactions().catch(() => ({ transactions: [] }))
      ]);
      setStats({
        revenue: dashRes.total_revenue || 0,
        expenses: dashRes.total_expenses || 0,
        profit: dashRes.profit || 0,
        pending: dashRes.pending_payments || 0
      });
      setTransactions(transRes.transactions || transRes || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Financial Overview</h1>
              <p className="text-gray-600">Company-wide financial summary</p>
            </div>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100">
              <DollarSign className="h-8 w-8 text-emerald-600 mb-2" />
              <p className="text-sm text-emerald-700">Total Revenue</p>
              <p className="text-2xl font-bold text-emerald-900">KES {stats.revenue.toLocaleString()}</p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100">
              <TrendingDown className="h-8 w-8 text-red-600 mb-2" />
              <p className="text-sm text-red-700">Total Expenses</p>
              <p className="text-2xl font-bold text-red-900">KES {stats.expenses.toLocaleString()}</p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
              <TrendingUp className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-sm text-blue-700">Net Profit</p>
              <p className="text-2xl font-bold text-blue-900">KES {stats.profit.toLocaleString()}</p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100">
              <CreditCard className="h-8 w-8 text-amber-600 mb-2" />
              <p className="text-sm text-amber-700">Pending</p>
              <p className="text-2xl font-bold text-amber-900">KES {stats.pending.toLocaleString()}</p>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card>
            <div className="p-4 border-b">
              <h2 className="font-semibold">Recent Transactions</h2>
            </div>
            <div className="divide-y">
              {transactions.slice(0, 10).map((t: any, i: number) => (
                <div key={t.id || i} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t.description || t.type}</p>
                    <p className="text-sm text-gray-500">{t.date || t.created_at}</p>
                  </div>
                  <span className={`font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'} KES {(t.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="p-8 text-center text-gray-500">No transactions found</div>
              )}
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
