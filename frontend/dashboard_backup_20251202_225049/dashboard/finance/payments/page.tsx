'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { financeAPI } from '@/lib/api';
import { CreditCard, RefreshCw, Search, ArrowUpRight, ArrowDownRight, DollarSign, Calendar } from 'lucide-react';

interface Transaction { id: string; type: 'income' | 'expense'; description: string; amount: number; category: string; date: string; payment_method?: string; reference?: string; }

export default function PaymentsPage() {
  const { user } = useAuth();
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
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Payments & Transactions</h1><p className="text-gray-500">Track all financial transactions</p></div>
            <IOSButton variant="secondary" onClick={fetchTransactions}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><p className="text-sm text-gray-500">Net Balance</p><p className={`text-2xl font-bold ${stats.income - stats.expense >= 0 ? 'text-green-600' : 'text-red-600'}`}>KES {(stats.income - stats.expense).toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500"><p className="text-sm text-gray-500">Total Income</p><p className="text-2xl font-bold text-green-600">KES {stats.income.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500"><p className="text-sm text-gray-500">Total Expenses</p><p className="text-2xl font-bold text-red-600">KES {stats.expense.toLocaleString()}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2">
                {['all', 'income', 'expense'].map((type) => (
                  <IOSButton key={type} variant={typeFilter === type ? 'primary' : 'secondary'} size="sm" onClick={() => setTypeFilter(type)}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredTransactions.length === 0 ? (
            <IOSCard className="p-12 text-center"><CreditCard className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No transactions found</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((tx) => (
                <IOSCard key={tx.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-ios-lg flex items-center justify-center ${tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {tx.type === 'income' ? <ArrowDownRight className="h-6 w-6 text-green-600" /> : <ArrowUpRight className="h-6 w-6 text-red-600" />}
                      </div>
                      <div>
                        <p className="font-bold">{tx.description}</p>
                        <p className="text-sm text-gray-500">{tx.category} • {new Date(tx.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className={`font-bold text-lg ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}KES {tx.amount.toLocaleString()}
                    </p>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
