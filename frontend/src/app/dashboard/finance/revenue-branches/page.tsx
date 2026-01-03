'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { Building2, RefreshCw, TrendingUp, DollarSign, ChevronDown, ChevronUp, Utensils, Wine, Bed, Wallet, Receipt, ArrowRight } from 'lucide-react';
import { BranchSelector } from '@/components/finance/BranchSelector';
import { DateRangeSelector, DateRangePreset } from '@/components/finance/DateRangeSelector';
import { formatNumber } from '@/lib/utils';

interface BranchRevenue {
  branch_id: number;
  name: string;
  income: number;
  expenses: number;
  net: number;
  breakdown: {
    restaurant: number;
    bar: number;
    rooms: number;
    other_income: number;
    operational_expenses: number;
    other_expenses: number;
  }
}

export default function RevenueBranchesPage() {
  const [branches, setBranches] = useState<BranchRevenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('month');
  const [expandedBranch, setExpandedBranch] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getRevenueByBranch({
        branch_id: selectedBranch || undefined,
        startDate,
        endDate
      });
      if (response.success && response.data?.branches) {
        setBranches(response.data.branches);
      } else {
        setBranches([]);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalRevenue = Array.isArray(branches) ? branches.reduce((sum, b) => sum + (b.income || 0), 0) : 0;
  const totalProfit = Array.isArray(branches) ? branches.reduce((sum, b) => sum + (b.net || 0), 0) : 0;

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Revenue by Branch</h1>
              <p className="text-sm text-stone-500 mt-1">Comparative performance analysis across all locations</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <BranchSelector
                selectedBranch={selectedBranch}
                onBranchChange={setSelectedBranch}
              />
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
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="p-2.5 text-stone-500 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <DollarSign className="h-24 w-24" />
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 rounded-xl"><DollarSign className="h-6 w-6 text-emerald-600" /></div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Revenue</p>
                  <p className="text-3xl font-bold text-stone-900 mt-1">KES {formatNumber(totalRevenue)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp className="h-24 w-24" />
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl"><TrendingUp className="h-6 w-6 text-blue-600" /></div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Net Profit</p>
                  <p className="text-3xl font-bold text-stone-900 mt-1">KES {formatNumber(totalProfit)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border border-stone-200 rounded-2xl shadow-sm">
              <RefreshCw className="h-10 w-10 animate-spin text-stone-300 mb-4" />
              <p className="text-stone-400 font-medium">Aggregating branch data...</p>
            </div>
          ) : branches.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center shadow-sm">
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Building2 className="h-10 w-10 text-stone-200" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900">No data available</h3>
              <p className="text-stone-500 mt-2 max-w-xs mx-auto">We couldn't find any financial data for the selected period and branch.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {branches.map((branch) => {
                const revenuePercent = totalRevenue > 0 ? (branch.income / totalRevenue) * 100 : 0;
                const isExpanded = expandedBranch === branch.branch_id;

                return (
                  <div key={branch.branch_id} className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden transition-all hover:border-stone-300">
                    <div
                      className="p-6 cursor-pointer flex items-center justify-between group"
                      onClick={() => setExpandedBranch(isExpanded ? null : branch.branch_id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-stone-50 flex items-center justify-center group-hover:bg-stone-100 transition-colors">
                          <Building2 className="h-6 w-6 text-stone-600" />
                        </div>
                        <div>
                          <p className="font-bold text-stone-900 text-lg">{branch.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full">
                              {revenuePercent.toFixed(1)}% of total
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Revenue</p>
                          <p className="font-bold text-stone-900 text-xl">KES {formatNumber(branch.income)}</p>
                        </div>
                        <div className="text-right hidden md:block">
                          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Net Profit</p>
                          <p className={`font-bold text-xl ${branch.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            KES {formatNumber(branch.net)}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-stone-50 group-hover:bg-stone-100 transition-colors">
                          {isExpanded ? <ChevronUp className="h-5 w-5 text-stone-400" /> : <ChevronDown className="h-5 w-5 text-stone-400" />}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 pb-6">
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-6">
                        <div className="h-full bg-stone-900 rounded-full" style={{ width: `${revenuePercent}%` }} />
                      </div>

                      {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-stone-100 animate-in fade-in slide-in-from-top-4 duration-300">
                          {/* Revenue Breakdown */}
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                              <DollarSign className="h-3 w-3" /> Revenue Breakdown
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                <div className="flex items-center gap-2 text-stone-500 mb-1">
                                  <Utensils className="h-3.5 w-3.5" />
                                  <span className="text-xs font-medium">Restaurant</span>
                                </div>
                                <p className="font-bold text-stone-900">KES {formatNumber(branch.breakdown?.restaurant || 0)}</p>
                              </div>
                              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                <div className="flex items-center gap-2 text-stone-500 mb-1">
                                  <Wine className="h-3.5 w-3.5" />
                                  <span className="text-xs font-medium">Bar</span>
                                </div>
                                <p className="font-bold text-stone-900">KES {formatNumber(branch.breakdown?.bar || 0)}</p>
                              </div>
                              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                <div className="flex items-center gap-2 text-stone-500 mb-1">
                                  <Bed className="h-3.5 w-3.5" />
                                  <span className="text-xs font-medium">Rooms</span>
                                </div>
                                <p className="font-bold text-stone-900">KES {formatNumber(branch.breakdown?.rooms || 0)}</p>
                              </div>
                              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                <div className="flex items-center gap-2 text-stone-500 mb-1">
                                  <Wallet className="h-3.5 w-3.5" />
                                  <span className="text-xs font-medium">Other</span>
                                </div>
                                <p className="font-bold text-stone-900">KES {formatNumber(branch.breakdown?.other_income || 0)}</p>
                              </div>
                            </div>
                          </div>

                          {/* Expense Breakdown */}
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                              <Receipt className="h-3 w-3" /> Expense Breakdown
                            </h4>
                            <div className="space-y-3">
                              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 flex justify-between items-center">
                                <div>
                                  <p className="text-xs font-medium text-stone-500">Operational Expenses</p>
                                  <p className="font-bold text-stone-900">KES {formatNumber(branch.breakdown?.operational_expenses || 0)}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-stone-300" />
                              </div>
                              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 flex justify-between items-center">
                                <div>
                                  <p className="text-xs font-medium text-stone-500">Other Expenses</p>
                                  <p className="font-bold text-stone-900">KES {formatNumber(branch.breakdown?.other_expenses || 0)}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-stone-300" />
                              </div>
                              <div className="p-4 bg-stone-900 rounded-xl flex justify-between items-center">
                                <div>
                                  <p className="text-xs font-medium text-stone-400">Total Expenses</p>
                                  <p className="font-bold text-white">KES {formatNumber(branch.expenses)}</p>
                                </div>
                                <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-bold text-white uppercase tracking-wider">
                                  {branch.income > 0 ? ((branch.expenses / branch.income) * 100).toFixed(1) : 0}% of Rev
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
