'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import {
  Search, RefreshCw, Receipt, PlusCircle,
  Filter, ArrowUpDown, Eye, FileText, PieChart
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Expense interface
interface Expense {
  id: string;
  reference: string;
  description: string;
  amount: number;
  category: string;
  payment_method: string;
  date: string;
  status: string;
  created_by: string;
  approved_by?: string;
  receipt_url?: string;
}

// Expense category interface
interface ExpenseCategory {
  id: string;
  name: string;
  budget: number;
  spent: number;
}

export default function BranchExpensesPage() {
  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.AUDITOR
    ]}>
      <BranchAwareDashboardLayout>
        <BranchExpensesContent />
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

function BranchExpensesContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (activeBranchId) {
      fetchExpenses();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [expenses, searchTerm, categoryFilter, statusFilter]);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      // Call the real API
      const response = await branchOperationsAPI.getExpenses(
        {
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          startDate,
          endDate
        },
        activeBranchId
      );

      if (response.success && Array.isArray(response.data?.expenses)) {
        setExpenses(response.data.expenses);
        setCategories(response.data.categories || []);
      } else {
        // Show empty state
        setExpenses([]);
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expense data');
      // Show empty state on error
      setExpenses([]);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...expenses];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(term) ||
        e.reference.toLowerCase().includes(term) ||
        e.category.toLowerCase().includes(term)
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(e => e.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let valA, valB;

      if (sortField === 'date') {
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
      } else if (sortField === 'amount') {
        valA = a.amount;
        valB = b.amount;
      } else {
        valA = a[sortField as keyof Expense];
        valB = b[sortField as keyof Expense];
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredExpenses(filtered);
  };

  // Helper functions for placeholder data
  const generatePlaceholderExpenses = (): Expense[] => [
    {
      id: '1',
      reference: 'EXP-001',
      description: 'Fresh Produce Purchase',
      amount: 12500,
      category: 'Supplies',
      payment_method: 'M-Pesa',
      date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      status: 'approved',
      created_by: 'Chef John'
    },
    {
      id: '2',
      reference: 'EXP-002',
      description: 'Cleaning Supplies',
      amount: 4500,
      category: 'Maintenance',
      payment_method: 'Cash',
      date: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
      status: 'pending',
      created_by: 'Jane Doe'
    },
    {
      id: '3',
      reference: 'EXP-003',
      description: 'Electricity Bill',
      amount: 25000,
      category: 'Utilities',
      payment_method: 'Bank Transfer',
      date: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
      status: 'approved',
      created_by: 'Manager'
    }
  ];

  const generatePlaceholderCategories = (): ExpenseCategory[] => [
    { id: '1', name: 'Supplies', budget: 50000, spent: 12500 },
    { id: '2', name: 'Maintenance', budget: 20000, spent: 4500 },
    { id: '3', name: 'Utilities', budget: 100000, spent: 25000 },
    { id: '4', name: 'Payroll', budget: 500000, spent: 0 },
    { id: '5', name: 'Marketing', budget: 30000, spent: 0 }
  ];

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <BranchPageWrapper
      title="Branch Expenses"
      subtitle="Track and manage operational expenses"
      actions={
        <div className="flex gap-2">
          <IOSButton variant="secondary" size="sm" onClick={fetchExpenses}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </IOSButton>
          <IOSButton variant="primary" size="sm">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Expense
          </IOSButton>
        </div>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <IOSCard className="p-4 bg-blue-50 border-blue-100">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-blue-600 font-medium mb-1">Total Expenses</div>
              <div className="text-2xl font-bold text-blue-700">
                KES {filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2 bg-blue-100 rounded-full">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </IOSCard>

        <IOSCard className="p-4 bg-purple-50 border-purple-100">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-purple-600 font-medium mb-1">Budget Utilization</div>
              <div className="text-2xl font-bold text-purple-700">
                {Math.round((categories.reduce((sum, c) => sum + c.spent, 0) / Math.max(categories.reduce((sum, c) => sum + c.budget, 0), 1)) * 100)}%
              </div>
            </div>
            <div className="p-2 bg-purple-100 rounded-full">
              <PieChart className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </IOSCard>

        <IOSCard className="p-4 bg-orange-50 border-orange-100">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-orange-600 font-medium mb-1">Pending Approval</div>
              <div className="text-2xl font-bold text-orange-700">
                {expenses.filter(e => e.status === 'pending').length}
              </div>
            </div>
            <div className="p-2 bg-orange-100 rounded-full">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </IOSCard>
      </div>

      <IOSCard className="p-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <Input
                placeholder="Search expenses..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <IOSButton variant="secondary" size="icon">
              <Filter className="w-4 h-4" />
            </IOSButton>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <select
              className="p-2 border rounded-md text-sm bg-white"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              className="p-2 border rounded-md text-sm bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  className="p-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 text-left font-medium text-gray-600">Reference</th>
                <th className="p-3 text-left font-medium text-gray-600">Description</th>
                <th className="p-3 text-left font-medium text-gray-600">Category</th>
                <th
                  className="p-3 text-right font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Amount
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 text-center font-medium text-gray-600">Status</th>
                <th className="p-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map(expense => (
                  <tr key={expense.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 text-sm text-gray-600">{expense.date}</td>
                    <td className="p-3 text-sm font-mono text-gray-500">{expense.reference}</td>
                    <td className="p-3 text-sm font-medium text-gray-800">{expense.description}</td>
                    <td className="p-3 text-sm text-gray-600">
                      <IOSBadge variant="light" color="secondary" size="sm">{expense.category}</IOSBadge>
                    </td>
                    <td className="p-3 text-sm font-bold text-right text-gray-800">
                      KES {expense.amount.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(expense.status)}`}>
                        {expense.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <IOSButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedExpense(expense);
                          setShowExpenseDetails(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </IOSButton>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No expenses found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </IOSCard>

      <Dialog open={showExpenseDetails} onOpenChange={setShowExpenseDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>
              {selectedExpense?.reference}
            </DialogDescription>
          </DialogHeader>

          {selectedExpense && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Date</label>
                  <div className="text-sm">{selectedExpense.date}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Amount</label>
                  <div className="text-sm font-bold">KES {selectedExpense.amount.toLocaleString()}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Category</label>
                  <div className="text-sm">{selectedExpense.category}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Payment Method</label>
                  <div className="text-sm">{selectedExpense.payment_method}</div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 uppercase font-bold">Description</label>
                  <div className="text-sm">{selectedExpense.description}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Created By</label>
                  <div className="text-sm">{selectedExpense.created_by}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-bold">Status</label>
                  <div className="text-sm capitalize">{selectedExpense.status}</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <IOSButton variant="secondary" onClick={() => setShowExpenseDetails(false)}>
              Close
            </IOSButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BranchPageWrapper>
  );
}
