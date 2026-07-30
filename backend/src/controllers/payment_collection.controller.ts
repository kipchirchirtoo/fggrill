import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { applyBranchFilter } from '../utils/branchIsolation';

/**
 * Single Point of Collection Controller
 * Receives all payments at the cashier desk.
 */

// POST /api/payments/receive
export const receivePayment = async (req: Request, res: Response) => {
    try {
        const {
            shift_id,
            receiving_branch_id,
            customer_name,
            total_amount,
            notes,
            tenders, // Array of { payment_method, payment_reference, amount }
            allocations // Array of { allocation_type, target_id, amount }
        } = req.body;
        
        const cashier_id = req.user?.id;

        if (!cashier_id) throw new AppError('Unauthorized', 401);
        if (!shift_id) throw new AppError('Active shift ID is required', 400);
        if (!tenders || tenders.length === 0) throw new AppError('Payment tenders are required', 400);
        if (!allocations || allocations.length === 0) throw new AppError('Payment allocations are required', 400);

        // Generate receipt number
        const receipt_number = `RCT-${receiving_branch_id}-${Date.now().toString().slice(-6)}`;

        // 1. Create the Receipt
        const { data: receipt, error: receiptErr } = await supabase
            .from('payment_receipts')
            .insert({
                receipt_number,
                branch_id: receiving_branch_id,
                cashier_id,
                shift_id,
                customer_name,
                total_amount,
                notes,
                status: 'POSTED'
            })
            .select()
            .single();

        if (receiptErr || !receipt) throw new AppError(`Failed to create receipt: ${receiptErr?.message}`, 500);

        // 2. Insert Tenders
        const tenderInserts = tenders.map((t: any) => ({
            receipt_id: receipt.id,
            payment_method: t.payment_method,
            payment_reference: t.payment_reference,
            amount: t.amount
        }));

        const { error: tendersErr } = await supabase.from('payment_tenders').insert(tenderInserts);
        if (tendersErr) throw new AppError(`Failed to save tenders: ${tendersErr.message}`, 500);

        // 3. Process Allocations and update targets
        const allocationInserts = [];
        const ledgerInserts = [];
        
        for (const alloc of allocations) {
            allocationInserts.push({
                receipt_id: receipt.id,
                allocation_type: alloc.allocation_type,
                target_id: alloc.target_id,
                amount: alloc.amount
            });

            if (alloc.allocation_type === 'INVOICE') {
                // Fetch the invoice
                const { data: invoice } = await supabase
                    .from('corporate_invoices')
                    .select('*')
                    .eq('id', alloc.target_id)
                    .single();
                
                if (invoice) {
                    const newPaid = Number(invoice.amount_paid || 0) + Number(alloc.amount);
                    const newStatus = newPaid >= Number(invoice.amount_due) ? 'PAID' : 'PARTIALLY_PAID';
                    
                    // Reduce Invoice balance
                    await supabase
                        .from('corporate_invoices')
                        .update({ amount_paid: newPaid, status: newStatus })
                        .eq('id', invoice.id);
                        
                    // Add Ledger Entry
                    ledgerInserts.push({
                        corporate_customer_id: invoice.corporate_customer_id,
                        customer_name,
                        transaction_type: 'PAYMENT',
                        amount: alloc.amount,
                        direction: 'IN', // Reduces debt
                        reference_id: receipt.id
                    });
                }
            } else if (alloc.allocation_type === 'ADVANCE') {
                ledgerInserts.push({
                    corporate_customer_id: alloc.target_id, // For advance, target_id is customer_id
                    customer_name,
                    transaction_type: 'ADVANCE',
                    amount: alloc.amount,
                    direction: 'IN',
                    reference_id: receipt.id
                });
            }
            // Add logic for POS_BILL, STAFF_CREDIT, etc. here if necessary.
        }

        // Insert allocations
        const { error: allocsErr } = await supabase.from('payment_allocations').insert(allocationInserts);
        if (allocsErr) throw new AppError(`Failed to save allocations: ${allocsErr.message}`, 500);

        // Insert Ledger entries if any
        if (ledgerInserts.length > 0) {
            const { error: ledgerErr } = await supabase.from('customer_account_ledger').insert(ledgerInserts);
            if (ledgerErr) throw new AppError(`Failed to update customer ledger: ${ledgerErr.message}`, 500);
        }

        // 4. Update the Cashier Logbook (Shift Transactions)
        // Record one transaction per tender for accurate cash breakdown
        const logbookInserts = tenders.map((t: any) => ({
            branch_id: receiving_branch_id,
            shift_id: shift_id,
            cashier_id: cashier_id,
            amount: t.amount,
            transaction_type: 'income',
            payment_method: t.payment_method, // Accurate per-tender method
            transaction_ref: receipt_number,
            description: `${t.payment_method} payment for receipt ${receipt_number}`,
            origin_branch_id: receiving_branch_id,
            receiving_branch_id: receiving_branch_id,
            entry_type: 'INVOICE_PAYMENT', // In reality, this might be POS_BILL_PAYMENT etc based on allocations
            direction: 'IN',
            allocation_status: 'ALLOCATED'
        }));

        const { error: logErr } = await supabase
            .from('cashier_transactions')
            .insert(logbookInserts);
            
        if (logErr) console.error("Warning: Could not log to cashier_transactions", logErr);

        res.json({ success: true, data: { receipt, allocations: allocationInserts, tenders: tenderInserts } });
    } catch (error: any) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// GET /api/payments/invoices/search
export const searchInvoices = async (req: Request, res: Response) => {
    try {
        let query = supabase
            .from('corporate_invoices')
            .select(`
                *,
                corporate_customer:corporate_customers(id, company_name, contact_person, phone)
            `)
            .in('status', ['UNINVOICED', 'INVOICED', 'PARTIALLY_PAID', 'PARTIAL']);
            
        // Filter by specific branch or global
        query = applyBranchFilter(query, req);

        const { search } = req.query;
        if (search) {
            query = query.or(`invoice_number.ilike.%${search}%,corporate_customer.company_name.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw new AppError(error.message, 500);

        res.json({ success: true, data });
    } catch (error: any) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};
