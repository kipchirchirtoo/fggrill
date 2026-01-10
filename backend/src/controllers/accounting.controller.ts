import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import notificationService from '../services/notification.service';

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
    if (customer_id) {
      // 1. Check if already exists in accounting_customers by internal ID (if UUID)
      if (isUUID(customer_id)) {
        const { data: existing } = await supabase
          .from('accounting_customers')
          .select('id')
          .eq('id', customer_id)
          .maybeSingle();

        if (existing) {
          resolvedCustomerId = existing.id;
        } else {
          // 2. Check if it's a customer_code (external ID)
          const { data: mapped } = await supabase
            .from('accounting_customers')
            .select('id')
            .eq('customer_code', customer_id)
            .maybeSingle();

          if (mapped) {
            resolvedCustomerId = mapped.id;
          } else {
            // 3. Not mapped, try to find in source table
            const { data: source } = await supabase
              .from('customers')
              .select('*')
              .eq('id', customer_id)
              .maybeSingle();

            if (source) {
              const { data: created, error: cError } = await supabase
                .from('accounting_customers')
                .insert([{
                  customer_code: source.id,
                  customer_name: source.name || `${source.first_name} ${source.last_name}`,
                  contact_person: source.contact_person,
                  email: source.email,
                  phone: source.phone,
                  address: source.address,
                  is_active: true
                }])
                .select()
                .single();

              if (cError) {
                logger.error('Error auto-creating accounting_customer:', cError);
              } else if (created) {
                resolvedCustomerId = created.id;
                logger.info(`Mapped customer ${customer_id} to accounting_customer ${resolvedCustomerId}`);
              } else {
                logger.error('Failed to resolve customer mapping for UUID:', customer_id);
              }
            } else {
              logger.error('Customer not found in source table:', customer_id);
            }
          }
        }
      } else {
        // Non-UUID: Check if it's a customer_code
        const { data: mapped } = await supabase
          .from('accounting_customers')
          .select('id')
          .eq('customer_code', customer_id)
          .maybeSingle();

        if (mapped) {
          resolvedCustomerId = mapped.id;
        } else {
          // Look up by customer_code equivalent if applicable
          logger.warn(`Non-UUID customer_id provided but no mapping found: ${customer_id}`);
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

    logger.info(`Invoice created: ${invoice_number}`);

    // Notify Auditor
    notificationService.notifyRole(
      'auditor',
      'New Invoice Created',
      `Invoice ${invoice_number} for ${total_amount} has been created.`,
      {
        type: 'info',
        category: 'finance',
        priority: 'medium',
        actionUrl: '/dashboard/auditor/invoices',
        metadata: { invoice_id: data.id }
      }
    ).catch(e => logger.error('Failed to notify auditor of new invoice', e));

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customer_id, status, overdue } = req.query;

    let resolvedCustomerId = customer_id as string;
    if (resolvedCustomerId) {
      // Try internal ID first
      const { data: exists } = await supabase
        .from('accounting_customers')
        .select('id')
        .eq('id', resolvedCustomerId)
        .maybeSingle();

      if (!exists) {
        // Try mapping code
        const { data: mapped } = await supabase
          .from('accounting_customers')
          .select('id')
          .eq('customer_code', resolvedCustomerId)
          .maybeSingle();
        if (mapped) resolvedCustomerId = mapped.id;
      }
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

export const recordInvoicePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, payment_date, bank_account_id, payment_method, reference, notes } = req.body;

    // 1. Get the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('accounting_ar_invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (invoiceError || !invoice) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }

    // 2. Update invoice balance and status
    const paymentAmount = Number(amount);
    const newPaidAmount = (invoice.paid_amount || 0) + paymentAmount;
    const newBalance = invoice.total_amount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partially_paid' : 'unpaid');

    const { error: updateError } = await supabase
      .from('accounting_ar_invoices')
      .update({
        paid_amount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // 3. Record bank transaction if account provided
    if (bank_account_id) {
      await supabase.from('accounting_bank_transactions').insert({
        bank_account_id,
        transaction_date: payment_date || new Date().toISOString().split('T')[0],
        debit_amount: paymentAmount,
        credit_amount: 0,
        reference: reference || `PYMT-INV-${invoice.invoice_number}`,
        description: notes || `Payment received for invoice ${invoice.invoice_number}`,
        reconciled: false
      });

      // Update bank balance
      const { data: bankAcc } = await supabase.from('accounting_bank_accounts').select('current_balance').eq('id', bank_account_id).single();
      if (bankAcc) {
        await supabase.from('accounting_bank_accounts').update({
          current_balance: (bankAcc.current_balance || 0) + paymentAmount,
          updated_at: new Date().toISOString()
        }).eq('id', bank_account_id);
      }
    }

    logger.info(`Payment of ${amount} recorded for invoice ${invoice.invoice_number}`);

    // Notify Accountant
    notificationService.notifyRole(
      'accountant',
      'Payment Received',
      `Payment of ${amount} received for invoice ${invoice.invoice_number}.`,
      {
        type: 'success',
        category: 'finance',
        priority: 'medium',
        actionUrl: '/dashboard/branch-accounting/invoices',
        metadata: { invoice_id: id }
      }
    ).catch(e => logger.error('Failed to notify accountant of payment', e));

    res.status(200).json({ success: true, message: 'Payment recorded successfully' });
  } catch (error) {
    next(error);
  }
};

// ============ ACCOUNTS PAYABLE ============

export const createBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendor_id, bill_date, due_date, subtotal, tax_amount, reference, notes } = req.body;

    // Validate required fields
    if (!vendor_id) {
      res.status(400).json({
        success: false,
        message: 'vendor_id is required'
      });
      return;
    }

    const total_amount = subtotal + (tax_amount || 0);
    const bill_number = `BILL-${Date.now()}`;

    // Vendor mapping logic to handle IDs from 'suppliers' table
    let resolvedVendorId = vendor_id as string;

    if (vendor_id) {
      // 1. First check if it exists in accounting_vendors by internal ID (if UUID)
      if (isUUID(vendor_id)) {
        logger.info(`Checking if vendor exists in accounting_vendors by ID: ${vendor_id}`);
        const { data: existingVendor } = await supabase
          .from('accounting_vendors')
          .select('id')
          .eq('id', vendor_id)
          .maybeSingle();

        if (existingVendor) {
          resolvedVendorId = existingVendor.id;
        } else {
          // 2. Not an internal ID, check if it's a vendor_code (external ID)
          logger.info(`Not found by ID, checking vendor_code mapping: ${vendor_id}`);
          const { data: mappedByCode } = await supabase
            .from('accounting_vendors')
            .select('id')
            .eq('vendor_code', vendor_id)
            .maybeSingle();

          if (mappedByCode) {
            resolvedVendorId = mappedByCode.id;
          } else {
            // 3. Not mapped, try to resolve from suppliers table and create mapping
            logger.info(`Not mapped, checking suppliers table: ${vendor_id}`);
            const { data: supplier, error: supplierError } = await supabase
              .from('suppliers')
              .select('*')
              .eq('id', vendor_id)
              .maybeSingle();

            if (supplierError) {
              logger.error('Error fetching supplier:', supplierError);
            }

            if (supplier) {
              logger.info(`Found supplier: ${supplier.name}, creating accounting_vendor mapping`);
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
                throw new Error(`Failed to create vendor mapping: ${vError.message}`);
              } else if (newVendor) {
                resolvedVendorId = newVendor.id;
                logger.info(`Mapped supplier ${vendor_id} to accounting_vendor ${resolvedVendorId}`);
              }
            } else {
              logger.error(`Vendor not found in either accounting_vendors or suppliers: ${vendor_id}`);
              throw new Error(`Vendor not found: ${vendor_id}. Please ensure the vendor exists in the system.`);
            }
          }
        }
      } else {
        // Non-UUID: Check if already mapped by vendor_code
        logger.info(`Non-UUID vendor_id provided, checking vendor_code mapping: ${vendor_id}`);
        const { data: mappedVendor } = await supabase
          .from('accounting_vendors')
          .select('id')
          .eq('vendor_code', vendor_id)
          .maybeSingle();

        if (mappedVendor) {
          resolvedVendorId = mappedVendor.id;
        } else {
          logger.warn(`Non-UUID vendor_id provided but no mapping found: ${vendor_id}`);
          // Possibly handle non-UUID lookups in suppliers if supported by schema
        }
      }
    }

    // Final validation before insert
    if (!resolvedVendorId) {
      throw new Error('Could not resolve vendor_id');
    }

    logger.info(`Creating bill with resolved vendor_id: ${resolvedVendorId}`);

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

    logger.info(`Bill created: ${bill_number}`);

    // Notify Auditor
    notificationService.notifyRole(
      'auditor',
      'New Bill Created',
      `Bill ${bill_number} for ${total_amount} has been recorded.`,
      {
        type: 'info',
        category: 'finance',
        priority: 'medium',
        actionUrl: '/dashboard/auditor/expenses',
        metadata: { bill_id: data.id }
      }
    ).catch(e => logger.error('Failed to notify auditor of new bill', e));

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendor_id, status, overdue } = req.query;

    let resolvedVendorId = vendor_id as string;
    if (resolvedVendorId) {
      // Try internal ID first
      const { data: exists } = await supabase
        .from('accounting_vendors')
        .select('id')
        .eq('id', resolvedVendorId)
        .maybeSingle();

      if (!exists) {
        // Try mapping code
        const { data: mapped } = await supabase
          .from('accounting_vendors')
          .select('id')
          .eq('vendor_code', resolvedVendorId)
          .maybeSingle();
        if (mapped) resolvedVendorId = mapped.id;
      }
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

export const recordBillPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, payment_date, bank_account_id, payment_method, reference, notes } = req.body;

    // 1. Get the bill
    const { data: bill, error: billError } = await supabase
      .from('accounting_ap_bills')
      .select('*')
      .eq('id', id)
      .single();

    if (billError || !bill) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }

    // 2. Update bill balance and status
    const paymentAmount = Number(amount);
    const newPaidAmount = (bill.paid_amount || 0) + paymentAmount;
    const newBalance = bill.total_amount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partially_paid' : 'unpaid');

    const { error: updateError } = await supabase
      .from('accounting_ap_bills')
      .update({
        paid_amount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // 3. Record bank transaction if account provided
    if (bank_account_id) {
      await supabase.from('accounting_bank_transactions').insert({
        bank_account_id,
        transaction_date: payment_date || new Date().toISOString().split('T')[0],
        debit_amount: 0,
        credit_amount: paymentAmount,
        reference: reference || `PYMT-BILL-${bill.bill_number}`,
        description: notes || `Payment made for bill ${bill.bill_number}`,
        reconciled: false
      });

      // Update bank balance
      const { data: bankAcc } = await supabase.from('accounting_bank_accounts').select('current_balance').eq('id', bank_account_id).single();
      if (bankAcc) {
        await supabase.from('accounting_bank_accounts').update({
          current_balance: (bankAcc.current_balance || 0) - paymentAmount,
          updated_at: new Date().toISOString()
        }).eq('id', bank_account_id);
      }
    }

    logger.info(`Payment of ${amount} recorded for bill ${bill.bill_number}`);

    // Notify Auditor
    notificationService.notifyRole(
      'auditor',
      'Bill Payment Recorded',
      `Payment of ${amount} recorded for bill ${bill.bill_number}.`,
      {
        type: 'info',
        category: 'finance',
        priority: 'medium',
        actionUrl: '/dashboard/auditor/expenses',
        metadata: { bill_id: id }
      }
    ).catch(e => logger.error('Failed to notify auditor of bill payment', e));

    res.status(200).json({ success: true, message: 'Payment recorded successfully' });
  } catch (error) {
    next(error);
  }
};

