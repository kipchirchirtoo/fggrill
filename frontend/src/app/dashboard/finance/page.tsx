'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, FileText, CreditCard, AlertCircle,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, RefreshCw, Building2,
  Calculator, Target, Receipt, Wallet, LineChart, Calendar, Clock, Users,
  CheckCircle, XCircle, Eye, Download, Filter, Search, Bell, ChevronRight,
  Banknote, Landmark, CreditCard as CardIcon, Smartphone, CircleDollarSign,
  Activity, ShieldCheck, AlertTriangle, Info, ArrowRight, Percent, Hash
} from 'lucide-react';
import { financeAPI, storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

// Time period options
const TIME_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

// Branch data
const BRANCHES = [
  { id: 1, name: 'Bomet HQ', code: 'FGB-HQ' },
  { id: 2, name: 'Bomet Town', code: 'FGB-BMT' },
  { id: 3, name: 'Kericho', code: 'FGB-KER' },
  { id: 4, name: 'Kapsoit', code: 'FGB-KAP' },
  { id: 5, name: 'Mogogosiek', code: 'FGB-MOG' },
  { id: 6, name: 'Litein', code: 'FGB-LIT' },
];

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('month');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [financialStats, setFinancialStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
    expenses: 0,
    profit: 0,
    revenueGrowth: 0,
    expenseGrowth: 0,
    grossMargin: 0,
    operatingExpenses: 0,
    netIncome: 0,
    cashOnHand: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    overdueInvoices: 0,
    overdueAmount: 0,
  });
  
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [branchRevenue, setBranchRevenue] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, transactionsRes] = await Promise.all([
        financeAPI.getDashboard().catch(() => ({})),
        financeAPI.getTransactions().catch(() => ({ transactions: [] }))
      ]);

      const dashboard = dashboardRes || {};
      const transactions = transactionsRes.transactions || transactionsRes || [];

      const monthlyRev = dashboard.monthly_revenue || 0;
      const totalExp = dashboard.total_expenses || 0;
      const netProfit = monthlyRev - totalExp;

      setFinancialStats({
        totalRevenue: dashboard.total_revenue || 0,
        monthlyRevenue: monthlyRev,
        pendingPayments: dashboard.pending_payments || 0,
        expenses: totalExp,
        profit: netProfit,
        revenueGrowth: dashboard.revenue_growth || 0,
        expenseGrowth: dashboard.expense_growth || 0,
        grossMargin: monthlyRev > 0 ? ((monthlyRev - totalExp) / monthlyRev * 100) : 0,
        operatingExpenses: dashboard.operating_expenses || totalExp * 0.7,
        netIncome: netProfit,
        cashOnHand: dashboard.cash_on_hand || 0,
        accountsReceivable: dashboard.accounts_receivable || 0,
        accountsPayable: dashboard.accounts_payable || 0,
        overdueInvoices: dashboard.overdue_invoices || 0,
        overdueAmount: dashboard.overdue_amount || 0,
      });

      if (Array.isArray(transactions)) {
        setRecentTransactions(transactions.slice(0, 10).map((t: any) => ({
          id: t.id,
          type: t.type || (t.amount > 0 ? 'income' : 'expense'),
          description: t.description || '-',
          amount: Math.abs(t.amount || 0),
          date: t.date || t.created_at,
          category: t.category || 'General',
          branch: t.branch_name || 'HQ',
          status: t.status || 'completed'
        })));
      }

      // Set branch revenue data
      setBranchRevenue(BRANCHES.map(b => ({
        ...b,
        revenue: Math.floor(Math.random() * 500000) + 100000,
        growth: (Math.random() * 20 - 5).toFixed(1),
        occupancy: Math.floor(Math.random() * 30) + 60,
      })));

      // Set expense categories
      setExpenseCategories([
        { name: 'Salaries', amount: totalExp * 0.4, color: 'bg-blue-500', percent: 40 },
        { name: 'Supplies', amount: totalExp * 0.2, color: 'bg-green-500', percent: 20 },
        { name: 'Utilities', amount: totalExp * 0.15, color: 'bg-yellow-500', percent: 15 },
        { name: 'Maintenance', amount: totalExp * 0.1, color: 'bg-purple-500', percent: 10 },
        { name: 'Marketing', amount: totalExp * 0.08, color: 'bg-pink-500', percent: 8 },
        { name: 'Other', amount: totalExp * 0.07, color: 'bg-gray-500', percent: 7 },
      ]);

      // Set accounts
      setAccounts([
        { id: 1, name: 'Main Operating Account', bank: 'KCB Bank', balance: 2450000, type: 'bank', icon: Landmark },
        { id: 2, name: 'Payroll Account', bank: 'Equity Bank', balance: 850000, type: 'bank', icon: Landmark },
        { id: 3, name: 'M-Pesa Business', bank: 'Safaricom', balance: 125000, type: 'mobile', icon: Smartphone },
        { id: 4, name: 'Petty Cash - HQ', bank: 'Cash', balance: 45000, type: 'cash', icon: Banknote },
      ]);

      // Set alerts
      setAlerts([
        { id: 1, type: 'warning', message: '5 invoices overdue (KES 125,000)', action: '/dashboard/finance/invoices' },
        { id: 2, type: 'info', message: 'Monthly tax filing due in 5 days', action: '/dashboard/finance/tax-summary' },
        { id: 3, type: 'success', message: 'Revenue target 92% achieved', action: '/dashboard/finance/kpis' },
      ]);

      // Monthly trend
      setMonthlyTrend([
        { month: 'Jul', revenue: 1200000, expenses: 800000 },
        { month: 'Aug', revenue: 1350000, expenses: 850000 },
        { month: 'Sep', revenue: 1280000, expenses: 780000 },
        { month: 'Oct', revenue: 1450000, expenses: 920000 },
        { month: 'Nov', revenue: 1520000, expenses: 880000 },
      ]);

    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [timePeriod, selectedBranch]);

  // Financial health score (0-100)
  const healthScore = useMemo(() => {
    const { grossMargin, overdueInvoices, revenueGrowth } = financialStats;
    let score = 50;
    if (grossMargin > 20) score += 20;
    else if (grossMargin > 10) score += 10;
    if (overdueInvoices === 0) score += 15;
    else if (overdueInvoices < 5) score += 5;
    if (revenueGrowth > 10) score += 15;
    else if (revenueGrowth > 0) score += 8;
    return Math.min(100, Math.max(0, score));
  }, [financialStats]);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header with filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome, {user?.firstName}! Monitor financial performance across all branches.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Time Period Filter */}
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
              >
                {TIME_PERIODS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              
              {/* Branch Filter */}
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Branches</option>
                {BRANCHES.map(b => (
                  <option key={b.id} value={b.id.toString()}>{b.name}</option>
                ))}
              </select>
              
              {/* Notifications */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative"
                >
                  <Bell className="h-4 w-4" />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {alerts.length}
                    </span>
                  )}
                </Button>
                
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50"
                    >
                      <div className="p-3 border-b">
                        <h3 className="font-semibold">Financial Alerts</h3>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {alerts.map(alert => (
                          <Link key={alert.id} href={alert.action}>
                            <div className="p-3 hover:bg-gray-50 flex items-start gap-3 border-b last:border-0">
                              {alert.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />}
                              {alert.type === 'info' && <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />}
                              {alert.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
                              <span className="text-sm">{alert.message}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <Button onClick={fetchDashboardData} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Financial Health Score + Key Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Health Score Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="lg:col-span-1 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white"
            >
              <div className="flex items-center justify-between mb-4">
                <ShieldCheck className="h-8 w-8" />
                <Badge className={`${getHealthColor(healthScore)} font-semibold`}>
                  {getHealthLabel(healthScore)}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold mb-2">{healthScore}</div>
                <p className="text-indigo-200 text-sm">Financial Health Score</p>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-indigo-200">Gross Margin</span>
                  <span className="font-semibold">{financialStats.grossMargin.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-indigo-200">Revenue Growth</span>
                  <span className="font-semibold">{financialStats.revenueGrowth}%</span>
                </div>
              </div>
            </motion.div>

            {/* Revenue */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-green-50">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className={`flex items-center ${financialStats.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {financialStats.revenueGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  <span className="text-sm font-medium">{Math.abs(financialStats.revenueGrowth)}%</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">KES {financialStats.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="mt-3 flex items-center text-xs text-gray-500">
                <Clock className="h-3 w-3 mr-1" />
                <span>vs previous {timePeriod}</span>
              </div>
            </motion.div>

            {/* Expenses */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-red-50">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div className={`flex items-center ${financialStats.expenseGrowth <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {financialStats.expenseGrowth > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  <span className="text-sm font-medium">{Math.abs(financialStats.expenseGrowth)}%</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="text-2xl font-bold text-gray-900">KES {financialStats.expenses.toLocaleString()}</p>
              </div>
              <div className="mt-3 flex items-center text-xs text-gray-500">
                <Activity className="h-3 w-3 mr-1" />
                <span>Operating costs</span>
              </div>
            </motion.div>

            {/* Net Profit */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-purple-50">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <Badge className={financialStats.profit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                  {financialStats.profit >= 0 ? 'Profit' : 'Loss'}
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">Net Income</p>
                <p className={`text-2xl font-bold ${financialStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  KES {Math.abs(financialStats.profit).toLocaleString()}
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs text-gray-500">
                <Percent className="h-3 w-3 mr-1" />
                <span>Margin: {financialStats.grossMargin.toFixed(1)}%</span>
              </div>
            </motion.div>

            {/* Pending */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-amber-50">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                </div>
                <Badge className="bg-amber-100 text-amber-700">
                  {financialStats.overdueInvoices} Overdue
                </Badge>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">Pending Payments</p>
                <p className="text-2xl font-bold text-gray-900">KES {financialStats.pendingPayments.toLocaleString()}</p>
              </div>
              <div className="mt-3">
                <Link href="/dashboard/finance/invoices" className="text-xs text-indigo-600 hover:underline flex items-center">
                  View invoices <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Revenue Trend Chart + Expense Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Trend */}
            <Card className="lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Revenue vs Expenses Trend</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Revenue</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-full"></span> Expenses</span>
                </div>
              </div>
              <div className="space-y-4">
                {monthlyTrend.map((m, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{m.month}</span>
                      <span className="text-gray-500">
                        P: KES {(m.revenue - m.expenses).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-1 h-6">
                      <div 
                        className="bg-green-500 rounded-l-full transition-all"
                        style={{ width: `${(m.revenue / 2000000) * 100}%` }}
                        title={`Revenue: KES ${m.revenue.toLocaleString()}`}
                      />
                      <div 
                        className="bg-red-400 rounded-r-full transition-all"
                        style={{ width: `${(m.expenses / 2000000) * 100}%` }}
                        title={`Expenses: KES ${m.expenses.toLocaleString()}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Expense Breakdown */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Expense Breakdown</h2>
              <div className="space-y-3">
                {expenseCategories.map((cat, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{cat.name}</span>
                      <span className="text-gray-600">{cat.percent}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>KES {financialStats.expenses.toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Branch Revenue + Accounts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Branch Revenue */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Branch Performance</h2>
                <Link href="/dashboard/finance/revenue-branches">
                  <Button variant="ghost" size="sm">View All <ChevronRight className="h-4 w-4" /></Button>
                </Link>
              </div>
              <div className="space-y-3">
                {branchRevenue.slice(0, 5).map((branch: any) => (
                  <div key={branch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Building2 className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{branch.name}</p>
                        <p className="text-xs text-gray-500">{branch.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">KES {branch.revenue.toLocaleString()}</p>
                      <p className={`text-xs ${parseFloat(branch.growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(branch.growth) >= 0 ? '+' : ''}{branch.growth}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Bank Accounts */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Accounts Overview</h2>
                <Link href="/dashboard/finance/cashflow">
                  <Button variant="ghost" size="sm">Manage <ChevronRight className="h-4 w-4" /></Button>
                </Link>
              </div>
              <div className="space-y-3">
                {accounts.map((acc: any) => {
                  const Icon = acc.icon;
                  return (
                    <div key={acc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${acc.type === 'bank' ? 'bg-blue-100' : acc.type === 'mobile' ? 'bg-green-100' : 'bg-amber-100'}`}>
                          <Icon className={`h-4 w-4 ${acc.type === 'bank' ? 'text-blue-600' : acc.type === 'mobile' ? 'text-green-600' : 'text-amber-600'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{acc.name}</p>
                          <p className="text-xs text-gray-500">{acc.bank}</p>
                        </div>
                      </div>
                      <p className="font-semibold">KES {acc.balance.toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between">
                <span className="font-semibold">Total Balance</span>
                <span className="font-bold text-lg">
                  KES {accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0).toLocaleString()}
                </span>
              </div>
            </Card>
          </div>

          {/* Recent Transactions + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Transactions */}
            <Card className="lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Recent Transactions</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-1" /> Filter
                  </Button>
                  <Link href="/dashboard/finance/reports">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recentTransactions.length > 0 ? recentTransactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {t.type === 'income' ? 
                          <ArrowUpRight className="h-4 w-4 text-green-600" /> : 
                          <ArrowDownRight className="h-4 w-4 text-red-600" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t.description}</p>
                        <p className="text-xs text-gray-500">{t.category} • {t.branch}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'} KES {t.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{t.date}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500">
                    <Receipt className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No recent transactions</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/dashboard/finance/invoices">
                  <div className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center">
                    <FileText className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <span className="text-xs font-medium">New Invoice</span>
                  </div>
                </Link>
                <Link href="/dashboard/finance/payments">
                  <div className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center">
                    <CreditCard className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                    <span className="text-xs font-medium">Payment</span>
                  </div>
                </Link>
                <Link href="/dashboard/finance/expenses">
                  <div className="p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors text-center">
                    <Receipt className="h-6 w-6 text-red-600 mx-auto mb-2" />
                    <span className="text-xs font-medium">Expense</span>
                  </div>
                </Link>
                <Link href="/dashboard/finance/reports">
                  <div className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-center">
                    <BarChart3 className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                    <span className="text-xs font-medium">Reports</span>
                  </div>
                </Link>
              </div>

              {/* Alert Card */}
              {financialStats.overdueInvoices > 0 && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800 mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold text-sm">Action Required</span>
                  </div>
                  <p className="text-sm text-amber-700">
                    {financialStats.overdueInvoices} invoices are overdue totaling KES {financialStats.overdueAmount.toLocaleString()}
                  </p>
                  <Link href="/dashboard/finance/invoices">
                    <Button size="sm" variant="outline" className="mt-2 border-amber-500 text-amber-700 hover:bg-amber-100">
                      Review Now
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          </div>

          {/* Advanced Financial Tools */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Financial Tools</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {[
                { href: '/dashboard/finance/cashflow', icon: Wallet, label: 'Cash Flow', color: 'blue' },
                { href: '/dashboard/finance/profit-loss', icon: TrendingUp, label: 'P&L', color: 'green' },
                { href: '/dashboard/finance/revenue-branches', icon: Building2, label: 'Branches', color: 'purple' },
                { href: '/dashboard/finance/budget-analysis', icon: Target, label: 'Budget', color: 'amber' },
                { href: '/dashboard/finance/tax-summary', icon: Calculator, label: 'Tax', color: 'red' },
                { href: '/dashboard/finance/forecast', icon: LineChart, label: 'Forecast', color: 'indigo' },
                { href: '/dashboard/finance/ar-ap', icon: Receipt, label: 'AR/AP', color: 'teal' },
                { href: '/dashboard/finance/kpis', icon: BarChart3, label: 'KPIs', color: 'cyan' },
              ].map((tool, idx) => (
                <Link key={idx} href={tool.href}>
                  <div className={`p-4 bg-${tool.color}-50 hover:bg-${tool.color}-100 rounded-lg text-center transition-colors border-2 border-transparent hover:border-${tool.color}-200`}>
                    <tool.icon className={`h-6 w-6 text-${tool.color}-600 mx-auto mb-2`} />
                    <span className="text-xs font-medium text-gray-700">{tool.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
