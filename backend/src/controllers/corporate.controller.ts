import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { applyBranchFilter } from '../utils/branchIsolation';
import { AppError } from '../middleware/errorHandler';

// 1. Get Corporate Customers
export const getCorporateCustomers = async (req: Request, res: Response) => {
    try {
        let query = supabase.from('corporate_customers').select('*').order('name');
        query = applyBranchFilter(query, req);
        
        const { data, error } = await query;
        if (error) throw new AppError(error.message, 400);

        // Map to include total_unpaid_amount if needed
        // For simplicity, we just return the raw customers
        res.json({ success: true, data });
    } catch (error: any) {
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
        const { error: updateBillErr } = await supabase
            .from('master_bills')
            .update({
                payment_status: 'credit_bill',
                status: 'credit_bill', // Treated as cleared but on credit
                payment_method: 'CORPORATE_CREDIT'
            })
            .eq('id', pos_bill_id);
            
        if (updateBillErr) throw new AppError(updateBillErr.message, 400);

        res.json({ success: true, data: creditBill, message: 'Charged to Corporate Credit' });
    } catch (error: any) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 5. Get Pending Corporate Bills
export const getPendingCorporateBills = async (req: Request, res: Response) => {
    try {
        let query = supabase
            .from('corporate_credit_bills')
            .select(`
                *,
                corporate_customers(name),
                auth_users:cashier_id(full_name),
                master_bills(bill_number)
            `)
            .eq('status', 'UNINVOICED')
            .order('created_at', { ascending: false });
            
        query = applyBranchFilter(query, req);
        const { data, error } = await query;
        if (error) throw new AppError(error.message, 400);

        res.json({ success: true, data });
    } catch (error: any) {
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
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 7. Get Invoices
export const getCorporateInvoices = async (req: Request, res: Response) => {
    try {
        let query = supabase
            .from('corporate_invoices')
            .select(`
                *,
                corporate_customers(name, phone, email)
            `)
            .order('created_at', { ascending: false });
            
        query = applyBranchFilter(query, req);
        const { data, error } = await query;
        if (error) throw new AppError(error.message, 400);

        res.json({ success: true, data });
    } catch (error: any) {
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
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};
