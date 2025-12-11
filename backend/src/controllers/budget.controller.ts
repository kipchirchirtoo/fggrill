import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Get all budgets for a branch
// @route   GET /api/branch-operations/finances/budgets
// @access  Private (Branch Manager, Finance)
export const getBranchBudgets = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.headers['x-branch-id'] || req.query.branch_id;
    
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }
    
    const { category, period, status, fiscal_year } = req.query;
    
    // Build the query
    let query = supabase
      .from('budget_analysis')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    
    // Apply filters if provided
    if (category) {
      query = query.eq('category', category);
    }
    
    if (period) {
      query = query.eq('period', period);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (fiscal_year) {
      query = query.eq('fiscal_year', fiscal_year);
    }
    
    const { data, error } = await query;
    
    if (error) {
      res.status(500).json({ success: false, message: `Error fetching budgets: ${error.message}` });
      return;
    }
    
    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

// @desc    Get a single budget by ID
// @route   GET /api/branch-operations/finances/budgets/:id
// @access  Private (Branch Manager, Finance)
export const getBudgetById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.headers['x-branch-id'] || req.query.branch_id;
    
    // Get budget details
    const { data: budget, error: budgetError } = await supabase
      .from('budget_analysis')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    
    if (budgetError) {
      res.status(500).json({ success: false, message: `Error fetching budget: ${budgetError.message}` });
      return;
    }
    
    if (!budget) {
      res.status(404).json({ success: false, message: 'Budget not found' });
      return;
    }
    
    // Get associated expenses
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select(`
        id, 
        reference, 
        description, 
        amount, 
        category, 
        payment_method, 
        date, 
        status, 
        created_by, 
        approved_by,
        budget_expenses!inner(amount)
      `)
      .eq('budget_expenses.budget_id', id);
    
    if (expensesError) {
      logger.error(`Error fetching budget expenses: ${expensesError.message}`);
    }
    
    // Get adjustment history
    const { data: adjustments, error: adjustmentsError } = await supabase
      .from('budget_adjustments')
      .select(`
        id,
        previous_amount,
        new_amount,
        adjustment_amount,
        reason,
        adjusted_by,
        approved_by,
        created_at,
        users!adjusted_by(name)
      `)
      .eq('budget_id', id)
      .order('created_at', { ascending: false });
    
    if (adjustmentsError) {
      logger.error(`Error fetching budget adjustments: ${adjustmentsError.message}`);
    }
    
    res.status(200).json({
      success: true,
      data: {
        budget,
        expenses: expenses || [],
        adjustments: adjustments || []
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

// @desc    Create a new budget
// @route   POST /api/branch-operations/finances/budgets
// @access  Private (Finance Manager)
export const createBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      category,
      period,
      allocated_amount,
      start_date,
      end_date,
      fiscal_year,
      fiscal_month,
      description
    } = req.body;
    
    const branchId = req.headers['x-branch-id'] || req.body.branch_id;
    const departmentId = req.body.department_id;
    const userId = req.user?.id;
    
    // Validate required fields
    if (!name || !category || !period || !allocated_amount || !start_date || !end_date || !fiscal_year) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }
    
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }
    
    // Create new budget
    const budgetData = {
      branch_id: branchId,
      department_id: departmentId,
      name,
      category,
      period,
      allocated_amount,
      start_date,
      end_date,
      fiscal_year,
      fiscal_month,
      description,
      status: 'active',
      created_by: userId
    };
    
    const { data, error } = await supabase
      .from('budgets')
      .insert(budgetData)
      .select()
      .single();
    
    if (error) {
      res.status(500).json({ success: false, message: `Error creating budget: ${error.message}` });
      return;
    }
    
    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

// @desc    Update a budget
// @route   PUT /api/branch-operations/finances/budgets/:id
// @access  Private (Finance Manager)
export const updateBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.headers['x-branch-id'] || req.body.branch_id;
    const userId = req.user?.id;
    
    // Check if budget exists and belongs to the branch
    const { data: existingBudget, error: fetchError } = await supabase
      .from('budgets')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    
    if (fetchError || !existingBudget) {
      res.status(404).json({ success: false, message: 'Budget not found or access denied' });
      return;
    }
    
    const {
      name,
      category,
      period,
      allocated_amount,
      start_date,
      end_date,
      fiscal_year,
      fiscal_month,
      description,
      status
    } = req.body;
    
    // Prepare update data
    const updateData: any = {};
    
    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (period) updateData.period = period;
    if (start_date) updateData.start_date = start_date;
    if (end_date) updateData.end_date = end_date;
    if (fiscal_year) updateData.fiscal_year = fiscal_year;
    if (fiscal_month) updateData.fiscal_month = fiscal_month;
    if (description) updateData.description = description;
    if (status) updateData.status = status;
    
    updateData.updated_at = new Date().toISOString();
    
    // If amount is changed, create an adjustment record
    if (allocated_amount && allocated_amount !== existingBudget.allocated_amount) {
      // Create adjustment record
      const adjustmentData = {
        budget_id: id,
        previous_amount: existingBudget.allocated_amount,
        new_amount: allocated_amount,
        adjustment_amount: allocated_amount - existingBudget.allocated_amount,
        reason: req.body.adjustment_reason || 'Budget adjustment',
        adjusted_by: userId
      };
      
      const { error: adjustmentError } = await supabase
        .from('budget_adjustments')
        .insert(adjustmentData);
      
      if (adjustmentError) {
        logger.error(`Error recording budget adjustment: ${adjustmentError.message}`);
      }
      
      updateData.allocated_amount = allocated_amount;
    }
    
    // Update the budget
    const { data, error } = await supabase
      .from('budgets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      res.status(500).json({ success: false, message: `Error updating budget: ${error.message}` });
      return;
    }
    
    res.status(200).json({
      success: true,
      message: 'Budget updated successfully',
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

// @desc    Delete a budget
// @route   DELETE /api/branch-operations/finances/budgets/:id
// @access  Private (Finance Manager)
export const deleteBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const branchId = req.headers['x-branch-id'] || req.query.branch_id;
    
    // Check if budget exists and belongs to the branch
    const { data: existingBudget, error: fetchError } = await supabase
      .from('budgets')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    
    if (fetchError || !existingBudget) {
      res.status(404).json({ success: false, message: 'Budget not found or access denied' });
      return;
    }
    
    // Check if budget has expenses linked to it
    const { data: linkedExpenses, error: expenseError } = await supabase
      .from('budget_expenses')
      .select('id')
      .eq('budget_id', id);
    
    if (expenseError) {
      logger.error(`Error checking budget expenses: ${expenseError.message}`);
    }
    
    if (linkedExpenses && linkedExpenses.length > 0) {
      res.status(400).json({ success: false, message: 'Cannot delete budget with linked expenses' });
      return;
    }
    
    // Delete the budget
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);
    
    if (error) {
      res.status(500).json({ success: false, message: `Error deleting budget: ${error.message}` });
      return;
    }
    
    res.status(200).json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

// @desc    Link expense to budget
// @route   POST /api/branch-operations/finances/budgets/:id/expenses
// @access  Private (Finance Manager)
export const linkExpenseToBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: budgetId } = req.params;
    const { expense_id, amount } = req.body;
    
    if (!expense_id || !amount) {
      res.status(400).json({ success: false, message: 'Expense ID and amount are required' });
      return;
    }
    
    // Check if budget exists
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select('*')
      .eq('id', budgetId)
      .single();
    
    if (budgetError || !budget) {
      res.status(404).json({ success: false, message: 'Budget not found' });
      return;
    }
    
    // Check if expense exists
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expense_id)
      .single();
    
    if (expenseError || !expense) {
      res.status(404).json({ success: false, message: 'Expense not found' });
      return;
    }
    
    // Link expense to budget
    const { data, error } = await supabase
      .from('budget_expenses')
      .insert({
        budget_id: budgetId,
        expense_id,
        amount
      })
      .select()
      .single();
    
    if (error) {
      if (error.message.includes('unique constraint')) {
        res.status(400).json({ success: false, message: 'Expense is already linked to this budget' });
      return;
      }
      res.status(500).json({ success: false, message: `Error linking expense to budget: ${error.message}` });
      return;
    }
    
    res.status(201).json({
      success: true,
      message: 'Expense linked to budget successfully',
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

// @desc    Get budget summary
// @route   GET /api/branch-operations/finances/budget-summary
// @access  Private (Branch Manager, Finance)
export const getBudgetSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.headers['x-branch-id'] || req.query.branch_id;
    const fiscalYear = req.query.fiscal_year || new Date().getFullYear().toString();
    
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }
    
    // Get budget summary
    const { data, error } = await supabase
      .from('budget_analysis')
      .select('*')
      .eq('branch_id', branchId)
      .eq('fiscal_year', fiscalYear)
      .order('created_at', { ascending: false });
    
    if (error) {
      res.status(500).json({ success: false, message: `Error fetching budget summary: ${error.message}` });
      return;
    }
    
    // Calculate aggregated metrics
    let totalAllocated = 0;
    let totalSpent = 0;
    let categoryTotals: Record<string, { allocated: number, spent: number }> = {};
    
    data?.forEach(budget => {
      totalAllocated += budget.allocated_amount || 0;
      totalSpent += budget.spent_amount || 0;
      
      const category = budget.category || 'other';
      if (!categoryTotals[category]) {
        categoryTotals[category] = { allocated: 0, spent: 0 };
      }
      
      categoryTotals[category].allocated += budget.allocated_amount || 0;
      categoryTotals[category].spent += budget.spent_amount || 0;
    });
    
    const categoryBreakdown = Object.entries(categoryTotals).map(([category, values]) => ({
      category,
      allocated: values.allocated,
      spent: values.spent,
      remaining: values.allocated - values.spent,
      percentage: values.allocated > 0 ? (values.spent / values.allocated) * 100 : 0
    }));
    
    res.status(200).json({
      success: true,
      data: {
        total_allocated: totalAllocated,
        total_spent: totalSpent,
        total_remaining: totalAllocated - totalSpent,
        usage_percentage: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
        category_breakdown: categoryBreakdown,
        budgets: data || []
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};

// @desc    Get budget vs actuals analysis
// @route   GET /api/branch-operations/finances/budget-analysis
// @access  Private (Branch Manager, Finance)
export const getBudgetAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.headers['x-branch-id'] || req.query.branch_id;
    const { period, fiscal_year, fiscal_month } = req.query;
    
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }
    
    // Build the query
    let query = supabase
      .from('budget_analysis')
      .select('*')
      .eq('branch_id', branchId);
    
    // Apply filters
    if (period) {
      query = query.eq('period', period);
    }
    
    if (fiscal_year) {
      query = query.eq('fiscal_year', fiscal_year);
    }
    
    if (fiscal_month) {
      query = query.eq('fiscal_month', fiscal_month);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      res.status(500).json({ success: false, message: `Error fetching budget analysis: ${error.message}` });
      return;
    }
    
    // Format data for visualization
    const analysisData = data?.map(budget => ({
      id: budget.id,
      name: budget.name,
      category: budget.category,
      allocated: budget.allocated_amount,
      spent: budget.spent_amount,
      remaining: budget.remaining_amount,
      percentage_used: budget.percentage_used,
      budget_status: budget.budget_status,
      start_date: budget.start_date,
      end_date: budget.end_date,
      period: budget.period,
      fiscal_year: budget.fiscal_year,
      fiscal_month: budget.fiscal_month
    }));
    
    res.status(200).json({
      success: true,
      count: analysisData?.length || 0,
      data: analysisData
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};
