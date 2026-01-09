import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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

    // Customer mapping logic to handle string IDs
    let resolvedCustomerId = customer_id;
    if (customer_id && !isUUID(customer_id)) {
      // Check if already mapped in accounting_customers
      const { data: mappedCustomer } = await supabase
        .from('accounting_customers')
        .select('id')
        .eq('customer_code', customer_id)
        .maybeSingle();

      if (mappedCustomer) {
        resolvedCustomerId = mappedCustomer.id;
      } else {
        // Not mapped, look up in customers/users table
        const { data: customer } = await supabase
          .from('customers') // Assuming a 'customers' table exists, otherwise might be 'users'
          .select('*')
          .eq('id', customer_id)
          .maybeSingle();

        if (customer) {
          // Auto-create mapping entry in accounting_customers
          const { data: newCustomer, error: cError } = await supabase
            .from('accounting_customers')
            .insert([{
              customer_code: customer.id,
              customer_name: customer.name || `${customer.first_name} ${customer.last_name}`,
              contact_person: customer.contact_person,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
              is_active: true
            }])
            .select()
            .single();

          if (cError) {
            logger.error('Error auto-creating accounting_customer:', cError);
          } else if (newCustomer) {
            resolvedCustomerId = newCustomer.id;
            logger.info(`Mapped customer ${customer_id} to accounting_customer ${resolvedCustomerId}`);
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('accounting_ar_invoices')
      .insert([{
        invoice_number,
        customer_id: resolvedCustomerId,
        invoice_date,
        due_date,
        subtotal,
        tax_amount,
        total_amount,
        balance: total_amount,
        status: 'unpaid',
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

    let resolvedCustomerId = customer_id as string;
    if (resolvedCustomerId && !isUUID(resolvedCustomerId)) {
      const { data: mapped } = await supabase
        .from('accounting_customers')
        .select('id')
        .eq('customer_code', resolvedCustomerId)
        .maybeSingle();
      if (mapped) resolvedCustomerId = mapped.id;
    }

    let query = supabase
      .from('accounting_ar_invoices')
      .select(`
        *,
        customer:accounting_customers(*)
      `)
      .order('invoice_date', { ascending: false });

    if (resolvedCustomerId) query = query.eq('customer_id', resolvedCustomerId);
    if (status) {
      let statusVal = status as string;
      if (statusVal === 'pending') statusVal = 'unpaid';
      query = query.eq('status', statusVal);
    }
    if (overdue === 'true') {
      query = query.lt('due_date', new Date().toISOString().split('T')[0]).eq('status', 'unpaid');
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

    // Vendor mapping logic to handle string IDs from 'suppliers' table
    let resolvedVendorId = vendor_id as string;

    if (vendor_id && !isUUID(vendor_id)) {
      // Check if already mapped in accounting_vendors
      const { data: mappedVendor } = await supabase
        .from('accounting_vendors')
        .select('id')
        .eq('vendor_code', vendor_id)
        .maybeSingle();

      if (mappedVendor) {
        resolvedVendorId = mappedVendor.id;
      } else {
        // Not mapped, look up in suppliers table
        const { data: supplier } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', vendor_id)
          .maybeSingle();

        if (supplier) {
          // Auto-create mapping entry in accounting_vendors
          const { data: newVendor, error: vError } = await supabase
            .from('accounting_vendors')
            .insert([{
              vendor_code: supplier.id,
              vendor_name: supplier.name,
              contact_person: supplier.contact_person,
              email: supplier.email,
              phone: supplier.phone,
              address: supplier.address,
              is_active: true
            }])
            .select()
            .single();

          if (vError) {
            logger.error('Error auto-creating accounting_vendor:', vError);
          } else if (newVendor) {
            resolvedVendorId = newVendor.id;
            logger.info(`Mapped supplier ${vendor_id} to accounting_vendor ${resolvedVendorId}`);
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('accounting_ap_bills')
      .insert([{
        bill_number,
        vendor_id: resolvedVendorId,
        bill_date,
        due_date,
        subtotal,
        tax_amount,
        total_amount,
        balance: total_amount,
        status: 'unpaid',
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

    let resolvedVendorId = vendor_id as string;
    if (resolvedVendorId && !isUUID(resolvedVendorId)) {
      const { data: mapped } = await supabase
        .from('accounting_vendors')
        .select('id')
        .eq('vendor_code', resolvedVendorId)
        .maybeSingle();
      if (mapped) resolvedVendorId = mapped.id;
    }

    let query = supabase
      .from('accounting_ap_bills')
      .select(`
        *,
        vendor:accounting_vendors(*)
      `)
      .order('bill_date', { ascending: false });

    if (resolvedVendorId) query = query.eq('vendor_id', resolvedVendorId);
    if (status) {
      let statusVal = status as string;
      if (statusVal === 'pending') statusVal = 'unpaid';
      query = query.eq('status', statusVal);
    }
    if (overdue === 'true') {
      query = query.lt('due_date', new Date().toISOString().split('T')[0]).eq('status', 'unpaid');
    }

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ BANK RECONCILIATION ============

export const createBankTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { bank_account_id, transaction_date, amount, transaction_type, reference, description } = req.body;

    const { data, error } = await supabase
      .from('accounting_bank_transactions')
      .insert([{
        bank_account_id,
        transaction_date,
        debit_amount: transaction_type === 'debit' ? amount : 0,
        credit_amount: transaction_type === 'credit' ? amount : 0,
        transaction_type, // 'credit' or 'debit'
        reference,
        description,
        reconciled: false
      }])
      .select()
      .single();

    if (error) throw error;

    // Update bank account balance
    const { data: account } = await supabase
      .from('accounting_bank_accounts')
      .select('current_balance')
      .eq('id', bank_account_id)
      .single();

    if (account) {
      const newBalance = transaction_type === 'credit'
        ? (account.current_balance || 0) + amount
        : (account.current_balance || 0) - amount;

      await supabase
        .from('accounting_bank_accounts')
        .update({ current_balance: newBalance })
        .eq('id', bank_account_id);
    }

    res.status(201).json({ success: true, data });
    logger.info(`Bank transaction created: ${reference}`);
  } catch (error) {
    next(error);
  }
};

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
        overdue: invoices?.filter(inv => inv.status === 'unpaid' && inv.due_date < today)
          .reduce((sum, inv) => sum + (inv.balance || 0), 0) || 0,
        current: invoices?.filter(inv => inv.status === 'unpaid' && inv.due_date >= today)
          .reduce((sum, inv) => sum + (inv.balance || 0), 0) || 0
      },
      payables: {
        total: bills?.reduce((sum, bill) => sum + (bill.balance || 0), 0) || 0,
        overdue: bills?.filter(bill => bill.status === 'unpaid' && bill.due_date < today)
          .reduce((sum, bill) => sum + (bill.balance || 0), 0) || 0,
        current: bills?.filter(bill => bill.status === 'unpaid' && bill.due_date >= today)
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
