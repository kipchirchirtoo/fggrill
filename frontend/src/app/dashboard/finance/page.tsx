'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  AlertCircle,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { financeAPI, storeAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [financialStats, setFinancialStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
    expenses: 0,
    profit: 0,
    revenueGrowth: 0,
    expenseGrowth: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, transactionsRes] = await Promise.all([
        financeAPI.getDashboard().catch(() => ({})),
        financeAPI.getTransactions().catch(() => ({ transactions: [] }))
      ]);

      const dashboard = dashboardRes || {};
      const transactions = transactionsRes.transactions || transactionsRes || [];

      setFinancialStats({
        totalRevenue: dashboard.total_revenue || 0,
        monthlyRevenue: dashboard.monthly_revenue || 0,
        pendingPayments: dashboard.pending_payments || 0,
        expenses: dashboard.total_expenses || 0,
        profit: (dashboard.monthly_revenue || 0) - (dashboard.total_expenses || 0),
        revenueGrowth: dashboard.revenue_growth || 0,
        expenseGrowth: dashboard.expense_growth || 0
      });

      if (Array.isArray(transactions)) {
        setRecentTransactions(transactions.slice(0, 10).map((t: any) => ({
          id: t.id,
          type: t.type || (t.amount > 0 ? 'income' : 'expense'),
          description: t.description || '-',
          amount: Math.abs(t.amount || 0),
          date: t.date || t.created_at
        })));
      }
    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Finance Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Welcome, {user?.firstName}! Monitor financial performance and transactions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    KES {financialStats.totalRevenue.toLocaleString()}
                  </p>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                    <span className="text-sm ml-1 text-green-500">
                      {financialStats.revenueGrowth}%
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-green-50">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    KES {financialStats.monthlyRevenue.toLocaleString()}
                  </p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-sm ml-1 text-blue-500">This month</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-blue-50">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Expenses</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    KES {financialStats.expenses.toLocaleString()}
                  </p>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="h-4 w-4 text-red-500" />
                    <span className="text-sm ml-1 text-red-500">
                      {financialStats.expenseGrowth}%
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-red-50">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Net Profit</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    KES {financialStats.profit.toLocaleString()}
                  </p>
                  <div className="flex items-center mt-2">
                    <PieChart className="h-4 w-4 text-purple-500" />
                    <span className="text-sm ml-1 text-purple-500">This month</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-purple-50">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
              <div className="space-y-3">
                {recentTransactions.map(transaction => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {transaction.type === 'income' ? (
                        <div className="p-2 bg-green-100 rounded-lg">
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-red-100 rounded-lg">
                          <ArrowDownRight className="h-4 w-4 text-red-600" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                        <p className="text-xs text-gray-600">{transaction.date}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'} KES {transaction.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                <button className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                  <FileText className="h-6 w-6 text-green-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Generate Invoice</span>
                </button>
                <button className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <CreditCard className="h-6 w-6 text-blue-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Process Payment</span>
                </button>
                <button className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <BarChart3 className="h-6 w-6 text-purple-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">View Reports</span>
                </button>
                <button className="p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                  <DollarSign className="h-6 w-6 text-yellow-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Expense Entry</span>
                </button>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <span className="text-sm font-medium text-yellow-800">Pending Payments</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  KES {financialStats.pendingPayments.toLocaleString()} in outstanding invoices
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
