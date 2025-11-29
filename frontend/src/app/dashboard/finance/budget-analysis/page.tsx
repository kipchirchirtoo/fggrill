'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

export default function BudgetAnalysisPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [budgetData, setBudgetData] = useState<any>(null);
  const [period, setPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  useEffect(() => { fetchBudgetAnalysis(); }, [period]);

  const fetchBudgetAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.getBudgetAnalysis({
        year: period.year,
        month: period.month
      });
      setBudgetData(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load budget analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `KES ${(amount || 0).toLocaleString()}`;
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/finance">
                <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Target className="h-6 w-6 text-amber-600" />
                  Budget vs Actual Analysis
                </h1>
                <p className="text-gray-600">Compare budgeted vs actual expenses</p>
              </div>
            </div>
            <Button onClick={fetchBudgetAnalysis} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium">Period:</span>
              <select 
                value={period.month} 
                onChange={(e) => setPeriod(prev => ({ ...prev, month: Number(e.target.value) }))}
                className="border rounded-lg px-3 py-2"
              >
                {months.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <select 
                value={period.year} 
                onChange={(e) => setPeriod(prev => ({ ...prev, year: Number(e.target.value) }))}
                className="border rounded-lg px-3 py-2"
              >
                {[2023, 2024, 2025].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </Card>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading budget analysis...</div>
          ) : budgetData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Total Budgeted</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(budgetData.totals?.budgeted)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Actual Spent</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(budgetData.totals?.actual)}</p>
                </Card>
                <Card className={`p-4 ${budgetData.totals?.variance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-sm text-gray-600">Variance</p>
                  <p className={`text-2xl font-bold ${budgetData.totals?.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(budgetData.totals?.variance)}
                  </p>
                </Card>
                <Card className={`p-4 ${budgetData.totals?.status === 'UNDER_BUDGET' ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-sm text-gray-600">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {budgetData.totals?.status === 'UNDER_BUDGET' ? (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <span className="font-bold text-green-700">Under Budget</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                        <span className="font-bold text-red-700">Over Budget</span>
                      </>
                    )}
                  </div>
                </Card>
              </div>

              {/* Category Analysis */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Budget by Category</h3>
                {budgetData.analysis?.length > 0 ? (
                  <div className="space-y-4">
                    {budgetData.analysis.map((item: any, idx: number) => {
                      const pctUsed = item.budgeted > 0 ? (item.actual / item.budgeted) * 100 : 0;
                      const isOver = pctUsed > 100;
                      return (
                        <div key={idx} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{item.category?.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-2">
                              {item.status === 'UNDER_BUDGET' ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                  <TrendingDown className="h-3 w-3" /> Under
                                </span>
                              ) : (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" /> Over
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                            <div>
                              <span className="text-gray-500">Budgeted:</span>
                              <span className="ml-2 font-medium">{formatCurrency(item.budgeted)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Actual:</span>
                              <span className="ml-2 font-medium">{formatCurrency(item.actual)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Variance:</span>
                              <span className={`ml-2 font-medium ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(item.variance)}
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full ${isOver ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(pctUsed, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{pctUsed.toFixed(1)}% of budget used</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No budget data for this period</p>
                    <p className="text-sm mt-1">Create budgets to start tracking</p>
                  </div>
                )}
              </Card>

              {/* Tips */}
              <Card className="p-4 bg-amber-50 border-amber-200">
                <h4 className="font-medium text-amber-800 mb-2">Budget Tips</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• Review categories that are consistently over budget</li>
                  <li>• Adjust future budgets based on actual spending patterns</li>
                  <li>• Set alerts for when spending approaches budget limits</li>
                </ul>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">No budget analysis data available</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
