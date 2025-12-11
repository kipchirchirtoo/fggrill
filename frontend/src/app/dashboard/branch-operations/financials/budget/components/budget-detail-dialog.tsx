'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { toast } from 'sonner';
import { budgetAPI, Budget, BudgetDetail, BudgetExpense } from '@/lib/api/budget';
import { format } from 'date-fns';
import { RefreshCw, AlertCircle, CheckCircle2, XCircle, Edit, Trash2, BarChart2 } from 'lucide-react';
import { BudgetFormDialog } from './budget-form-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BudgetVarianceReport } from './budget-variance-report';

interface BudgetDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  branchId?: number;
  onSuccess: () => void;
}

export function BudgetDetailDialog({
  open,
  onOpenChange,
  budgetId,
  branchId,
  onSuccess
}: BudgetDetailDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [budgetDetail, setBudgetDetail] = useState<BudgetDetail | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'expenses' | 'adjustments' | 'analysis'>('details');
  const [showVarianceReport, setShowVarianceReport] = useState(false);

  // Fetch budget details
  useEffect(() => {
    if (open && budgetId) {
      fetchBudgetDetails();
    }
  }, [open, budgetId, branchId]);

  // Fetch budget details from API
  const fetchBudgetDetails = async () => {
    setIsLoading(true);
    try {
      const response = await budgetAPI.getBudgetById(budgetId, branchId);
      
      if (response.success && response.data) {
        setBudgetDetail(response.data);
      } else {
        toast.error('Failed to load budget details');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error fetching budget details:', error);
      toast.error('An error occurred while loading budget details');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle budget update success
  const handleBudgetUpdated = () => {
    fetchBudgetDetails();
    setShowEditDialog(false);
    onSuccess();
  };

  // Handle budget delete
  const handleDeleteBudget = async () => {
    if (!budgetId) return;
    
    setIsDeleting(true);
    try {
      const response = await budgetAPI.deleteBudget(budgetId, branchId);
      
      if (response.success) {
        toast.success('Budget deleted successfully');
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(response.message || 'Failed to delete budget');
      }
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast.error('An error occurred while deleting the budget');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
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

  // Get expense status badge
  const getExpenseStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return <IOSBadge className="bg-green-100 text-green-700">Approved</IOSBadge>;
      case 'pending':
        return <IOSBadge className="bg-yellow-100 text-yellow-700">Pending</IOSBadge>;
      case 'rejected':
        return <IOSBadge className="bg-red-100 text-red-700">Rejected</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{status}</IOSBadge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Budget Details</DialogTitle>
            <DialogDescription>
              {budgetDetail?.budget?.name || 'Loading budget details...'}
            </DialogDescription>
          </DialogHeader>
          
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : budgetDetail ? (
            <>
              <div className="flex border-b">
                <button
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'details' ? 'border-b-2 border-[#007AFF] text-[#007AFF]' : 'text-gray-500'}`}
                  onClick={() => setActiveTab('details')}
                >
                  Details
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'expenses' ? 'border-b-2 border-[#007AFF] text-[#007AFF]' : 'text-gray-500'}`}
                  onClick={() => setActiveTab('expenses')}
                >
                  Expenses ({budgetDetail.expenses.length})
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'adjustments' ? 'border-b-2 border-[#007AFF] text-[#007AFF]' : 'text-gray-500'}`}
                  onClick={() => setActiveTab('adjustments')}
                >
                  Adjustments ({budgetDetail.adjustments.length})
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'analysis' ? 'border-b-2 border-[#007AFF] text-[#007AFF]' : 'text-gray-500'}`}
                  onClick={() => setActiveTab('analysis')}
                >
                  Analysis
                </button>
              </div>
              
              <ScrollArea className="flex-grow pr-4">
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-500">Allocated Amount</p>
                        <p className="text-xl font-bold">{formatCurrency(budgetDetail.budget.allocated_amount)}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-500">Spent</p>
                        <p className="text-xl font-bold">{formatCurrency(budgetDetail.budget.spent_amount || 0)}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-500">Remaining</p>
                        <p className={`text-xl font-bold ${(budgetDetail.budget.remaining_amount || 0) < 0 ? 'text-red-600' : ''}`}>
                          {formatCurrency(budgetDetail.budget.remaining_amount || 0)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-500 mb-2">Budget Usage</p>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${
                            (budgetDetail.budget.percentage_used || 0) > 100 ? 'bg-red-600' : 
                            (budgetDetail.budget.percentage_used || 0) > 90 ? 'bg-yellow-600' : 
                            (budgetDetail.budget.percentage_used || 0) > 70 ? 'bg-blue-600' :
                            'bg-green-600'
                          }`}
                          style={{ width: `${Math.min(100, budgetDetail.budget.percentage_used || 0)}%` }}
                        ></div>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span className="text-sm">{(budgetDetail.budget.percentage_used || 0).toFixed(1)}% Used</span>
                        <span className="text-sm font-medium">
                          {getBudgetStatusBadge(budgetDetail.budget)}
                        </span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Budget Category</p>
                        <p className="font-medium">{formatCategory(budgetDetail.budget.category)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-500">Budget Period</p>
                        <p className="font-medium">{formatPeriod(budgetDetail.budget.period)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-500">Date Range</p>
                        <p className="font-medium">
                          {formatDate(budgetDetail.budget.start_date)} - {formatDate(budgetDetail.budget.end_date)}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-500">Fiscal Year</p>
                        <p className="font-medium">{budgetDetail.budget.fiscal_year}</p>
                      </div>
                      
                      {budgetDetail.budget.fiscal_month && (
                        <div>
                          <p className="text-sm text-gray-500">Fiscal Month</p>
                          <p className="font-medium">
                            {new Date(0, parseInt(budgetDetail.budget.fiscal_month) - 1).toLocaleString('en-US', { month: 'long' })}
                          </p>
                        </div>
                      )}
                      
                      {budgetDetail.budget.description && (
                        <div>
                          <p className="text-sm text-gray-500">Description</p>
                          <p className="font-medium">{budgetDetail.budget.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'expenses' && (
                  <div className="space-y-4">
                    {budgetDetail.expenses.length === 0 ? (
                      <div className="py-12 text-center">
                        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No expenses linked to this budget yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {budgetDetail.expenses.map((expense) => (
                          <div key={expense.id} className="border rounded-md p-4 bg-white">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{expense.description}</p>
                                <p className="text-sm text-gray-500">{expense.reference}</p>
                              </div>
                              <div className="flex flex-col items-end">
                                <p className="font-medium">{formatCurrency(expense.amount)}</p>
                                <div className="mt-1">{getExpenseStatusBadge(expense.status)}</div>
                              </div>
                            </div>
                            <div className="mt-2 flex justify-between text-sm">
                              <span className="text-gray-500">
                                {formatDate(expense.date)} • {formatCategory(expense.category)}
                              </span>
                              <span className="text-gray-500">
                                {expense.payment_method?.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'adjustments' && (
                  <div className="space-y-4">
                    {budgetDetail.adjustments.length === 0 ? (
                      <div className="py-12 text-center">
                        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No budget adjustments have been made</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {budgetDetail.adjustments.map((adjustment) => (
                          <div key={adjustment.id} className="border rounded-md p-4 bg-white">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">
                                  Budget {adjustment.adjustment_amount > 0 ? 'Increased' : 'Decreased'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Adjusted by {adjustment.users?.name || 'User'} on {formatDate(adjustment.created_at)}
                                </p>
                              </div>
                              <div className="flex flex-col items-end">
                                <p className={`font-medium ${adjustment.adjustment_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {adjustment.adjustment_amount > 0 ? '+' : ''}{formatCurrency(adjustment.adjustment_amount)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex justify-between text-sm">
                              <span className="text-gray-500">
                                Previous: {formatCurrency(adjustment.previous_amount)}
                              </span>
                              <span className="text-gray-500">
                                New: {formatCurrency(adjustment.new_amount)}
                              </span>
                            </div>
                            {adjustment.reason && (
                              <p className="mt-2 text-sm italic text-gray-500">
                                "{adjustment.reason}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'analysis' && (
                  <div className="space-y-4">
                    <div className="py-4">
                      <IOSButton
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowVarianceReport(true)}
                        leftIcon={<BarChart2 className="h-4 w-4" />}
                      >
                        View Budget Variance Report
                      </IOSButton>
                    </div>
                    
                    <div className="p-4 border rounded-md">
                      <h3 className="font-medium mb-2">Budget Health Check</h3>
                      
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Overall Budget Health</span>
                          <IOSBadge className={`
                            ${(budgetDetail.budget.percentage_used || 0) > 100 ? 'bg-red-100 text-red-700' : 
                              (budgetDetail.budget.percentage_used || 0) > 90 ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-green-100 text-green-700'}
                          `}>
                            {(budgetDetail.budget.percentage_used || 0) > 100 ? 'Critical' : 
                              (budgetDetail.budget.percentage_used || 0) > 90 ? 'Warning' : 
                              (budgetDetail.budget.percentage_used || 0) > 70 ? 'Good' :
                              'Excellent'}
                          </IOSBadge>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Burn Rate</span>
                          <IOSBadge className={`
                            ${(budgetDetail.budget.percentage_used || 0) / ((new Date().getTime() - new Date(budgetDetail.budget.start_date).getTime()) / (new Date(budgetDetail.budget.end_date).getTime() - new Date(budgetDetail.budget.start_date).getTime())) > 1.1 ? 'bg-red-100 text-red-700' : 
                              (budgetDetail.budget.percentage_used || 0) / ((new Date().getTime() - new Date(budgetDetail.budget.start_date).getTime()) / (new Date(budgetDetail.budget.end_date).getTime() - new Date(budgetDetail.budget.start_date).getTime())) > 1 ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-green-100 text-green-700'}
                          `}>
                            {(budgetDetail.budget.percentage_used || 0) / ((new Date().getTime() - new Date(budgetDetail.budget.start_date).getTime()) / (new Date(budgetDetail.budget.end_date).getTime() - new Date(budgetDetail.budget.start_date).getTime())) > 1.1 ? 'Too Fast' : 
                              (budgetDetail.budget.percentage_used || 0) / ((new Date().getTime() - new Date(budgetDetail.budget.start_date).getTime()) / (new Date(budgetDetail.budget.end_date).getTime() - new Date(budgetDetail.budget.start_date).getTime())) > 1 ? 'Slightly Fast' : 
                              (budgetDetail.budget.percentage_used || 0) / ((new Date().getTime() - new Date(budgetDetail.budget.start_date).getTime()) / (new Date(budgetDetail.budget.end_date).getTime() - new Date(budgetDetail.budget.start_date).getTime())) < 0.9 ? 'Underutilized' :
                              'On Track'}
                          </IOSBadge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <p className="text-sm text-gray-500">
                        For more detailed analysis and forecasting, please visit the Analytics and Forecast tabs on the Budget page.
                      </p>
                    </div>
                  </div>
                )}
              </ScrollArea>
              
              <DialogFooter className="gap-2 border-t pt-4">
                <div className="flex flex-1 justify-start">
                  {activeTab === 'details' && (
                    <IOSButton 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                      Delete
                    </IOSButton>
                  )}
                </div>
                <IOSButton 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </IOSButton>
                {activeTab === 'details' && (
                  <IOSButton 
                    onClick={() => setShowEditDialog(true)}
                    leftIcon={<Edit className="h-4 w-4" />}
                  >
                    Edit
                  </IOSButton>
                )}
              </DialogFooter>
            </>
          ) : (
            <div className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
              <p className="text-gray-500">Failed to load budget details</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Budget</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this budget? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-gray-500">
              Deleting this budget will remove all budget information, but it will not delete any linked expenses.
            </p>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <IOSButton
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </IOSButton>
            <IOSButton
              variant="destructive"
              onClick={handleDeleteBudget}
              disabled={isDeleting}
              leftIcon={isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            >
              {isDeleting ? 'Deleting...' : 'Delete Budget'}
            </IOSButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit budget dialog */}
      {budgetDetail?.budget && (
        <BudgetFormDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          budget={budgetDetail.budget}
          branchId={branchId}
          onSuccess={handleBudgetUpdated}
        />
      )}
      
      {/* Variance report dialog */}
      <Dialog open={showVarianceReport} onOpenChange={setShowVarianceReport}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Budget Variance Report</DialogTitle>
            <DialogDescription>
              Detailed analysis of budget variance
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-grow pr-4">
            {budgetDetail?.budget && (
              <BudgetVarianceReport
                budgetId={budgetDetail.budget.id}
                budgetName={budgetDetail.budget.name}
                branchId={branchId}
                fiscalYear={budgetDetail.budget.fiscal_year}
              />
            )}
          </ScrollArea>
          
          <DialogFooter>
            <IOSButton
              variant="outline"
              onClick={() => setShowVarianceReport(false)}
            >
              Close
            </IOSButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
