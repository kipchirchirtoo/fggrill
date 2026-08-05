import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { applyBranchFilter } from '../utils/branchIsolation';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Auto-process corporate bills whose credit term days have matured
export const autoProcessMaturedCorporateInvoices = async (): Promise<void> => {
    try {
        const { data: bills } = await supabase
            .from('corporate_credit_bills')
            .select('id, branch_id, corporate_customer_id, amount, created_at')
            .eq('status', 'UNINVOICED');

        if (!bills || bills.length === 0) return;

        const { data: customers } = await supabase
            .from('corporate_customers')
            .select('id, credit_period_days');

        if (!customers || customers.length === 0) return;

        const customerMap = new Map(customers.map(c => [c.id, c.credit_period_days || 30]));
        const nowMs = Date.now();

        const matureByCustomer: Record<string, { branchId: number; billIds: string[]; totalAmount: number; periodDays: number }> = {};

        for (const b of bills) {
            const periodDays = customerMap.get(b.corporate_customer_id) ?? 30;
            const createdAtMs = new Date(b.created_at).getTime();
            const ageDays = (nowMs - createdAtMs) / (1000 * 60 * 60 * 24);

            if (ageDays >= periodDays) {
                if (!matureByCustomer[b.corporate_customer_id]) {
                    matureByCustomer[b.corporate_customer_id] = {
                        branchId: b.branch_id,
                        billIds: [],
                        totalAmount: 0,
                        periodDays
                    };
                }
                matureByCustomer[b.corporate_customer_id].billIds.push(b.id);
                matureByCustomer[b.corporate_customer_id].totalAmount += Number(b.amount || 0);
            }
        }

        for (const [customerId, data] of Object.entries(matureByCustomer)) {
            if (data.billIds.length === 0) continue;

            const invNum = `INV-AUTO-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
            const dueDate = new Date(nowMs + data.periodDays * 24 * 60 * 60 * 1000).toISOString();

            const { data: invoice, error: invErr } = await supabase
                .from('corporate_invoices')
                .insert({
                    branch_id: data.branchId,
                    corporate_customer_id: customerId,
                    invoice_number: invNum,
                    amount_due: data.totalAmount,
                    amount_paid: 0,
                    status: 'UNPAID',
                    due_date: dueDate
                })
                .select()
                .single();

            if (!invErr && invoice) {
                await supabase
                    .from('corporate_credit_bills')
                    .update({
                        status: 'INVOICED',
                        corporate_invoice_id: invoice.id
                    })
                    .in('id', data.billIds);
                logger.info(`Auto-generated corporate invoice ${invNum} for customer ${customerId} (${data.billIds.length} bills, KES ${data.totalAmount})`);
            }
        }
    } catch (err) {
        logger.error('Error auto-processing matured corporate invoices:', err);
    }
};

// 1. Get Corporate Customers
export const getCorporateCustomers = async (req: Request, res: Response) => {
    try {
        await autoProcessMaturedCorporateInvoices();
        let query = supabase.from('corporate_customers').select('*').order('name');
        query = applyBranchFilter(query, req);
        
        const { data, error } = await query;
        if (error) {
            logger.warn('Error fetching corporate customers:', error.message);
            res.json({ success: true, data: [] });
            return;
        }

        res.json({ success: true, data: data || [] });
    } catch (error: any) {
        logger.error('Failed to get corporate customers:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 2. Create Corporate Customer
export const createCorporateCustomer = async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branch_id;
        const { name, contact_person, phone, email, credit_limit, credit_period_days, is_active } = req.body;

        const { data, error } = await supabase
            .from('corporate_customers')
            .insert({
                branch_id: branchId,
                name,
                contact_person,
                phone,
                email,
                credit_limit: credit_limit || 0,
                credit_period_days: credit_period_days || 30,
                is_active: is_active ?? true
            })
            .select()
            .single();

        if (error) throw new AppError(error.message, 400);
        res.status(201).json({ success: true, data });
    } catch (error: any) {
        logger.error('Failed to create corporate customer:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 3. Update Corporate Customer
export const updateCorporateCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        let query = supabase.from('corporate_customers').update(updates).eq('id', id);
        query = applyBranchFilter(query, req);

        const { data, error } = await query.select().single();
        if (error) throw new AppError(error.message, 400);

        res.json({ success: true, data });
    } catch (error: any) {
        logger.error('Failed to update corporate customer:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 4. Charge Corporate Credit (Cashier action)
export const chargeCorporateCredit = async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branch_id;
        const cashierId = (req as any).user.id;
        const { pos_bill_id, corporate_customer_id, amount, shift_id } = req.body;

        // Verify Customer and Credit Limit
        const { data: customer, error: customerErr } = await supabase
            .from('corporate_customers')
            .select('*')
            .eq('id', corporate_customer_id)
            .single();
        
        if (customerErr || !customer) throw new AppError('Corporate customer not found', 404);
        if (!customer.is_active) throw new AppError('Corporate account is inactive', 400);

        // Check current uninvoiced/unpaid balance (Simple sum of uninvoiced bills + unpaid invoices)
        const { data: uninvBills } = await supabase
            .from('corporate_credit_bills')
            .select('amount')
            .eq('corporate_customer_id', corporate_customer_id)
            .in('status', ['UNINVOICED', 'INVOICED']);
        
        const currentBalance = (uninvBills || []).reduce((sum, bill) => sum + Number(bill.amount), 0);
        
        if ((currentBalance + Number(amount)) > Number(customer.credit_limit)) {
            throw new AppError(`Credit limit exceeded. Limit: KES ${customer.credit_limit}, Current Balance: KES ${currentBalance}`, 400);
        }

        // 1. Record Corporate Credit Bill
        const { data: creditBill, error: creditErr } = await supabase
            .from('corporate_credit_bills')
            .insert({
                branch_id: branchId,
                corporate_customer_id,
                pos_bill_id,
                amount,
                cashier_id: cashierId,
                shift_id,
                status: 'UNINVOICED'
            })
            .select()
            .single();

        if (creditErr) throw new AppError(creditErr.message, 400);

        // 2. Update Master Bill to credit_bill and PAYMENT_METHOD to CORPORATE_CREDIT
        if (pos_bill_id) {
            const { error: updateMasterErr } = await supabase
                .from('pos_master_bills')
                .update({
                    payment_status: 'credit_bill',
                    status: 'credit_bill',
                    payment_method: 'CORPORATE_CREDIT'
                })
                .eq('id', pos_bill_id);
            if (updateMasterErr) {
                logger.warn('Failed updating pos_master_bills, trying pos_shift_orders:', updateMasterErr.message);
                await supabase
                    .from('pos_shift_orders')
                    .update({
                        payment_status: 'credit_bill',
                        status: 'credit_bill',
                        payment_method: 'CORPORATE_CREDIT'
                    })
                    .eq('id', pos_bill_id);
            }
        }

        res.json({ success: true, data: creditBill, message: 'Charged to Corporate Credit' });
    } catch (error: any) {
        logger.error('Failed to charge corporate credit:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 5. Get Pending Corporate Bills
export const getPendingCorporateBills = async (req: Request, res: Response) => {
    try {
        await autoProcessMaturedCorporateInvoices();
        let query = supabase
            .from('corporate_credit_bills')
            .select(`
                *,
                corporate_customers(name),
                pos_master_bills:pos_bill_id(bill_number)
            `)
            .eq('status', 'UNINVOICED')
            .order('created_at', { ascending: false });
            
        query = applyBranchFilter(query, req);
        let { data, error } = await query;
        if (error) {
            logger.warn('Embedded query failed for corporate_credit_bills, trying plain select:', error.message);
            let fallbackQuery = supabase
                .from('corporate_credit_bills')
                .select('*, corporate_customers(name)')
                .eq('status', 'UNINVOICED')
                .order('created_at', { ascending: false });
            fallbackQuery = applyBranchFilter(fallbackQuery, req);
            const fallbackRes = await fallbackQuery;
            if (fallbackRes.error) {
                logger.warn('Fallback query also failed for corporate_credit_bills:', fallbackRes.error.message);
                res.json({ success: true, data: [] });
                return;
            }
            data = fallbackRes.data || [];
        }

        res.json({ success: true, data: data || [] });
    } catch (error: any) {
        logger.error('Failed to get pending corporate bills:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 6. Generate Invoice
export const generateCorporateInvoice = async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branch_id;
        const accountantId = (req as any).user.id;
        const { corporate_customer_id, bill_ids } = req.body;

        if (!bill_ids || bill_ids.length === 0) {
            throw new AppError('No bills provided for invoice', 400);
        }

        // Get bills
        const { data: bills, error: billsErr } = await supabase
            .from('corporate_credit_bills')
            .select('amount, id, status')
            .in('id', bill_ids)
            .eq('corporate_customer_id', corporate_customer_id)
            .eq('status', 'UNINVOICED');
            
        if (billsErr || !bills || bills.length === 0) {
            throw new AppError('Could not fetch valid uninvoiced bills', 400);
        }

        const amountDue = bills.reduce((sum, b) => sum + Number(b.amount), 0);
        
        // Get customer terms
        const { data: customer } = await supabase.from('corporate_customers').select('credit_period_days').eq('id', corporate_customer_id).single();
        const days = customer?.credit_period_days || 30;
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);

        // Generate Invoice Number (Simple format INV-YYYYMMDD-XXXX)
        const invNum = `INV-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;

        const { data: invoice, error: invErr } = await supabase
            .from('corporate_invoices')
            .insert({
                branch_id: branchId,
                corporate_customer_id,
                invoice_number: invNum,
                amount_due: amountDue,
                amount_paid: 0,
                status: 'UNPAID',
                due_date: dueDate.toISOString(),
                created_by: accountantId
            })
            .select()
            .single();

        if (invErr) throw new AppError(invErr.message, 400);

        // Update bills
        const { error: updateBillsErr } = await supabase
            .from('corporate_credit_bills')
            .update({
                status: 'INVOICED',
                corporate_invoice_id: invoice.id
            })
            .in('id', bill_ids);
            
        if (updateBillsErr) throw new AppError(updateBillsErr.message, 400);

        res.status(201).json({ success: true, data: invoice });
    } catch (error: any) {
        logger.error('Failed to generate corporate invoice:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 7. Get Invoices
export const getCorporateInvoices = async (req: Request, res: Response) => {
    try {
        await autoProcessMaturedCorporateInvoices();
        let query = supabase
            .from('corporate_invoices')
            .select(`
                *,
                corporate_customers(name, phone, email)
            `)
            .order('created_at', { ascending: false });
            
        query = applyBranchFilter(query, req);
        let { data, error } = await query;
        if (error) {
            logger.warn('Embedded query failed for corporate_invoices, trying plain select:', error.message);
            let fallbackQuery = supabase
                .from('corporate_invoices')
                .select('*')
                .order('created_at', { ascending: false });
            fallbackQuery = applyBranchFilter(fallbackQuery, req);
            const fallbackRes = await fallbackQuery;
            if (fallbackRes.error) {
                logger.warn('Fallback query also failed for corporate_invoices:', fallbackRes.error.message);
                res.json({ success: true, data: [] });
                return;
            }
            data = fallbackRes.data || [];
        }

        res.json({ success: true, data: data || [] });
    } catch (error: any) {
        logger.error('Failed to get corporate invoices:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 8. Pay/Clear Invoice
export const payCorporateInvoice = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount } = req.body; // Amount being paid right now
        
        let query = supabase.from('corporate_invoices').select('*').eq('id', id);
        query = applyBranchFilter(query, req);
        const { data: invoice, error: invErr } = await query.single();
        
        if (invErr || !invoice) throw new AppError('Invoice not found', 404);

        const newPaid = Number(invoice.amount_paid) + Number(amount);
        const status = newPaid >= Number(invoice.amount_due) ? 'PAID' : 'PARTIAL';

        const { data: updatedInvoice, error: updateErr } = await supabase
            .from('corporate_invoices')
            .update({
                amount_paid: newPaid,
                status: status
            })
            .eq('id', id)
            .select()
            .single();
            
        if (updateErr) throw new AppError(updateErr.message, 400);

        // If PAID, mark the underlying bills as PAID too
        if (status === 'PAID') {
            await supabase
                .from('corporate_credit_bills')
                .update({ status: 'PAID' })
                .eq('corporate_invoice_id', id);
        }

        res.json({ success: true, data: updatedInvoice });
    } catch (error: any) {
        logger.error('Failed to pay corporate invoice:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};
