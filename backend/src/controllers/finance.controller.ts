import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { aggregationService } from '../services/aggregation.service';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';

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
    query = applyBranchFilter(query, req);

    if (req.query.type && req.query.type !== 'all') {
      query = query.eq('transaction_type', req.query.type);
    }
    if (req.query.category) {
      query = query.eq('category', req.query.category);
    }
    if (req.query.branch_id) {
      query = query.eq('branch_id', req.query.branch_id);
    }
    if (req.query.startDate || req.query.from_date) {
      query = query.gte('created_at', req.query.startDate || req.query.from_date);
    }
    if (req.query.endDate || req.query.to_date) {
      query = query.lte('created_at', req.query.endDate || req.query.to_date);
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
      transaction_type,
      amount,
      description,
      category,
      payment_method,
      branch_id,
      payment_date,
      notes
    } = req.body;

    // Generate transaction number
    const transaction_number = `TXN-${Date.now()}`;

    const { data: transaction, error } = await supabase
      .from('finance_transactions')
      .insert([{
        transaction_number,
        transaction_type,
        amount,
        description,
        category,
        payment_method,
        branch_id,
        payment_date: payment_date || new Date().toISOString(),
        payment_status: 'completed',
        notes,
        created_by: req.user?.id
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: transaction
    });
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

    // NOTE: embedded joins (users!guest_id / finance_invoice_items) fail with
    // PGRST200 when the FK relationship is not in the schema cache. Fetch the
    // base rows first, then enrich guests + items with separate batch queries.
    let query = supabase
      .from('finance_invoices')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    // Add filters
    query = applyBranchFilter(query, req);

    if (req.query.status && req.query.status !== 'all') {
      let status = (req.query.status as string).toLowerCase();
      if (status === 'pending') status = 'sent';
      query = query.eq('status', status);
    }
    if (req.query.guest) {
      query = query.eq('guest_id', req.query.guest);
    }
    if (req.query.branch_id) {
      query = query.eq('branch_id', req.query.branch_id);
    }
    if (req.query.startDate) {
      query = query.gte('created_at', req.query.startDate);
    }
    if (req.query.endDate) {
      query = query.lte('created_at', req.query.endDate);
    }

    const { data: invoices, error, count } = await query;

    if (error) {
      throw error;
    }

    const rows = (invoices || []) as Array<Record<string, any>>;

    // Enrich guests (best-effort — never fatal)
    const guestIds = [...new Set(rows.map((r) => r.guest_id).filter(Boolean))];
    const guestMap: Record<string, any> = {};
    if (guestIds.length > 0) {
      const { data: guests } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, phone')
        .in('id', guestIds);
      (guests || []).forEach((g: any) => {
        guestMap[g.id] = g;
      });
    }

    // Enrich line items (best-effort — never fatal)
    const invoiceIds = rows.map((r) => r.id).filter(Boolean);
    const itemsByInvoice: Record<string, any[]> = {};
    if (invoiceIds.length > 0) {
      const { data: lineItems } = await supabase
        .from('finance_invoice_items')
        .select('*')
        .in('invoice_id', invoiceIds);
      (lineItems || []).forEach((li: any) => {
        (itemsByInvoice[li.invoice_id] ||= []).push(li);
      });
    }

    const enriched = rows.map((r) => ({
      ...r,
      guest: r.guest_id ? guestMap[r.guest_id] || null : null,
      items: itemsByInvoice[r.id] || [],
    }));

    res.status(200).json({
      success: true,
      count: enriched.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: enriched
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
    const { branch_id, startDate, endDate } = req.query;

    // 1. Restaurant Revenue
    let restaurantQuery = supabase
      .from('restaurant_orders')
      .select('total_amount')
      .in('status', ['completed', 'paid', 'delivered']);

    // 2. Bar Revenue
    let barQuery = supabase
      .from('bar_orders')
      .select('total')
      .in('status', ['completed', 'paid', 'closed']);

    // 3. Room Revenue (Reservations)
    // Note: reservations might not have branch_id directly, join with rooms
    let roomQuery = supabase
      .from('reservations')
      .select('total_amount, rooms!room_id!inner(branch_id)')
      .in('status', ['confirmed', 'checked_in', 'checked_out']);

    // 4. Expenses
    let expensesTableQuery = supabase
      .from('expenses')
      .select('amount')
      .in('status', ['approved', 'paid']);

    // 5. Finance Transactions (Other Income/Expense)
    let financeIncomeQuery = supabase
      .from('finance_transactions')
      .select('amount')
      .eq('transaction_type', 'income')
      .eq('payment_status', 'completed');

    let financeExpenseQuery = supabase
      .from('finance_transactions')
      .select('amount')
      .eq('transaction_type', 'expense')
      .eq('payment_status', 'completed');

    // Apply filters
    const userBranchId = req.user?.branch_id;
    const isGlobal = isGlobalRole(req.user?.role);
    const effectiveBranchId = isGlobal && branch_id ? branch_id : userBranchId;

    if (effectiveBranchId) {
      restaurantQuery = restaurantQuery.eq('branch_id', effectiveBranchId);
      barQuery = barQuery.eq('branch_id', effectiveBranchId);
      roomQuery = roomQuery.eq('rooms.branch_id', effectiveBranchId);
      expensesTableQuery = expensesTableQuery.eq('branch_id', effectiveBranchId);
      financeIncomeQuery = financeIncomeQuery.eq('branch_id', effectiveBranchId);
      financeExpenseQuery = financeExpenseQuery.eq('branch_id', effectiveBranchId);
    }

    if (startDate) {
      restaurantQuery = restaurantQuery.gte('created_at', startDate);
      barQuery = barQuery.gte('created_at', startDate);
      roomQuery = roomQuery.gte('created_at', startDate);
      expensesTableQuery = expensesTableQuery.gte('expense_date', startDate);
      financeIncomeQuery = financeIncomeQuery.gte('created_at', startDate);
      financeExpenseQuery = financeExpenseQuery.gte('created_at', startDate);
    }

    if (endDate) {
      restaurantQuery = restaurantQuery.lte('created_at', endDate);
      barQuery = barQuery.lte('created_at', endDate);
      roomQuery = roomQuery.lte('created_at', endDate);
      expensesTableQuery = expensesTableQuery.lte('expense_date', endDate);
      financeIncomeQuery = financeIncomeQuery.lte('created_at', endDate);
      financeExpenseQuery = financeExpenseQuery.lte('created_at', endDate);
    }

    // Get pending payments (unpaid invoices)
    let pendingQuery = supabase
      .from('accounting_ar_invoices')
      .select('balance')
      .neq('status', 'paid');

    if (effectiveBranchId) {
      pendingQuery = pendingQuery.eq('branch_id', effectiveBranchId);
    }

    const [
      { data: restaurantRevenue },
      { data: barRevenue },
      { data: roomRevenue },
      { data: expensesData },
      { data: financeIncome },
      { data: financeExpense },
      { data: pendingData }
    ] = await Promise.all([
      restaurantQuery,
      barQuery,
      roomQuery,
      expensesTableQuery,
      financeIncomeQuery,
      financeExpenseQuery,
      pendingQuery
    ]);

    // Calculate totals
    const totalRestaurant = restaurantRevenue?.reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;
    const totalBar = barRevenue?.reduce((sum, item) => sum + Number(item.total), 0) || 0;
    const totalRoom = roomRevenue?.reduce((sum, item) => sum + Number(item.total_amount), 0) || 0;
    const totalFinanceIncome = financeIncome?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    const totalRevenue = totalRestaurant + totalBar + totalRoom + totalFinanceIncome;

    const totalExpensesTable = expensesData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
    const totalFinanceExpense = financeExpense?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    const totalExpenses = totalExpensesTable + totalFinanceExpense;

    const pendingPayments = pendingData?.reduce((sum, item) => sum + Number(item.balance), 0) || 0;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        pendingPayments,
        breakdown: {
          restaurant: totalRestaurant,
          bar: totalBar,
          room: totalRoom,
          other_income: totalFinanceIncome,
          operational_expenses: totalExpensesTable,
          other_expenses: totalFinanceExpense
        }
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
        branch:branches(id, name)
      `)
      .order('budget_year', { ascending: false });

    query = applyBranchFilter(query, req);

    if (fiscal_year) {
      query = query.eq('budget_year', fiscal_year);
    }

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
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
        branch:branches(id, name)
      `)
      .order('created_at', { ascending: false });

    query = applyBranchFilter(query, req);

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

    const userIds = [
      ...new Set(
        (data || [])
          .flatMap((expense: any) => [expense.created_by, expense.approved_by])
          .filter(Boolean)
      )
    ];

    const usersById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', userIds);

      if (usersError) throw usersError;
      (users || []).forEach((user: any) => {
        usersById[user.id] = user;
      });
    }

    const enrichedData = (data || []).map((expense: any) => ({
      ...expense,
      created_by: expense.created_by ? usersById[expense.created_by] || null : null,
      approved_by: expense.approved_by ? usersById[expense.approved_by] || null : null,
    }));

    res.status(200).json({
      success: true,
      count: enrichedData.length,
      data: enrichedData
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

// @desc    Get Cash Flow Report (Multi-Source Aggregation)
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

    const dateRange = { startDate: start, endDate: end };
    const branchId = branch_id ? Number(branch_id) : undefined;

    // Use aggregation service to get data from ALL sources
    const [aggregatedData, dailyCashFlow] = await Promise.all([
      aggregationService.getAggregatedData(dateRange, branchId),
      aggregationService.getDailyCashFlow(dateRange, branchId),
    ]);

    const totalInflow = aggregatedData.revenue;
    const totalOutflow = aggregatedData.expenses;
    const netCashFlow = aggregatedData.netProfit;

    // Transform daily data to periods
    const periods = dailyCashFlow.map(d => ({
      period: d.date,
      inflow: d.inflow,
      outflow: d.outflow,
      net: d.net
    }));

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalInflow: Math.round(totalInflow * 100) / 100,
          totalOutflow: Math.round(totalOutflow * 100) / 100,
          netCashFlow: Math.round(netCashFlow * 100) / 100,
          profitMargin: totalInflow > 0 ? ((netCashFlow / totalInflow) * 100).toFixed(2) : 0
        },
        periods,
        revenueBySource: aggregatedData.revenueBySource,
        expensesByCategory: aggregatedData.expensesByCategory,
        period: { start, end }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Profit & Loss Statement (Multi-Source Aggregation)
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

    const dateRange = { startDate: start, endDate: end };
    const branchId = branch_id ? Number(branch_id) : undefined;

    // Get aggregated data from all sources
    const aggregatedData = await aggregationService.getAggregatedData(dateRange, branchId);

    const totalRevenue = aggregatedData.revenue;
    const expensesByCategory = aggregatedData.expensesByCategory;

    // Calculate COGS (Food & Beverage, Supplies, Inventory)
    const cogsCategories = ['Food & Beverage', 'Supplies', 'Inventory', 'FOOD_BEVERAGE', 'SUPPLIES'];
    const costOfGoods = Object.entries(expensesByCategory)
      .filter(([cat]) => cogsCategories.some(c => cat.toLowerCase().includes(c.toLowerCase())))
      .reduce((sum, [, amount]) => sum + amount, 0);

    // Calculate Operating Expenses (Salaries, Utilities, Maintenance, Marketing, etc.)
    const opexCategories = ['Salaries', 'Utilities', 'Maintenance', 'Marketing', 'Transport', 'Rent', 'SALARIES', 'UTILITIES', 'MAINTENANCE', 'MARKETING'];
    const operatingExpenses = Object.entries(expensesByCategory)
      .filter(([cat]) => opexCategories.some(c => cat.toLowerCase().includes(c.toLowerCase())))
      .reduce((sum, [, amount]) => sum + amount, 0);

    // Other expenses
    const otherExpenses = aggregatedData.expenses - costOfGoods - operatingExpenses;

    // Calculate P&L components
    const grossProfit = totalRevenue - costOfGoods;
    const operatingIncome = grossProfit - operatingExpenses;
    const netProfit = operatingIncome - otherExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        revenue: Math.round(totalRevenue * 100) / 100,
        costOfGoods: Math.round(costOfGoods * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        operatingExpenses: Math.round(operatingExpenses * 100) / 100,
        operatingIncome: Math.round(operatingIncome * 100) / 100,
        otherIncome: 0, // Can be enhanced later
        otherExpenses: Math.round(otherExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        margin: Math.round(margin * 10) / 10,
        revenueBySource: aggregatedData.revenueBySource,
        expensesByCategory,
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
    const { data: branches , error } = await supabase.from('branches').select('id, name, code');
    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // 1. Restaurant Revenue
    const { data: restaurantRevenue } = await supabase
      .from('restaurant_orders')
      .select('total_amount, branch_id')
      .in('status', ['completed', 'paid', 'delivered'])
      .gte('created_at', start)
      .lte('created_at', end);

    // 2. Bar Revenue
    const { data: barRevenue } = await supabase
      .from('bar_orders')
      .select('total, branch_id')
      .in('status', ['completed', 'paid', 'closed'])
      .gte('created_at', start)
      .lte('created_at', end);

    // 3. Room Revenue
    const { data: roomRevenue } = await supabase
      .from('reservations')
      .select('total_amount, rooms!room_id!inner(branch_id)')
      .in('status', ['confirmed', 'checked_in', 'checked_out'])
      .gte('created_at', start)
      .lte('created_at', end);

    // 4. Expenses
    const { data: expensesData } = await supabase
      .from('expenses')
      .select('amount, branch_id')
      .in('status', ['approved', 'paid'])
      .gte('expense_date', start)
      .lte('expense_date', end);

    // 5. Finance Transactions
    const { data: transactions } = await supabase
      .from('finance_transactions')
      .select('amount, transaction_type, branch_id')
      .gte('created_at', start)
      .lte('created_at', end)
      .eq('payment_status', 'completed');

    const branchData: Record<string, {
      income: number;
      expenses: number;
      net: number;
      name: string;
      code: string;
      breakdown: {
        restaurant: number;
        bar: number;
        rooms: number;
        other_income: number;
        operational_expenses: number;
        other_expenses: number;
      }
    }> = {};

    branches?.forEach(b => {
      branchData[b.id] = {
        income: 0,
        expenses: 0,
        net: 0,
        name: b.name,
        code: b.code || '',
        breakdown: {
          restaurant: 0,
          bar: 0,
          rooms: 0,
          other_income: 0,
          operational_expenses: 0,
          other_expenses: 0
        }
      };
    });

    // Aggregate Restaurant
    restaurantRevenue?.forEach(r => {
      if (r.branch_id && branchData[r.branch_id]) {
        const amount = Number(r.total_amount);
        branchData[r.branch_id].income += amount;
        branchData[r.branch_id].breakdown.restaurant += amount;
      }
    });

    // Aggregate Bar
    barRevenue?.forEach(b => {
      if (b.branch_id && branchData[b.branch_id]) {
        const amount = Number(b.total);
        branchData[b.branch_id].income += amount;
        branchData[b.branch_id].breakdown.bar += amount;
      }
    });

    // Aggregate Rooms
    roomRevenue?.forEach((r: any) => {
      const branchId = r.rooms?.branch_id;
      if (branchId && branchData[branchId]) {
        const amount = Number(r.total_amount);
        branchData[branchId].income += amount;
        branchData[branchId].breakdown.rooms += amount;
      }
    });

    // Aggregate Expenses Table
    expensesData?.forEach(e => {
      if (e.branch_id && branchData[e.branch_id]) {
        const amount = Number(e.amount);
        branchData[e.branch_id].expenses += amount;
        branchData[e.branch_id].breakdown.operational_expenses += amount;
      }
    });

    // Aggregate Finance Transactions
    transactions?.forEach(t => {
      if (t.branch_id && branchData[t.branch_id]) {
        const amount = Number(t.amount);
        if (t.transaction_type === 'income') {
          branchData[t.branch_id].income += amount;
          branchData[t.branch_id].breakdown.other_income += amount;
        } else {
          branchData[t.branch_id].expenses += amount;
          branchData[t.branch_id].breakdown.other_expenses += amount;
        }
      }
    });

    // Calculate Net
    Object.keys(branchData).forEach(id => {
      branchData[id].net = branchData[id].income - branchData[id].expenses;
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

    // Get budgets - FIXED: use fiscal_year and fiscal_month
    let budgetQuery = supabase
      .from('budgets')
      .select('*')
      .eq('fiscal_year', String(currentYear))
      .eq('fiscal_month', String(currentMonth).padStart(2, '0'));

    if (branch_id) {
      budgetQuery = budgetQuery.eq('branch_id', branch_id);
    }

    const { data: budgets } = await budgetQuery;

    // Get actual expenses for the period - FIXED: use lowercase 'expense'
    const startDate = new Date(Number(currentYear), Number(currentMonth) - 1, 1).toISOString();
    const endDate = new Date(Number(currentYear), Number(currentMonth), 0, 23, 59, 59).toISOString();

    let expenseQuery = supabase
      .from('finance_transactions')
      .select('amount, category')
      .eq('transaction_type', 'expense')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (branch_id) {
      expenseQuery = expenseQuery.eq('branch_id', branch_id);
    }

    const { data: expenses } = await expenseQuery;

    // Calculate actuals by category
    const actualsByCategory: Record<string, number> = {};
    expenses?.forEach(e => {
      const cat = String(e.category || 'other');
      actualsByCategory[cat] = (actualsByCategory[cat] || 0) + e.amount;
    });

    // Transform to frontend format - flat array with percentUsed
    const analysis = budgets?.map(b => {
      const budgeted = Number(b.allocated_amount) || 0;
      const actual = actualsByCategory[String(b.category)] || 0;
      const variance = budgeted - actual;
      const percentUsed = budgeted > 0 ? (actual / budgeted) * 100 : 0;

      return {
        category: String(b.category),
        budgeted,
        actual,
        variance,
        percentUsed
      };
    }) || [];

    res.status(200).json({
      success: true,
      data: analysis
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

    // Get all income - FIXED: use lowercase 'income'
    const { data: income } = await supabase
      .from('finance_transactions')
      .select('amount, category')
      .eq('transaction_type', 'income')
      .gte('created_at', start)
      .lte('created_at', end);

    // Get all expenses - FIXED: use lowercase 'expense'
    const { data: expenses } = await supabase
      .from('finance_transactions')
      .select('amount, category')
      .eq('transaction_type', 'expense')
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
    const { months = 3, branch_id } = req.query;
    const forecastMonths = Number(months);

    // Get last 6 months of data for trend analysis
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let historicalQuery = supabase
      .from('finance_transactions')
      .select('amount, transaction_type, created_at')
      .gte('created_at', sixMonthsAgo.toISOString());

    if (branch_id) {
      historicalQuery = historicalQuery.eq('branch_id', branch_id);
    }

    const { data: historicalData } = await historicalQuery;

    // Group by month
    const monthlyData: Record<string, { income: number; expenses: number }> = {};

    historicalData?.forEach(t => {
      const month = t.created_at.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0 };
      if (t.transaction_type === 'income') {
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

    // Calculate confidence based on data availability and consistency
    const baseConfidence = Math.min((months_data.length / 6) * 100, 100);
    const varianceConfidence = months_data.length >= 3 ? 85 : 70;
    const confidence = Math.round((baseConfidence + varianceConfidence) / 2);

    // Generate forecast - FIXED: return flat array with correct field names
    const forecast = [];
    let currentIncome = avgIncome;
    let currentExpenses = avgExpenses;
    const today = new Date();

    for (let i = 1; i <= forecastMonths; i++) {
      const forecastDate = new Date(today);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      const monthStr = forecastDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

      currentIncome = currentIncome * (1 + incomeGrowth);
      currentExpenses = currentExpenses * (1 + expenseGrowth);

      forecast.push({
        month: monthStr,
        projectedRevenue: Math.round(currentIncome),
        projectedExpenses: Math.round(currentExpenses),
        projectedProfit: Math.round(currentIncome - currentExpenses),
        confidence
      });
    }

    res.status(200).json({
      success: true,
      data: forecast
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
    const { branch_id } = req.query;

    // Get unpaid invoices (Accounts Receivable)
    let arQuery = supabase
      .from('finance_invoices')
      .select('id, invoice_number, guest_id, total_amount, amount_paid, due_date, status')
      .in('status', ['PENDING', 'PARTIAL', 'OVERDUE']);

    if (branch_id) {
      arQuery = arQuery.eq('branch_id', branch_id);
    }

    const { data: unpaidInvoices } = await arQuery;

    // Get pending supplier payments (Accounts Payable)
    let apQuery = supabase
      .from('expenses')
      .select('id, description, amount, expense_date, status')
      .eq('status', 'approved');

    if (branch_id) {
      apQuery = apQuery.eq('branch_id', branch_id);
    }

    const { data: pendingPayments } = await apQuery;

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

// @desc    Get Financial KPIs (Multi-Source Aggregation)
// @route   GET /api/finance/kpis
// @access  Private (Finance Staff)
export const getFinancialKPIs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { period = 'month', branch_id } = req.query;

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

    const branchId = branch_id ? Number(branch_id) : undefined;

    // Get current period data using aggregation service
    const currData = await aggregationService.getAggregatedData(
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      branchId
    );

    // Get previous period data for comparison
    const prevStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const prevData = await aggregationService.getAggregatedData(
      { startDate: prevStartDate.toISOString(), endDate: startDate.toISOString() },
      branchId
    );

    const totalRevenue = currData.revenue;
    const totalExpenses = currData.expenses;
    const netIncome = currData.netProfit;

    const prevRevenue = prevData.revenue;
    const prevTotalExpenses = prevData.expenses;
    const prevNetIncome = prevData.netProfit;

    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
    const expenseGrowth = prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses * 100) : 0;
    const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
    const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

    // Transform to array format for frontend
    const kpis = [
      {
        name: 'Total Revenue',
        value: Math.round(totalRevenue * 100) / 100,
        unit: 'KES',
        change: Math.round(revenueGrowth * 10) / 10,
        trend: revenueGrowth > 0 ? 'up' as const : revenueGrowth < 0 ? 'down' as const : 'stable' as const
      },
      {
        name: 'Total Expenses',
        value: Math.round(totalExpenses * 100) / 100,
        unit: 'KES',
        change: Math.round(expenseGrowth * 10) / 10,
        trend: expenseGrowth > 0 ? 'up' as const : expenseGrowth < 0 ? 'down' as const : 'stable' as const
      },
      {
        name: 'Net Income',
        value: Math.round(netIncome * 100) / 100,
        unit: 'KES',
        change: prevNetIncome > 0 ? Math.round(((netIncome - prevNetIncome) / prevNetIncome * 100) * 10) / 10 : 0,
        trend: netIncome > prevNetIncome ? 'up' as const : netIncome < prevNetIncome ? 'down' as const : 'stable' as const
      },
      {
        name: 'Profit Margin',
        value: Math.round(profitMargin * 10) / 10,
        unit: '%',
        target: 20,
        change: Math.round((revenueGrowth - expenseGrowth) * 10) / 10,
        trend: profitMargin > 15 ? 'up' as const : profitMargin < 10 ? 'down' as const : 'stable' as const
      },
      {
        name: 'Expense Ratio',
        value: Math.round(expenseRatio * 10) / 10,
        unit: '%',
        target: 80,
        change: Math.round((expenseGrowth - revenueGrowth) * 10) / 10,
        trend: expenseRatio < 80 ? 'up' as const : expenseRatio > 90 ? 'down' as const : 'stable' as const
      },
      {
        name: 'Revenue Growth',
        value: Math.round(revenueGrowth * 10) / 10,
        unit: '%',
        target: 10,
        change: Math.round(revenueGrowth * 10) / 10,
        trend: revenueGrowth > 0 ? 'up' as const : revenueGrowth < 0 ? 'down' as const : 'stable' as const
      }
    ];

    res.status(200).json({
      success: true,
      data: kpis
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Get detailed branch financial profile
// @route   GET /api/finance/branch-financials/:branchId
// @access  Private (Finance Staff, Branch Accountant)
export const getBranchFinancialProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { days = 30, startDate: startDateParam, endDate: endDateParam } = req.query;
    const branch_id = parseInt(branchId);

    if (isNaN(branch_id)) {
      res.status(400).json({ success: false, message: 'Invalid branch ID' });
      return;
    }

    const userBranchId = Number(req.user?.branch_id || 0);
    const userRole = String(req.user?.role || '').toLowerCase();

    if (['branch_manager', 'branch_accountant'].includes(userRole) && userBranchId !== branch_id) {
      res.status(403).json({ success: false, message: 'Access denied for this branch' });
      return;
    }

    const parsedStartDate = typeof startDateParam === 'string'
      ? new Date(startDateParam.includes('T') ? startDateParam : `${startDateParam}T00:00:00.000Z`)
      : new Date(Date.now() - (parseInt(days as string) * 24 * 60 * 60 * 1000));

    const parsedEndDate = typeof endDateParam === 'string'
      ? new Date(endDateParam.includes('T') ? endDateParam : `${endDateParam}T23:59:59.999Z`)
      : new Date();

    if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime()) || parsedEndDate < parsedStartDate) {
      res.status(400).json({ success: false, message: 'Invalid date range' });
      return;
    }

    const endDate = parsedEndDate.toISOString();
    const startDate = parsedStartDate.toISOString();
    const dateRange = { startDate, endDate };

    // 1. Get Aggregated P&L Data
    const aggregatedData = await aggregationService.getAggregatedData(
      { startDate: startDate, endDate: endDate },
      branch_id
    );

    // 2. Get Recent Payments from central table
    // We fetch more to allow for filtering of branch_id from joined tables
    const { data: payments } = await supabase
      .from('payments')
      .select(`
        *,
        restaurant_orders ( order_number, branch_id ),
        bar_orders ( order_number, branch_id ),
        reservations ( room_id, rooms ( branch_id ) )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(50);

    // Filter payments manually due to deep join branch_id requirement
    const filteredPayments = (payments || []).filter(p => {
      // Check for branch_id in any of the potential related tables
      const restaurantBranchId = (p.restaurant_orders as any)?.branch_id;
      const barBranchId = (p.bar_orders as any)?.branch_id;

      // Handle potential array or object response from Supabase joins
      let roomBranchId: number | undefined;
      const resData = p.reservations as any;
      if (resData) {
        if (Array.isArray(resData)) {
          roomBranchId = resData[0]?.rooms?.branch_id;
        } else {
          roomBranchId = resData.rooms?.branch_id;
        }
      }

      const pBranchId = restaurantBranchId || barBranchId || roomBranchId;
      return pBranchId === branch_id;
    }).slice(0, 10);

    // 3. Get Recent Finance Transactions
    const { data: transactions } = await supabase
      .from('finance_transactions')
      .select('*')
      .eq('branch_id', branch_id)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(10);

    // 4. Get POS Activity Summary (Restaurant & Bar)
    const [restaurantOrders, barOrders] = await Promise.all([
      supabase
        .from('restaurant_orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('branch_id', branch_id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('bar_orders')
        .select('id, order_number, status, total, created_at')
        .eq('branch_id', branch_id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    // 5. Get Cashier Logbooks status
    const { data: logbooks } = await supabase
      .from('cashier_logbooks')
      .select('id, status, log_date, audit_notes, type')
      .eq('branch_id', branch_id)
      .gte('log_date', startDate.slice(0, 10))
      .lte('log_date', endDate.slice(0, 10))
      .order('log_date', { ascending: false })
      .limit(5);

    // 6. AR/AP Summary
    const [{ data: invoices }, { data: bills }] = await Promise.all([
      supabase.from('accounting_ar_invoices').select('balance').eq('branch_id', branch_id).neq('status', 'paid'),
      supabase.from('accounting_ap_bills').select('balance').eq('branch_id', branch_id).neq('status', 'paid')
    ]);

    const arTotal = invoices?.reduce((sum, inv) => sum + Number(inv.balance || 0), 0) || 0;
    const apTotal = bills?.reduce((sum, bill) => sum + Number(bill.balance || 0), 0) || 0;

    res.status(200).json({
      success: true,
      data: {
        summary: aggregatedData,
        receivables: arTotal,
        payables: apTotal,
        recentPayments: filteredPayments,
        recentTransactions: transactions,
        posActivity: {
          restaurant: restaurantOrders.data || [],
          bar: barOrders.data || []
        },
        logbooks: logbooks || [],
        period: dateRange
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Daily Logs
// @route   GET /api/finance/daily-logs
// @access  Private (Finance Staff, Auditor)
export const getDailyLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, startDate, endDate, status, log_date } = req.query;
    let query = supabase
      .from('finance_daily_logs')
      .select(`
        *,
        lines:finance_daily_log_lines(*)
      `)
      .order('log_date', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);
    if (log_date) query = query.eq('log_date', log_date);
    if (startDate) query = query.gte('log_date', startDate);
    if (endDate) query = query.lte('log_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Save Daily Log
// @route   POST /api/finance/daily-logs
// @access  Private (Branch Accountant)
export const saveDailyLog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      id, branch_id, log_date, opening_balance, closing_balance,
      total_payments, total_expenses, notes, status, lines
    } = req.body;

    const userId = req.user?.id;
    const activeBranchId = req.headers['x-branch-id'];

    // 1. Upsert main log record
    const logData = {
      branch_id: branch_id || activeBranchId,
      log_date,
      opening_balance,
      closing_balance,
      total_payments,
      total_expenses,
      notes,
      status: status || 'draft',
      created_by: userId
    };

    let result;
    if (id) {
      result = await supabase
        .from('finance_daily_logs')
        .update(logData)
        .eq('id', id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('finance_daily_logs')
        .insert([logData])
        .select()
        .single();
    }

    if (result.error) throw result.error;
    const log = result.data;

    // 2. Clear and recreate lines
    if (log.id) {
      const { error } = await supabase.from('finance_daily_log_lines').delete().eq('log_id', log.id);
      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      if (lines && lines.length > 0) {
        const linesWithLogId = lines.map((l: any) => {
          const { id: tempId, ...lineData } = l;
          return {
            ...lineData,
            log_id: log.id
          };
        });

        const { error: linesError } = await supabase
          .from('finance_daily_log_lines')
          .insert(linesWithLogId);
        if (linesError) throw linesError;
      }
    }

    res.status(200).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Daily Log Status
// @route   PUT /api/finance/daily-logs/:id/status
// @access  Private (Auditor, Accountant)
export const updateDailyLogStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    const userId = req.user?.id;

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'verified') {
      updateData.verified_by = userId;
      updateData.verified_at = new Date().toISOString();
    }

    if (status === 'rejected') {
      updateData.rejection_reason = rejection_reason;
    }

    const { data, error } = await supabase
      .from('finance_daily_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
