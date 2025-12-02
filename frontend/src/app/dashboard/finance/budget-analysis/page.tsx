'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { financeAPI } from '@/lib/api';
import { PieChart, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface BudgetItem { category: string; budgeted: number; actual: number; variance: number; percentUsed: number; }

export default function BudgetAnalysisPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getBudgetAnalysis();
      if (response.success) setBudgets(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalBudget = budgets.reduce((sum, b) => sum + b.budgeted, 0);
  const totalActual = budgets.reduce((sum, b) => sum + b.actual, 0);
  const overBudget = budgets.filter(b => b.actual > b.budgeted).length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Budget Analysis</h1><p className="text-gray-500">Track budget vs actual spending</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-2xl font-bold">KES {totalBudget.toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Actual Spending</p>
              <p className={`text-2xl font-bold ${totalActual > totalBudget ? 'text-[#FF3B30]' : 'text-[#34C759]'}`}>KES {totalActual.toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Categories Over Budget</p>
              <p className={`text-2xl font-bold ${overBudget > 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}`}>{overBudget}</p>
            </IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : budgets.length === 0 ? (
            <IOSCard className="p-12 text-center"><PieChart className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No budget data</p></IOSCard>
          ) : (
            <div className="space-y-4">
              {budgets.map((item, i) => {
                const isOver = item.actual > item.budgeted;
                return (
                  <IOSCard key={i} className={`p-4 ${isOver ? 'border-l-4 border-red-500' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {isOver ? <AlertTriangle className="h-5 w-5 text-[#FF3B30]" /> : <CheckCircle className="h-5 w-5 text-[#34C759]" />}
                        <div><p className="font-bold">{item.category}</p><p className="text-sm text-gray-500">{item.percentUsed.toFixed(0)}% used</p></div>
                      </div>
                      <IOSBadge variant={isOver ? 'error' : 'success'}>{isOver ? 'Over Budget' : 'On Track'}</IOSBadge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div><p className="text-gray-500">Budgeted</p><p className="font-medium">KES {item.budgeted.toLocaleString()}</p></div>
                      <div><p className="text-gray-500">Actual</p><p className="font-medium">KES {item.actual.toLocaleString()}</p></div>
                      <div><p className="text-gray-500">Variance</p><p className={`font-medium ${item.variance < 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}`}>{item.variance < 0 ? '' : '+'}KES {item.variance.toLocaleString()}</p></div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full ${isOver ? 'bg-[#FF3B30]' : 'bg-[#34C759]'}`} style={{ width: `${Math.min(item.percentUsed, 100)}%` }} />
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
