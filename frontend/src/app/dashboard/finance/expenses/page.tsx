'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt, Plus, Search, Filter, Download, Eye, Edit2, Trash2, Upload,
  CheckCircle, Clock, AlertTriangle, XCircle, Calendar, DollarSign,
  Building2, User, Tag, Paperclip, RefreshCw, X, Check, MoreVertical,
  TrendingUp, TrendingDown, PieChart, ArrowUpRight, ArrowDownRight,
  Utensils, Zap, Wrench, Users, ShoppingCart, Car, Briefcase, Package,
  Image, FileText, AlertCircle, ChevronDown, BarChart3, Target
} from 'lucide-react';
import { toast } from 'sonner';

// Expense types
type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';
type ExpenseCategory = 'salaries' | 'supplies' | 'utilities' | 'maintenance' | 'marketing' | 'transport' | 'food' | 'inventory' | 'other';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  branch: string;
  branchCode: string;
  vendor: string;
  date: string;
  status: ExpenseStatus;
  receipt?: string;
  approvedBy?: string;
  submittedBy: string;
  notes: string;
  isRecurring: boolean;
  recurringFrequency?: string;
}

interface Budget {
  category: ExpenseCategory;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
}

const STATUS_CONFIG: Record<ExpenseStatus, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; icon: any; color: string }> = {
  salaries: { label: 'Salaries & Wages', icon: Users, color: 'bg-blue-500' },
  supplies: { label: 'Office Supplies', icon: Package, color: 'bg-green-500' },
  utilities: { label: 'Utilities', icon: Zap, color: 'bg-yellow-500' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'bg-purple-500' },
  marketing: { label: 'Marketing', icon: Target, color: 'bg-pink-500' },
  transport: { label: 'Transport', icon: Car, color: 'bg-indigo-500' },
  food: { label: 'Food & Beverages', icon: Utensils, color: 'bg-orange-500' },
  inventory: { label: 'Inventory', icon: ShoppingCart, color: 'bg-teal-500' },
  other: { label: 'Other', icon: Briefcase, color: 'bg-gray-500' },
};

const BRANCHES = [
  { id: 'FGB-HQ', name: 'Bomet HQ' },
  { id: 'FGB-BMT', name: 'Bomet Town' },
  { id: 'FGB-KER', name: 'Kericho' },
  { id: 'FGB-KAP', name: 'Kapsoit' },
  { id: 'FGB-MOG', name: 'Mogogosiek' },
  { id: 'FGB-LIT', name: 'Litein' },
];

