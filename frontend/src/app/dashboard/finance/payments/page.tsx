'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { financeAPI } from '@/lib/api';
import { CreditCard, Plus, RefreshCw, Search, ArrowUpRight, ArrowDownLeft, Filter, Calendar, Building2, Wallet, Tag, FileText, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BranchSelector } from '@/components/finance/BranchSelector';
import { DateRangeSelector, DateRangePreset } from '@/components/finance/DateRangeSelector';
import { formatNumber } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

interface Transaction {
  id: string;
  transaction_number: string;
  transaction_type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  payment_method: string;
  payment_date: string;
  payment_status: string;
  branch_id?: string;
  branch_id?: string;
  created_at: string;
  metadata?: any;
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New transaction form
  const [newTransaction, setNewTransaction] = useState({
    transaction_type: 'income' as 'income' | 'expense',
    amount: 0,
    description: '',
    category: 'General',
    payment_method: 'Cash',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getTransactions({
        branch_id: selectedBranch || undefined,
        startDate,
        endDate,
        type: typeFilter !== 'all' ? typeFilter : undefined
      });
      if (response.success) setTransactions(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch, startDate, endDate, typeFilter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleRecordTransaction = async () => {
    if (newTransaction.amount <= 0) { toast.error('Amount must be greater than 0'); return; }
    if (!newTransaction.description) { toast.error('Description is required'); return; }
    if (!selectedBranch) { toast.error('Please select a branch for this transaction'); return; }

    setIsSubmitting(true);
    try {
      await financeAPI.createTransaction({
        ...newTransaction,
        branch_id: selectedBranch
      });
      toast.success('Transaction recorded successfully!');
      setShowRecordModal(false);
      setNewTransaction({
        transaction_type: 'income',
        amount: 0,
        description: '',
        category: 'General',
        payment_method: 'Cash',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      fetchTransactions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.transaction_number?.toLowerCase().includes(searchQuery.toLowerCase()) || t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleVerifyPayment = async (paymentId: string, status: 'completed' | 'failed') => {
    try {
      await financeAPI.verifyPayment(paymentId, status);
      toast.success(`Payment ${status} successfully`);
      fetchTransactions();
    } catch (error: any) {
      toast.error(error.message || 'Verification failed');
    }
  };

  const stats = {
    income: transactions.filter(t => t.transaction_type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0),
    expense: transactions.filter(t => t.transaction_type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0),
  };
  const netBalance = stats.income - stats.expense;

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Payments & Transactions</h1>
              <p className="text-sm text-stone-500 mt-1">Track all cash flows and financial activities</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <BranchSelector
                selectedBranch={selectedBranch}
                onBranchChange={setSelectedBranch}
              />
              <DateRangeSelector
                startDate={startDate}
                endDate={endDate}
                onRangeChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
                preset={datePreset}
                onPresetChange={setDatePreset}
              />
              <button onClick={fetchTransactions} disabled={isLoading} className="p-2.5 text-stone-500 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-all shadow-sm">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowRecordModal(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-stone-900 rounded-xl hover:bg-stone-800 transition-all shadow-sm active:scale-95">
                <Plus className="h-4 w-4" />
                Record Transaction
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-stone-900 rounded-xl"><Wallet className="h-6 w-6 text-white" /></div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Net Balance</p>
                  <p className={`text-2xl font-bold mt-1 ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>KES {formatNumber(netBalance)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 rounded-xl"><ArrowUpRight className="h-6 w-6 text-emerald-600" /></div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Income</p>
                  <p className="text-2xl font-bold mt-1 text-stone-900">KES {formatNumber(stats.income)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-50 rounded-xl"><ArrowDownLeft className="h-6 w-6 text-rose-600" /></div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Expenses</p>
                  <p className="text-2xl font-bold mt-1 text-stone-900">KES {formatNumber(stats.expense)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-stone-400" />
                <input
                  type="text"
                  placeholder="Search transactions by # or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0">
                {['all', 'income', 'expense'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${typeFilter === type ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:bg-stone-50'}`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border border-stone-200 rounded-2xl shadow-sm">
              <RefreshCw className="h-10 w-10 animate-spin text-stone-300 mb-4" />
              <p className="text-stone-400 font-medium">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center shadow-sm">
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CreditCard className="h-10 w-10 text-stone-200" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900">No transactions found</h3>
              <p className="text-stone-500 mt-2 max-w-xs mx-auto">We couldn't find any transactions for the selected filters.</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-stone-100">
              {filteredTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-5 hover:bg-stone-50/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors border ${t.transaction_type === 'income' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                      {t.transaction_type === 'income' ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownLeft className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-stone-900">{t.description}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full uppercase tracking-wider">{t.category}</span>
                      </div>
                      <p className="text-xs text-stone-400 font-medium mt-0.5">{t.transaction_number} • {t.payment_method}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Calendar className="h-3 w-3 text-stone-300" />
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{new Date(t.payment_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={`font-bold text-lg ${t.transaction_type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.transaction_type === 'income' ? '+' : '-'} KES {formatNumber(t.amount)}
                      </p>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${t.payment_status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : t.payment_status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {t.payment_status}
                        </div>
                        {t.payment_status === 'pending' && (user?.role === 'cashier' || user?.role === 'super_admin' || user?.role === 'accountant') && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleVerifyPayment(t.id, 'completed'); }}
                              className="p-1 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                              title="Verify Payment"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleVerifyPayment(t.id, 'failed'); }}
                              className="p-1 hover:bg-rose-100 rounded-full text-rose-600 transition-colors"
                              title="Reject Payment"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-stone-900 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Record Transaction Modal */}
        <Dialog open={showRecordModal} onOpenChange={setShowRecordModal}>
          <DialogContent className="max-w-xl rounded-3xl border-none shadow-2xl p-0">
            <div className="p-8">
              <DialogHeader><DialogTitle className="text-2xl font-bold text-stone-900">Record Transaction</DialogTitle></DialogHeader>
              <div className="space-y-6 mt-6">
                <div className="flex p-1 bg-stone-100 rounded-xl">
                  <button
                    onClick={() => setNewTransaction({ ...newTransaction, transaction_type: 'income' })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newTransaction.transaction_type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500'}`}
                  >
                    INCOME
                  </button>
                  <button
                    onClick={() => setNewTransaction({ ...newTransaction, transaction_type: 'expense' })}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${newTransaction.transaction_type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-500'}`}
                  >
                    EXPENSE
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block">Amount (KES) *</label>
                    <input
                      type="number"
                      value={newTransaction.amount}
                      onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all text-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block">Date</label>
                    <input
                      type="date"
                      value={newTransaction.payment_date}
                      onChange={(e) => setNewTransaction({ ...newTransaction, payment_date: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block">Description *</label>
                  <input
                    type="text"
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                    placeholder="e.g. Office supplies, Guest refund, etc."
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block">Category</label>
                    <select
                      value={newTransaction.category}
                      onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm font-medium"
                    >
                      <option value="General">General</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Supplies">Supplies</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Payroll">Payroll</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block">Payment Method</label>
                    <select
                      value={newTransaction.payment_method}
                      onChange={(e) => setNewTransaction({ ...newTransaction, payment_method: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm font-medium"
                    >
                      <option value="Cash">Cash</option>
                      <option value="M-Pesa">M-Pesa</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block">Notes</label>
                  <textarea
                    value={newTransaction.notes}
                    onChange={(e) => setNewTransaction({ ...newTransaction, notes: e.target.value })}
                    placeholder="Additional details..."
                    rows={2}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm font-medium resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowRecordModal(false)} className="flex-1 px-6 py-3 text-sm font-bold text-stone-500 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-all">Cancel</button>
                  <button onClick={handleRecordTransaction} disabled={isSubmitting} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-stone-900 rounded-xl hover:bg-stone-800 disabled:opacity-50 shadow-lg shadow-stone-200 transition-all active:scale-95">
                    {isSubmitting ? 'Recording...' : 'Record Transaction'}
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
