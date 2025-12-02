'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { financeAPI } from '@/lib/api';
import { TrendingUp, RefreshCw, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface ForecastData { month: string; projectedRevenue: number; projectedExpenses: number; projectedProfit: number; confidence: number; }

export default function ForecastPage() {
  const { user } = useAuth();
  const [forecasts, setForecasts] = useState<ForecastData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [months, setMonths] = useState(6);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getForecast(months);
      if (response.success) setForecasts(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [months]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalProjectedRevenue = forecasts.reduce((sum, f) => sum + f.projectedRevenue, 0);
  const totalProjectedProfit = forecasts.reduce((sum, f) => sum + f.projectedProfit, 0);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Financial Forecast</h1><p className="text-gray-500">Projected financial performance</p></div>
            <div className="flex gap-2">
              {[3, 6, 12].map((m) => (
                <IOSButton key={m} variant={months === m ? 'primary' : 'secondary'} size="sm" onClick={() => setMonths(m)}>
                  {m} Months
                </IOSButton>
              ))}
              <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4" /></IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-ios-lg"><ArrowUpRight className="h-5 w-5 text-[#34C759]" /></div>
                <div><p className="text-sm text-gray-500">Projected Revenue ({months}mo)</p><p className="text-xl font-bold">KES {totalProjectedRevenue.toLocaleString()}</p></div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-ios-lg"><TrendingUp className="h-5 w-5 text-[#007AFF]" /></div>
                <div><p className="text-sm text-gray-500">Projected Profit ({months}mo)</p><p className="text-xl font-bold text-[#007AFF]">KES {totalProjectedProfit.toLocaleString()}</p></div>
              </div>
            </IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : forecasts.length === 0 ? (
            <IOSCard className="p-12 text-center"><TrendingUp className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No forecast data</p></IOSCard>
          ) : (
            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Monthly Projections</h2>
              <div className="space-y-4">
                {forecasts.map((f, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-ios-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{f.month}</span>
                      </div>
                      <span className="text-sm text-gray-500">{f.confidence}% confidence</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><p className="text-gray-500">Revenue</p><p className="font-bold text-[#34C759]">KES {f.projectedRevenue.toLocaleString()}</p></div>
                      <div><p className="text-gray-500">Expenses</p><p className="font-bold text-[#FF3B30]">KES {f.projectedExpenses.toLocaleString()}</p></div>
                      <div><p className="text-gray-500">Profit</p><p className={`font-bold ${f.projectedProfit >= 0 ? 'text-[#007AFF]' : 'text-[#FF3B30]'}`}>KES {f.projectedProfit.toLocaleString()}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </IOSCard>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
