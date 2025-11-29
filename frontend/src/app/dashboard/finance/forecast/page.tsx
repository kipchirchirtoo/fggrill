'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ForecastPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [forecastData, setForecastData] = useState<any>(null);
  const [months, setMonths] = useState(3);

  useEffect(() => { fetchForecast(); }, [months]);

  const fetchForecast = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.getForecast(months);
      setForecastData(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load forecast');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `KES ${(amount || 0).toLocaleString()}`;

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
                  <LineChart className="h-6 w-6 text-indigo-600" />
                  Financial Forecast
                </h1>
                <p className="text-gray-600">Projected income and expenses based on trends</p>
              </div>
            </div>
            <Button onClick={fetchForecast} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Forecast Period:</span>
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="border rounded-lg px-3 py-2">
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
              </select>
            </div>
          </Card>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Generating forecast...</div>
          ) : forecastData ? (
            <>
              {/* Trends */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Avg Monthly Income</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(forecastData.trends?.avgMonthlyIncome)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Avg Monthly Expenses</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(forecastData.trends?.avgMonthlyExpenses)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Income Growth Rate</p>
                  <p className={`text-xl font-bold ${Number(forecastData.trends?.incomeGrowthRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {forecastData.trends?.incomeGrowthRate}%
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Expense Growth Rate</p>
                  <p className={`text-xl font-bold ${Number(forecastData.trends?.expenseGrowthRate) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {forecastData.trends?.expenseGrowthRate}%
                  </p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Historical Data */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Historical Data (Last 6 Months)</h3>
                  <div className="space-y-2">
                    {(forecastData.historical || []).map((h: any) => (
                      <div key={h.month} className="flex items-center justify-between p-3 bg-gray-50 rounded text-sm">
                        <span className="font-medium">{h.month}</span>
                        <div className="flex gap-4">
                          <span className="text-green-600">+{formatCurrency(h.income)}</span>
                          <span className="text-red-600">-{formatCurrency(h.expenses)}</span>
                          <span className={`font-bold ${h.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatCurrency(h.net)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Forecast */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    Projected ({months} Months)
                  </h3>
                  <div className="space-y-2">
                    {(forecastData.forecast || []).map((f: any) => (
                      <div key={f.month} className="flex items-center justify-between p-3 bg-indigo-50 rounded text-sm border border-indigo-100">
                        <span className="font-medium">{f.month}</span>
                        <div className="flex gap-4">
                          <span className="text-green-600">+{formatCurrency(f.projectedIncome)}</span>
                          <span className="text-red-600">-{formatCurrency(f.projectedExpenses)}</span>
                          <span className={`font-bold ${f.projectedNet >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatCurrency(f.projectedNet)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Summary */}
              <Card className="p-6 bg-indigo-50 border-indigo-200">
                <h3 className="font-semibold mb-4">Forecast Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">Total Projected Income</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(forecastData.forecast?.reduce((s: number, f: any) => s + f.projectedIncome, 0))}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">Total Projected Expenses</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(forecastData.forecast?.reduce((s: number, f: any) => s + f.projectedExpenses, 0))}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-white rounded-lg">
                    <p className="text-sm text-gray-600">Total Projected Net</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {formatCurrency(forecastData.forecast?.reduce((s: number, f: any) => s + f.projectedNet, 0))}
                    </p>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">No forecast data available</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
