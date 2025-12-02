'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { financeAPI } from '@/lib/api';
import { Receipt, Plus, RefreshCw, Search, Check, X, Eye, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Expense { id: string; description: string; amount: number; category: string; status: 'pending' | 'approved' | 'rejected'; date: string; submitted_by?: string; approved_by?: string; receipt_url?: string; }

const categories = ['Utilities', 'Supplies', 'Maintenance', 'Salaries', 'Marketing', 'Food & Beverage', 'Transport', 'Other'];
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  approved: { label: 'Approved', color: 'text-green-700', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ description: '', amount: 0, category: 'Other', date: new Date().toISOString().split('T')[0] });

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getExpenses({ status: statusFilter !== 'all' ? statusFilter : undefined });
      if (response.success) setExpenses(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const filteredExpenses = expenses.filter((e) => e.description?.toLowerCase().includes(searchQuery.toLowerCase()));
  const stats = { total: expenses.reduce((sum, e) => sum + e.amount, 0), pending: expenses.filter(e => e.status === 'pending').length, approved: expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0) };

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
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Expenses</h1><p className="text-gray-500">Track and manage expenses</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchExpenses}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Expense</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><p className="text-sm text-gray-500">Total Expenses</p><p className="text-2xl font-bold">KES {stats.total.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4"><p className="text-sm text-gray-500">Pending Approval</p><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><p className="text-sm text-gray-500">Approved</p><p className="text-2xl font-bold text-[#34C759]">KES {stats.approved.toLocaleString()}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2">
                {['all', 'pending', 'approved', 'rejected'].map((status) => (
                  <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredExpenses.length === 0 ? (
            <IOSCard className="p-12 text-center"><Receipt className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No expenses found</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense) => {
                const statusInfo = statusConfig[expense.status];
                return (
                  <IOSCard key={expense.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-red-100 flex items-center justify-center"><Receipt className="h-6 w-6 text-[#FF3B30]" /></div>
                        <div>
                          <p className="font-bold">{expense.description}</p>
                          <p className="text-sm text-gray-500">{expense.category} • {new Date(expense.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold text-lg">KES {expense.amount.toLocaleString()}</p>
                        <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>{statusInfo.label}</IOSBadge>
                        {expense.status === 'pending' && user?.role === UserRole.SUPER_ADMIN && (
                          <IOSButton size="sm" onClick={() => handleApprove(expense.id)}><Check className="h-4 w-4" /></IOSButton>
                        )}
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Description *</label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Amount (KES) *</label><Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium">Category</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Date</label><Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddExpense} className="flex-1">Add Expense</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
