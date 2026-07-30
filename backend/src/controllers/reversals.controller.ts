import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// POST /api/payments/reverse/:receiptId
export const reversePayment = async (req: Request, res: Response) => {
    try {
        const { receiptId } = req.params;
        const { reason } = req.body;
        const cashier_id = req.user?.id;
        
        if (!cashier_id) throw new AppError('Unauthorized', 401);
        if (!reason) throw new AppError('Reversal reason is required', 400);

        // Fetch original receipt
        const { data: originalReceipt, error: fetchErr } = await supabase
            .from('payment_receipts')
            .select('*')
            .eq('id', receiptId)
            .single();

        if (fetchErr || !originalReceipt) throw new AppError('Receipt not found', 404);
        if (originalReceipt.status === 'REVERSED') throw new AppError('Receipt is already reversed', 400);

        // Require active shift to log the reversal in the *current* open shift
        // We'll get it from the frontend or query it here
        const { data: activeShift } = await supabase
            .from('cashier_shifts')
            .select('id')
            .eq('cashier_id', cashier_id)
            .eq('status', 'open')
            .single();

        const currentShiftId = activeShift?.id || originalReceipt.shift_id;

        // 1. Create reversal receipt (negative amount)
        const reversalNumber = `REV-${originalReceipt.receipt_number}`;
        const { data: reversalReceipt, error: revReceiptErr } = await supabase
            .from('payment_receipts')
            .insert({
                receipt_number: reversalNumber,
                branch_id: originalReceipt.branch_id,
                cashier_id,
                shift_id: currentShiftId,
                customer_name: originalReceipt.customer_name,
                total_amount: -Number(originalReceipt.total_amount),
                notes: `Reversal of ${originalReceipt.receipt_number}: ${reason}`,
                status: 'POSTED'
            })
            .select()
            .single();

        if (revReceiptErr) throw new AppError(`Failed to create reversal receipt: ${revReceiptErr.message}`, 500);

        // 2. Mark original receipt as REVERSED
        await supabase
            .from('payment_receipts')
            .update({ status: 'REVERSED' })
            .eq('id', receiptId);

        // 3. Create cashier_entry_reversals record
        await supabase
            .from('cashier_entry_reversals')
            .insert({
                original_receipt_id: originalReceipt.id,
                reversal_receipt_id: reversalReceipt.id,
                reason,
                approved_by: cashier_id
            });

        // 4. Fetch Allocations to reverse them in the Ledger and target invoices
        const { data: allocations } = await supabase
            .from('payment_allocations')
            .select('*')
            .eq('receipt_id', receiptId);

        if (allocations && allocations.length > 0) {
            for (const alloc of allocations) {
                if (alloc.allocation_type === 'INVOICE') {
                    const { data: invoice } = await supabase
                        .from('corporate_invoices')
                        .select('*')
                        .eq('id', alloc.target_id)
                        .single();
                        
                    if (invoice) {
                        const newPaid = Math.max(0, Number(invoice.amount_paid) - Number(alloc.amount));
                        const newStatus = newPaid === 0 ? 'UNINVOICED' : (newPaid >= Number(invoice.amount_due) ? 'PAID' : 'PARTIALLY_PAID');
                        
                        await supabase
                            .from('corporate_invoices')
                            .update({ amount_paid: newPaid, status: newStatus })
                            .eq('id', invoice.id);
                            
                        // Reversal Ledger entry
                        await supabase
                            .from('customer_account_ledger')
                            .insert({
                                corporate_customer_id: invoice.corporate_customer_id,
                                customer_name: originalReceipt.customer_name,
                                transaction_type: 'REVERSAL',
                                amount: alloc.amount,
                                direction: 'OUT', // Increases debt back
                                reference_id: reversalReceipt.id
                            });
                    }
                }
            }
        }

        // 5. Update Cashier shift transactions (Money Out)
        await supabase
            .from('cashier_transactions')
            .insert({
                branch_id: originalReceipt.branch_id,
                shift_id: currentShiftId,
                cashier_id: cashier_id,
                amount: -Number(originalReceipt.total_amount),
                transaction_type: 'reversal',
                payment_method: 'mixed', 
                transaction_ref: reversalNumber,
                description: `Reversal of ${originalReceipt.receipt_number}`,
                origin_branch_id: originalReceipt.branch_id,
                receiving_branch_id: originalReceipt.branch_id,
                entry_type: 'REVERSAL',
                direction: 'OUT',
                allocation_status: 'REVERSED'
            });

        res.json({ success: true, data: { reversalReceipt } });
    } catch (error: any) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};
