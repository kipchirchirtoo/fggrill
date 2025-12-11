'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { 
  DollarSign, TrendingUp, TrendingDown, CreditCard, RefreshCw,
  ArrowUpRight, ArrowDownRight, PieChart, BarChart3, FileText, Receipt,
  Wallet, Calculator, Scale, ChevronRight, Building2, BookOpen, Percent
} from 'lucide-react';
import Link from 'next/link';
import { formatNumber } from '@/lib/utils';

interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  pendingPayments: number;
  revenueChange: number;
  expenseChange: number;
}

interface Branch {
  id: number;
  name: string;
  code?: string;
}

interface FinancialRatios {
  liquidity?: { current_ratio: number; quick_ratio: number };
  profitability?: { net_profit_margin: number; return_on_assets: number };
}

export default function FinanceDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({ totalRevenue: 0, totalExpenses: 0, netProfit: 0, pendingPayments: 0, revenueChange: 0, expenseChange: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [ratios, setRatios] = useState<FinancialRatios>({});
  const [comparison, setComparison] = useState<any>(null);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await financeAPI.getBranches();
      if (response.success && Array.isArray(response.data)) {
        setBranches(response.data);
      }
    } catch (error) { console.error('Error fetching branches:', error); }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, ratiosRes, comparisonRes] = await Promise.all([
        financeAPI.getDashboard(selectedBranch || undefined),
        financeAPI.getFinancialRatios({ branch_id: selectedBranch || undefined }),
        financeAPI.getComparativeAnalysis({ type: 'period', branch_id: selectedBranch || undefined, days: 30 })
      ]);
      
      if (dashboardRes.success) setData(dashboardRes.data || {});
      if (ratiosRes.success) setRatios(ratiosRes.data || {});
      if (comparisonRes.success) setComparison(comparisonRes.data || null);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/finance/profit-loss', icon: BarChart3, label: 'Profit & Loss Statement', desc: 'Income statement overview' },
    { href: '/dashboard/finance/balance-sheet', icon: Scale, label: 'Balance Sheet', desc: 'Assets, liabilities & equity' },
    { href: '/dashboard/finance/cashflow', icon: TrendingUp, label: 'Cash Flow Statement', desc: 'Cash inflows and outflows' },
    { href: '/dashboard/finance/trial-balance', icon: BookOpen, label: 'Trial Balance', desc: 'Debit and credit balances' },
    { href: '/dashboard/finance/journal-entries', icon: FileText, label: 'Journal Entries', desc: 'Transaction records' },
    { href: '/dashboard/finance/expenses', icon: Receipt, label: 'Expense Management', desc: 'Track and approve expenses' },
    { href: '/dashboard/finance/invoices', icon: FileText, label: 'Invoices & Billing', desc: 'Customer invoices' },
    { href: '/dashboard/finance/ar-ap', icon: Scale, label: 'Accounts Receivable/Payable', desc: 'Outstanding balances' },
    { href: '/dashboard/finance/budget-analysis', icon: Wallet, label: 'Budget Analysis', desc: 'Budget vs actual' },
    { href: '/dashboard/finance/revenue-branches', icon: PieChart, label: 'Revenue by Branch', desc: 'Branch performance' },
    { href: '/dashboard/finance/kpis', icon: Calculator, label: 'Financial KPIs', desc: 'Key performance indicators' },
    { href: '/dashboard/finance/tax-summary', icon: Percent, label: 'Tax Summary', desc: 'VAT, PAYE, withholding' },
    { href: '/dashboard/finance/forecast', icon: TrendingUp, label: 'Financial Forecast', desc: 'Future projections' },
    { href: '/dashboard/finance/reports', icon: FileText, label: 'Financial Reports', desc: 'Generate reports' },
  ];

  const profitMargin = data.totalRevenue > 0 ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1) : '0.0';

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-7xl">
          {/* Header with Branch Selector */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Finance Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Comprehensive financial overview and accounting</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              <button 
                onClick={fetchData}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gray-100 rounded-lg"><DollarSign className="h-5 w-5 text-gray-600" /></div>
                {(data.revenueChange || 0) >= 0 ? (
                  <span className="flex items-center text-xs text-gray-600"><ArrowUpRight className="h-3 w-3" />{data.revenueChange || 0}%</span>
                ) : (
                  <span className="flex items-center text-xs text-gray-600"><ArrowDownRight className="h-3 w-3" />{Math.abs(data.revenueChange || 0)}%</span>
                )}
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">KES {formatNumber(data.totalRevenue || 0)}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gray-100 rounded-lg"><TrendingDown className="h-5 w-5 text-gray-600" /></div>
                {(data.expenseChange || 0) <= 0 ? (
                  <span className="flex items-center text-xs text-gray-600"><ArrowDownRight className="h-3 w-3" />{Math.abs(data.expenseChange || 0)}%</span>
                ) : (
                  <span className="flex items-center text-xs text-gray-600"><ArrowUpRight className="h-3 w-3" />{data.expenseChange || 0}%</span>
                )}
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Expenses</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">KES {formatNumber(data.totalExpenses || 0)}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="p-2 bg-gray-100 rounded-lg w-fit mb-3"><TrendingUp className="h-5 w-5 text-gray-600" /></div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Net Profit</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">KES {formatNumber(data.netProfit || 0)}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="p-2 bg-gray-100 rounded-lg w-fit mb-3"><Percent className="h-5 w-5 text-gray-600" /></div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Profit Margin</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{profitMargin}%</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="p-2 bg-gray-100 rounded-lg w-fit mb-3"><CreditCard className="h-5 w-5 text-gray-600" /></div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">KES {formatNumber(data.pendingPayments || 0)}</p>
            </div>
          </div>

          {/* Financial Ratios & Period Comparison */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Financial Ratios */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-medium text-gray-900">Key Financial Ratios</h2>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Current Ratio</p>
                  <p className="text-lg font-semibold text-gray-900">{ratios.liquidity?.current_ratio?.toFixed(2) || '0.00'}</p>
                  <p className="text-xs text-gray-400 mt-1">Liquidity measure</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Quick Ratio</p>
                  <p className="text-lg font-semibold text-gray-900">{ratios.liquidity?.quick_ratio?.toFixed(2) || '0.00'}</p>
                  <p className="text-xs text-gray-400 mt-1">Acid test ratio</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Net Profit Margin</p>
                  <p className="text-lg font-semibold text-gray-900">{ratios.profitability?.net_profit_margin?.toFixed(1) || '0.0'}%</p>
                  <p className="text-xs text-gray-400 mt-1">Profitability</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Return on Assets</p>
                  <p className="text-lg font-semibold text-gray-900">{ratios.profitability?.return_on_assets?.toFixed(1) || '0.0'}%</p>
                  <p className="text-xs text-gray-400 mt-1">Asset efficiency</p>
                </div>
              </div>
            </div>

            {/* Period Comparison */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-medium text-gray-900">Period Comparison (30 Days)</h2>
              </div>
              {comparison ? (
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase">Current Period</p>
                      <p className="text-lg font-semibold text-gray-900">KES {formatNumber(comparison.current_period?.revenue || 0)}</p>
                      <p className="text-xs text-gray-400">Revenue</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase">Previous Period</p>
                      <p className="text-lg font-semibold text-gray-900">KES {formatNumber(comparison.previous_period?.revenue || 0)}</p>
                      <p className="text-xs text-gray-400">Revenue</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Revenue Change</span>
                    <span className={`text-sm font-semibold ${(comparison.changes?.revenue || 0) >= 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                      {(comparison.changes?.revenue || 0) >= 0 ? '+' : ''}{comparison.changes?.revenue || 0}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center text-gray-500">No comparison data</div>
              )}
            </div>
          </div>

          {/* Quick Access - Accounting Modules */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">Accounting & Finance Modules</h2>
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              <div className="divide-y divide-gray-100">
                {quickLinks.slice(0, 7).map((link) => (
                  <Link key={link.href} href={link.href} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg"><link.icon className="h-4 w-4 text-gray-600" /></div>
                      <div>
                        <span className="text-sm font-medium text-gray-900 block">{link.label}</span>
                        <span className="text-xs text-gray-500">{link.desc}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </Link>
                ))}
              </div>
              <div className="divide-y divide-gray-100">
                {quickLinks.slice(7).map((link) => (
                  <Link key={link.href} href={link.href} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg"><link.icon className="h-4 w-4 text-gray-600" /></div>
                      <div>
                        <span className="text-sm font-medium text-gray-900 block">{link.label}</span>
                        <span className="text-xs text-gray-500">{link.desc}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
