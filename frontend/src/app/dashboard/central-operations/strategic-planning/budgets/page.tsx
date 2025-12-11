'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { DollarSign, Plus, RefreshCw, TrendingUp, TrendingDown, Loader2, Edit2, Trash2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Budget {
  id: number;
  branch_id: number;
  branch_name: string;
  fiscal_year: number;
  fiscal_month: number;
  category: string;
  name: string;
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  status: string;
  description: string;
}

interface Category { id: number; name: string; description: string; }

function BudgetsContent() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState({ total_budgeted: 0, total_actual: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewBudget, setViewBudget] = useState<Budget | null>(null);
  const [formData, setFormData] = useState({
    fiscal_year: new Date().getFullYear(),
    fiscal_month: new Date().getMonth() + 1,
    category: '',
    name: '',
    allocated_amount: '',
    description: ''
  });

  const fetchBudgets = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const res = await fetch(`${API_BASE}/api/central-operations/strategic-planning/budgets`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) {
        const data = await res.json();
        setBudgets(Array.isArray(data.data?.budgets) ? data.data.budgets : []);
        setCategories(Array.isArray(data.data?.categories) ? data.data.categories : []);
        setSummary(data.data?.summary || { total_budgeted: 0, total_actual: 0 });
      }
    } catch (error) { 
      console.error('Error:', error); 
      toast.error('Failed to load budgets'); 
    } finally { 
      setIsLoading(false); 
    }
  }, []);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const url = editingBudget 
        ? `${API_BASE}/api/central-operations/strategic-planning/budgets/${editingBudget.id}`
        : `${API_BASE}/api/central-operations/strategic-planning/budgets`;
      const method = editingBudget ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          allocated_amount: parseFloat(formData.allocated_amount) || 0 
        })
      });
      
      if (res.ok) { 
        toast.success(editingBudget ? 'Budget updated' : 'Budget created'); 
        setShowForm(false);
        setEditingBudget(null);
        resetForm();
        fetchBudgets(); 
      } else { 
        toast.error('Failed to save budget'); 
      }
    } catch (error) { 
      console.error('Error:', error); 
      toast.error('Failed to save budget'); 
    }
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      fiscal_year: budget.fiscal_year,
      fiscal_month: budget.fiscal_month,
      category: budget.category,
      name: budget.name || '',
      allocated_amount: budget.budgeted_amount?.toString() || '',
      description: budget.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const res = await fetch(`${API_BASE}/api/central-operations/strategic-planning/budgets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Budget deleted');
        fetchBudgets();
      } else {
        toast.error('Failed to delete budget');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete budget');
    }
  };

  const handleApprove = async (id: number, status: 'approved' | 'rejected') => {
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const res = await fetch(`${API_BASE}/api/central-operations/strategic-planning/budgets/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Budget ${status}`);
        fetchBudgets();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      fiscal_year: new Date().getFullYear(),
      fiscal_month: new Date().getMonth() + 1,
      category: '',
      name: '',
      allocated_amount: '',
      description: ''
    });
  };

  const filteredBudgets = budgets.filter(b => {
    if (filterYear && b.fiscal_year !== filterYear) return false;
    if (filterCategory && b.category !== filterCategory) return false;
    if (filterStatus && b.status !== filterStatus) return false;
    if (searchTerm && !b.name?.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !b.category?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const totalVariance = parseFloat(summary.total_actual?.toString() || '0') - parseFloat(summary.total_budgeted?.toString() || '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Budget Management</h1>
              <p className="text-gray-500">Plan and track financial budgets across all branches</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchBudgets} disabled={isLoading} leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}>
                Refresh
              </IOSButton>
              <IOSButton variant="primary" onClick={() => { resetForm(); setEditingBudget(null); setShowForm(true); }} leftIcon={<Plus className="h-4 w-4" />}>
                Add Budget
              </IOSButton>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <DollarSign className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Total Budgeted</p>
              <p className="text-xl font-bold">KES {parseFloat(summary.total_budgeted?.toString() || '0').toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <TrendingUp className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Total Actual</p>
              <p className="text-xl font-bold text-gray-600">KES {parseFloat(summary.total_actual?.toString() || '0').toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              {totalVariance >= 0 ? <TrendingUp className="h-6 w-6 text-gray-500 mb-2" /> : <TrendingDown className="h-6 w-6 text-gray-500 mb-2" />}
              <p className="text-sm text-gray-500">Variance</p>
              <p className={`text-xl font-bold ${totalVariance >= 0 ? 'text-gray-600' : 'text-gray-600'}`}>
                {totalVariance >= 0 ? '+' : ''}KES {totalVariance.toLocaleString()}
              </p>
            </IOSCard>
            <IOSCard className="p-4">
              <CheckCircle className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Total Budgets</p>
              <p className="text-xl font-bold text-gray-600">{budgets.length}</p>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <Input 
                  placeholder="Search budgets..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Year</label>
                <select value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))} className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
                  {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Add/Edit Budget Form */}
          {showForm && (
            <IOSCard className="p-4">
              <h3 className="font-semibold text-lg mb-4">{editingBudget ? 'Edit Budget' : 'Create New Budget'}</h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fiscal Year *</label>
                  <Input type="number" value={formData.fiscal_year} onChange={(e) => setFormData({ ...formData, fiscal_year: parseInt(e.target.value) })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Month *</label>
                  <select value={formData.fiscal_month} onChange={(e) => setFormData({ ...formData, fiscal_month: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">
                    {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" required>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Budget Name *</label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Q1 Marketing" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Allocated Amount (KES) *</label>
                  <Input type="number" value={formData.allocated_amount} onChange={(e) => setFormData({ ...formData, allocated_amount: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description" />
                </div>
                <div className="md:col-span-3 flex gap-2">
                  <IOSButton type="submit" variant="primary">{editingBudget ? 'Update Budget' : 'Create Budget'}</IOSButton>
                  <IOSButton type="button" variant="secondary" onClick={() => { setShowForm(false); setEditingBudget(null); }}>Cancel</IOSButton>
                </div>
              </form>
            </IOSCard>
          )}

          {/* Budgets Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : filteredBudgets.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <DollarSign className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No budgets found. Create your first budget to get started.</p>
            </IOSCard>
          ) : (
            <IOSCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Period</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Category / Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Branch</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Budgeted</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Actual</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Variance</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBudgets.map((budget) => (
                      <tr key={budget.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4">{months[(budget.fiscal_month || 1) - 1]} {budget.fiscal_year}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{budget.category}</p>
                          {budget.name && <p className="text-sm text-gray-500">{budget.name}</p>}
                        </td>
                        <td className="py-3 px-4">{budget.branch_name || 'All Branches'}</td>
                        <td className="py-3 px-4 text-right font-medium">KES {parseFloat(budget.budgeted_amount?.toString() || '0').toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">KES {parseFloat(budget.actual_amount?.toString() || '0').toLocaleString()}</td>
                        <td className={`py-3 px-4 text-right font-medium ${parseFloat(budget.variance?.toString() || '0') > 0 ? 'text-gray-600' : 'text-gray-600'}`}>
                          {parseFloat(budget.variance?.toString() || '0') > 0 ? '+' : ''}KES {parseFloat(budget.variance?.toString() || '0').toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            budget.status === 'approved' ? 'bg-gray-100 text-gray-700' : 
                            budget.status === 'pending' ? 'bg-gray-100 text-gray-700' : 
                            budget.status === 'rejected' ? 'bg-gray-100 text-gray-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {budget.status || 'draft'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <IOSButton variant="ghost" size="sm" onClick={() => setViewBudget(budget)}>
                              <Eye className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton variant="ghost" size="sm" onClick={() => handleEdit(budget)}>
                              <Edit2 className="h-4 w-4" />
                            </IOSButton>
                            {budget.status === 'pending' && (
                              <>
                                <IOSButton variant="ghost" size="sm" onClick={() => handleApprove(budget.id, 'approved')}>
                                  <CheckCircle className="h-4 w-4 text-gray-500" />
                                </IOSButton>
                                <IOSButton variant="ghost" size="sm" onClick={() => handleApprove(budget.id, 'rejected')}>
                                  <XCircle className="h-4 w-4 text-gray-500" />
                                </IOSButton>
                              </>
                            )}
                            <IOSButton variant="ghost" size="sm" onClick={() => handleDelete(budget.id)}>
                              <Trash2 className="h-4 w-4 text-gray-500" />
                            </IOSButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}

          {/* View Budget Dialog */}
          <Dialog open={!!viewBudget} onOpenChange={() => setViewBudget(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Budget Details</DialogTitle>
              </DialogHeader>
              {viewBudget && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-sm text-gray-500">Period</p><p className="font-medium">{months[(viewBudget.fiscal_month || 1) - 1]} {viewBudget.fiscal_year}</p></div>
                    <div><p className="text-sm text-gray-500">Category</p><p className="font-medium">{viewBudget.category}</p></div>
                    <div><p className="text-sm text-gray-500">Name</p><p className="font-medium">{viewBudget.name || '-'}</p></div>
                    <div><p className="text-sm text-gray-500">Branch</p><p className="font-medium">{viewBudget.branch_name || 'All Branches'}</p></div>
                    <div><p className="text-sm text-gray-500">Budgeted Amount</p><p className="font-medium">KES {parseFloat(viewBudget.budgeted_amount?.toString() || '0').toLocaleString()}</p></div>
                    <div><p className="text-sm text-gray-500">Actual Amount</p><p className="font-medium">KES {parseFloat(viewBudget.actual_amount?.toString() || '0').toLocaleString()}</p></div>
                    <div><p className="text-sm text-gray-500">Variance</p><p className={`font-medium ${parseFloat(viewBudget.variance?.toString() || '0') > 0 ? 'text-gray-600' : 'text-gray-600'}`}>KES {parseFloat(viewBudget.variance?.toString() || '0').toLocaleString()}</p></div>
                    <div><p className="text-sm text-gray-500">Status</p><p className="font-medium capitalize">{viewBudget.status || 'draft'}</p></div>
                  </div>
                  {viewBudget.description && (
                    <div><p className="text-sm text-gray-500">Description</p><p>{viewBudget.description}</p></div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function BudgetsPage() {
  return (
    <BranchPageWrapper>
      <BudgetsContent />
    </BranchPageWrapper>
  );
}
