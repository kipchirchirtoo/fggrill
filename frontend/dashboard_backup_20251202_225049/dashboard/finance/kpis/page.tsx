'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { financeAPI } from '@/lib/api';
import { BarChart3, RefreshCw, TrendingUp, TrendingDown, Target, DollarSign, Percent, Users } from 'lucide-react';

interface KPI { name: string; value: number; unit: string; target?: number; change?: number; trend: 'up' | 'down' | 'stable'; }

export default function KPIsPage() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getKPIs(period);
      if (response.success) setKpis(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getIcon = (name: string) => {
    if (name.toLowerCase().includes('revenue') || name.toLowerCase().includes('profit')) return DollarSign;
    if (name.toLowerCase().includes('rate') || name.toLowerCase().includes('margin')) return Percent;
    if (name.toLowerCase().includes('guest') || name.toLowerCase().includes('customer')) return Users;
    return BarChart3;
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Key Performance Indicators</h1><p className="text-gray-500">Track business performance metrics</p></div>
            <div className="flex gap-2">
              {(['week', 'month', 'quarter'] as const).map((p) => (
                <IOSButton key={p} variant={period === p ? 'primary' : 'secondary'} size="sm" onClick={() => setPeriod(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </IOSButton>
              ))}
              <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4" /></IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : kpis.length === 0 ? (
            <IOSCard className="p-12 text-center"><BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No KPI data</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kpis.map((kpi, i) => {
                const Icon = getIcon(kpi.name);
                const isPositive = kpi.trend === 'up';
                const targetMet = kpi.target ? kpi.value >= kpi.target : true;
                return (
                  <IOSCard key={i} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-blue-100 rounded-ios-lg"><Icon className="h-5 w-5 text-blue-600" /></div>
                      {kpi.change !== undefined && (
                        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {Math.abs(kpi.change)}%
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{kpi.name}</p>
                    <p className="text-2xl font-bold mt-1">
                      {kpi.unit === 'KES' ? 'KES ' : ''}{kpi.value.toLocaleString()}{kpi.unit === '%' ? '%' : ''}
                    </p>
                    {kpi.target && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Target: {kpi.target.toLocaleString()}</span>
                          <span className={targetMet ? 'text-green-600' : 'text-red-600'}>{targetMet ? '✓ Met' : '✗ Below'}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full ${targetMet ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
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