export const submitInvoiceForAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;

    // 1. Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('accounting_ar_invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (invoiceError || !invoice) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }

    // 2. Update status
    const { error: updateError } = await supabase
      .from('accounting_ar_invoices')
      .update({ status: 'posted_to_audit', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    // 3. Create approval request
    const { error: approvalError } = await supabase.from('approval_requests').insert({
      request_type: 'invoice',
      status: 'pending',
      requested_by: userId,
      amount: invoice.total_amount,
      description: `Audit request for invoice ${invoice.invoice_number}`,
      notes,
      metadata: { invoice_id: id }
    });

    if (approvalError) throw approvalError;

    logger.info(`Invoice ${invoice.invoice_number} submitted for audit by ${userId}`);

    // Notify Auditor
    notificationService.notifyRole(
      'auditor',
      'Audit Request: Invoice',
      `Invoice ${invoice.invoice_number} submitted for audit.`,
      {
        type: 'warning',
        category: 'audit',
        priority: 'high',
        actionUrl: '/dashboard/auditor/audit-requests',
        metadata: { invoice_id: id, type: 'invoice' }
      }
    ).catch(e => logger.error('Failed to notify auditor of invoice audit request', e));

    res.status(200).json({ success: true, message: 'Invoice submitted for audit' });
  } catch (error) {
    next(error);
  }
};

