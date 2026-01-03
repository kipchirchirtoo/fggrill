'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { PieChart, RefreshCw, Calendar } from 'lucide-react';
import { BranchSelector } from '@/components/finance/BranchSelector';

interface BudgetItem { category: string; budgeted: number; actual: number; variance: number; percentUsed: number; }

export default function BudgetAnalysisPage() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getBudgetAnalysis({
        branch_id: selectedBranch || undefined,
        year,
        month
      });
      if (response?.success && Array.isArray(response.data)) {
        setBudgets(response.data);
      } else if (Array.isArray(response)) {
        setBudgets(response);
      } else {
        setBudgets([]);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const budgetArray = Array.isArray(budgets) ? budgets : [];
  const totalBudget = budgetArray.reduce((sum, b) => sum + (b.budgeted || 0), 0);
  const totalActual = budgetArray.reduce((sum, b) => sum + (b.actual || 0), 0);
  const overBudget = budgetArray.filter(b => (b.actual || 0) > (b.budgeted || 0)).length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3">
            <BranchSelector
              selectedBranch={selectedBranch}
              onBranchChange={setSelectedBranch}
            />
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3 py-1.5">
              <Calendar className="h-4 w-4 text-stone-400" />
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="text-[13px] text-stone-600 bg-transparent border-none focus:ring-0 p-0"
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="text-[13px] text-stone-600 bg-transparent border-none focus:ring-0 p-0"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}</option>
                ))}
              </select>
            </div>
            <button onClick={fetchData} disabled={isLoading} className="p-2.5 text-stone-500 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Budget</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">KES {totalBudget.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Actual Spending</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">KES {totalActual.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Over Budget</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{overBudget} categories</p>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : budgetArray.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <PieChart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No budget data</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {budgetArray.map((item, i) => {
                const isOver = (item.actual || 0) > (item.budgeted || 0);
                return (
                  <div key={i} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.category}</p>
                        <p className="text-sm text-gray-500">{(item.percentUsed || 0).toFixed(0)}% used</p>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {isOver ? 'Over Budget' : 'On Track'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div><p className="text-gray-500">Budgeted</p><p className="font-medium text-gray-900">KES {(item.budgeted || 0).toLocaleString()}</p></div>
                      <div><p className="text-gray-500">Actual</p><p className="font-medium text-gray-900">KES {(item.actual || 0).toLocaleString()}</p></div>
                      <div><p className="text-gray-500">Variance</p><p className="font-medium text-gray-900">{(item.variance || 0) < 0 ? '' : '+'}KES {(item.variance || 0).toLocaleString()}</p></div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-400" style={{ width: `${Math.min(item.percentUsed || 0, 100)}%` }} />
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
