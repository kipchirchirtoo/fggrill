import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Get all transactions
// @route   GET /api/finance/transactions
// @access  Private (Finance Staff)
export const getTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const startIndex = (page - 1) * limit;

    let query = supabase
      .from('finance_transactions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    // Add filters
    if (req.query.type) {
      query = query.eq('transaction_type', req.query.type);
    }
    if (req.query.category) {
      query = query.eq('category', req.query.category);
    }
    if (req.query.startDate) {
      query = query.gte('created_at', req.query.startDate);
    }
    if (req.query.endDate) {
      query = query.lte('created_at', req.query.endDate);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      count: transactions.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create transaction
// @route   POST /api/finance/transactions
// @access  Private (Finance Staff)
export const createTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      transactionType,
      amount,
      description,
      category,
      referenceType,
      referenceId,
      paymentMethod,
      paymentReference,
      notes
    } = req.body;

    // Generate transaction number
    const { data: transactionNumber } = await supabase
      .rpc('generate_transaction_number');

    // Create transaction
    const { data: transaction, error } = await supabase
      .from('finance_transactions')
      .insert([{
        transaction_number: transactionNumber,
        transaction_type: transactionType,
        amount,
        description,
        category,
        reference_type: referenceType,
        reference_id: referenceId,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        notes,
        created_by: req.user?.id,
        payment_date: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      data: transaction
    });

    logger.info(`New transaction created: ${transactionNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all invoices
// @route   GET /api/finance/invoices
// @access  Private
export const getInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const startIndex = (page - 1) * limit;

    let query = supabase
      .from('finance_invoices')
      .select(`
        *,
        guest:users!guest_id(*),
        items:finance_invoice_items(*)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    // Add filters
    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }
    if (req.query.guest) {
      query = query.eq('guest_id', req.query.guest);
    }

    const { data: invoices, error, count } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      count: invoices.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: invoices
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create invoice
// @route   POST /api/finance/invoices
// @access  Private (Finance Staff)
export const createInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      guestId,
      bookingId,
      totalAmount,
      dueDate,
      notes,
      items
    } = req.body;

    // Generate invoice number
    const { data: invoiceNumber } = await supabase
      .rpc('generate_invoice_number');

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('finance_invoices')
      .insert([{
        invoice_number: invoiceNumber,
        guest_id: guestId,
        booking_id: bookingId,
        total_amount: totalAmount,
        due_date: dueDate,
        notes,
        created_by: req.user?.id
      }])
      .select()
      .single();

    if (invoiceError || !invoice) {
      throw invoiceError || new Error('Failed to create invoice');
    }

    // Create invoice items
    const { error: itemsError } = await supabase
      .from('finance_invoice_items')
      .insert(
        items.map((item: any) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice
        }))
      );

    if (itemsError) {
      throw itemsError;
    }

    // Get updated invoice with items
    const { data: updatedInvoice, error: getError } = await supabase
      .from('finance_invoices')
      .select(`
        *,
        items:finance_invoice_items(*)
      `)
      .eq('id', invoice.id)
      .single();

    if (getError) {
      throw getError;
    }

    res.status(201).json({
      success: true,
      data: updatedInvoice
    });

    logger.info(`New invoice created: ${invoiceNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Process payment
// @route   POST /api/finance/payments
// @access  Private (Finance Staff)
export const processPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      invoiceId,
      bookingId,
      amount,
      paymentMethod,
      paymentReference,
      notes
    } = req.body;

    // Generate payment number
    const { data: paymentNumber } = await supabase
      .rpc('generate_payment_number');

    // Create payment
    const { data: payment, error: paymentError } = await supabase
      .from('finance_payments')
      .insert([{
        payment_number: paymentNumber,
        invoice_id: invoiceId,
        booking_id: bookingId,
        amount,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        notes,
        created_by: req.user?.id,
        status: 'completed',
        processed_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (paymentError) {
      throw paymentError;
    }

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('finance_transactions')
      .insert([{
        transaction_number: await supabase.rpc('generate_transaction_number'),
        transaction_type: 'income',
        amount,
        description: `Payment received - ${paymentNumber}`,
        reference_type: invoiceId ? 'invoice' : 'booking',
        reference_id: invoiceId || bookingId,
        payment_method: paymentMethod,
        payment_status: 'completed',
        payment_reference: paymentReference,
        notes,
        created_by: req.user?.id,
        payment_date: new Date().toISOString()
      }]);

    if (transactionError) {
      throw transactionError;
    }

    res.status(201).json({
      success: true,
      data: payment
    });

    logger.info(`Payment processed: ${paymentNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get financial overview
// @route   GET /api/finance/overview
// @access  Private (Finance Staff)
export const getFinancialOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get total revenue
    const { data: revenue } = await supabase
      .from('finance_transactions')
      .select('amount')
      .eq('transaction_type', 'income')
      .eq('payment_status', 'completed');

    // Get total expenses
    const { data: expenses } = await supabase
      .from('finance_transactions')
      .select('amount')
      .eq('transaction_type', 'expense')
      .eq('payment_status', 'completed');

    // Get revenue by category
    const { data: revenueBySource } = await supabase
      .from('finance_transactions')
      .select('reference_type, amount')
      .eq('transaction_type', 'income')
      .eq('payment_status', 'completed');

    // Get expenses by category
    const { data: expensesByCategory } = await supabase
      .from('finance_transactions')
      .select('category, amount')
      .eq('transaction_type', 'expense')
      .eq('payment_status', 'completed');

    // Calculate totals
    const totalRevenue = revenue?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Group revenue by source
    const revenueBreakdown = revenueBySource?.reduce((acc: any, item) => {
      const source = item.reference_type || 'other';
      acc[source] = (acc[source] || 0) + Number(item.amount);
      return acc;
    }, {});

    // Group expenses by category
    const expenseBreakdown = expensesByCategory?.reduce((acc: any, item) => {
      const category = item.category || 'other';
      acc[category] = (acc[category] || 0) + Number(item.amount);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        revenueBreakdown,
        expenseBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// BUDGETS
// =====================================================

// @desc    Get budgets
// @route   GET /api/finance/budgets
// @access  Private
export const getBudgets = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { fiscal_year, branch_id, department_id } = req.query;

    let query = supabase
      .from('budgets')
      .select(`
        *,
        branch:branches(id, name),
        department:departments(id, name)
      `)
      .order('fiscal_year', { ascending: false });

    if (fiscal_year) {
      query = query.eq('fiscal_year', fiscal_year);
    }

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (department_id) {
      query = query.eq('department_id', department_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create/Update budget
// @route   POST /api/finance/budgets
// @access  Private (Finance Manager)
export const createBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, department_id, category, fiscal_year, fiscal_month, allocated_amount } = req.body;

    const budget = {
      branch_id,
      department_id,
      category,
      fiscal_year,
      fiscal_month,
      allocated_amount,
      updated_at: new Date().toISOString()
    };

    // Upsert budget
    const { data, error } = await supabase
      .from('budgets')
      .upsert(budget, { onConflict: 'branch_id,department_id,category,fiscal_year,fiscal_month' })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Budget set for ${category} (${fiscal_year}) by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// OPERATIONAL EXPENSES
// =====================================================

// @desc    Get operational expenses
// @route   GET /api/finance/expenses
// @access  Private
export const getExpenses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, branch_id, department_id, startDate, endDate } = req.query;

    let query = supabase
      .from('expenses')
      .select(`
        *,
        branch:branches(id, name),
        department:departments(id, name),
        created_by:users!created_by(id, full_name),
        approved_by:users!approved_by(id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (department_id) {
      query = query.eq('department_id', department_id);
    }

    if (startDate) {
      query = query.gte('expense_date', startDate);
    }

    if (endDate) {
      query = query.lte('expense_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: data?.length || 0,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create expense request
// @route   POST /api/finance/expenses
// @access  Private
export const createExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, department_id, category, amount, description, expense_date } = req.body;

    const expense = {
      branch_id,
      department_id,
      category,
      amount,
      description,
      expense_date: expense_date || new Date().toISOString(),
      created_by: req.user.id,
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('expenses')
      .insert([expense])
      .select()
      .single();

    if (error) throw error;

    logger.info(`Expense request created: ${amount} for ${category} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve expense
// @route   PUT /api/finance/expenses/:id/approve
// @access  Private (Manager)
export const approveExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Expense approved: ${data.id} by user ${req.user.id}`);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// ============== ADVANCED FINANCIAL TOOLS ==============

// @desc    Get Cash Flow Report
// @route   GET /api/finance/cashflow
// @access  Private (Finance Staff)
export const getCashFlowReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate, branch_id } = req.query;
    const start = startDate as string || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString();
    const end = endDate as string || new Date().toISOString();

    // Get income transactions
    let incomeQuery = supabase
      .from('finance_transactions')
      .select('amount, category, created_at, payment_method')
      .eq('transaction_type', 'INCOME')
      .gte('created_at', start)
      .lte('created_at', end);

    // Get expense transactions
    let expenseQuery = supabase
      .from('finance_transactions')
      .select('amount, category, created_at, payment_method')
      .eq('transaction_type', 'EXPENSE')
      .gte('created_at', start)
      .lte('created_at', end);

    if (branch_id) {
      incomeQuery = incomeQuery.eq('branch_id', branch_id);
      expenseQuery = expenseQuery.eq('branch_id', branch_id);
    }

    const [incomeRes, expenseRes] = await Promise.all([incomeQuery, expenseQuery]);

    const income = incomeRes.data || [];
    const expenses = expenseRes.data || [];

    const totalIncome = income.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + (t.amount || 0), 0);
    const netCashFlow = totalIncome - totalExpenses;

    // Group by category
    const incomeByCategory: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};

    income.forEach(t => {
      incomeByCategory[t.category || 'Other'] = (incomeByCategory[t.category || 'Other'] || 0) + t.amount;
    });

    expenses.forEach(t => {
      expensesByCategory[t.category || 'Other'] = (expensesByCategory[t.category || 'Other'] || 0) + t.amount;
    });

    // Daily cash flow
    const dailyCashFlow: Record<string, { income: number; expenses: number; net: number }> = {};
    
    income.forEach(t => {
      const date = t.created_at.split('T')[0];
      if (!dailyCashFlow[date]) dailyCashFlow[date] = { income: 0, expenses: 0, net: 0 };
      dailyCashFlow[date].income += t.amount;
      dailyCashFlow[date].net += t.amount;
    });

    expenses.forEach(t => {
      const date = t.created_at.split('T')[0];
      if (!dailyCashFlow[date]) dailyCashFlow[date] = { income: 0, expenses: 0, net: 0 };
      dailyCashFlow[date].expenses += t.amount;
      dailyCashFlow[date].net -= t.amount;
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalIncome,
          totalExpenses,
          netCashFlow,
          profitMargin: totalIncome > 0 ? ((netCashFlow / totalIncome) * 100).toFixed(2) : 0
        },
        incomeByCategory,
        expensesByCategory,
        dailyCashFlow: Object.entries(dailyCashFlow).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)),
        period: { start, end }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Profit & Loss Statement
// @route   GET /api/finance/profit-loss
// @access  Private (Finance Staff)
export const getProfitLossStatement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate, branch_id } = req.query;
    const start = startDate as string || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString();
    const end = endDate as string || new Date().toISOString();

    // Revenue categories
    const revenueCategories = ['ROOM_REVENUE', 'FOOD_BEVERAGE', 'SERVICES', 'OTHER_INCOME'];
    const expenseCategories = ['SALARIES', 'UTILITIES', 'SUPPLIES', 'MAINTENANCE', 'MARKETING', 'ADMIN', 'OTHER_EXPENSE'];

    let revenueQuery = supabase
      .from('finance_transactions')
      .select('amount, category')
      .eq('transaction_type', 'INCOME')
      .gte('created_at', start)
      .lte('created_at', end);

    let expenseQuery = supabase
      .from('finance_transactions')
      .select('amount, category')
      .eq('transaction_type', 'EXPENSE')
      .gte('created_at', start)
      .lte('created_at', end);

    if (branch_id) {
      revenueQuery = revenueQuery.eq('branch_id', branch_id);
      expenseQuery = expenseQuery.eq('branch_id', branch_id);
    }

    const [revenueRes, expenseRes] = await Promise.all([revenueQuery, expenseQuery]);

    const revenues = revenueRes.data || [];
    const expenses = expenseRes.data || [];

    // Calculate revenue breakdown
    const revenueBreakdown: Record<string, number> = {};
    let totalRevenue = 0;
    revenues.forEach(t => {
      const cat = t.category || 'OTHER_INCOME';
      revenueBreakdown[cat] = (revenueBreakdown[cat] || 0) + t.amount;
      totalRevenue += t.amount;
    });

    // Calculate expense breakdown
    const expenseBreakdown: Record<string, number> = {};
    let totalExpenses = 0;
    expenses.forEach(t => {
      const cat = t.category || 'OTHER_EXPENSE';
      expenseBreakdown[cat] = (expenseBreakdown[cat] || 0) + t.amount;
      totalExpenses += t.amount;
    });

    const grossProfit = totalRevenue;
    const operatingExpenses = totalExpenses;
    const netProfit = grossProfit - operatingExpenses;

    res.status(200).json({
      success: true,
      data: {
        revenue: {
          breakdown: revenueBreakdown,
          total: totalRevenue
        },
        expenses: {
          breakdown: expenseBreakdown,
          total: totalExpenses
        },
        grossProfit,
        operatingExpenses,
        netProfit,
        profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0,
        period: { start, end }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Revenue by Branch
// @route   GET /api/finance/revenue-by-branch
// @access  Private (Finance Staff)
export const getRevenueByBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate as string || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString();
    const end = endDate as string || new Date().toISOString();

    // Get all branches
    const { data: branches } = await supabase.from('branches').select('id, name, code');

    // Get transactions grouped by branch
    const { data: transactions } = await supabase
      .from('finance_transactions')
      .select('amount, transaction_type, branch_id')
      .gte('created_at', start)
      .lte('created_at', end);

    const branchData: Record<string, { income: number; expenses: number; net: number; name: string; code: string }> = {};

    branches?.forEach(b => {
      branchData[b.id] = { income: 0, expenses: 0, net: 0, name: b.name, code: b.code };
    });

    transactions?.forEach(t => {
      if (t.branch_id && branchData[t.branch_id]) {
        if (t.transaction_type === 'INCOME') {
          branchData[t.branch_id].income += t.amount;
          branchData[t.branch_id].net += t.amount;
        } else {
          branchData[t.branch_id].expenses += t.amount;
          branchData[t.branch_id].net -= t.amount;
        }
      }
    });

    const branchRevenue = Object.entries(branchData).map(([id, data]) => ({
      branch_id: id,
      ...data
    })).sort((a, b) => b.income - a.income);

    const totals = branchRevenue.reduce((acc, b) => ({
      income: acc.income + b.income,
      expenses: acc.expenses + b.expenses,
      net: acc.net + b.net
    }), { income: 0, expenses: 0, net: 0 });

    res.status(200).json({
      success: true,
      data: {
        branches: branchRevenue,
        totals,
        period: { start, end }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Budget vs Actual Report
// @route   GET /api/finance/budget-analysis
// @access  Private (Finance Staff)
export const getBudgetAnalysis = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { year, month, branch_id } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || new Date().getMonth() + 1;

    // Get budgets
    let budgetQuery = supabase
      .from('budgets')
      .select('*')
      .eq('year', currentYear)
      .eq('month', currentMonth);

    if (branch_id) {
      budgetQuery = budgetQuery.eq('branch_id', branch_id);
    }

    const { data: budgets } = await budgetQuery;

    // Get actual expenses for the period
    const startDate = new Date(Number(currentYear), Number(currentMonth) - 1, 1).toISOString();
    const endDate = new Date(Number(currentYear), Number(currentMonth), 0).toISOString();

    let expenseQuery = supabase
      .from('finance_transactions')
      .select('amount, category')
      .eq('transaction_type', 'EXPENSE')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (branch_id) {
      expenseQuery = expenseQuery.eq('branch_id', branch_id);
    }

    const { data: expenses } = await expenseQuery;

    // Calculate actuals by category
    const actualsByCategory: Record<string, number> = {};
    expenses?.forEach(e => {
      actualsByCategory[e.category || 'Other'] = (actualsByCategory[e.category || 'Other'] || 0) + e.amount;
    });

    // Compare budget vs actual
    const analysis = budgets?.map(b => {
      const actual = actualsByCategory[b.category] || 0;
      const variance = b.amount - actual;
      const variancePercent = b.amount > 0 ? ((variance / b.amount) * 100).toFixed(2) : 0;
      return {
        category: b.category,
        budgeted: b.amount,
        actual,
        variance,
        variancePercent,
        status: variance >= 0 ? 'UNDER_BUDGET' : 'OVER_BUDGET'
      };
    }) || [];

    const totals = analysis.reduce((acc, a) => ({
      budgeted: acc.budgeted + a.budgeted,
      actual: acc.actual + a.actual,
      variance: acc.variance + a.variance
    }), { budgeted: 0, actual: 0, variance: 0 });

    res.status(200).json({
      success: true,
      data: {
        analysis,
        totals: {
          ...totals,
          variancePercent: totals.budgeted > 0 ? ((totals.variance / totals.budgeted) * 100).toFixed(2) : 0,
          status: totals.variance >= 0 ? 'UNDER_BUDGET' : 'OVER_BUDGET'
        },
        period: { year: currentYear, month: currentMonth }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Tax Summary
// @route   GET /api/finance/tax-summary
// @access  Private (Finance Staff)
export const getTaxSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate as string || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = endDate as string || new Date().toISOString();

    // Get all income
    const { data: income } = await supabase
      .from('finance_transactions')
      .select('amount, category')
      .eq('transaction_type', 'INCOME')
      .gte('created_at', start)
      .lte('created_at', end);

    // Get all expenses
    const { data: expenses } = await supabase
      .from('finance_transactions')
      .select('amount, category')
      .eq('transaction_type', 'EXPENSE')
      .gte('created_at', start)
      .lte('created_at', end);

    const totalIncome = income?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const totalExpenses = expenses?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const taxableIncome = totalIncome - totalExpenses;

    // Kenya tax rates (simplified)
    const vatRate = 0.16; // 16% VAT
    const corporateTaxRate = 0.30; // 30% corporate tax

    const estimatedVAT = totalIncome * vatRate;
    const estimatedCorporateTax = taxableIncome > 0 ? taxableIncome * corporateTaxRate : 0;

    res.status(200).json({
      success: true,
      data: {
        grossIncome: totalIncome,
        deductibleExpenses: totalExpenses,
        taxableIncome,
        taxes: {
          vat: {
            rate: vatRate * 100,
            estimated: estimatedVAT.toFixed(2)
          },
          corporateTax: {
            rate: corporateTaxRate * 100,
            estimated: estimatedCorporateTax.toFixed(2)
          },
          totalEstimated: (estimatedVAT + estimatedCorporateTax).toFixed(2)
        },
        period: { start, end }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Financial Forecast
// @route   GET /api/finance/forecast
// @access  Private (Finance Staff)
export const getFinancialForecast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { months = 3 } = req.query;
    const forecastMonths = Number(months);

    // Get last 6 months of data for trend analysis
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: historicalData } = await supabase
      .from('finance_transactions')
      .select('amount, transaction_type, created_at')
      .gte('created_at', sixMonthsAgo.toISOString());

    // Group by month
    const monthlyData: Record<string, { income: number; expenses: number }> = {};
    
    historicalData?.forEach(t => {
      const month = t.created_at.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0 };
      if (t.transaction_type === 'INCOME') {
        monthlyData[month].income += t.amount;
      } else {
        monthlyData[month].expenses += t.amount;
      }
    });

    const months_data = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0]));
    
    // Calculate averages for forecasting
    const avgIncome = months_data.reduce((sum, [_, d]) => sum + d.income, 0) / Math.max(months_data.length, 1);
    const avgExpenses = months_data.reduce((sum, [_, d]) => sum + d.expenses, 0) / Math.max(months_data.length, 1);

    // Simple growth rate calculation
    let incomeGrowth = 0;
    let expenseGrowth = 0;
    if (months_data.length >= 2) {
      const first = months_data[0][1];
      const last = months_data[months_data.length - 1][1];
      incomeGrowth = first.income > 0 ? (last.income - first.income) / first.income / months_data.length : 0;
      expenseGrowth = first.expenses > 0 ? (last.expenses - first.expenses) / first.expenses / months_data.length : 0;
    }

    // Generate forecast
    const forecast = [];
    let currentIncome = avgIncome;
    let currentExpenses = avgExpenses;
    const today = new Date();

    for (let i = 1; i <= forecastMonths; i++) {
      const forecastDate = new Date(today);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      const monthStr = forecastDate.toISOString().substring(0, 7);

      currentIncome = currentIncome * (1 + incomeGrowth);
      currentExpenses = currentExpenses * (1 + expenseGrowth);

      forecast.push({
        month: monthStr,
        projectedIncome: Math.round(currentIncome),
        projectedExpenses: Math.round(currentExpenses),
        projectedNet: Math.round(currentIncome - currentExpenses)
      });
    }

    res.status(200).json({
      success: true,
      data: {
        historical: months_data.map(([month, data]) => ({
          month,
          income: data.income,
          expenses: data.expenses,
          net: data.income - data.expenses
        })),
        forecast,
        trends: {
          avgMonthlyIncome: Math.round(avgIncome),
          avgMonthlyExpenses: Math.round(avgExpenses),
          incomeGrowthRate: (incomeGrowth * 100).toFixed(2),
          expenseGrowthRate: (expenseGrowth * 100).toFixed(2)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Accounts Receivable/Payable Summary
// @route   GET /api/finance/ar-ap
// @access  Private (Finance Staff)
export const getAccountsReceivablePayable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get unpaid invoices (Accounts Receivable)
    const { data: unpaidInvoices } = await supabase
      .from('finance_invoices')
      .select('id, invoice_number, guest_id, total_amount, amount_paid, due_date, status')
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE']);

    // Get pending supplier payments (Accounts Payable)
    const { data: pendingPayments } = await supabase
      .from('expenses')
      .select('id, description, amount, expense_date, status')
      .eq('status', 'approved');

    const totalReceivable = unpaidInvoices?.reduce((sum, inv) => sum + (inv.total_amount - (inv.amount_paid || 0)), 0) || 0;
    const totalPayable = pendingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

    // Aging analysis for receivables
    const today = new Date();
    const aging = {
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0
    };

    unpaidInvoices?.forEach(inv => {
      const dueDate = new Date(inv.due_date);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = inv.total_amount - (inv.amount_paid || 0);

      if (daysPastDue <= 0) aging.current += amount;
      else if (daysPastDue <= 30) aging.days30 += amount;
      else if (daysPastDue <= 60) aging.days60 += amount;
      else if (daysPastDue <= 90) aging.days90 += amount;
      else aging.over90 += amount;
    });

    res.status(200).json({
      success: true,
      data: {
        accountsReceivable: {
          total: totalReceivable,
          count: unpaidInvoices?.length || 0,
          aging
        },
        accountsPayable: {
          total: totalPayable,
          count: pendingPayments?.length || 0
        },
        netPosition: totalReceivable - totalPayable
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Financial KPIs
// @route   GET /api/finance/kpis
// @access  Private (Finance Staff)
export const getFinancialKPIs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate: Date;
    const endDate = new Date();
    
    switch (period) {
      case 'week':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default: // month
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
    }

    // Get transactions
    const { data: transactions } = await supabase
      .from('finance_transactions')
      .select('amount, transaction_type, category')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const income = transactions?.filter(t => t.transaction_type === 'INCOME') || [];
    const expenses = transactions?.filter(t => t.transaction_type === 'EXPENSE') || [];

    const totalRevenue = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    // Calculate previous period for comparison
    const prevStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    
    const { data: prevTransactions } = await supabase
      .from('finance_transactions')
      .select('amount, transaction_type')
      .gte('created_at', prevStartDate.toISOString())
      .lt('created_at', startDate.toISOString());

    const prevIncome = prevTransactions?.filter(t => t.transaction_type === 'INCOME') || [];
    const prevExpenses = prevTransactions?.filter(t => t.transaction_type === 'EXPENSE') || [];
    const prevRevenue = prevIncome.reduce((sum, t) => sum + t.amount, 0);
    const prevTotalExpenses = prevExpenses.reduce((sum, t) => sum + t.amount, 0);

    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
    const expenseGrowth = prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalRevenue,
          totalExpenses,
          netIncome,
          profitMargin: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : 0,
          expenseRatio: totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(2) : 0,
          revenueGrowth: revenueGrowth.toFixed(2),
          expenseGrowth: expenseGrowth.toFixed(2)
        },
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          type: period
        },
        comparison: {
          prevRevenue,
          prevExpenses: prevTotalExpenses,
          prevNetIncome: prevRevenue - prevTotalExpenses
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
