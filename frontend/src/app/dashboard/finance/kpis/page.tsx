'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface KPI { name: string; value: number; unit: string; target?: number; change?: number; trend?: 'up' | 'down' | 'stable'; }
interface Branch { id: number; name: string; }

export default function KPIsPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await financeAPI.getBranches();
      if (response.success && Array.isArray(response.data)) setBranches(response.data);
    } catch (error) { console.error('Error:', error); }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getKPIs(period);
      if (response.success && Array.isArray(response.data)) {
        setKpis(response.data);
      } else {
        setKpis([]);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [period]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Financial KPIs</h1>
              <p className="text-sm text-gray-500 mt-1">Key performance indicators</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {(['week', 'month', 'quarter'] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${period === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
              <button onClick={fetchData} disabled={isLoading} className="p-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !Array.isArray(kpis) || kpis.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Activity className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No KPI data available</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kpis.map((kpi, i) => {
                const progress = kpi.target ? Math.min((kpi.value / kpi.target) * 100, 100) : 0;
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{kpi.name}</p>
                        <p className="text-2xl font-semibold text-gray-900 mt-1">
                          {kpi.unit === 'KES' ? 'KES ' : ''}{kpi.value.toLocaleString()}{kpi.unit === '%' ? '%' : ''}
                        </p>
                      </div>
                      {kpi.trend && (
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {kpi.trend === 'up' ? <TrendingUp className="h-4 w-4 text-gray-600" /> : 
                           kpi.trend === 'down' ? <TrendingDown className="h-4 w-4 text-gray-600" /> :
                           <Activity className="h-4 w-4 text-gray-500" />}
                        </div>
                      )}
                    </div>
                    {kpi.change !== undefined && (
                      <p className="text-sm text-gray-500">
                        {kpi.change >= 0 ? '+' : ''}{kpi.change}% from last period
                      </p>
                    )}
                    {kpi.target && (
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Target</span>
                          <span className="font-medium text-gray-900">{kpi.unit === 'KES' ? 'KES ' : ''}{kpi.target.toLocaleString()}{kpi.unit === '%' ? '%' : ''}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-400" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
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