export default function FinanceExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'budget' | 'analytics'>('expenses');

  // Stats
  const [stats, setStats] = useState({
    totalExpenses: 0,
    thisMonth: 0,
    pending: 0,
    pendingAmount: 0,
    approved: 0,
    monthlyBudget: 2500000,
    budgetUsed: 0,
    topCategory: '',
    avgExpense: 0,
  });

  // New expense form
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: 0,
    category: 'other' as ExpenseCategory,
    branch: '',
    vendor: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    receipt: null as File | null,
    isRecurring: false,
    recurringFrequency: '',
  });

  useEffect(() => {
    fetchExpenses();
    fetchBudgets();
  }, []);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      // Mock data
      const mockExpenses: Expense[] = [
        {
          id: '1',
          description: 'Monthly Electricity Bill - All Branches',
          amount: 85000,
          category: 'utilities',
          branch: 'All Branches',
          branchCode: 'ALL',
          vendor: 'Kenya Power',
          date: '2024-11-25',
          status: 'paid',
          submittedBy: 'Jane Finance',
          approvedBy: 'GM John',
          notes: 'November billing',
          isRecurring: true,
          recurringFrequency: 'Monthly',
        },
        {
          id: '2',
          description: 'Kitchen Equipment Repair',
          amount: 25000,
          category: 'maintenance',
          branch: 'Bomet HQ',
          branchCode: 'FGB-HQ',
          vendor: 'Tech Repairs Ltd',
          date: '2024-11-26',
          status: 'approved',
          submittedBy: 'Kitchen Manager',
          approvedBy: 'Jane Finance',
          notes: 'Industrial oven repair',
          isRecurring: false,
        },
        {
          id: '3',
          description: 'Staff Salaries - November',
          amount: 850000,
          category: 'salaries',
          branch: 'All Branches',
          branchCode: 'ALL',
          vendor: 'Payroll',
          date: '2024-11-28',
          status: 'pending',
          submittedBy: 'HR Manager',
          notes: 'Includes overtime',
          isRecurring: true,
          recurringFrequency: 'Monthly',
        },
        {
          id: '4',
          description: 'Office Supplies - Stationery',
          amount: 12500,
          category: 'supplies',
          branch: 'Kericho',
          branchCode: 'FGB-KER',
          vendor: 'Kericho Stationers',
          date: '2024-11-24',
          status: 'paid',
          submittedBy: 'Branch Manager',
          approvedBy: 'Jane Finance',
          notes: '',
          isRecurring: false,
        },
        {
          id: '5',
          description: 'Social Media Advertising',
          amount: 35000,
          category: 'marketing',
          branch: 'Bomet HQ',
          branchCode: 'FGB-HQ',
          vendor: 'Digital Agency',
          date: '2024-11-23',
          status: 'rejected',
          submittedBy: 'Marketing Team',
          notes: 'Budget exceeded - needs revision',
          isRecurring: false,
        },
        {
          id: '6',
          description: 'Food Supplies - Fresh Produce',
          amount: 145000,
          category: 'food',
          branch: 'All Branches',
          branchCode: 'ALL',
          vendor: 'Farm Fresh Suppliers',
          date: '2024-11-27',
          status: 'pending',
          submittedBy: 'Procurement',
          notes: 'Weekly supply order',
          isRecurring: true,
          recurringFrequency: 'Weekly',
        },
        {
          id: '7',
          description: 'Vehicle Fuel - November',
          amount: 45000,
          category: 'transport',
          branch: 'Bomet HQ',
          branchCode: 'FGB-HQ',
          vendor: 'Shell Petrol Station',
          date: '2024-11-22',
          status: 'paid',
          submittedBy: 'Transport Dept',
          approvedBy: 'Jane Finance',
          notes: 'Fleet vehicles',
          isRecurring: true,
          recurringFrequency: 'Monthly',
        },
      ];

      setExpenses(mockExpenses);

      // Calculate stats
      const paid = mockExpenses.filter(e => e.status === 'paid');
      const pending = mockExpenses.filter(e => e.status === 'pending');
      const thisMonthExpenses = mockExpenses.filter(e => e.status === 'paid' || e.status === 'approved');
      const totalThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

      // Find top category
      const categoryTotals: Record<string, number> = {};
      paid.forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
      });
      const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

      setStats({
        totalExpenses: mockExpenses.length,
        thisMonth: totalThisMonth,
        pending: pending.length,
        pendingAmount: pending.reduce((sum, e) => sum + e.amount, 0),
        approved: mockExpenses.filter(e => e.status === 'approved').length,
        monthlyBudget: 2500000,
        budgetUsed: (totalThisMonth / 2500000) * 100,
        topCategory: topCat ? CATEGORY_CONFIG[topCat[0] as ExpenseCategory]?.label : 'N/A',
        avgExpense: totalThisMonth / (thisMonthExpenses.length || 1),
      });
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBudgets = async () => {
    // Mock budget data
    setBudgets([
      { category: 'salaries', budgeted: 1000000, spent: 850000, remaining: 150000, percentage: 85 },
      { category: 'utilities', budgeted: 150000, spent: 85000, remaining: 65000, percentage: 57 },
      { category: 'food', budgeted: 400000, spent: 345000, remaining: 55000, percentage: 86 },
      { category: 'maintenance', budgeted: 100000, spent: 75000, remaining: 25000, percentage: 75 },
      { category: 'supplies', budgeted: 50000, spent: 32500, remaining: 17500, percentage: 65 },
      { category: 'marketing', budgeted: 80000, spent: 45000, remaining: 35000, percentage: 56 },
      { category: 'transport', budgeted: 80000, spent: 65000, remaining: 15000, percentage: 81 },
      { category: 'inventory', budgeted: 500000, spent: 420000, remaining: 80000, percentage: 84 },
      { category: 'other', budgeted: 40000, spent: 15000, remaining: 25000, percentage: 38 },
    ]);
  };

  // Filter expenses
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         e.vendor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesBranch = branchFilter === 'all' || e.branchCode === branchFilter;
    return matchesSearch && matchesStatus && matchesCategory && matchesBranch;
  });

  const handleAddExpense = () => {
    toast.success('Expense submitted for approval');
    setShowAddModal(false);
    setNewExpense({
      description: '',
      amount: 0,
      category: 'other',
      branch: '',
      vendor: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      receipt: null,
      isRecurring: false,
      recurringFrequency: '',
    });
    fetchExpenses();
  };

  const handleApprove = (expense: Expense) => {
    setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, status: 'approved' as ExpenseStatus } : e));
    toast.success(`Expense approved: ${expense.description}`);
  };

  const handleReject = (expense: Expense) => {
    setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, status: 'rejected' as ExpenseStatus } : e));
    toast.error(`Expense rejected: ${expense.description}`);
  };

  const handleDelete = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    toast.success('Expense deleted');
  };

  const getBudgetColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Expense Management</h1>
              <p className="text-gray-600 mt-1">Track, approve, and analyze business expenses</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={fetchExpenses}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => setShowAddModal(true)} className="bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">This Month</p>
                  <p className="text-xl font-bold text-red-600">KES {stats.thisMonth.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-red-200" />
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>Budget Used</span>
                  <span className={stats.budgetUsed > 80 ? 'text-red-600' : 'text-green-600'}>{stats.budgetUsed.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div 
                    className={`h-full rounded-full ${stats.budgetUsed > 80 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(stats.budgetUsed, 100)}%` }}
                  />
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Pending Approval</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-200" />
              </div>
              <p className="text-xs text-gray-500 mt-1">KES {stats.pendingAmount.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Monthly Budget</p>
                  <p className="text-xl font-bold">KES {stats.monthlyBudget.toLocaleString()}</p>
                </div>
                <Target className="h-8 w-8 text-indigo-200" />
              </div>
              <p className="text-xs text-green-600 mt-1">
                KES {(stats.monthlyBudget - stats.thisMonth).toLocaleString()} remaining
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Top Category</p>
                  <p className="text-sm font-bold">{stats.topCategory}</p>
                </div>
                <PieChart className="h-8 w-8 text-purple-200" />
              </div>
              <p className="text-xs text-gray-500 mt-1">Highest spending</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Avg. Expense</p>
                  <p className="text-xl font-bold">KES {stats.avgExpense.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-teal-200" />
              </div>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
            {['expenses', 'budget', 'analytics'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                  activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'expenses' ? 'All Expenses' : tab === 'budget' ? 'Budget Tracking' : 'Analytics'}
              </button>
            ))}
          </div>

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <>
              {/* Filters */}
              <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by description or vendor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">All Categories</option>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">All Branches</option>
                    {BRANCHES.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </Card>

              {/* Expenses Table */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Branch</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                        <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredExpenses.map((expense) => {
                        const StatusIcon = STATUS_CONFIG[expense.status].icon;
                        const CategoryIcon = CATEGORY_CONFIG[expense.category].icon;
                        return (
                          <motion.tr
                            key={expense.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="hover:bg-gray-50"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${CATEGORY_CONFIG[expense.category].color}`}>
                                  <CategoryIcon className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                  <p className="font-medium">{expense.description}</p>
                                  <p className="text-xs text-gray-500">{expense.vendor}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline">{CATEGORY_CONFIG[expense.category].label}</Badge>
                            </td>
                            <td className="p-4">
                              <p className="font-bold text-red-600">KES {expense.amount.toLocaleString()}</p>
                            </td>
                            <td className="p-4">
                              <p className="text-sm">{expense.branch}</p>
                            </td>
                            <td className="p-4">
                              <Badge className={STATUS_CONFIG[expense.status].color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {STATUS_CONFIG[expense.status].label}
                              </Badge>
                              {expense.isRecurring && (
                                <Badge variant="outline" className="ml-2">
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  {expense.recurringFrequency}
                                </Badge>
                              )}
                            </td>
                            <td className="p-4">
                              <p className="text-sm">{expense.date}</p>
                              <p className="text-xs text-gray-500">by {expense.submittedBy}</p>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setSelectedExpense(expense); setShowViewModal(true); }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {expense.status === 'pending' && (
                                  <>
                                    <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleApprove(expense)}>
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleReject(expense)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(expense.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredExpenses.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No expenses found</p>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* Budget Tab */}
          {activeTab === 'budget' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgets.map((budget) => {
                const config = CATEGORY_CONFIG[budget.category];
                const Icon = config.icon;
                return (
                  <Card key={budget.category} className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-medium">{config.label}</span>
                      </div>
                      <Badge className={`${getBudgetColor(budget.percentage)} text-white`}>
                        {budget.percentage}%
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${getBudgetColor(budget.percentage)}`}
                          style={{ width: `${budget.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Spent: KES {budget.spent.toLocaleString()}</span>
                        <span className="text-gray-500">Budget: KES {budget.budgeted.toLocaleString()}</span>
                      </div>
                      <p className={`text-sm font-medium ${budget.remaining < budget.budgeted * 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                        KES {budget.remaining.toLocaleString()} remaining
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Distribution */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Expense by Category</h3>
                <div className="space-y-3">
                  {budgets.sort((a, b) => b.spent - a.spent).map((budget) => {
                    const config = CATEGORY_CONFIG[budget.category];
                    const Icon = config.icon;
                    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
                    const percentage = (budget.spent / totalSpent) * 100;
                    return (
                      <div key={budget.category} className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{config.label}</span>
                            <span className="font-medium">{percentage.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full">
                            <div className={`h-full ${config.color} rounded-full`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold w-28 text-right">
                          KES {budget.spent.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Monthly Trend */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Monthly Expense Trend</h3>
                <div className="space-y-4">
                  {[
                    { month: 'November', amount: 1932500, change: 5.2 },
                    { month: 'October', amount: 1836000, change: -2.1 },
                    { month: 'September', amount: 1875000, change: 3.8 },
                    { month: 'August', amount: 1806000, change: 1.5 },
                    { month: 'July', amount: 1779000, change: -0.8 },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <span className="font-medium">{item.month}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold">KES {item.amount.toLocaleString()}</span>
                        <Badge className={item.change > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                          {item.change > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                          {Math.abs(item.change)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Top Vendors */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Top Vendors</h3>
                <div className="space-y-3">
                  {[
                    { name: 'Payroll', amount: 850000, count: 1 },
                    { name: 'Farm Fresh Suppliers', amount: 345000, count: 8 },
                    { name: 'Kenya Power', amount: 85000, count: 1 },
                    { name: 'Shell Petrol Station', amount: 65000, count: 4 },
                    { name: 'Tech Repairs Ltd', amount: 45000, count: 2 },
                  ].map((vendor, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-500">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium">{vendor.name}</p>
                          <p className="text-xs text-gray-500">{vendor.count} transactions</p>
                        </div>
                      </div>
                      <p className="font-semibold">KES {vendor.amount.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Alerts */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Budget Alerts</h3>
                <div className="space-y-3">
                  {budgets.filter(b => b.percentage >= 75).map((budget) => {
                    const config = CATEGORY_CONFIG[budget.category];
                    return (
                      <div key={budget.category} className={`p-4 rounded-lg border ${budget.percentage >= 90 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-5 w-5 ${budget.percentage >= 90 ? 'text-red-600' : 'text-amber-600'}`} />
                          <span className="font-medium">{config.label}</span>
                        </div>
                        <p className={`text-sm mt-1 ${budget.percentage >= 90 ? 'text-red-600' : 'text-amber-600'}`}>
                          {budget.percentage >= 90 
                            ? `Critical: ${budget.percentage}% of budget used. Only KES ${budget.remaining.toLocaleString()} remaining!`
                            : `Warning: ${budget.percentage}% of budget used. KES ${budget.remaining.toLocaleString()} remaining.`
                          }
                        </p>
                      </div>
                    );
                  })}
                  {budgets.filter(b => b.percentage >= 75).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-300" />
                      <p>All budgets are healthy!</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Add Expense Modal */}
          <AnimatePresence>
            {showAddModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowAddModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold">Add New Expense</h2>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Description *</label>
                      <input
                        type="text"
                        placeholder="What is this expense for?"
                        value={newExpense.description}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    {/* Amount & Category */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Amount (KES) *</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={newExpense.amount || ''}
                          onChange={(e) => setNewExpense(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border rounded-lg text-xl font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Category *</label>
                        <select
                          value={newExpense.category}
                          onChange={(e) => setNewExpense(prev => ({ ...prev, category: e.target.value as ExpenseCategory }))}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Branch & Vendor */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Branch *</label>
                        <select
                          value={newExpense.branch}
                          onChange={(e) => setNewExpense(prev => ({ ...prev, branch: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="">Select Branch</option>
                          <option value="ALL">All Branches</option>
                          {BRANCHES.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Vendor</label>
                        <input
                          type="text"
                          placeholder="Vendor/Supplier name"
                          value={newExpense.vendor}
                          onChange={(e) => setNewExpense(prev => ({ ...prev, vendor: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Date *</label>
                      <input
                        type="date"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    {/* Recurring */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newExpense.isRecurring}
                          onChange={(e) => setNewExpense(prev => ({ ...prev, isRecurring: e.target.checked }))}
                          className="rounded"
                        />
                        <span className="text-sm">This is a recurring expense</span>
                      </label>
                      {newExpense.isRecurring && (
                        <select
                          value={newExpense.recurringFrequency}
                          onChange={(e) => setNewExpense(prev => ({ ...prev, recurringFrequency: e.target.value }))}
                          className="px-3 py-1 border rounded-lg text-sm"
                        >
                          <option value="">Select frequency</option>
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Quarterly">Quarterly</option>
                        </select>
                      )}
                    </div>

                    {/* Receipt Upload */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Receipt/Invoice</label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center">
                        <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF up to 10MB</p>
                        <input type="file" className="hidden" accept="image/*,.pdf" />
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Notes</label>
                      <textarea
                        placeholder="Additional notes..."
                        value={newExpense.notes}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                    <div className="text-lg">
                      Total: <span className="font-bold text-2xl text-red-600">KES {newExpense.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                      <Button className="bg-red-600 hover:bg-red-700" onClick={handleAddExpense}>
                        <Check className="h-4 w-4 mr-2" /> Submit Expense
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* View Expense Modal */}
          <AnimatePresence>
            {showViewModal && selectedExpense && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowViewModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-white rounded-xl shadow-xl w-full max-w-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <Badge className={STATUS_CONFIG[selectedExpense.status].color}>
                        {STATUS_CONFIG[selectedExpense.status].label}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => setShowViewModal(false)}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${CATEGORY_CONFIG[selectedExpense.category].color}`}>
                        {(() => {
                          const Icon = CATEGORY_CONFIG[selectedExpense.category].icon;
                          return <Icon className="h-6 w-6 text-white" />;
                        })()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{selectedExpense.description}</h3>
                        <p className="text-sm text-gray-500">{CATEGORY_CONFIG[selectedExpense.category].label}</p>
                      </div>
                    </div>

                    <div className="text-3xl font-bold text-red-600 text-center py-4">
                      KES {selectedExpense.amount.toLocaleString()}
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-500">Vendor</span>
                        <span className="font-medium">{selectedExpense.vendor}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-500">Branch</span>
                        <span className="font-medium">{selectedExpense.branch}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-500">Date</span>
                        <span className="font-medium">{selectedExpense.date}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-500">Submitted By</span>
                        <span className="font-medium">{selectedExpense.submittedBy}</span>
                      </div>
                      {selectedExpense.approvedBy && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-500">Approved By</span>
                          <span className="font-medium">{selectedExpense.approvedBy}</span>
                        </div>
                      )}
                      {selectedExpense.isRecurring && (
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-500">Recurring</span>
                          <Badge variant="outline">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {selectedExpense.recurringFrequency}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {selectedExpense.notes && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm"><span className="font-medium">Notes:</span> {selectedExpense.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    {selectedExpense.status === 'pending' && (
                      <>
                        <Button variant="outline" className="text-red-600" onClick={() => { handleReject(selectedExpense); setShowViewModal(false); }}>
                          <X className="h-4 w-4 mr-2" /> Reject
                        </Button>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => { handleApprove(selectedExpense); setShowViewModal(false); }}>
                          <Check className="h-4 w-4 mr-2" /> Approve
                        </Button>
                      </>
                    )}
                    {selectedExpense.status !== 'pending' && (
                      <Button variant="outline" onClick={() => setShowViewModal(false)}>Close</Button>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