export const submitBillForAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;

    // 1. Get bill
    const { data: bill, error: billError } = await supabase
      .from('accounting_ap_bills')
      .select('*')
      .eq('id', id)
      .single();

    if (billError || !bill) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }

    // 2. Update status
    const { error: updateError } = await supabase
      .from('accounting_ap_bills')
      .update({ status: 'posted_to_audit', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    // 3. Create approval request
    const { error: approvalError } = await supabase.from('approval_requests').insert({
      request_type: 'bill',
      status: 'pending',
      requested_by: userId,
      amount: bill.total_amount,
      description: `Audit request for bill ${bill.bill_number}`,
      notes,
      metadata: { bill_id: id }
    });

    if (approvalError) throw approvalError;

    logger.info(`Bill ${bill.bill_number} submitted for audit by ${userId}`);

    // Notify Auditor
    notificationService.notifyRole(
      'auditor',
      'Audit Request: Bill',
      `Bill ${bill.bill_number} submitted for audit.`,
      {
        type: 'warning',
        category: 'audit',
        priority: 'high',
        actionUrl: '/dashboard/auditor/audit-requests',
        metadata: { bill_id: id, type: 'bill' }
      }
    ).catch(e => logger.error('Failed to notify auditor of bill audit request', e));

    res.status(200).json({ success: true, message: 'Bill submitted for audit' });
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
        total: invoices?.reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0) || 0,
        overdue: invoices?.filter((inv: any) => inv.status === 'unpaid' && inv.due_date < today)
          .reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0) || 0,
        current: invoices?.filter((inv: any) => inv.status === 'unpaid' && inv.due_date >= today)
          .reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0) || 0
      },
      payables: {
        total: bills?.reduce((sum: number, bill: any) => sum + (bill.balance || 0), 0) || 0,
        overdue: bills?.filter((bill: any) => bill.status === 'unpaid' && bill.due_date < today)
          .reduce((sum: number, bill: any) => sum + (bill.balance || 0), 0) || 0,
        current: bills?.filter((bill: any) => bill.status === 'unpaid' && bill.due_date >= today)
          .reduce((sum: number, bill: any) => sum + (bill.balance || 0), 0) || 0
      },
      cash: {
        total: bankAccounts?.reduce((sum: number, acc: any) => sum + (acc.current_balance || 0), 0) || 0,
        accounts: bankAccounts?.length || 0
      }
    };

    res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
};
