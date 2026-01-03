'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, RefreshCw,
  ArrowUpRight, ArrowDownRight, PieChart, BarChart3, FileText, Receipt,
  Wallet, Calculator, Scale, ChevronRight, Building2, BookOpen, Percent
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { BranchSelector } from '@/components/finance/BranchSelector';
import { DateRangeSelector, DateRangePreset } from '@/components/finance/DateRangeSelector';

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
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('month');
  const [ratios, setRatios] = useState<FinancialRatios>({});
  const [comparison, setComparison] = useState<any>(null);


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, ratiosRes, comparisonRes] = await Promise.all([
        financeAPI.getDashboard({ branch_id: selectedBranch || undefined, startDate, endDate }),
        financeAPI.getFinancialRatios({ branch_id: selectedBranch || undefined }),
        financeAPI.getComparativeAnalysis({ type: 'period', branch_id: selectedBranch || undefined, days: 30 })
      ]);

      if (dashboardRes.success) setData(dashboardRes.data || {});
      if (ratiosRes.success) setRatios(ratiosRes.data || {});
      if (comparisonRes.success) setComparison(comparisonRes.data || null);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch, startDate, endDate]);

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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-2">
            <div>
              <h1 className="text-[32px] font-bold text-stone-900 tracking-tight">Finance Dashboard</h1>
              <p className="text-stone-500 text-base">Comprehensive financial overview and accounting</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider ml-1">Branch</span>
                <BranchSelector
                  selectedBranch={selectedBranch}
                  onBranchChange={setSelectedBranch}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider ml-1">Date Range</span>
                <DateRangeSelector
                  startDate={startDate}
                  endDate={endDate}
                  onRangeChange={(start, end) => {
                    setStartDate(start);
                    setEndDate(end);
                  }}
                  preset={datePreset}
                  onPresetChange={setDatePreset}
                />
              </div>
              <div className="flex flex-col gap-1 self-end">
                <button
                  onClick={fetchData}
                  disabled={isLoading}
                  className="h-[42px] px-5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="font-medium">Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div className="stat-icon"><DollarSign className="h-5 w-5" /></div>
                <span className="flex items-center text-[11px] font-medium text-stone-500">
                  {(data.revenueChange || 0) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(data.revenueChange || 0)}%
                </span>
              </div>
              <p className="stat-label">Revenue</p>
              <p className="stat-value text-[20px]">KES {formatNumber(data.totalRevenue || 0)}</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div className="stat-icon"><TrendingDown className="h-5 w-5" /></div>
                <span className="flex items-center text-[11px] font-medium text-stone-500">
                  {(data.expenseChange || 0) <= 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {Math.abs(data.expenseChange || 0)}%
                </span>
              </div>
              <p className="stat-label">Expenses</p>
              <p className="stat-value text-[20px]">KES {formatNumber(data.totalExpenses || 0)}</p>
            </div>

            <div className="stat-card">
              <div className="stat-icon mb-3"><TrendingUp className="h-5 w-5" /></div>
              <p className="stat-label">Net Profit</p>
              <p className="stat-value text-[20px]">KES {formatNumber(data.netProfit || 0)}</p>
            </div>

            <div className="stat-card">
              <div className="stat-icon mb-3"><Percent className="h-5 w-5" /></div>
              <p className="stat-label">Profit Margin</p>
              <p className="stat-value text-[20px]">{profitMargin}%</p>
            </div>

            <div className="stat-card">
              <div className="stat-icon mb-3"><CreditCard className="h-5 w-5" /></div>
              <p className="stat-label">Pending</p>
              <p className="stat-value text-[20px]">KES {formatNumber(data.pendingPayments || 0)}</p>
            </div>
          </div>

          {/* Financial Ratios & Period Comparison */}
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Financial Ratios */}
            <div className="card-elevated">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="text-[15px] font-semibold text-stone-900">Key Financial Ratios</h2>
              </div>
              <div className="p-5 grid grid-cols-2 gap-3">
                <div className="p-4 bg-stone-50 rounded-lg">
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Current Ratio</p>
                  <p className="text-[18px] font-semibold text-stone-900 mt-1">{ratios.liquidity?.current_ratio?.toFixed(2) || '0.00'}</p>
                  <p className="text-[11px] text-stone-400 mt-1">Liquidity measure</p>
                </div>
                <div className="p-4 bg-stone-50 rounded-lg">
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Quick Ratio</p>
                  <p className="text-[18px] font-semibold text-stone-900 mt-1">{ratios.liquidity?.quick_ratio?.toFixed(2) || '0.00'}</p>
                  <p className="text-[11px] text-stone-400 mt-1">Acid test ratio</p>
                </div>
                <div className="p-4 bg-stone-50 rounded-lg">
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Net Profit Margin</p>
                  <p className="text-[18px] font-semibold text-stone-900 mt-1">{ratios.profitability?.net_profit_margin?.toFixed(1) || '0.0'}%</p>
                  <p className="text-[11px] text-stone-400 mt-1">Profitability</p>
                </div>
                <div className="p-4 bg-stone-50 rounded-lg">
                  <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Return on Assets</p>
                  <p className="text-[18px] font-semibold text-stone-900 mt-1">{ratios.profitability?.return_on_assets?.toFixed(1) || '0.0'}%</p>
                  <p className="text-[11px] text-stone-400 mt-1">Asset efficiency</p>
                </div>
              </div>
            </div>

            {/* Period Comparison */}
            <div className="card-elevated">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="text-[15px] font-semibold text-stone-900">Period Comparison (30 Days)</h2>
              </div>
              {comparison ? (
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                      <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Current Period</p>
                      <p className="text-[18px] font-semibold text-stone-900 mt-1">KES {formatNumber(comparison.current_period?.revenue || 0)}</p>
                      <p className="text-[11px] text-stone-400">Revenue</p>
                    </div>
                    <div className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                      <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">Previous Period</p>
                      <p className="text-[18px] font-semibold text-stone-900 mt-1">KES {formatNumber(comparison.previous_period?.revenue || 0)}</p>
                      <p className="text-[11px] text-stone-400">Revenue</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg border border-stone-100">
                    <span className="text-[13px] font-medium text-stone-700">Revenue Change</span>
                    <span className="text-[14px] font-semibold text-stone-700">
                      {(comparison.changes?.revenue || 0) >= 0 ? '+' : ''}{comparison.changes?.revenue || 0}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center text-stone-500">No comparison data</div>
              )}
            </div>
          </div>

          {/* Quick Access - Accounting Modules */}
          <div className="card-elevated">
            <div className="px-5 py-4 border-b border-stone-100">
              <h2 className="text-[15px] font-semibold text-stone-900">Accounting & Finance Modules</h2>
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-100">
              <div className="divide-y divide-stone-50">
                {quickLinks.slice(0, 7).map((link) => (
                  <Link key={link.href} href={link.href} className="flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-stone-100 rounded-lg group-hover:bg-stone-200 transition-colors"><link.icon className="h-4 w-4 text-stone-600" /></div>
                      <div>
                        <span className="text-[13px] font-medium text-stone-800 block">{link.label}</span>
                        <span className="text-[11px] text-stone-500">{link.desc}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-400 transition-colors" />
                  </Link>
                ))}
              </div>
              <div className="divide-y divide-stone-50">
                {quickLinks.slice(7).map((link) => (
                  <Link key={link.href} href={link.href} className="flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-stone-100 rounded-lg group-hover:bg-stone-200 transition-colors"><link.icon className="h-4 w-4 text-stone-600" /></div>
                      <div>
                        <span className="text-[13px] font-medium text-stone-800 block">{link.label}</span>
                        <span className="text-[11px] text-stone-500">{link.desc}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-400 transition-colors" />
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
