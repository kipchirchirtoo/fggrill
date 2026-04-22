'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { fetchAPI } from '@/lib/api/core';
import {
  DollarSign, TrendingUp, Users, ShoppingCart, Award, RefreshCw,
  ArrowLeft, Calendar, Eye, Star, Trophy, Utensils
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface WaiterSales {
  waiter_id: string;
  waiter_name: string;
  email: string;
  pos_pin?: string;
  role?: string;
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  total_tips: number;
  total_items_sold: number;
  items_per_order: number;
  period_days: number;
}

interface Summary {
  total_waiters: number;
  total_orders: number;
  total_revenue: number;
  total_tips: number;
  average_order_value: number;
  top_performer: WaiterSales | null;
  period_days: number;
}

export default function WaiterSalesPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [waiterSales, setWaiterSales] = useState<WaiterSales[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchWaiterSales = useCallback(async () => {
    if (!currentBranchId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        branch_id: currentBranchId.toString(),
        date: selectedDate,
        period: period.toString()
      });

      const response = await fetchAPI<any>(`/restaurant/waiter-sales?${params}`);

      if (response.success && response.data) {
        setWaiterSales(response.data.waiter_sales || []);
        setSummary(response.data.summary || null);
      }
    } catch (error: any) {
      console.error('Error fetching waiter sales:', error);
      toast.error(error.message || 'Failed to load waiter sales');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, selectedDate, period]);

  useEffect(() => {
    fetchWaiterSales();
  }, [fetchWaiterSales]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return { icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50' };
    if (index === 1) return { icon: Award, color: 'text-stone-400', bg: 'bg-stone-50' };
    if (index === 2) return { icon: Award, color: 'text-orange-600', bg: 'bg-orange-50' };
    return { icon: Star, color: 'text-stone-300', bg: 'bg-stone-50' };
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.RESTAURANT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/branch-manager" className="text-stone-400 hover:text-stone-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">
              Branch Manager / Waiter Sales Analytics
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Waiter Sales Analytics</h1>
              <p className="text-stone-500 mt-0.5">{activeBranch?.name || user?.branch_name || 'Your Branch'}</p>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none"
              />
              <select
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value))}
                className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent outline-none"
              >
                <option value="1">Today</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
              </select>
              <button
                onClick={fetchWaiterSales}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="stat-card">
                <div className="stat-icon bg-blue-50 text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.total_waiters}</p>
                <p className="stat-label text-[12px] mt-1">Active Waiters</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-purple-50 text-purple-600">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.total_orders}</p>
                <p className="stat-label text-[12px] mt-1">Total Orders</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-emerald-50 text-emerald-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <p className="stat-value text-[18px]">{formatCurrency(summary.total_revenue)}</p>
                <p className="stat-label text-[12px] mt-1">Total Revenue</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-amber-50 text-amber-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <p className="stat-value text-[18px]">{formatCurrency(summary.average_order_value)}</p>
                <p className="stat-label text-[12px] mt-1">Avg Order Value</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-rose-50 text-rose-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <p className="stat-value text-[18px]">{formatCurrency(summary.total_tips)}</p>
                <p className="stat-label text-[12px] mt-1">Total Tips</p>
              </div>

              <div className="stat-card">
                <div className="stat-icon bg-stone-50 text-stone-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{summary.period_days}</p>
                <p className="stat-label text-[12px] mt-1">Day{summary.period_days > 1 ? 's' : ''}</p>
              </div>
            </div>
          )}

          {/* Top Performer Highlight */}
          {summary?.top_performer && (
            <div className="card-elevated p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center">
                  <Trophy className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-amber-700 uppercase tracking-wider font-bold mb-1">Top Performer</p>
                  <h3 className="text-[20px] font-bold text-stone-900">{summary.top_performer.waiter_name}</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <p className="text-[11px] text-stone-500 uppercase">Revenue</p>
                      <p className="text-[16px] font-bold text-emerald-600">{formatCurrency(summary.top_performer.total_revenue)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500 uppercase">Orders</p>
                      <p className="text-[16px] font-bold text-stone-900">{summary.top_performer.total_orders}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500 uppercase">Avg Order</p>
                      <p className="text-[16px] font-bold text-stone-900">{formatCurrency(summary.top_performer.average_order_value)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Waiter Sales Table */}
          <div className="card-elevated p-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-2 opacity-50">
                  <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Loading sales data...</span>
                </div>
              </div>
            ) : waiterSales.length === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="h-16 w-16 rounded-full bg-stone-50 flex items-center justify-center mb-4 mx-auto">
                  <Utensils className="h-8 w-8 text-stone-300" />
                </div>
                <h3 className="text-lg font-bold text-stone-900">No Sales Data</h3>
                <p className="text-sm text-stone-500 mt-1">No waiter sales found for the selected period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-header-cell">Rank</th>
                      <th className="table-header-cell">Waiter</th>
                      <th className="table-header-cell text-center">Orders</th>
                      <th className="table-header-cell text-right">Revenue</th>
                      <th className="table-header-cell text-right">Avg Order</th>
                      <th className="table-header-cell text-right">Tips</th>
                      <th className="table-header-cell text-center">Items Sold</th>
                      <th className="table-header-cell text-center">Items/Order</th>
                      <th className="table-header-cell text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {waiterSales.map((waiter, index) => {
                      const badge = getRankBadge(index);
                      const BadgeIcon = badge.icon;
                      return (
                        <tr key={waiter.waiter_id} className="table-row">
                          <td className="table-cell">
                            <div className={`w-10 h-10 rounded-full ${badge.bg} flex items-center justify-center`}>
                              <BadgeIcon className={`h-5 w-5 ${badge.color}`} />
                            </div>
                          </td>
                          <td className="table-cell">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-medium text-stone-800">{waiter.waiter_name}</p>
                                {waiter.pos_pin && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-stone-100 text-stone-600 rounded-md font-mono">
                                    {waiter.pos_pin}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-stone-500">{waiter.email}</p>
                            </div>
                          </td>
                          <td className="table-cell text-center">
                            <p className="text-[14px] font-bold text-stone-900">{waiter.total_orders}</p>
                          </td>
                          <td className="table-cell text-right">
                            <p className="text-[14px] font-bold text-emerald-600">
                              {formatCurrency(waiter.total_revenue)}
                            </p>
                          </td>
                          <td className="table-cell text-right">
                            <p className="text-[13px] font-medium text-stone-800">
                              {formatCurrency(waiter.average_order_value)}
                            </p>
                          </td>
                          <td className="table-cell text-right">
                            <p className="text-[13px] font-medium text-amber-600">
                              {formatCurrency(waiter.total_tips)}
                            </p>
                          </td>
                          <td className="table-cell text-center">
                            <p className="text-[13px] font-medium text-stone-800">{waiter.total_items_sold}</p>
                          </td>
                          <td className="table-cell text-center">
                            <p className="text-[13px] font-medium text-stone-600">
                              {waiter.items_per_order.toFixed(1)}
                            </p>
                          </td>
                          <td className="table-cell text-right">
                            <Link href={`/dashboard/branch-manager/staff/${waiter.waiter_id}`}>
                              <button className="p-1.5 rounded-md hover:bg-stone-100 transition-colors">
                                <Eye className="h-4 w-4 text-stone-500" />
                              </button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Performance Insights */}
          {waiterSales.length > 0 && (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="card-elevated p-5">
                <h3 className="text-[13px] font-semibold text-stone-900 mb-3">Revenue Distribution</h3>
                <div className="space-y-2">
                  {waiterSales.slice(0, 5).map((waiter, index) => {
                    const percentage = summary ? (waiter.total_revenue / summary.total_revenue) * 100 : 0;
                    return (
                      <div key={waiter.waiter_id}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-stone-600 truncate">{waiter.waiter_name}</span>
                          <span className="text-stone-900 font-bold">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="card-elevated p-5">
                <h3 className="text-[13px] font-semibold text-stone-900 mb-3">Order Volume Leaders</h3>
                <div className="space-y-3">
                  {waiterSales
                    .sort((a, b) => b.total_orders - a.total_orders)
                    .slice(0, 5)
                    .map((waiter, index) => (
                      <div key={waiter.waiter_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-stone-400">#{index + 1}</span>
                          <span className="text-[12px] text-stone-700 truncate">{waiter.waiter_name}</span>
                        </div>
                        <span className="text-[13px] font-bold text-stone-900">{waiter.total_orders}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="card-elevated p-5">
                <h3 className="text-[13px] font-semibold text-stone-900 mb-3">Tips Leaders</h3>
                <div className="space-y-3">
                  {waiterSales
                    .sort((a, b) => b.total_tips - a.total_tips)
                    .slice(0, 5)
                    .map((waiter, index) => (
                      <div key={waiter.waiter_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-stone-400">#{index + 1}</span>
                          <span className="text-[12px] text-stone-700 truncate">{waiter.waiter_name}</span>
                        </div>
                        <span className="text-[13px] font-bold text-amber-600">{formatCurrency(waiter.total_tips)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
