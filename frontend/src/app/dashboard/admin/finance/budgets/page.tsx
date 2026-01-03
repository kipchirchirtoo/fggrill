'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { financeAPI } from '@/lib/api';
import { PieChart, RefreshCw, Plus, DollarSign, TrendingUp, TrendingDown, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Budget { id: string; name: string; category: string; allocated: number; spent: number; remaining: number; period: string; }

export default function AdminBudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: 'operations', allocated: 0, period: 'monthly' });

  const fetchBudgets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getBudgets();
      if (response.success) setBudgets(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const resetForm = () => setFormData({ name: '', category: 'operations', allocated: 0, period: 'monthly' });

  const handleAddBudget = async () => {
    if (!formData.name || !formData.allocated) { toast.error('Fill required fields'); return; }
    setIsSubmitting(true);
    try {
      await financeAPI.createBudget(formData);
      toast.success('Budget created');
      setAddModalOpen(false);
      resetForm();
      fetchBudgets();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const openEditModal = (budget: Budget) => {
    setSelectedBudget(budget);
    setFormData({ name: budget.name, category: budget.category, allocated: budget.allocated, period: budget.period });
    setEditModalOpen(true);
  };

  const handleUpdateBudget = async () => {
    if (!selectedBudget || !formData.name) { toast.error('Fill required fields'); return; }
    setIsSubmitting(true);
    try {
      await financeAPI.updateBudget(selectedBudget.id, formData);
      toast.success('Budget updated');
      setEditModalOpen(false);
      setSelectedBudget(null);
      resetForm();
      fetchBudgets();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteBudget = async () => {
    if (!selectedBudget) return;
    setIsSubmitting(true);
    try {
      await financeAPI.deleteBudget(selectedBudget.id);
      toast.success('Budget deleted');
      setDeleteConfirmOpen(false);
      setSelectedBudget(null);
      fetchBudgets();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const totalAllocated = budgets.reduce((sum, b) => sum + (b.allocated || 0), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Budgets</h1><p className="text-gray-500">Budget allocation and tracking</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchBudgets} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Budget</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><DollarSign className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Allocated</p><p className="text-xl font-bold">KES {totalAllocated.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4"><TrendingDown className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Total Spent</p><p className="text-xl font-bold text-[#FF3B30]">KES {totalSpent.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4"><TrendingUp className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Remaining</p><p className="text-xl font-bold text-[#34C759]">KES {(totalAllocated - totalSpent).toLocaleString()}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : budgets.length === 0 ? (
            <IOSCard className="p-12 text-center"><PieChart className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No budgets</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {budgets.map((budget) => {
                const percentage = budget.allocated > 0 ? (budget.spent / budget.allocated) * 100 : 0;
                const isOverBudget = percentage > 100;
                return (
                  <IOSCard key={budget.id} className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div><p className="font-bold">{budget.name}</p><p className="text-sm text-gray-500">{budget.category} • {budget.period}</p></div>
                      <p className={`font-bold ${isOverBudget ? 'text-[#FF3B30]' : 'text-[#34C759]'}`}>{percentage.toFixed(0)}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div className={`h-2 rounded-full ${isOverBudget ? 'bg-[#FF3B30]' : percentage > 80 ? 'bg-[#FF9500]' : 'bg-[#34C759]'}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Spent: KES {budget.spent?.toLocaleString()}</span>
                      <span>Budget: KES {budget.allocated?.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <IOSButton size="sm" variant="secondary" className="flex-1" onClick={() => openEditModal(budget)} leftIcon={<Edit2 className="h-3 w-3" />}>Edit</IOSButton>
                      <IOSButton size="sm" variant="destructive" onClick={() => { setSelectedBudget(budget); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></IOSButton>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Budget</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Category</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="operations">Operations</option>
                  <option value="marketing">Marketing</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="supplies">Supplies</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Allocated Amount *</label><Input type="number" value={formData.allocated} onChange={(e) => setFormData({ ...formData, allocated: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium">Period</label>
                <select value={formData.period} onChange={(e) => setFormData({ ...formData, period: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddBudget} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Creating...' : 'Create'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedBudget(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Budget</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Category</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="operations">Operations</option>
                  <option value="marketing">Marketing</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="supplies">Supplies</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Allocated Amount *</label><Input type="number" value={formData.allocated} onChange={(e) => setFormData({ ...formData, allocated: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium">Period</label>
                <select value={formData.period} onChange={(e) => setFormData({ ...formData, period: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleUpdateBudget} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Updating...' : 'Update'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-red-600">Delete Budget</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-stone-600">Are you sure you want to delete this budget?</p>
              {selectedBudget && <div className="p-3 bg-stone-50 rounded-lg"><p className="font-medium">{selectedBudget.name}</p><p className="text-sm text-stone-500">KES {selectedBudget.allocated?.toLocaleString()}</p></div>}
              <div className="flex gap-2">
                <IOSButton variant="secondary" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</IOSButton>
                <IOSButton variant="destructive" className="flex-1" onClick={handleDeleteBudget} disabled={isSubmitting}>{isSubmitting ? 'Deleting...' : 'Delete'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
