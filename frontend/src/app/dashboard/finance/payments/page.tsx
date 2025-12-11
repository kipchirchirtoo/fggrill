'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { RefreshCw, CreditCard, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface Transaction { id: string; type: 'income' | 'expense'; description: string; amount: number; category: string; date: string; }

export default function PaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getTransactions({ type: typeFilter !== 'all' ? typeFilter : undefined });
      if (response.success) setTransactions(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [typeFilter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const filteredTransactions = transactions.filter((t) => t.description?.toLowerCase().includes(searchQuery.toLowerCase()));
  const stats = {
    income: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    expense: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Payments & Transactions</h1>
              <p className="text-sm text-gray-500 mt-1">Track all financial transactions</p>
            </div>
            <button onClick={fetchTransactions} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Net Balance</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">KES {formatNumber((stats.income - stats.expense) || 0)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Income</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">KES {formatNumber(stats.income || 0)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Expenses</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">KES {formatNumber(stats.expense || 0)}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search transactions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div className="flex gap-1">
                {['all', 'income', 'expense'].map((type) => (
                  <button key={type} onClick={() => setTypeFilter(type)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${typeFilter === type ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : filteredTransactions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No transactions found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      {tx.type === 'income' ? <ArrowDownRight className="h-5 w-5 text-gray-600" /> : <ArrowUpRight className="h-5 w-5 text-gray-600" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{tx.description}</p>
                      <p className="text-sm text-gray-500" suppressHydrationWarning>{tx.category} • {new Date(tx.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {tx.type === 'income' ? '+' : '-'}KES {formatNumber(tx.amount || 0)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
