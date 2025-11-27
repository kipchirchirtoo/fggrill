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
