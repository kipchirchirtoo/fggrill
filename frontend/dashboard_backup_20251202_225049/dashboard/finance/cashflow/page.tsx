'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { financeAPI } from '@/lib/api';
import { TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight, DollarSign, Calendar } from 'lucide-react';

interface CashFlowData { period: string; inflow: number; outflow: number; net: number; }

export default function CashFlowPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CashFlowData[]>([]);
  const [summary, setSummary] = useState({ totalInflow: 0, totalOutflow: 0, netCashFlow: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getCashFlow();
      if (response.success) {
        setData(response.data?.periods || []);
        setSummary(response.data?.summary || { totalInflow: 0, totalOutflow: 0, netCashFlow: 0 });
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Cash Flow</h1><p className="text-gray-500">Track money in and out</p></div>
            <div className="flex gap-2">
              {(['week', 'month', 'quarter'] as const).map((p) => (
                <IOSButton key={p} variant={period === p ? 'primary' : 'secondary'} size="sm" onClick={() => setPeriod(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </IOSButton>
              ))}
              <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4" /></IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-ios-lg"><ArrowDownRight className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-sm text-gray-500">Total Inflow</p><p className="text-xl font-bold text-green-600">KES {summary.totalInflow.toLocaleString()}</p></div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-ios-lg"><ArrowUpRight className="h-5 w-5 text-red-600" /></div>
                <div><p className="text-sm text-gray-500">Total Outflow</p><p className="text-xl font-bold text-red-600">KES {summary.totalOutflow.toLocaleString()}</p></div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-ios-lg ${summary.netCashFlow >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                  {summary.netCashFlow >= 0 ? <TrendingUp className="h-5 w-5 text-blue-600" /> : <TrendingDown className="h-5 w-5 text-orange-600" />}
                </div>
                <div><p className="text-sm text-gray-500">Net Cash Flow</p><p className={`text-xl font-bold ${summary.netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>KES {summary.netCashFlow.toLocaleString()}</p></div>
              </div>
            </IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Cash Flow by Period</h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
            ) : data.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No data available</div>
            ) : (
              <div className="space-y-4">
                {data.map((item, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-ios-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{item.period}</p>
                      <p className={`font-bold ${item.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.net >= 0 ? '+' : ''}KES {item.net.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">↓ KES {item.inflow.toLocaleString()}</span>
                      <span className="text-red-600">↑ KES {item.outflow.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${(item.inflow / (item.inflow + item.outflow)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
