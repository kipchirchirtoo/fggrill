'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Plus, TrendingUp, TrendingDown, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Budget {
  id: number;
  branch_id?: number;
  department_id?: number;
  category: string;
  fiscal_year: number;
  fiscal_month?: number;
  allocated_amount: number;
  spent_amount: number;
  created_at: string;
  branch?: {
    id: number;
    name: string;
  };
  department?: {
    id: number;
    name: string;
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

export default function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [formData, setFormData] = useState({
    branch_id: '',
    department_id: '',
    category: '',
    fiscal_year: new Date().getFullYear(),
    fiscal_month: '',
    allocated_amount: 0
  });

  useEffect(() => {
    fetchBudgets();
    fetchBranches();
    fetchDepartments();
  }, [filterYear]);

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

  const fetchBudgets = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_URL}/api/finance/budgets?fiscal_year=${filterYear}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBudgets(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast.error('Failed to load budgets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/finance/budgets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          branch_id: formData.branch_id ? parseInt(formData.branch_id) : null,
          department_id: formData.department_id ? parseInt(formData.department_id) : null,
          fiscal_month: formData.fiscal_month ? parseInt(formData.fiscal_month) : null
        })
      });

      if (response.ok) {
        toast.success('Budget created successfully');
        setIsModalOpen(false);
        setFormData({
          branch_id: '',
          department_id: '',
          category: '',
          fiscal_year: new Date().getFullYear(),
          fiscal_month: '',
          allocated_amount: 0
        });
        fetchBudgets();
      } else {
        toast.error('Failed to create budget');
      }
    } catch (error) {
      toast.error('Error creating budget');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getUtilizationPercentage = (budget: Budget) => {
    if (budget.allocated_amount === 0) return 0;
    return (budget.spent_amount / budget.allocated_amount) * 100;
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-amber-600';
    return 'text-green-600';
  };

  const totalAllocated = budgets.reduce((sum, b) => sum + b.allocated_amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent_amount, 0);
  const overallUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Budget Management</h1>
            <p className="text-gray-600 mt-1">Track and manage departmental budgets</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Set Budget
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="p-6">
            <div className="text-sm text-gray-600 mb-2">Total Allocated</div>
            <div className="text-3xl font-bold text-blue-600">{formatCurrency(totalAllocated)}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-600 mb-2">Total Spent</div>
            <div className="text-3xl font-bold text-green-600">{formatCurrency(totalSpent)}</div>
          </Card>
          <Card className="p-6">
            <div className="text-sm text-gray-600 mb-2">Utilization</div>
            <div className={`text-3xl font-bold ${getUtilizationColor(overallUtilization)}`}>
              {overallUtilization.toFixed(1)}%
            </div>
          </Card>
        </div>

        {/* Filter */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="filterYear">Fiscal Year</Label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger id="filterYear" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={(new Date().getFullYear() - 1).toString()}>
                  {new Date().getFullYear() - 1}
                </SelectItem>
                <SelectItem value={new Date().getFullYear().toString()}>
                  {new Date().getFullYear()}
                </SelectItem>
                <SelectItem value={(new Date().getFullYear() + 1).toString()}>
                  {new Date().getFullYear() + 1}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Budgets List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p>Loading budgets...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {budgets.map((budget) => {
              const utilizationPct = getUtilizationPercentage(budget);
              const remaining = budget.allocated_amount - budget.spent_amount;

              return (
                <Card key={budget.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{budget.category}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          {budget.department && <span>{budget.department.name}</span>}
                          {budget.branch && <span>• {budget.branch.name}</span>}
                          {budget.fiscal_month && <span>• Month: {budget.fiscal_month}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getUtilizationColor(utilizationPct)}`}>
                        {utilizationPct.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Utilized</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Allocated</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {formatCurrency(budget.allocated_amount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Spent</div>
                      <div className="text-lg font-semibold text-green-600">
                        {formatCurrency(budget.spent_amount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Remaining</div>
                      <div className={`text-lg font-semibold ${remaining >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {formatCurrency(remaining)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        utilizationPct >= 90 ? 'bg-red-600' :
                        utilizationPct >= 75 ? 'bg-amber-600' : 'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoading && budgets.length === 0 && (
          <div className="text-center py-12">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No budgets found for {filterYear}</p>
          </div>
        )}

        {/* Create Budget Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Set Budget</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateBudget} className="space-y-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Maintenance, Utilities, Salaries"
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fiscal_year">Fiscal Year *</Label>
                  <Input
                    id="fiscal_year"
                    type="number"
                    required
                    value={formData.fiscal_year}
                    onChange={(e) => setFormData({ ...formData, fiscal_year: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="fiscal_month">Month (Optional)</Label>
                  <Select
                    value={formData.fiscal_month}
                    onValueChange={(value) => setFormData({ ...formData, fiscal_month: value })}
                  >
                    <SelectTrigger id="fiscal_month">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Yearly</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {new Date(2000, i).toLocaleString('en', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="allocated_amount">Allocated Amount (KES) *</Label>
                <Input
                  id="allocated_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.allocated_amount}
                  onChange={(e) => setFormData({ ...formData, allocated_amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Set Budget</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
