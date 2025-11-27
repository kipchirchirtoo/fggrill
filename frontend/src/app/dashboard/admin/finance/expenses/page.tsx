'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Plus, CheckCircle, XCircle, Clock, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Expense {
  id: number;
  branch_id?: number;
  department_id?: number;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  created_by: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at?: string;
  branch?: {
    id: number;
    name: string;
  };
  department?: {
    id: number;
    name: string;
  };
  created_by_user?: {
    id: string;
    full_name: string;
  };
  approved_by_user?: {
    id: string;
    full_name: string;
  };
}

interface Branch {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState({
    branch_id: '',
    department_id: '',
    category: '',
    amount: 0,
    description: '',
    expense_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchExpenses();
    fetchBranches();
    fetchDepartments();
  }, [filterStatus]);

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/system/branches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBranches(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/system/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = filterStatus !== 'all'
        ? `${API_URL}/api/finance/expenses?status=${filterStatus}`
        : `${API_URL}/api/finance/expenses`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setExpenses(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/finance/expenses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          branch_id: formData.branch_id ? parseInt(formData.branch_id) : null,
          department_id: formData.department_id ? parseInt(formData.department_id) : null
        })
      });

      if (response.ok) {
        toast.success('Expense request created successfully');
        setIsModalOpen(false);
        setFormData({
          branch_id: '',
          department_id: '',
          category: '',
          amount: 0,
          description: '',
          expense_date: new Date().toISOString().split('T')[0]
        });
        fetchExpenses();
      } else {
        toast.error('Failed to create expense');
      }
    } catch (error) {
      toast.error('Error creating expense');
    }
  };

  const handleApproveExpense = async (expenseId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/finance/expenses/${expenseId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Expense approved successfully');
        fetchExpenses();
      } else {
        toast.error('Failed to approve expense');
      }
    } catch (error) {
      toast.error('Error approving expense');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-amber-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-amber-500';
    }
  };

  const stats = {
    total: expenses.length,
    pending: expenses.filter(e => e.status === 'pending').length,
    approved: expenses.filter(e => e.status === 'approved').length,
    totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0)
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Expense Management</h1>
            <p className="text-gray-600 mt-1">Track and approve operational expenses</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Expense
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Expenses</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Pending</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Approved</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Amount</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {formatCurrency(stats.totalAmount)}
            </div>
          </Card>
        </div>

        {/* Filter */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="filterStatus">Filter by Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger id="filterStatus" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Expenses List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p>Loading expenses...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <Card key={expense.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {getStatusIcon(expense.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{expense.category}</h3>
                        <Badge className={getStatusColor(expense.status)}>
                          {expense.status}
                        </Badge>
                      </div>

                      <p className="text-gray-700 mb-3">{expense.description}</p>

                      <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-semibold text-lg text-green-600">
                            {formatCurrency(expense.amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(expense.expense_date).toLocaleDateString()}</span>
                        </div>
                        {expense.department && (
                          <span className="text-blue-600">{expense.department.name}</span>
                        )}
                        {expense.branch && (
                          <span className="text-purple-600">{expense.branch.name}</span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500">
                        Requested by: {expense.created_by_user?.full_name || expense.created_by} on{' '}
                        {new Date(expense.created_at).toLocaleDateString()}
                        {expense.approved_by_user && expense.approved_at && (
                          <>
                            {' '}• Approved by: {expense.approved_by_user.full_name} on{' '}
                            {new Date(expense.approved_at).toLocaleDateString()}
                          </>
                        )}
                      </div>
                    </div>

                    {expense.status === 'pending' && user?.role === 'MANAGER' && (
                      <Button
                        size="sm"
                        onClick={() => handleApproveExpense(expense.id)}
                        className="ml-4"
                      >
                        Approve
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && expenses.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No expenses found</p>
          </div>
        )}

        {/* Create Expense Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Expense Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Office Supplies, Utilities"
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount (KES) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="description">Description *</Label>
                <textarea
                  id="description"
                  required
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the expense..."
                />
              </div>
              <div>
                <Label htmlFor="expense_date">Expense Date *</Label>
                <Input
                  id="expense_date"
                  type="date"
                  required
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="branch_id">Branch</Label>
                <Select
                  value={formData.branch_id}
                  onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
                >
                  <SelectTrigger id="branch_id">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="department_id">Department</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                >
                  <SelectTrigger id="department_id">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Request</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
