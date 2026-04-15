import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { migratePendingBills } from '../jobs/migrate-pending-bills.job';
import { applyBranchFilter } from '../utils/branchIsolation';
import { logger } from '../utils/logger';

export const createCreditBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, amount, description, date } = req.body;

        if (!staff_id || !amount || !description) {
            throw new AppError('Missing required fields', 400);
        }

        const cashier_id = (req as any).user?.id;
        const branch_id = (req as any).user?.branch_id;

        // Auto-detect current open shift for this cashier
        const { data: currentShift } = await supabase
            .from('cashier_shifts')
            .select('id')
            .eq('cashier_id', cashier_id)
            .eq('status', 'open')
            .single();

        const { data, error } = await supabase
            .from('staff_credit_bills')
            .insert({
                staff_id,
                amount,
                description,
                bill_date: date || new Date().toISOString().split('T')[0],
                status: 'pending',
                balance: amount,
                paid_amount: 0,
                shift_id: currentShift?.id || (req.body as any).shift_id,
                branch_id: branch_id || (req.body as any).branch_id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getCreditBills = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status } = req.query;

        let query = supabase
            .from('staff_credit_bills')
            .select('*')
            .order('bill_date', { ascending: false });

        query = applyBranchFilter(query, req);

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status === 'pending') query = query.eq('status', 'pending');
        if (status === 'paid' || status === 'deducted') query = query.eq('status', status);



        const { data, error } = await query;
        if (error) throw error;

        // Fetch staff names separately to avoid schema cache FK issues
        const staffIds = [...new Set((data || []).map((b: any) => b.staff_id).filter(Boolean))];
        const { data: staffProfiles } = staffIds.length > 0
            ? await supabase.from('staff_profiles').select('id, role, first_name, last_name, user_id').in('id', staffIds)
            : { data: [] };
        const userIds = (staffProfiles || []).map((s: any) => s.user_id).filter(Boolean);
        const { data: users } = userIds.length > 0
            ? await supabase.from('users').select('id, first_name, last_name').in('id', userIds)
            : { data: [] };

        const staffMap = new Map((staffProfiles || []).map((s: any) => [s.id, s]));
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        const transformed = (data || []).map((bill: any) => {
            const sp = staffMap.get(bill.staff_id);
            const user = sp ? userMap.get(sp.user_id) : null;
            return {
                ...bill,
                staff: sp ? {
                    id: sp.id,
                    role: sp.role,
                    first_name: user?.first_name || sp.first_name || '',
                    last_name: user?.last_name || sp.last_name || ''
                } : null
            };
        });

        res.status(200).json({ success: true, data: transformed });
    } catch (error) {
        next(error);
    }
};

export const updateCreditBillStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'pending' | 'deducted' | 'cancelled' | 'paid_cash'

        const validStatuses = ['pending', 'deducted', 'cancelled', 'paid_cash'];
        // Map legacy 'paid' to 'paid_cash'
        const resolvedStatus = status === 'paid' ? 'paid_cash' : status;

        if (!validStatuses.includes(resolvedStatus)) {
            throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
        }

        // Fetch current bill to get amount for full settlement tracking
        const { data: bill, error: fetchError } = await supabase
            .from('staff_credit_bills')
            .select('amount')
            .eq('id', id)
            .single();
        if (fetchError || !bill) throw new AppError('Credit bill not found', 404);

        let updateData: any = { status: resolvedStatus };

        // Full settlement: set paid_amount = amount, balance = 0
        if (resolvedStatus === 'paid_cash' || resolvedStatus === 'deducted') {
            updateData.paid_amount = bill.amount;
            updateData.balance = 0;
        }

        // If paying in cash, link to the current shift for reconciliation
        if (resolvedStatus === 'paid_cash') {
            const cashier_id = (req as any).user?.id;
            const { data: currentShift } = await supabase
                .from('cashier_shifts')
                .select('id')
                .eq('cashier_id', cashier_id)
                .eq('status', 'open')
                .single();

            if (currentShift) {
                updateData.paid_in_shift_id = currentShift.id;
            }

            // Record full payment in payments table
            await supabase.from('staff_credit_bill_payments').insert({
                credit_bill_id: id,
                amount: bill.amount,
                payment_method: 'cash',
                payment_date: new Date().toISOString().split('T')[0],
                recorded_by: (req as any).user?.id,
                shift_id: updateData.paid_in_shift_id || null,
                notes: 'Full settlement'
            });
        }

        const { data, error } = await supabase
            .from('staff_credit_bills')
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

