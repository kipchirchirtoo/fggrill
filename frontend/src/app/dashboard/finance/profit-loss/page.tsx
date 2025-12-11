'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { BarChart3, RefreshCw, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';

interface PLData { revenue: number; costOfGoods: number; grossProfit: number; operatingExpenses: number; operatingIncome: number; otherIncome: number; otherExpenses: number; netProfit: number; margin: number; }
interface Branch { id: number; name: string; }

export default function ProfitLossPage() {
  const [data, setData] = useState<PLData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
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
      const response = await financeAPI.getProfitLoss({ branch_id: selectedBranch || undefined });
      if (response.success && response.data) {
        setData({
          revenue: response.data.revenue || 0,
          costOfGoods: response.data.costOfGoods || 0,
          grossProfit: response.data.grossProfit || 0,
          operatingExpenses: response.data.operatingExpenses || 0,
          operatingIncome: response.data.operatingIncome || 0,
          otherIncome: response.data.otherIncome || 0,
          otherExpenses: response.data.otherExpenses || 0,
          netProfit: response.data.netProfit || 0,
          margin: response.data.margin || 0,
        });
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const LineItem = ({ label, amount, indent = false, bold = false }: { label: string; amount: number; indent?: boolean; bold?: boolean }) => (
    <div className={`flex justify-between py-3 ${indent ? 'pl-6' : ''} ${bold ? 'font-medium' : ''}`}>
      <span className="text-gray-700">{label}</span>
      <span className={`${bold ? 'font-semibold' : ''} text-gray-900`}>
        {amount < 0 ? '(' : ''}KES {Math.abs(amount).toLocaleString()}{amount < 0 ? ')' : ''}
      </span>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Profit & Loss Statement</h1>
              <p className="text-sm text-gray-500 mt-1">Income statement overview</p>
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
              {(['month', 'quarter', 'year'] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${period === p ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !data ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No data available</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg"><DollarSign className="h-5 w-5 text-gray-600" /></div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
                      <p className="text-xl font-semibold text-gray-900">KES {data.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      {data.netProfit >= 0 ? <TrendingUp className="h-5 w-5 text-gray-600" /> : <TrendingDown className="h-5 w-5 text-gray-600" />}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Net Profit</p>
                      <p className="text-xl font-semibold text-gray-900">KES {data.netProfit.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg"><BarChart3 className="h-5 w-5 text-gray-600" /></div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Profit Margin</p>
                      <p className="text-xl font-semibold text-gray-900">{data.margin.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statement */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-medium text-gray-900">Statement Details</h2>
                </div>
                <div className="px-5 divide-y divide-gray-100">
                  <LineItem label="Revenue" amount={data.revenue} bold />
                  <LineItem label="Cost of Goods Sold" amount={-data.costOfGoods} indent />
                  <div className="flex justify-between py-3 bg-gray-50 -mx-5 px-5">
                    <span className="font-medium text-gray-900">Gross Profit</span>
                    <span className="font-semibold text-gray-900">KES {data.grossProfit.toLocaleString()}</span>
                  </div>
                  <LineItem label="Operating Expenses" amount={-data.operatingExpenses} indent />
                  <div className="flex justify-between py-3 bg-gray-50 -mx-5 px-5">
                    <span className="font-medium text-gray-900">Operating Income</span>
                    <span className="font-semibold text-gray-900">KES {data.operatingIncome.toLocaleString()}</span>
                  </div>
                  <LineItem label="Other Income" amount={data.otherIncome} indent />
                  <LineItem label="Other Expenses" amount={-data.otherExpenses} indent />
                </div>
                <div className="flex justify-between py-4 px-5 bg-gray-100 font-semibold text-lg border-t border-gray-200">
                  <span>Net Profit</span>
                  <span>KES {data.netProfit.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
