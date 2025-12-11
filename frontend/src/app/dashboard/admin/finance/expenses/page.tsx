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
import { DollarSign, RefreshCw, Plus, Calendar, User, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Expense { id: string; description: string; amount: number; category: string; status: string; submitted_by: string; date: string; }

export default function AdminExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ description: '', amount: 0, category: 'operations' });

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getExpenses();
      if (response.success) setExpenses(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleAddExpense = async () => {
    if (!formData.description || !formData.amount) { toast.error('Fill required fields'); return; }
    try {
      await financeAPI.createExpense(formData);
      toast.success('Expense added');
      setAddModalOpen(false);
      fetchExpenses();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleApprove = async (id: string) => {
    try {
      await financeAPI.approveExpense(id);
      toast.success('Expense approved');
      fetchExpenses();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pending = expenses.filter(e => e.status === 'pending').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Expenses</h1><p className="text-gray-500">Manage expenses</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchExpenses} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Expense</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4"><DollarSign className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Total Expenses</p><p className="text-xl font-bold text-[#FF3B30]">KES {total.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending Approval</p><p className="text-xl font-bold text-yellow-600">{pending}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <IOSCard key={expense.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{expense.description}</p>
                      <p className="text-sm text-gray-500">{expense.category}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-2"><User className="h-3 w-3" /> {expense.submitted_by} <Calendar className="h-3 w-3 ml-2" /> {new Date(expense.date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-lg">KES {expense.amount?.toLocaleString()}</p>
                      <IOSBadge variant={expense.status === 'approved' ? 'success' : expense.status === 'rejected' ? 'error' : 'warning'}>{expense.status}</IOSBadge>
                      {expense.status === 'pending' && <IOSButton size="sm" onClick={() => handleApprove(expense.id)}>Approve</IOSButton>}
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Description *</label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Amount *</label><Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium">Category</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="operations">Operations</option>
                  <option value="utilities">Utilities</option>
                  <option value="supplies">Supplies</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddExpense} className="flex-1">Add</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