// @desc    Record a partial payment against a credit bill
// @route   POST /api/payroll/credit-bills/:id/partial-payment
// @access  Private (Branch Accountant, Manager)
export const partialPayCreditBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { amount, payment_method, reference, notes } = req.body;

        const paymentAmount = parseFloat(amount);
        if (!paymentAmount || paymentAmount <= 0) {
            throw new AppError('Payment amount must be greater than 0', 400);
        }

        // Fetch current bill — only columns guaranteed to exist
        const { data: bill, error: fetchError } = await supabase
            .from('staff_credit_bills')
            .select('id, amount, status')
            .eq('id', id)
            .single();

        if (fetchError || !bill) throw new AppError('Credit bill not found', 404);

        if (['paid_cash', 'deducted', 'cancelled'].includes(bill.status)) {
            throw new AppError('This bill is already fully settled or cancelled', 400);
        }

        // Try to get paid_amount and balance — may not exist on older schemas
        let currentPaid = 0;
        let currentBalance = parseFloat(bill.amount);
        try {
            const { data: billFull, error: fullErr } = await supabase
                .from('staff_credit_bills')
                .select('paid_amount, balance')
                .eq('id', id)
                .single();
            if (!fullErr && billFull) {
                currentPaid = parseFloat(billFull.paid_amount ?? 0) || 0;
                currentBalance = (billFull.balance > 0)
                    ? parseFloat(billFull.balance)
                    : (parseFloat(bill.amount) - currentPaid);
            }
        } catch (_) {
            // columns don't exist yet — use defaults (full amount as balance)
        }

        if (paymentAmount > currentBalance + 0.001) { // small epsilon for float safety
            throw new AppError(`Payment amount (${paymentAmount}) exceeds remaining balance (${currentBalance})`, 400);
        }

        const newPaidAmount = currentPaid + paymentAmount;
        const newBalance = parseFloat(bill.amount) - newPaidAmount;
        const isFullyPaid = newBalance <= 0.001;

        // Get current open shift for reconciliation
        const cashier_id = (req as any).user?.id;
        const { data: currentShift } = await supabase
            .from('cashier_shifts')
            .select('id')
            .eq('cashier_id', cashier_id)
            .eq('status', 'open')
            .single();

        // Try to record in payments table — gracefully skip if table doesn't exist yet
        try {
            await supabase
                .from('staff_credit_bill_payments')
                .insert({
                    credit_bill_id: id,
                    amount: paymentAmount,
                    payment_method: payment_method || 'cash',
                    payment_date: new Date().toISOString().split('T')[0],
                    reference: reference || null,
                    notes: notes || null,
                    recorded_by: cashier_id,
                    shift_id: currentShift?.id || null
                });
        } catch (paymentTableErr) {
            logger.warn('staff_credit_bill_payments table may not exist yet, skipping payment record:', paymentTableErr);
        }

        // Update bill — build update object carefully
        // Use 'paid_cash' for full settlement (always valid), keep 'pending' for partial
        // to avoid constraint violation if migration 52 hasn't run yet
        const newStatus = isFullyPaid ? 'paid_cash' : 'pending';
        const billUpdate: any = { status: newStatus };

        // Only set balance/paid_amount if the columns exist (try/catch the update)
        try {
            billUpdate.paid_amount = newPaidAmount;
            billUpdate.balance = Math.max(0, newBalance);
            if (isFullyPaid && currentShift) {
                billUpdate.paid_in_shift_id = currentShift.id;
            }

            const { data: updatedBill, error: updateError } = await supabase
                .from('staff_credit_bills')
                .update(billUpdate)
                .eq('id', id)
                .select()
                .single();

            if (updateError) throw updateError;

            res.status(200).json({
                success: true,
                message: isFullyPaid ? 'Bill fully settled' : `Partial payment of KES ${paymentAmount.toLocaleString()} recorded`,
                data: updatedBill
            });
        } catch (updateErr: any) {
            // If update failed due to missing columns, retry with just status
            logger.warn('Full update failed, retrying with status only:', updateErr?.message);
            const { data: updatedBill, error: retryError } = await supabase
                .from('staff_credit_bills')
                .update({ status: newStatus })
                .eq('id', id)
                .select()
                .single();

            if (retryError) throw retryError;

            res.status(200).json({
                success: true,
                message: isFullyPaid ? 'Bill fully settled' : `Partial payment of KES ${paymentAmount.toLocaleString()} recorded`,
                data: updatedBill
            });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Get payment history for a credit bill
// @route   GET /api/payroll/credit-bills/:id/payments
// @access  Private
export const getCreditBillPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('staff_credit_bill_payments')
            .select('*, recorded_by_user:users!recorded_by(first_name, last_name)')
            .eq('credit_bill_id', id)
            .order('created_at', { ascending: false });

        // If table doesn't exist yet, return empty array gracefully
        if (error) {
            if (error.message?.includes('does not exist') || error.code === '42P01') {
                res.status(200).json({ success: true, data: [] });
                return;
            }
            throw error;
        }

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        next(error);
    }
};

// @desc    Manually trigger pending bills migration
// @route   POST /api/credit-bills/migrate-pending
// @access  Private (Branch Accountant, Manager)
export const triggerPendingBillsMigration = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        await migratePendingBills();

        res.status(200).json({
            success: true,
            message: 'Pending bills migration completed successfully'
        });
    } catch (error) {
        next(error);
    }
};
