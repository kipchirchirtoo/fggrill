'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { fetchAPI } from '@/lib/api/core';
import {
  DollarSign, TrendingUp, TrendingDown, Target, Award, RefreshCw,
  ArrowLeft, Calendar, BarChart3, PieChart, Activity
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface CategoryBreakdown {
  category: string;
  revenue: number;
  percentage: number;
  transactions: number;
}

interface DailyTrend {
  date: string;
  rooms: number;
  restaurant: number;
  bar: number;
  conference: number;
  total: number;
}

interface Summary {
  total_revenue: number;
  target_revenue: number;
  variance: number;
  variance_percentage: number;
  achievement_rate: number;
  growth_rate: number;
  period_days: number;
}

export default function RevenueOversightPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchRevenueData = useCallback(async () => {
    if (!currentBranchId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        branch_id: currentBranchId.toString(),
        period: period.toString()
      });

      const response = await fetchAPI<any>(`/finance/revenue-oversight?${params}`);

      if (response.success && response.data) {
        setSummary(response.data.summary || null);
        setCategoryBreakdown(response.data.category_breakdown || []);
        setDailyTrend(response.data.daily_trend || []);
      }
    } catch (error: any) {
      console.error('Error fetching revenue data:', error);
      toast.error(error.message || 'Failed to load revenue data');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, period]);

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Rooms': 'bg-blue-500',
      'Restaurant': 'bg-emerald-500',
      'Bar': 'bg-amber-500',
      'Conference': 'bg-purple-500'
    };
    return colors[category] || 'bg-stone-500';
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/branch-manager" className="text-stone-400 hover:text-stone-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">
              Branch Manager / Revenue Oversight
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Revenue Oversight</h1>
              <p className="text-stone-500 mt-0.5">{activeBranch?.name || user?.branch_name || 'Your Branch'}</p>
            </div>
            <div className="flex gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value))}
                className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
              <button
                onClick={fetchRevenueData}
                disabled={isLoading}
                className="btn-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="stat-card">
                  <div className="stat-icon bg-emerald-50 text-emerald-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <p className="stat-value text-[18px]">{formatCurrency(summary.total_revenue)}</p>
                  <p className="stat-label text-[12px] mt-1">Total Revenue</p>
                </div>

                <div className="stat-card">
                  <div className="stat-icon bg-blue-50 text-blue-600">
                    <Target className="h-5 w-5" />
                  </div>
                  <p className="stat-value text-[18px]">{formatCurrency(summary.target_revenue)}</p>
                  <p className="stat-label text-[12px] mt-1">Target</p>
                </div>

                <div className="stat-card">
                  <div className={`stat-icon ${summary.variance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {summary.variance >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  </div>
                  <p className={`stat-value text-[18px] ${summary.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {summary.variance >= 0 ? '+' : ''}{formatCurrency(summary.variance)}
                  </p>
                  <p className="stat-label text-[12px] mt-1">Variance</p>
                </div>

                <div className="stat-card">
                  <div className="stat-icon bg-purple-50 text-purple-600">
                    <Award className="h-5 w-5" />
                  </div>
                  <p className="stat-value text-[22px]">{summary.achievement_rate.toFixed(1)}%</p>
                  <p className="stat-label text-[12px] mt-1">Achievement</p>
                </div>

                <div className="stat-card">
                  <div className={`stat-icon ${summary.growth_rate >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    <Activity className="h-5 w-5" />
                  </div>
                  <p className={`stat-value text-[22px] ${summary.growth_rate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {summary.growth_rate >= 0 ? '+' : ''}{summary.growth_rate.toFixed(1)}%
                  </p>
                  <p className="stat-label text-[12px] mt-1">Growth Rate</p>
                </div>

                <div className="stat-card">
                  <div className="stat-icon bg-stone-50 text-stone-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <p className="stat-value text-[22px]">{summary.period_days}</p>
                  <p className="stat-label text-[12px] mt-1">Days</p>
                </div>
              </div>

              {/* Achievement Progress Bar */}
              <div className="card-elevated p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[15px] font-semibold text-stone-900">Target Achievement</h3>
                  <span className="text-[20px] font-bold text-stone-900">{summary.achievement_rate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 rounded-full transition-all ${summary.achievement_rate >= 100 ? 'bg-emerald-500' : summary.achievement_rate >= 80 ? 'bg-blue-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(summary.achievement_rate, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-stone-500">
                  <span>0%</span>
                  <span>Target: {formatCurrency(summary.target_revenue)}</span>
                  <span>100%</span>
                </div>
              </div>
            </>
          )}

          {/* Category Breakdown */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="h-5 w-5 text-stone-600" />
                <h3 className="text-[15px] font-semibold text-stone-900">Revenue by Category</h3>
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                </div>
              ) : categoryBreakdown.length === 0 ? (
                <p className="text-center py-10 text-stone-400 text-sm">No data available</p>
              ) : (
                <div className="space-y-4">
                  {categoryBreakdown.map((category) => (
                    <div key={category.category}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${getCategoryColor(category.category)}`} />
                          <span className="text-[13px] font-medium text-stone-700">{category.category}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-bold text-stone-900">{formatCurrency(category.revenue)}</p>
                          <p className="text-[11px] text-stone-500">{category.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getCategoryColor(category.category)}`}
                          style={{ width: `${category.percentage}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1">{category.transactions} transactions</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Categories */}
            <div className="card-elevated p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-stone-600" />
                <h3 className="text-[15px] font-semibold text-stone-900">Category Performance</h3>
              </div>
              {categoryBreakdown.length === 0 ? (
                <p className="text-center py-10 text-stone-400 text-sm">No data available</p>
              ) : (
                <div className="space-y-3">
                  {categoryBreakdown.map((category, index) => (
                    <div key={category.category} className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center font-bold text-sm text-stone-600">
                        #{index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium text-stone-800">{category.category}</p>
                        <p className="text-[11px] text-stone-500">{category.transactions} transactions</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-bold text-emerald-600">{formatCurrency(category.revenue)}</p>
                        <p className="text-[11px] text-stone-500">{category.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Daily Trend */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-stone-600" />
              <h3 className="text-[15px] font-semibold text-stone-900">Daily Revenue Trend</h3>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
              </div>
            ) : dailyTrend.length === 0 ? (
              <p className="text-center py-10 text-stone-400 text-sm">No trend data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-header-cell">Date</th>
                      <th className="table-header-cell text-right">Rooms</th>
                      <th className="table-header-cell text-right">Restaurant</th>
                      <th className="table-header-cell text-right">Bar</th>
                      <th className="table-header-cell text-right">Conference</th>
                      <th className="table-header-cell text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {dailyTrend.slice(-10).reverse().map((day) => (
                      <tr key={day.date} className="table-row">
                        <td className="table-cell">
                          <p className="text-[13px] font-medium text-stone-800">
                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </td>
                        <td className="table-cell text-right">
                          <p className="text-[13px] text-stone-700">{formatCurrency(day.rooms)}</p>
                        </td>
                        <td className="table-cell text-right">
                          <p className="text-[13px] text-stone-700">{formatCurrency(day.restaurant)}</p>
                        </td>
                        <td className="table-cell text-right">
                          <p className="text-[13px] text-stone-700">{formatCurrency(day.bar)}</p>
                        </td>
                        <td className="table-cell text-right">
                          <p className="text-[13px] text-stone-700">{formatCurrency(day.conference)}</p>
                        </td>
                        <td className="table-cell text-right">
                          <p className="text-[14px] font-bold text-emerald-600">{formatCurrency(day.total)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
