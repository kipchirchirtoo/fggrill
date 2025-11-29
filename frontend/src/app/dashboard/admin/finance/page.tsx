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
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Plus,
  Edit2,
  Trash2,
  MoreHorizontal,
  Search,
  Filter,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { PaymentModal, InvoiceModal } from '@/components/modals/FinanceModals';
import { financeAPI, storeAPI } from '@/lib/api';

export default function AdminFinancePage() {
  const { user } = useAuth();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [financialOverview, setFinancialOverview] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    todayRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    outstandingPayments: 0
  });

  const [revenueBreakdown, setRevenueBreakdown] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  const fetchFinanceData = async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, transactionsRes] = await Promise.all([
        financeAPI.getDashboard().catch(() => ({})),
        financeAPI.getTransactions().catch(() => ({ transactions: [] }))
      ]);

      const dashboard = dashboardRes || {};
      const transactions = transactionsRes.transactions || transactionsRes || [];

      setFinancialOverview({
        totalRevenue: dashboard.total_revenue || 0,
        monthlyRevenue: dashboard.monthly_revenue || 0,
        weeklyRevenue: dashboard.weekly_revenue || 0,
        todayRevenue: dashboard.today_revenue || 0,
        totalExpenses: dashboard.total_expenses || 0,
        netProfit: (dashboard.total_revenue || 0) - (dashboard.total_expenses || 0),
        profitMargin: dashboard.profit_margin || 0,
        outstandingPayments: dashboard.outstanding_payments || 0
      });

      // Set transactions
      if (Array.isArray(transactions)) {
        setRecentTransactions(transactions.slice(0, 10).map((t: any) => ({
          id: t.id || t.transaction_id || '-',
          type: t.type || 'income',
          description: t.description || '-',
          amount: t.amount || 0,
          date: t.date || t.created_at,
          status: t.status || 'completed'
        })));
      }
    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Financial Overview</h1>
              <p className="text-gray-600 mt-1">Complete financial management and reporting</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                This Month
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export Report
              </button>
            </div>
          </div>

          {/* Financial Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-xs text-green-600 font-medium">+12.5%</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">KES {(financialOverview.totalRevenue / 1000000).toFixed(2)}M</p>
              <p className="text-sm text-gray-600 mt-1">Total Revenue</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-xs text-blue-600 font-medium">+8.3%</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">KES {(financialOverview.monthlyRevenue / 1000).toFixed(0)}K</p>
              <p className="text-sm text-gray-600 mt-1">Monthly Revenue</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <span className="text-xs text-red-600 font-medium">-5.2%</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">KES {(financialOverview.totalExpenses / 1000000).toFixed(1)}M</p>
              <p className="text-sm text-gray-600 mt-1">Total Expenses</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-sm p-6 text-white"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <PieChart className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium">{financialOverview.profitMargin}% margin</span>
              </div>
              <p className="text-2xl font-bold">KES {(financialOverview.netProfit / 1000000).toFixed(2)}M</p>
              <p className="text-sm mt-1">Net Profit</p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h2>
              <div className="space-y-4">
                {revenueBreakdown.map(item => (
                  <div key={item.source}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{item.source}</span>
                      <span className="text-sm font-bold text-gray-900">KES {(item.amount / 1000000).toFixed(2)}M</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{item.percentage}% of total</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h2>
              <div className="space-y-4">
                {expenseBreakdown.map(item => (
                  <div key={item.category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{item.category}</span>
                      <span className="text-sm font-bold text-gray-900">KES {(item.amount / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-red-500 to-orange-600 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{item.percentage}% of total</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
              <a href="#" className="text-sm text-indigo-600 hover:text-indigo-700">View all →</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentTransactions.map(transaction => (
                    <tr key={transaction.id}>
                      <td className="px-4 py-3 text-sm font-medium">{transaction.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          {transaction.type === 'income' ? (
                            <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
                          )}
                          <span className={`text-sm ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{transaction.description}</td>
                      <td className="px-4 py-3 text-sm font-bold">
                        <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                          {transaction.type === 'income' ? '+' : '-'} KES {transaction.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{transaction.date}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                          transaction.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
            <h2 className="text-lg font-semibold mb-4">Financial Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <CreditCard className="h-6 w-6 mb-2 mx-auto" />
                <span className="text-sm">Process Payment</span>
              </button>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <FileText className="h-6 w-6 mb-2 mx-auto" />
                <span className="text-sm">Create Invoice</span>
              </button>
              <button
                onClick={() => toast.info('Opening expense form...')}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <TrendingDown className="h-6 w-6 mb-2 mx-auto" />
                <span className="text-sm">Record Expense</span>
              </button>
              <button
                onClick={() => toast.info('Opening financial reports...')}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <BarChart3 className="h-6 w-6 mb-2 mx-auto" />
                <span className="text-sm">View Reports</span>
              </button>
            </div>
          </div>

          {/* Finance Modals */}
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            mode="create"
          />
          <InvoiceModal
            isOpen={showInvoiceModal}
            onClose={() => setShowInvoiceModal(false)}
            mode="create"
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
