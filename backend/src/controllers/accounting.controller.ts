import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// ============ CHART OF ACCOUNTS ============

export const getChartOfAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { account_type, is_active } = req.query;
    
    let query = supabase
      .from('accounting_chart_of_accounts')
      .select('*')
      .order('account_code');
    
    if (account_type) query = query.eq('account_type', account_type);
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('accounting_chart_of_accounts')
      .insert([req.body])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, data });
    logger.info(`Account created: ${data.account_code}`);
  } catch (error) {
    next(error);
  }
};

// ============ JOURNAL ENTRIES ============

export const createJournalEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { entry_date, description, reference, lines } = req.body;
    
    // Calculate totals
    const total_debit = lines.reduce((sum: number, line: any) => sum + (line.debit_amount || 0), 0);
    const total_credit = lines.reduce((sum: number, line: any) => sum + (line.credit_amount || 0), 0);
    
    if (Math.abs(total_debit - total_credit) > 0.01) {
      res.status(400).json({ success: false, message: 'Journal entry not balanced' });
      return;
    }
    
    // Generate journal number
    const journal_number = `JE-${Date.now()}`;
    
    // Create journal entry
    const { data: journal, error: journalError } = await supabase
      .from('accounting_journal_entries')
      .insert([{
        journal_number,
        entry_date,
        description,
        reference,
        total_debit,
        total_credit,
        status: 'draft',
        posted_by: req.user?.id
      }])
      .select()
      .single();
    
    if (journalError) throw journalError;
    
    // Create journal lines
    const linesWithJournal = lines.map((line: any) => ({
      ...line,
      journal_entry_id: journal.id
    }));
    
    const { error: linesError } = await supabase
      .from('accounting_journal_lines')
      .insert(linesWithJournal);
    
    if (linesError) throw linesError;
    
    res.status(201).json({ success: true, data: journal });
    logger.info(`Journal entry created: ${journal_number}`);
  } catch (error) {
    next(error);
  }
};

export const postJournalEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('accounting_journal_entries')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        posted_by: req.user?.id
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(200).json({ success: true, data });
    logger.info(`Journal entry posted: ${data.journal_number}`);
  } catch (error) {
    next(error);
  }
};

export const getJournalEntries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { start_date, end_date, status } = req.query;
    
    let query = supabase
      .from('accounting_journal_entries')
      .select(`
        *,
        lines:accounting_journal_lines(
          *,
          account:accounting_chart_of_accounts(*)
        )
      `)
      .order('entry_date', { ascending: false });
    
    if (start_date) query = query.gte('entry_date', start_date);
    if (end_date) query = query.lte('entry_date', end_date);
    if (status) query = query.eq('status', status);
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ ACCOUNTS RECEIVABLE ============

export const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customer_id, invoice_date, due_date, subtotal, tax_amount, reference, notes } = req.body;
    
    const total_amount = subtotal + (tax_amount || 0);
    const invoice_number = `INV-${Date.now()}`;
    
    const { data, error } = await supabase
      .from('accounting_ar_invoices')
      .insert([{
        invoice_number,
        customer_id,
        invoice_date,
        due_date,
        subtotal,
        tax_amount,
        total_amount,
        balance: total_amount,
        status: 'pending',
        reference,
        notes,
        created_by: req.user?.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, data });
    logger.info(`Invoice created: ${invoice_number}`);
  } catch (error) {
    next(error);
  }
};

