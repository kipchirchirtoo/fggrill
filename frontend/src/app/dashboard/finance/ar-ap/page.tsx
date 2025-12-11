'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { Scale, RefreshCw, ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react';

interface ArApItem { id: string; type: 'receivable' | 'payable'; entity_name: string; amount: number; due_date: string; status: 'current' | 'overdue' | 'paid'; days_overdue?: number; }
interface Branch { id: number; name: string; }

export default function ArApPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ArApItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'receivable' | 'payable'>('all');
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
      const response = await financeAPI.getArAp();
      if (response.success && Array.isArray(response.data)) {
        setItems(response.data);
      } else {
        setItems([]);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const itemsArray = Array.isArray(items) ? items : [];
  const filteredItems = itemsArray.filter((item) => filter === 'all' || item.type === filter);
  const stats = {
    receivable: itemsArray.filter(i => i.type === 'receivable').reduce((sum, i) => sum + (i.amount || 0), 0),
    payable: itemsArray.filter(i => i.type === 'payable').reduce((sum, i) => sum + (i.amount || 0), 0),
    overdue: itemsArray.filter(i => i.status === 'overdue').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Accounts Receivable / Payable</h1>
              <p className="text-sm text-gray-500 mt-1">Outstanding balances and aging</p>
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
              {(['all', 'receivable', 'payable'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {f === 'all' ? 'All' : f === 'receivable' ? 'Receivable' : 'Payable'}
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
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Receivable</p>
                  <p className="text-xl font-semibold text-gray-900">KES {stats.receivable.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><ArrowUpRight className="h-5 w-5 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Payable</p>
                  <p className="text-xl font-semibold text-gray-900">KES {stats.payable.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><AlertCircle className="h-5 w-5 text-gray-600" /></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Overdue</p>
                  <p className="text-xl font-semibold text-gray-900">{stats.overdue} items</p>
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Scale className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No items found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      {item.type === 'receivable' ? <ArrowDownRight className="h-5 w-5 text-gray-600" /> : <ArrowUpRight className="h-5 w-5 text-gray-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.entity_name}</p>
                      <p className="text-sm text-gray-500">Due: {new Date(item.due_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold text-gray-900">KES {item.amount.toLocaleString()}</p>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {item.status === 'overdue' ? `${item.days_overdue}d overdue` : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
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
