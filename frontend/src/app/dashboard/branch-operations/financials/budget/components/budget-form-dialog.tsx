'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { budgetAPI, Budget } from '@/lib/api/budget';
import { format } from 'date-fns';

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget?: Budget; // For edit mode
  branchId?: number;
  onSuccess: () => void;
}

export function BudgetFormDialog({ 
  open, 
  onOpenChange, 
  budget, 
  branchId,
  onSuccess 
}: BudgetFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'operations',
    period: 'monthly',
    allocated_amount: 0,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(new Date().setMonth(new Date().getMonth() + 1)), 'yyyy-MM-dd'),
    fiscal_year: new Date().getFullYear().toString(),
    fiscal_month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    description: ''
  });

  // Set form data when editing an existing budget
  useEffect(() => {
    if (budget) {
      setFormData({
        name: budget.name || '',
        category: budget.category || 'operations',
        period: budget.period || 'monthly',
        allocated_amount: budget.allocated_amount || 0,
        start_date: budget.start_date ? format(new Date(budget.start_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        end_date: budget.end_date ? format(new Date(budget.end_date), 'yyyy-MM-dd') : format(new Date(new Date().setMonth(new Date().getMonth() + 1)), 'yyyy-MM-dd'),
        fiscal_year: budget.fiscal_year || new Date().getFullYear().toString(),
        fiscal_month: budget.fiscal_month || (new Date().getMonth() + 1).toString().padStart(2, '0'),
        description: budget.description || ''
      });
    } else {
      // Reset form for new budget
      setFormData({
        name: '',
        category: 'operations',
        period: 'monthly',
        allocated_amount: 0,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: format(new Date(new Date().setMonth(new Date().getMonth() + 1)), 'yyyy-MM-dd'),
        fiscal_year: new Date().getFullYear().toString(),
        fiscal_month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
        description: ''
      });
    }
  }, [budget, open]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: parseFloat(value) || 0
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name) {
      toast.error('Budget name is required');
      return;
    }
    
    if (formData.allocated_amount <= 0) {
      toast.error('Allocated amount must be greater than zero');
      return;
    }
    
    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    
    if (endDate <= startDate) {
      toast.error('End date must be after start date');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      let response;
      
      if (budget) {
        // Update existing budget
        response = await budgetAPI.updateBudget(budget.id, formData, branchId);
      } else {
        // Create new budget
        response = await budgetAPI.createBudget(formData, branchId);
      }
      
      if (response.success) {
        toast.success(budget ? 'Budget updated successfully' : 'Budget created successfully');
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(response.message || 'Failed to save budget');
      }
    } catch (error) {
      console.error('Error saving budget:', error);
      toast.error('An error occurred while saving the budget');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set end date based on period
  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const period = e.target.value;
    const startDate = new Date(formData.start_date);
    let endDate = new Date(startDate);
    
    if (period === 'monthly') {
      endDate.setMonth(startDate.getMonth() + 1);
      endDate.setDate(endDate.getDate() - 1);
    } else if (period === 'quarterly') {
      endDate.setMonth(startDate.getMonth() + 3);
      endDate.setDate(endDate.getDate() - 1);
    } else if (period === 'yearly') {
      endDate.setFullYear(startDate.getFullYear() + 1);
      endDate.setDate(endDate.getDate() - 1);
    }
    
    setFormData({
      ...formData,
      period,
      end_date: format(endDate, 'yyyy-MM-dd')
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? 'Edit Budget' : 'Create New Budget'}</DialogTitle>
          <DialogDescription>
            {budget 
              ? 'Update the budget details below' 
              : 'Enter the details for the new budget allocation'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-1">Budget Name *</label>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Q4 Marketing Budget"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                required
              >
                <option value="operations">Operations</option>
                <option value="marketing">Marketing</option>
                <option value="maintenance">Maintenance</option>
                <option value="supplies">Supplies</option>
                <option value="utilities">Utilities</option>
                <option value="salaries">Salaries</option>
                <option value="taxes">Taxes</option>
                <option value="insurance">Insurance</option>
                <option value="rent">Rent</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Period *</label>
              <select
                name="period"
                value={formData.period}
                onChange={handlePeriodChange}
                className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                required
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Allocated Amount (KES) *</label>
            <Input
              name="allocated_amount"
              type="number"
              min="0"
              step="1000"
              value={formData.allocated_amount}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date *</label>
              <Input
                name="start_date"
                type="date"
                value={formData.start_date}
                onChange={handleChange}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">End Date *</label>
              <Input
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Fiscal Year *</label>
              <Input
                name="fiscal_year"
                value={formData.fiscal_year}
                onChange={handleChange}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Fiscal Month</label>
              <select
                name="fiscal_month"
                value={formData.fiscal_month}
                onChange={handleChange}
                className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
              >
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full h-24 px-3 py-2 rounded-ios-lg border border-gray-200 resize-none"
              placeholder="Add additional details about this budget allocation"
            />
          </div>
        </form>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <IOSButton 
            variant="secondary" 
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </IOSButton>
          <IOSButton 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : budget ? 'Update Budget' : 'Create Budget'}
          </IOSButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