export const getInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customer_id, status, overdue } = req.query;
    
    let query = supabase
      .from('accounting_ar_invoices')
      .select(`
        *,
        customer:accounting_customers(*)
      `)
      .order('invoice_date', { ascending: false });
    
    if (customer_id) query = query.eq('customer_id', customer_id);
    if (status) query = query.eq('status', status);
    if (overdue === 'true') {
      query = query.lt('due_date', new Date().toISOString().split('T')[0]).eq('status', 'pending');
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ ACCOUNTS PAYABLE ============

export const createBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendor_id, bill_date, due_date, subtotal, tax_amount, reference, notes } = req.body;
    
    const total_amount = subtotal + (tax_amount || 0);
    const bill_number = `BILL-${Date.now()}`;
    
    const { data, error } = await supabase
      .from('accounting_ap_bills')
      .insert([{
        bill_number,
        vendor_id,
        bill_date,
        due_date,
        subtotal,
        tax_amount,
        total_amount,
        balance: total_amount,
        status: 'pending',
        reference,
        notes,
        created_by: req.user?.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, data });
    logger.info(`Bill created: ${bill_number}`);
  } catch (error) {
    next(error);
  }
};

export const getBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendor_id, status, overdue } = req.query;
    
    let query = supabase
      .from('accounting_ap_bills')
      .select(`
        *,
        vendor:accounting_vendors(*)
      `)
      .order('bill_date', { ascending: false});
    
    if (vendor_id) query = query.eq('vendor_id', vendor_id);
    if (status) query = query.eq('status', status);
    if (overdue === 'true') {
      query = query.lt('due_date', new Date().toISOString().split('T')[0]).eq('status', 'pending');
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ BANK RECONCILIATION ============

export const getBankTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { bank_account_id, start_date, end_date, reconciled } = req.query;
    
    let query = supabase
      .from('accounting_bank_transactions')
      .select(`
        *,
        bank_account:accounting_bank_accounts(*)
      `)
      .order('transaction_date', { ascending: false });
    
    if (bank_account_id) query = query.eq('bank_account_id', bank_account_id);
    if (start_date) query = query.gte('transaction_date', start_date);
    if (end_date) query = query.lte('transaction_date', end_date);
    if (reconciled !== undefined) query = query.eq('reconciled', reconciled === 'true');
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ BUDGETS ============

export const getBudgets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fiscal_year, department, status } = req.query;
    
    let query = supabase
      .from('accounting_budgets')
      .select(`
        *,
        account:accounting_chart_of_accounts(*)
      `)
      .order('budget_name');
    
    if (fiscal_year) query = query.eq('fiscal_year', fiscal_year);
    if (department) query = query.eq('department', department);
    if (status) query = query.eq('status', status);
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ DASHBOARD ============

export const getAccountingDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get AR summary
    const { data: invoices } = await supabase
      .from('accounting_ar_invoices')
      .select('total_amount, paid_amount, balance, status, due_date');
    
    // Get AP summary
    const { data: bills } = await supabase
      .from('accounting_ap_bills')
      .select('total_amount, paid_amount, balance, status, due_date');
    
    // Get bank balances
    const { data: bankAccounts } = await supabase
      .from('accounting_bank_accounts')
      .select('current_balance, currency');
    
    const today = new Date().toISOString().split('T')[0];
    
    const dashboard = {
      receivables: {
        total: invoices?.reduce((sum, inv) => sum + (inv.balance || 0), 0) || 0,
        overdue: invoices?.filter(inv => inv.status === 'pending' && inv.due_date < today)
          .reduce((sum, inv) => sum + (inv.balance || 0), 0) || 0,
        current: invoices?.filter(inv => inv.status === 'pending' && inv.due_date >= today)
          .reduce((sum, inv) => sum + (inv.balance || 0), 0) || 0
      },
      payables: {
        total: bills?.reduce((sum, bill) => sum + (bill.balance || 0), 0) || 0,
        overdue: bills?.filter(bill => bill.status === 'pending' && bill.due_date < today)
          .reduce((sum, bill) => sum + (bill.balance || 0), 0) || 0,
        current: bills?.filter(bill => bill.status === 'pending' && bill.due_date >= today)
          .reduce((sum, bill) => sum + (bill.balance || 0), 0) || 0
      },
      cash: {
        total: bankAccounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) || 0,
        accounts: bankAccounts?.length || 0
      }
    };
    
    res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
};
