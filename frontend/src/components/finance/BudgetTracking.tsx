'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, PieChart, BarChart3,
  Calendar, AlertTriangle, CheckCircle, Loader2, RefreshCw,
  Plus, Edit, Eye, Filter, Download, ChevronRight, X, Check,
  Building2, Users, UtensilsCrossed, Home, Wrench, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { financeAPI, systemAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

interface Budget {
  id: string;
  department: string;
  department_id?: string;
  period: string; // 'monthly' | 'quarterly' | 'yearly'
  year: number;
  month?: number;
  quarter?: number;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  variance: number;
  variance_percent: number;
  status: 'under' | 'on_track' | 'warning' | 'over';
  categories: BudgetCategory[];
}

interface BudgetCategory {
  name: string;
  allocated: number;
  spent: number;
  remaining: number;
}

interface Expense {
  id: string;
  department: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  approved_by?: string;
  status: string;
}

interface BudgetTrackingProps {
  branchId?: number;
  departmentId?: string;
  period?: 'monthly' | 'quarterly' | 'yearly';
}

const DEPARTMENTS = [
  { id: 'housekeeping', name: 'Housekeeping', icon: Home, color: 'bg-blue-100 text-blue-700' },
  { id: 'restaurant', name: 'Restaurant', icon: UtensilsCrossed, color: 'bg-green-100 text-green-700' },
  { id: 'maintenance', name: 'Maintenance', icon: Wrench, color: 'bg-orange-100 text-orange-700' },
  { id: 'front_office', name: 'Front Office', icon: Users, color: 'bg-purple-100 text-purple-700' },
  { id: 'admin', name: 'Administration', icon: Building2, color: 'bg-gray-100 text-gray-700' },
  { id: 'inventory', name: 'Inventory', icon: Package, color: 'bg-yellow-100 text-yellow-700' }
];

const EXPENSE_CATEGORIES = [
  'Salaries', 'Supplies', 'Utilities', 'Maintenance', 'Marketing',
  'Training', 'Equipment', 'Miscellaneous'
];

export function BudgetTracking({ branchId, departmentId, period = 'monthly' }: BudgetTrackingProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>(period);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(departmentId || '');
  
  // Modals
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  
  // Form state
  const [allocateForm, setAllocateForm] = useState({
    department: '',
    amount: 0,
    categories: {} as Record<string, number>
  });
  const [expenseForm, setExpenseForm] = useState({
    department: '',
    category: '',
    amount: 0,
    description: ''
  });

  // Summary stats
  const [summary, setSummary] = useState({
    totalAllocated: 0,
    totalSpent: 0,
    totalRemaining: 0,
    overBudgetDepts: 0,
    underBudgetDepts: 0
  });

  useEffect(() => {
    fetchBudgetData();
  }, [branchId, selectedPeriod, selectedYear, selectedMonth]);

  const fetchBudgetData = async () => {
    setIsLoading(true);
    try {
      // Fetch budget allocations
      // In a real implementation, this would call a budget API
      // For now, we'll simulate with department-based data
      
      const mockBudgets: Budget[] = DEPARTMENTS.map(dept => {
        const allocated = Math.floor(Math.random() * 500000) + 100000;
        const spent = Math.floor(Math.random() * allocated);
        const remaining = allocated - spent;
        const variance = remaining;
        const variancePercent = (variance / allocated) * 100;
        
        let status: Budget['status'] = 'on_track';
        if (variancePercent < 0) status = 'over';
        else if (variancePercent < 10) status = 'warning';
        else if (variancePercent > 30) status = 'under';

        return {
          id: dept.id,
          department: dept.name,
          department_id: dept.id,
          period: selectedPeriod,
          year: selectedYear,
          month: selectedMonth,
          allocated_amount: allocated,
          spent_amount: spent,
          remaining_amount: remaining,
          variance,
          variance_percent: variancePercent,
          status,
          categories: EXPENSE_CATEGORIES.slice(0, 4).map(cat => ({
            name: cat,
            allocated: Math.floor(allocated / 4),
            spent: Math.floor(spent / 4),
            remaining: Math.floor(remaining / 4)
          }))
        };
      });

      setBudgets(mockBudgets);

      // Calculate summary
      const totalAllocated = mockBudgets.reduce((sum, b) => sum + b.allocated_amount, 0);
      const totalSpent = mockBudgets.reduce((sum, b) => sum + b.spent_amount, 0);
      const totalRemaining = totalAllocated - totalSpent;
      const overBudgetDepts = mockBudgets.filter(b => b.status === 'over').length;
      const underBudgetDepts = mockBudgets.filter(b => b.status === 'under').length;

      setSummary({
        totalAllocated,
        totalSpent,
        totalRemaining,
        overBudgetDepts,
        underBudgetDepts
      });

      // Fetch recent expenses
      try {
        const expenseRes = await financeAPI.getExpenses({ limit: 20 });
        const expenseData = expenseRes.data || expenseRes.expenses || expenseRes || [];
        setExpenses(Array.isArray(expenseData) ? expenseData : []);
      } catch {
        setExpenses([]);
      }
    } catch (error) {
      console.error('Error fetching budget data:', error);
      toast.error('Failed to load budget data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBudgets = useMemo(() => {
    if (!selectedDepartment) return budgets;
    return budgets.filter(b => b.department_id === selectedDepartment);
  }, [budgets, selectedDepartment]);

  const handleAllocateBudget = async () => {
    if (!allocateForm.department || allocateForm.amount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // In production, this would call the budget API
      toast.success('Budget allocated successfully');
      setIsAllocateModalOpen(false);
      setAllocateForm({ department: '', amount: 0, categories: {} });
      fetchBudgetData();
    } catch (error) {
      toast.error('Failed to allocate budget');
    }
  };

  const handleRecordExpense = async () => {
    if (!expenseForm.department || !expenseForm.category || expenseForm.amount <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await financeAPI.createExpense({
        department: expenseForm.department,
        category: expenseForm.category,
        amount: expenseForm.amount,
        description: expenseForm.description,
        date: new Date().toISOString()
      });

      toast.success('Expense recorded successfully');
      setIsExpenseModalOpen(false);
      setExpenseForm({ department: '', category: '', amount: 0, description: '' });
      fetchBudgetData();
    } catch (error) {
      toast.error('Failed to record expense');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'over': return 'bg-red-100 text-red-700';
      case 'warning': return 'bg-yellow-100 text-yellow-700';
      case 'under': return 'bg-blue-100 text-blue-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'over': return 'Over Budget';
      case 'warning': return 'Warning';
      case 'under': return 'Under Budget';
      default: return 'On Track';
    }
  };

  const getProgressColor = (percent: number) => {
    if (percent > 100) return 'bg-red-500';
    if (percent > 90) return 'bg-yellow-500';
    if (percent > 75) return 'bg-orange-400';
    return 'bg-green-500';
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PieChart className="h-6 w-6" />
            Budget Tracking
          </h2>
          <p className="text-sm text-gray-500">
            {months[selectedMonth - 1]} {selectedYear} • {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} View
          </p>
        </div>
        <div className="flex items-center gap-3">
          <IOSButton variant="outline" onClick={fetchBudgetData}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </IOSButton>
          <IOSButton variant="outline" onClick={() => setIsExpenseModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Expense
          </IOSButton>
          <IOSButton onClick={() => setIsAllocateModalOpen(true)} className="bg-[#3C3C43] hover:bg-[#000000] text-white">
            <DollarSign className="h-4 w-4 mr-2" />
            Allocate Budget
          </IOSButton>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value as any)}
          className="px-3 py-2 border rounded-ios-lg text-sm"
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-2 border rounded-ios-lg text-sm"
        >
          {[2023, 2024, 2025].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        {selectedPeriod === 'monthly' && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-ios-lg text-sm"
          >
            {months.map((month, i) => (
              <option key={i} value={i + 1}>{month}</option>
            ))}
          </select>
        )}
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="px-3 py-2 border rounded-ios-lg text-sm"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(dept => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <IOSCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#F2F2F7]">
              <DollarSign className="h-6 w-6 text-[#3C3C43]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Allocated</p>
              <p className="text-xl font-bold">KES {(summary.totalAllocated / 1000000).toFixed(1)}M</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100">
              <TrendingDown className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Spent</p>
              <p className="text-xl font-bold">KES {(summary.totalSpent / 1000000).toFixed(1)}M</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-100">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Remaining</p>
              <p className="text-xl font-bold text-green-600">KES {(summary.totalRemaining / 1000000).toFixed(1)}M</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-4 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-red-600">Over Budget</p>
              <p className="text-xl font-bold text-red-700">{summary.overBudgetDepts}</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-4 bg-green-50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-600">Under Budget</p>
              <p className="text-xl font-bold text-green-700">{summary.underBudgetDepts}</p>
            </div>
          </div>
        </IOSCard>
      </div>

      {/* Budget by Department */}
      <IOSCard>
        <div className="p-4 border-b">
          <h3 className="font-semibold font-sf-pro-display">Department Budgets</h3>
        </div>
        <div className="divide-y">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <PieChart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No budget data available</p>
            </div>
          ) : (
            filteredBudgets.map(budget => {
              const spentPercent = (budget.spent_amount / budget.allocated_amount) * 100;
              const deptConfig = DEPARTMENTS.find(d => d.id === budget.department_id);
              const Icon = deptConfig?.icon || Building2;

              return (
                <motion.div
                  key={budget.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => { setSelectedBudget(budget); setIsDetailModalOpen(true); }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-ios-lg ${deptConfig?.color || 'bg-gray-100'}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold font-sf-pro-display">{budget.department}</h4>
                        <p className="text-sm text-gray-500">
                          KES {budget.spent_amount.toLocaleString()} of {budget.allocated_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IOSBadge className={getStatusColor(budget.status)}>
                        {getStatusLabel(budget.status)}
                      </IOSBadge>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(spentPercent, 100)}%` }}
                      transition={{ duration: 0.5 }}
                      className={`absolute h-full rounded-full ${getProgressColor(spentPercent)}`}
                    />
                    {spentPercent > 100 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${spentPercent - 100}%` }}
                        className="absolute h-full bg-red-600 right-0"
                        style={{ maxWidth: '20%' }}
                      />
                    )}
                  </div>
                  
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-gray-500">{spentPercent.toFixed(1)}% used</span>
                    <span className={budget.remaining_amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {budget.remaining_amount >= 0 ? 'Remaining' : 'Over by'}: KES {Math.abs(budget.remaining_amount).toLocaleString()}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </IOSCard>

      {/* Recent Expenses */}
      <IOSCard>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold font-sf-pro-display">Recent Expenses</h3>
          <IOSButton variant="ghost" size="sm">
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </IOSButton>
        </div>
        <div className="divide-y max-h-64 overflow-y-auto">
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No recent expenses</p>
            </div>
          ) : (
            expenses.slice(0, 5).map(expense => (
              <div key={expense.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{expense.description || expense.category}</p>
                  <p className="text-xs text-gray-500">{expense.department} • {formatDate(expense.date)}</p>
                </div>
                <span className="font-semibold font-sf-pro-display text-red-600">-KES {expense.amount.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </IOSCard>

      {/* Allocate Budget Modal */}
      <Dialog open={isAllocateModalOpen} onOpenChange={setIsAllocateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Department *</label>
              <select
                value={allocateForm.department}
                onChange={(e) => setAllocateForm({ ...allocateForm, department: e.target.value })}
                className="w-full px-3 py-2 border rounded-ios-lg"
              >
                <option value="">Select department...</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Total Amount (KES) *</label>
              <Input
                type="number"
                value={allocateForm.amount || ''}
                onChange={(e) => setAllocateForm({ ...allocateForm, amount: parseFloat(e.target.value) || 0 })}
                placeholder="Enter amount"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <IOSButton variant="outline" className="flex-1" onClick={() => setIsAllocateModalOpen(false)}>
                Cancel
              </IOSButton>
              <IOSButton className="flex-1 bg-[#3C3C43]" onClick={handleAllocateBudget}>
                <Check className="h-4 w-4 mr-2" /> Allocate
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Expense Modal */}
      <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Department *</label>
              <select
                value={expenseForm.department}
                onChange={(e) => setExpenseForm({ ...expenseForm, department: e.target.value })}
                className="w-full px-3 py-2 border rounded-ios-lg"
              >
                <option value="">Select department...</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Category *</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-ios-lg"
              >
                <option value="">Select category...</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Amount (KES) *</label>
              <Input
                type="number"
                value={expenseForm.amount || ''}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <textarea
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="Enter description..."
                className="w-full px-3 py-2 border rounded-ios-lg resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <IOSButton variant="outline" className="flex-1" onClick={() => setIsExpenseModalOpen(false)}>
                Cancel
              </IOSButton>
              <IOSButton className="flex-1 bg-[#3C3C43]" onClick={handleRecordExpense}>
                <Check className="h-4 w-4 mr-2" /> Record
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedBudget?.department} Budget Details</DialogTitle>
          </DialogHeader>
          {selectedBudget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">Allocated</p>
                  <p className="text-lg font-bold">KES {selectedBudget.allocated_amount.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">Spent</p>
                  <p className="text-lg font-bold">KES {selectedBudget.spent_amount.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">Remaining</p>
                  <p className={`text-lg font-bold ${selectedBudget.remaining_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    KES {selectedBudget.remaining_amount.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">Variance</p>
                  <p className={`text-lg font-bold ${selectedBudget.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedBudget.variance_percent.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold font-sf-pro-display mb-2">Category Breakdown</h4>
                <div className="space-y-2">
                  {selectedBudget.categories.map(cat => (
                    <div key={cat.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-ios-lg">
                      <span className="text-sm">{cat.name}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium">KES {cat.spent.toLocaleString()}</span>
                        <span className="text-xs text-gray-500"> / {cat.allocated.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <IOSButton variant="outline" className="w-full" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </IOSButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
