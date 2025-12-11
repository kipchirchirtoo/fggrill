'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { budgetAPI, Budget, BudgetSummary } from '@/lib/api/budget';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Button } from "@/components/ui/minimal/button";
import { 
  Search, RefreshCw, CreditCard, PlusCircle, ChevronRight,
  Filter, Calendar, Download, FileText, BarChart2, 
  Wallet, TrendingUp, TrendingDown, ArrowUpDown, PieChart
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { BudgetFormDialog } from './components/budget-form-dialog';
import { BudgetDetailDialog } from './components/budget-detail-dialog';
import { BudgetAnalyticsTab } from './components/budget-analytics-tab';
import { BudgetForecastTab } from './components/budget-forecast-tab';

function BranchBudgetPageContent() {
  // Use state and context hooks
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [filteredBudgets, setFilteredBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [fiscalYearFilter, setFiscalYearFilter] = useState(new Date().getFullYear().toString());
  const [showAddBudgetDialog, setShowAddBudgetDialog] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [showBudgetDetailDialog, setShowBudgetDetailDialog] = useState(false);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Unique category and period options
  const categoryOptions = Array.from(new Set(budgets.map(budget => budget.category)));
  const periodOptions = Array.from(new Set(budgets.map(budget => budget.period)));
  const fiscalYearOptions = Array.from(new Set(budgets.map(budget => budget.fiscal_year)));
  
  // Fetch budgets from API
  const fetchBudgets = useCallback(async () => {
    if (!activeBranchId) return;
    
    setIsLoading(true);
    try {
      const filters = {
        fiscal_year: fiscalYearFilter !== 'all' ? fiscalYearFilter : undefined
      };
      
      const response = await budgetAPI.getBudgets(filters, activeBranchId);
      
      if (response.success && Array.isArray(response.data)) {
        setBudgets(response.data);
      } else {
        toast.error('Failed to load budget data');
        // Set empty array to avoid mapping errors
        setBudgets([]);
      }
      
      // Fetch budget summary
      const summaryResponse = await budgetAPI.getBudgetSummary(
        fiscalYearFilter !== 'all' ? fiscalYearFilter : undefined, 
        activeBranchId
      );
      
      if (summaryResponse.success && summaryResponse.data) {
        setSummary(summaryResponse.data);
      }
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast.error('Failed to load budget data');
      // Set empty arrays to avoid mapping errors
      setBudgets([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, fiscalYearFilter]);

  // Apply filters to budgets
  useEffect(() => {
    let filtered = [...budgets];
    
    // Apply search filter
    if (searchTerm) {
      const lowercaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(budget => 
        budget.name.toLowerCase().includes(lowercaseSearch) || 
        budget.category.toLowerCase().includes(lowercaseSearch)
      );
    }
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(budget => budget.category === categoryFilter);
    }
    
    // Apply period filter
    if (periodFilter !== 'all') {
      filtered = filtered.filter(budget => budget.period === periodFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (sortField === 'name') {
        return sortDirection === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (sortField === 'allocated_amount') {
        return sortDirection === 'asc' 
          ? a.allocated_amount - b.allocated_amount
          : b.allocated_amount - a.allocated_amount;
      } else if (sortField === 'spent_amount') {
        return sortDirection === 'asc' 
          ? (a.spent_amount || 0) - (b.spent_amount || 0)
          : (b.spent_amount || 0) - (a.spent_amount || 0);
      } else if (sortField === 'percentage_used') {
        return sortDirection === 'asc' 
          ? (a.percentage_used || 0) - (b.percentage_used || 0)
          : (b.percentage_used || 0) - (a.percentage_used || 0);
      } else if (sortField === 'created_at') {
        return sortDirection === 'asc' 
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });
    
    setFilteredBudgets(filtered);
  }, [budgets, searchTerm, categoryFilter, periodFilter, sortField, sortDirection]);

  // Initial data load
  useEffect(() => {
    if (activeBranchId) {
      fetchBudgets();
    }
  }, [fetchBudgets, activeBranchId]);

  // Handle sort change
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Get status badge for budget
  const getBudgetStatusBadge = (budget: Budget) => {
    const percentage = budget.percentage_used || 0;
    
    if (percentage > 100) {
      return <IOSBadge className="bg-red-100 text-red-700">Over Budget</IOSBadge>;
    } else if (percentage > 90) {
      return <IOSBadge className="bg-yellow-100 text-yellow-700">Near Limit</IOSBadge>;
    } else if (percentage > 70) {
      return <IOSBadge className="bg-blue-100 text-blue-700">On Track</IOSBadge>;
    } else {
      return <IOSBadge className="bg-green-100 text-green-700">Within Budget</IOSBadge>;
    }
  };

  // Format category name for display
  const formatCategory = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ');
  };

  // Format period name for display
  const formatPeriod = (period: string) => {
    return period.charAt(0).toUpperCase() + period.slice(1);
  };

  // Handle budget creation success
  const handleBudgetCreated = () => {
    fetchBudgets();
    setShowAddBudgetDialog(false);
  };

  // Handle budget view
  const handleViewBudget = (budget: Budget) => {
    setSelectedBudget(budget);
    setShowBudgetDetailDialog(true);
  };

  // Calculate total allocated, spent and remaining amounts
  const totalAllocated = summary?.total_allocated || 0;
  const totalSpent = summary?.total_spent || 0;
  const totalRemaining = summary?.total_remaining || 0;
  const usagePercentage = summary?.usage_percentage || 0;

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.FINANCE,
      UserRole.ACCOUNTANT,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title="Budget Management"
        subtitle={`Manage and track budgets for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton 
            onClick={() => setShowAddBudgetDialog(true)} 
            leftIcon={<PlusCircle />}
          >
            New Budget
          </IOSButton>
        }
      >
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">Total Allocated Budget</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(totalAllocated)}</p>
                </div>
                <Wallet className="h-5 w-5 text-[#007AFF]" />
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">Total Spent</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(totalSpent)}</p>
                </div>
                <TrendingDown className={`h-5 w-5 ${usagePercentage > 100 ? 'text-[#FF3B30]' : 'text-[#5856D6]'}`} />
              </div>
              <div className="mt-2">
                <div className="text-xs text-gray-500 flex justify-between mb-1">
                  <span>Usage</span>
                  <span className={usagePercentage > 100 ? 'text-[#FF3B30]' : 'text-gray-500'}>
                    {usagePercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${
                      usagePercentage > 100 ? 'bg-[#FF3B30]' : 
                      usagePercentage > 90 ? 'bg-[#FF9500]' : 
                      'bg-[#34C759]'
                    }`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">Remaining Budget</p>
                  <p className={`text-xl font-bold mt-1 ${totalRemaining < 0 ? 'text-[#FF3B30]' : ''}`}>
                    {formatCurrency(totalRemaining)}
                  </p>
                </div>
                <TrendingUp className={`h-5 w-5 ${totalRemaining < 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}`} />
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-gray-500">Analysis & Reports</p>
                  <p className="mt-2 text-sm">View detailed analytics</p>
                </div>
                <Button variant="outline" size="sm" className="h-8">
                  <FileText className="h-4 w-4 mr-1" />
                  View
                </Button>
              </div>
            </IOSCard>
          </div>
          
          {/* Category Breakdown */}
          {summary?.category_breakdown && summary.category_breakdown.length > 0 && (
            <IOSCard className="p-4">
              <h3 className="font-medium mb-4">Budget by Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.category_breakdown.map((category) => (
                  <div key={category.category} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">{formatCategory(category.category)}</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(category.spent)} / {formatCurrency(category.allocated)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          category.percentage > 100 ? 'bg-red-600' : 
                          category.percentage > 90 ? 'bg-yellow-600' : 
                          category.percentage > 70 ? 'bg-blue-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(100, category.percentage)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{category.percentage.toFixed(1)}% Used</span>
                      <span>{formatCurrency(category.remaining)} Remaining</span>
                    </div>
                  </div>
                ))}
              </div>
            </IOSCard>
          )}

          {/* Tabs */}
          <Tabs defaultValue="budgets" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="budgets">Budgets</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="forecast">Forecasts</TabsTrigger>
            </TabsList>
            
            <TabsContent value="budgets">
              {/* Search and Filter */}
              <IOSCard className="p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="relative col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search budgets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                    >
                      <option value="all">All Categories</option>
                      {categoryOptions.map(category => (
                        <option key={category} value={category}>
                          {formatCategory(category)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <select
                      value={periodFilter}
                      onChange={(e) => setPeriodFilter(e.target.value)}
                      className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                    >
                      <option value="all">All Periods</option>
                      {periodOptions.map(period => (
                        <option key={period} value={period}>
                          {formatPeriod(period)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex gap-2">
                    <IOSButton 
                      onClick={fetchBudgets} 
                      leftIcon={<RefreshCw />}
                      variant="secondary"
                      className="flex-1"
                    >
                      Refresh
                    </IOSButton>
                    
                    <IOSButton 
                      variant="outline"
                      leftIcon={<Download />}
                      className="flex-1"
                    >
                      Export
                    </IOSButton>
                  </div>
                </div>
              </IOSCard>

              {/* Budgets Table */}
              <IOSCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Budget Name</span>
                            {sortField === 'name' && (
                              <ArrowUpDown className={`h-3 w-3 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Period
                        </th>
                        <th 
                          className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('allocated_amount')}
                        >
                          <div className="flex items-center justify-end space-x-1">
                            <span>Allocated</span>
                            {sortField === 'allocated_amount' && (
                              <ArrowUpDown className={`h-3 w-3 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('spent_amount')}
                        >
                          <div className="flex items-center justify-end space-x-1">
                            <span>Spent</span>
                            {sortField === 'spent_amount' && (
                              <ArrowUpDown className={`h-3 w-3 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('percentage_used')}
                        >
                          <div className="flex items-center justify-end space-x-1">
                            <span>Usage</span>
                            {sortField === 'percentage_used' && (
                              <ArrowUpDown className={`h-3 w-3 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} />
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                            <p className="text-gray-500 mt-2">Loading budget data...</p>
                          </td>
                        </tr>
                      ) : filteredBudgets.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center">
                            <div className="flex flex-col items-center">
                              <CreditCard className="h-12 w-12 text-gray-300 mb-2" />
                              <p className="text-gray-500">No budget records found</p>
                              <IOSButton 
                                variant="outline" 
                                className="mt-4" 
                                onClick={() => setShowAddBudgetDialog(true)}
                                leftIcon={<PlusCircle className="h-4 w-4" />}
                              >
                                Create Budget
                              </IOSButton>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredBudgets.map((budget) => {
                          // Calculate percentage safely
                          const percentage = budget.percentage_used || 0;
                          const remaining = (budget.allocated_amount || 0) - (budget.spent_amount || 0);
                          
                          return (
                            <tr key={budget.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4">
                                <div>
                                  <div className="font-medium text-gray-900">{budget.name}</div>
                                  <div className="text-sm text-gray-500">
                                    {format(new Date(budget.start_date), 'MMM d, yyyy')} - {format(new Date(budget.end_date), 'MMM d, yyyy')}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {formatCategory(budget.category)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {formatPeriod(budget.period)}
                              </td>
                              <td className="px-4 py-4 text-right whitespace-nowrap">
                                {formatCurrency(budget.allocated_amount || 0)}
                              </td>
                              <td className="px-4 py-4 text-right whitespace-nowrap">
                                {formatCurrency(budget.spent_amount || 0)}
                              </td>
                              <td className="px-4 py-4 text-right whitespace-nowrap">
                                <div className="flex flex-col items-end">
                                  <span className={`font-medium ${percentage > 100 ? 'text-red-600' : ''}`}>
                                    {percentage.toFixed(1)}%
                                  </span>
                                  <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                                    <div 
                                      className={`h-1.5 rounded-full ${
                                        percentage > 100 ? 'bg-red-600' : 
                                        percentage > 90 ? 'bg-yellow-600' : 
                                        percentage > 70 ? 'bg-blue-600' :
                                        'bg-green-600'
                                      }`}
                                      style={{ width: `${Math.min(100, percentage)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center whitespace-nowrap">
                                {getBudgetStatusBadge(budget)}
                              </td>
                              <td className="px-4 py-4 text-right whitespace-nowrap">
                                <IOSButton 
                                  size="sm" 
                                  variant="ghost"
                                  className="text-gray-500 hover:text-gray-700"
                                  onClick={() => handleViewBudget(budget)}
                                  rightIcon={<ChevronRight className="h-4 w-4" />}
                                >
                                  View Details
                                </IOSButton>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </IOSCard>
            </TabsContent>
            
            <TabsContent value="analytics">
              <BudgetAnalyticsTab 
                branchId={activeBranchId}
                fiscalYear={fiscalYearFilter}
              />
            </TabsContent>
            
            <TabsContent value="forecast">
              <BudgetForecastTab
                branchId={activeBranchId}
              />
            </TabsContent>
          </Tabs>
        </div>
      </BranchAwareDashboardLayout>
      
      {/* Budget Form Dialog */}
      <BudgetFormDialog
        open={showAddBudgetDialog}
        onOpenChange={setShowAddBudgetDialog}
        branchId={activeBranchId}
        onSuccess={handleBudgetCreated}
      />
      
      {/* Budget Detail Dialog */}
      {selectedBudget && (
        <BudgetDetailDialog
          open={showBudgetDetailDialog}
          onOpenChange={setShowBudgetDetailDialog}
          budgetId={selectedBudget.id}
          branchId={activeBranchId}
          onSuccess={fetchBudgets}
        />
      )}
    </ProtectedRoute>
  );
}

export default function BranchBudgetPage() {
  return (
    <BranchPageWrapper>
      <BranchBudgetPageContent />
    </BranchPageWrapper>
  );
}
