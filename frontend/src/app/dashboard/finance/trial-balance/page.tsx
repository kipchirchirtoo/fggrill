'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { BookOpen, RefreshCw, Download, CheckCircle, AlertCircle } from 'lucide-react';

interface TrialBalanceEntry {
  account: string;
  debit: number;
  credit: number;
}

interface TrialBalanceData {
  period: string;
  entries: TrialBalanceEntry[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

interface Branch { id: number; name: string; }

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      const response = await financeAPI.getTrialBalance({ branch_id: selectedBranch || undefined });
      if (response.success && response.data) setData(response.data);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Trial Balance</h1>
              <p className="text-sm text-gray-500 mt-1">Verify debit and credit balances</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button onClick={fetchData} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !data ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No trial balance data available</p>
            </div>
          ) : (
            <>
              {/* Period & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Period</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{data.period || 'Current Period'}</p>
                </div>
                <div className={`border rounded-lg p-4 ${data.is_balanced ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300'}`}>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {data.is_balanced ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-gray-600" />
                        <span className="text-lg font-semibold text-gray-900">Balanced</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-gray-600" />
                        <span className="text-lg font-semibold text-gray-900">Unbalanced</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Trial Balance Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Account</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Debit (KES)</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Credit (KES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-gray-500">No entries found</td>
                      </tr>
                    ) : (
                      entries.map((entry, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-sm text-gray-900">{entry.account}</td>
                          <td className="px-5 py-3 text-sm text-gray-900 text-right font-mono">
                            {(entry.debit || 0) > 0 ? (entry.debit || 0).toLocaleString() : '-'}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-900 text-right font-mono">
                            {(entry.credit || 0) > 0 ? (entry.credit || 0).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-900">Total</td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-900 text-right font-mono">
                        {(data.total_debit || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-900 text-right font-mono">
                        {(data.total_credit || 0).toLocaleString()}
                      </td>
                    </tr>
                    {!data.is_balanced && (
                      <tr className="bg-gray-200">
                        <td className="px-5 py-3 text-sm font-medium text-gray-700">Difference</td>
                        <td colSpan={2} className="px-5 py-3 text-sm font-semibold text-gray-900 text-right font-mono">
                          {Math.abs((data.total_debit || 0) - (data.total_credit || 0)).toLocaleString()}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {/* Accounting Equation */}
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Accounting Equation Verification</h3>
                <div className="flex items-center justify-center gap-4 text-center">
                  <div className="p-4 bg-gray-50 rounded-lg flex-1">
                    <p className="text-xs text-gray-500 uppercase">Total Debits</p>
                    <p className="text-xl font-semibold text-gray-900">KES {(data.total_debit || 0).toLocaleString()}</p>
                  </div>
                  <span className="text-2xl text-gray-400">=</span>
                  <div className="p-4 bg-gray-50 rounded-lg flex-1">
                    <p className="text-xs text-gray-500 uppercase">Total Credits</p>
                    <p className="text-xl font-semibold text-gray-900">KES {(data.total_credit || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
