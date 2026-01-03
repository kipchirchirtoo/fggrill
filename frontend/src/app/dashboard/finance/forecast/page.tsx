'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { TrendingUp, RefreshCw, Calendar, Target } from 'lucide-react';
import { BranchSelector } from '@/components/finance/BranchSelector';

interface ForecastItem { month: string; projectedRevenue: number; projectedExpenses: number; projectedProfit: number; confidence: number; }

export default function ForecastPage() {
  const [forecast, setForecast] = useState<ForecastItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [months, setMonths] = useState<number>(6);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getForecast({
        months,
        branch_id: selectedBranch || undefined
      });
      if (response?.success && Array.isArray(response.data)) {
        setForecast(response.data);
      } else if (Array.isArray(response)) {
        setForecast(response);
      } else {
        setForecast([]);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [months, selectedBranch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const forecastArray = Array.isArray(forecast) ? forecast : [];
  const totalProjectedRevenue = forecastArray.reduce((sum, f) => sum + (f.projectedRevenue || 0), 0);
  const totalProjectedProfit = forecastArray.reduce((sum, f) => sum + (f.projectedProfit || 0), 0);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Financial Forecast</h1>
              <p className="text-sm text-gray-500 mt-1">Projected financial performance</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <BranchSelector
                selectedBranch={selectedBranch}
                onBranchChange={setSelectedBranch}
              />
              <div className="flex gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200">
                {[3, 6, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMonths(m)}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all ${months === m
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                      }`}
                  >
                    {m} Months
                  </button>
                ))}
              </div>
              <button onClick={fetchData} disabled={isLoading} className="p-2.5 text-stone-500 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><TrendingUp className="h-5 w-5 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Projected Revenue ({months}mo)</p>
                  <p className="text-xl font-semibold text-gray-900">KES {totalProjectedRevenue.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><Target className="h-5 w-5 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Projected Profit ({months}mo)</p>
                  <p className="text-xl font-semibold text-gray-900">KES {totalProjectedProfit.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : forecastArray.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No forecast data</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {forecastArray.map((item, i) => (
                <div key={i} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg"><Calendar className="h-5 w-5 text-gray-600" /></div>
                      <p className="font-medium text-gray-900">{item.month || 'Unknown'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Confidence:</span>
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400" style={{ width: `${item.confidence || 0}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{item.confidence || 0}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase">Revenue</p>
                      <p className="font-semibold text-gray-900">KES {(item.projectedRevenue || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase">Expenses</p>
                      <p className="font-semibold text-gray-900">KES {(item.projectedExpenses || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase">Profit</p>
                      <p className="font-semibold text-gray-900">KES {(item.projectedProfit || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
