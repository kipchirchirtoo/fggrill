'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { financeAPI } from '@/lib/api';
import { Receipt, Plus, RefreshCw, Search, Check, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { BranchSelector } from '@/components/finance/BranchSelector';
import { DateRangeSelector, DateRangePreset } from '@/components/finance/DateRangeSelector';

interface Expense { id: string; description: string; amount: number; category: string; status: 'pending' | 'approved' | 'rejected'; date: string; }

const categories = ['Utilities', 'Supplies', 'Maintenance', 'Salaries', 'Marketing', 'Food & Beverage', 'Transport', 'Other'];

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ description: '', amount: 0, category: 'Other', date: new Date().toISOString().split('T')[0] });

  const [breakdown, setBreakdown] = useState<any>(null);

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const [expensesRes, breakdownRes] = await Promise.all([
        financeAPI.getExpenses({
          branch_id: selectedBranch || undefined,
          startDate,
          endDate,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }),
        financeAPI.getExpenseBreakdown({
          branch_id: selectedBranch || undefined,
          start_date: startDate,
          end_date: endDate
        })
      ]);

      if (expensesRes.success) setExpenses(expensesRes.data || []);
      if (breakdownRes.success) setBreakdown(breakdownRes.data || null);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch, startDate, endDate, statusFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const filteredExpenses = expenses.filter((e) => e.description?.toLowerCase().includes(searchQuery.toLowerCase()));
  const stats = {
    total: expenses.reduce((sum, e) => sum + e.amount, 0),
    pending: expenses.filter(e => e.status === 'pending').length,
    approved: expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0)
  };

  const handleAddExpense = async () => {
    if (!formData.description || !formData.amount) { toast.error('Fill required fields'); return; }
    try {
      await financeAPI.createExpense(formData);
      toast.success('Expense added');
      setAddModalOpen(false);
      setFormData({ description: '', amount: 0, category: 'Other', date: new Date().toISOString().split('T')[0] });
      fetchExpenses();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleApprove = async (id: string) => {
    try { await financeAPI.approveExpense(id); toast.success('Approved'); fetchExpenses(); }
    catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Expenses</h1>
              <p className="text-sm text-gray-500 mt-1">Track and manage expenses</p>
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
              <button onClick={fetchExpenses} disabled={isLoading} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
                <Plus className="h-4 w-4" />
                Add Expense
              </button>
            </div>
          </div>

          {/* Stats & Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Expenses</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">KES {stats.total.toLocaleString()}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Pending Approval</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.pending}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Approved</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">KES {stats.approved.toLocaleString()}</p>
              </div>
            </div>

            {/* Breakdown Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
              {breakdown && breakdown.categories && breakdown.categories.length > 0 ? (
                <div className="space-y-3">
                  {breakdown.categories.slice(0, 5).map((cat: any) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-gray-700">{cat.category}</span>
                        <span className="text-gray-500">KES {cat.amount.toLocaleString()} ({cat.percentage}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-900 rounded-full" style={{ width: `${cat.percentage}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-sm text-gray-500">No data available</div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <input
                  type="text"
                  placeholder="Search expenses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <div className="flex gap-1">
                {['all', 'pending', 'approved', 'rejected'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${statusFilter === status
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Receipt className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No expenses found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Receipt className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{expense.description}</p>
                      <p className="text-sm text-gray-500">{expense.category} • {new Date(expense.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold text-gray-900">KES {expense.amount.toLocaleString()}</p>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${expense.status === 'approved' ? 'bg-gray-100 text-gray-700' :
                      expense.status === 'rejected' ? 'bg-gray-100 text-gray-500' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                      {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
                    </span>
                    {expense.status === 'pending' && user?.role === UserRole.SUPER_ADMIN && (
                      <button onClick={() => handleApprove(expense.id)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Description *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Amount (KES) *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAddModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleAddExpense} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800">
                  Add Expense
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
