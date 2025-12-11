'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { TrendingUp, TrendingDown, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface CashFlowData { period: string; inflow: number; outflow: number; net: number; }
interface Branch { id: number; name: string; }

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlowData[]>([]);
  const [summary, setSummary] = useState({ totalInflow: 0, totalOutflow: 0, netCashFlow: 0 });
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
      const response = await financeAPI.getCashFlow({ branch_id: selectedBranch || undefined });
      if (response.success) {
        setData(Array.isArray(response.data?.periods) ? response.data.periods : []);
        const summaryData = response.data?.summary || {};
        setSummary({
          totalInflow: typeof summaryData.totalInflow === 'number' ? summaryData.totalInflow : 0,
          totalOutflow: typeof summaryData.totalOutflow === 'number' ? summaryData.totalOutflow : 0,
          netCashFlow: typeof summaryData.netCashFlow === 'number' ? summaryData.netCashFlow : 0
        });
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Cash Flow Statement</h1>
              <p className="text-sm text-gray-500 mt-1">Track money in and out</p>
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

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><ArrowDownRight className="h-5 w-5 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Inflow</p>
                  <p className="text-xl font-semibold text-gray-900">KES {(summary?.totalInflow || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><ArrowUpRight className="h-5 w-5 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Outflow</p>
                  <p className="text-xl font-semibold text-gray-900">KES {(summary?.totalOutflow || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  {(summary?.netCashFlow || 0) >= 0 ? <TrendingUp className="h-5 w-5 text-gray-600" /> : <TrendingDown className="h-5 w-5 text-gray-600" />}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Net Cash Flow</p>
                  <p className="text-xl font-semibold text-gray-900">KES {(summary?.netCashFlow || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Periods */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-900">Cash Flow by Period</h2>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : data.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No data available</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.map((item, i) => (
                  <div key={i} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-gray-900">{item.period}</p>
                      <p className="font-semibold text-gray-900">
                        {item.net >= 0 ? '+' : ''}KES {item.net.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-6 text-sm text-gray-500 mb-3">
                      <span>↓ Inflow: KES {item.inflow.toLocaleString()}</span>
                      <span>↑ Outflow: KES {item.outflow.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-400" style={{ width: `${(item.inflow / Math.max(item.inflow + item.outflow, 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
