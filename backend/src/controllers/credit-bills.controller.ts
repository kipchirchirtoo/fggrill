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
                status: 'accountant_confirmed',
                balance: amount,
                paid_amount: 0,
                shift_id: currentShift?.id || (req.body as any).shift_id,
                branch_id: branch_id || (req.body as any).branch_id,
                approved_at: new Date().toISOString(),
                approved_by: cashier_id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

const toNumber = (value: unknown): number => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const openCreditStatuses = ['pending', 'accountant_confirmed', 'auditor_confirmed'];

async function syncLinkedCashierCreditBill(
    sourceCashierCreditBillId: string | null | undefined,
    payload: Record<string, any>
) {
    if (!sourceCashierCreditBillId) return;
    const cleaned = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
    );
    if (!Object.keys(cleaned).length) return;
    try {
        await supabase
            .from('credit_bills')
            .update(cleaned)
            .eq('id', sourceCashierCreditBillId);
    } catch (error) {
        logger.warn('Unable to sync linked cashier credit bill', {
            sourceCashierCreditBillId,
            error
        });
    }
}

export const getCreditBills = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status } = req.query;

        let query = supabase
            .from('staff_credit_bills')
            .select('*')
            .order('bill_date', { ascending: false });

        query = applyBranchFilter(query, req);

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status && status !== 'all') {
            if (status === 'outstanding') {
                query = query.in('status', ['accountant_confirmed', 'auditor_confirmed']);
            } else {
                query = query.eq('status', status);
            }
        }



        const { data, error } = await query;
        if (error) throw error;

        // Fetch staff names separately to avoid schema cache FK issues
        const staffIds = [...new Set((data || []).map((b: any) => b.staff_id).filter(Boolean))];
        const { data: staffProfiles } = staffIds.length > 0
            ? await supabase.from('staff_profiles').select('id, role, position, department, employee_number, national_id, first_name, last_name, user_id').in('id', staffIds)
            : { data: [] };
        const userIds = (staffProfiles || []).map((s: any) => s.user_id).filter(Boolean);
        const { data: users } = userIds.length > 0
            ? await supabase.from('users').select('id, first_name, last_name, employee_id').in('id', userIds)
            : { data: [] };

        const staffMap = new Map((staffProfiles || []).map((s: any) => [s.id, s]));
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        const transformed = (data || []).map((bill: any) => {
            const sp = staffMap.get(bill.staff_id);
            const user = sp ? userMap.get(sp.user_id) : null;
            return {
                ...bill,
                staff_name: `${user?.first_name || sp?.first_name || ''} ${user?.last_name || sp?.last_name || ''}`.trim(),
                employee_id: user?.employee_id || sp?.id_number || sp?.national_id || null,
                department: sp?.department || null,
                staff: sp ? {
                    id: sp.id,
                    role: sp.role || sp.position,
                    department: sp.department,
                    employee_id: user?.employee_id || sp.id_number || sp.national_id,
                    first_name: user?.first_name || sp.first_name || '',
                    last_name: user?.last_name || sp.last_name || ''
                } : null
            };
        }).filter((bill: any) => {
            if (status !== 'outstanding') return true;
            const balance = bill.balance !== null && bill.balance !== undefined
                ? toNumber(bill.balance)
                : Math.max(0, toNumber(bill.amount) - toNumber(bill.paid_amount));
            return balance > 0;
        });

        res.status(200).json({ success: true, data: transformed });
    } catch (error) {
        next(error);
    }
};

export const approveCreditBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const approvedAt = new Date().toISOString();
        const approvedBy = (req as any).user?.id || null;

        const { data: bill, error: fetchError } = await supabase
            .from('staff_credit_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !bill) throw new AppError('Credit bill not found', 404);
        if (['paid_cash', 'deducted', 'cancelled'].includes(bill.status)) {
            throw new AppError('This credit bill is already settled or cancelled', 400);
        }

        const updatePayload = {
            status: 'accountant_confirmed',
            accountant_confirmed_at: bill.accountant_confirmed_at || approvedAt,
            accountant_id: bill.accountant_id || approvedBy
        };

        const { data, error } = await supabase
            .from('staff_credit_bills')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await syncLinkedCashierCreditBill(bill.source_cashier_credit_bill_id, {
            accountant_confirmed_at: updatePayload.accountant_confirmed_at,
            accountant_id: updatePayload.accountant_id,
            approval_status: 'accountant_confirmed'
        });

        res.status(200).json({
            success: true,
            message: 'Credit bill approved and moved to outstanding staff credit',
            data
        });
    } catch (error) {
        next(error);
    }
};

export const updateCreditBillStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'pending' | 'deducted' | 'cancelled' | 'paid_cash'

        const validStatuses = ['pending', 'accountant_confirmed', 'auditor_confirmed', 'deducted', 'cancelled', 'paid_cash'];
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
            const { error } = await supabase.from('staff_credit_bill_payments').insert({
                credit_bill_id: id,
                amount: bill.amount,
                payment_method: 'cash',
                payment_date: new Date().toISOString().split('T')[0],
                recorded_by: (req as any).user?.id,
                shift_id: updateData.paid_in_shift_id || null,
                notes: 'Full settlement'
            });

            if (error) {

              console.error('Database error:', error);

              throw error;

            }
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
        const { amount, payment_method, reference, notes, cashier_paid_entry_id } = req.body;

        const paymentAmount = parseFloat(amount);
        if (!paymentAmount || paymentAmount <= 0) {
            throw new AppError('Payment amount must be greater than 0', 400);
        }

        // Fetch current bill — only columns guaranteed to exist
        const { data: bill, error: fetchError } = await supabase
            .from('staff_credit_bills')
            .select('id, amount, status, source_cashier_credit_bill_id')
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
                    notes: cashier_paid_entry_id
                        ? `Applied cashier paid-credit entry ${cashier_paid_entry_id}${notes ? `: ${notes}` : ''}`
                        : notes || null,
                    recorded_by: cashier_id,
                    shift_id: currentShift?.id || null
                });
        } catch (paymentTableErr) {
            logger.warn('staff_credit_bill_payments table may not exist yet, skipping payment record:', paymentTableErr);
        }

        // Update bill — build update object carefully
        // Use 'paid_cash' for full settlement (always valid), keep 'pending' for partial
        // to avoid constraint violation if migration 52 hasn't run yet
        const newStatus = isFullyPaid ? 'paid_cash' : bill.status;
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

            await syncLinkedCashierCreditBill(bill.source_cashier_credit_bill_id, {
                paid_amount: newPaidAmount,
                balance_amount: Math.max(0, newBalance),
                status: isFullyPaid ? 'paid' : undefined
            });

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

export const getCashierPaidCreditEntries = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = String(req.query.status || 'pending').toLowerCase();

        const collect = (shift: any, sourceTable: string) => {
            const entries = Array.isArray(shift.paid_bills_details)
                ? shift.paid_bills_details
                : [];
            return entries.map((entry: any, index: number) => {
                const applications = Array.isArray(entry.applications)
                    ? entry.applications
                    : [];
                const amount = toNumber(entry.amount);
                const appliedAmount = applications
                    .reduce((sum: number, app: any) => sum + toNumber(app.amount), 0);
                const remainingAmount = Math.max(0, amount - appliedAmount);
                const reviewStatus = String(
                    entry.review_status ||
                    (remainingAmount <= 0
                        ? 'fully_applied'
                        : appliedAmount > 0
                            ? 'partially_applied'
                            : 'pending_branch_accountant_review')
                );
                const entryId = entry.id || `${sourceTable}:${shift.id}:${index}`;
                return {
                    ...entry,
                    id: entryId,
                    entry_id: entryId,
                    source_table: sourceTable,
                    shift_id: shift.id,
                    shift_number: shift.shift_number,
                    branch_id: shift.branch_id,
                    cashier_id: shift.cashier_id,
                    cashier_name: shift.cashier_name,
                    shift_start: shift.shift_start,
                    shift_end: shift.shift_end,
                    shift_status: shift.status,
                    staff_id: entry.staff_id || null,
                    staff_name: entry.staff_name || entry.employee_name || entry.name || '',
                    employee_id: entry.employee_id || null,
                    department: entry.department || null,
                    amount,
                    applied_amount: appliedAmount,
                    remaining_amount: remainingAmount,
                    review_status: reviewStatus,
                    applications,
                    recorded_at: entry.recorded_at || shift.shift_end || shift.shift_start
                };
            });
        };

        let logQuery = supabase
            .from('cashier_shift_logs')
            .select('id, shift_number, branch_id, cashier_id, cashier_name, shift_start, shift_end, status, paid_bills_details')
            .order('shift_start', { ascending: false });
        logQuery = applyBranchFilter(logQuery, req);
        const { data: logShifts, error: logError } = await logQuery;
        if (logError) throw logError;

        let legacyQuery = supabase
            .from('cashier_shifts')
            .select('id, shift_number, branch_id, cashier_id, cashier_name, shift_start, shift_end, status, paid_bills_details')
            .order('shift_start', { ascending: false });
        legacyQuery = applyBranchFilter(legacyQuery, req);
        const { data: legacyShifts, error: legacyError } = await legacyQuery;
        if (legacyError && !['42P01', '42703', 'PGRST205', 'PGRST204'].includes(legacyError.code)) {
            throw legacyError;
        }

        const seen = new Set<string>();
        const rows = [
            ...((logShifts || []) as any[]).flatMap((shift) => collect(shift, 'cashier_shift_logs')),
            ...((legacyShifts || []) as any[]).flatMap((shift) => collect(shift, 'cashier_shifts')),
        ]
            .filter((entry: any) => {
                const key = [
                    entry.id,
                    entry.staff_id,
                    entry.staff_name,
                    entry.amount,
                    entry.recorded_at,
                ].join('|');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .filter((entry: any) => {
                if (status === 'all') return true;
                if (status === 'pending') return entry.remaining_amount > 0;
                if (status === 'applied') return entry.remaining_amount <= 0;
                return String(entry.review_status).toLowerCase() === status;
            });

        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

export const applyCashierPaidCreditEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { entryId } = req.params;
        const { staff_credit_bill_id, amount, notes } = req.body;
        const paymentAmount = toNumber(amount);

        if (!staff_credit_bill_id) throw new AppError('Select the staff credit bill to clear', 400);
        if (!paymentAmount || paymentAmount <= 0) throw new AppError('Payment amount must be greater than zero', 400);

        const sourceHint = String(req.body.source_table || '').trim();
        const sourceTables = sourceHint === 'cashier_shifts'
            ? ['cashier_shifts', 'cashier_shift_logs']
            : ['cashier_shift_logs', 'cashier_shifts'];

        let selectedShift: any = null;
        let selectedEntry: any = null;
        let selectedIndex = -1;
        let selectedTable = 'cashier_shift_logs';

        for (const table of sourceTables) {
            let shiftQuery = supabase
                .from(table)
                .select('id, shift_number, branch_id, cashier_id, cashier_name, paid_bills_details');
            shiftQuery = applyBranchFilter(shiftQuery, req);
            const { data: shifts, error: shiftError } = await shiftQuery;
            if (shiftError) {
                if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(shiftError.code)) continue;
                throw shiftError;
            }

            for (const shift of shifts || []) {
                const entries = Array.isArray(shift.paid_bills_details)
                    ? shift.paid_bills_details
                    : [];
                const index = entries.findIndex((entry: any, i: number) =>
                    String(entry.id || `${table}:${shift.id}:${i}`) === String(entryId));
                if (index >= 0) {
                    selectedShift = shift;
                    selectedEntry = entries[index];
                    selectedIndex = index;
                    selectedTable = table;
                    break;
                }
            }
            if (selectedShift) break;
        }

        if (!selectedShift || !selectedEntry || selectedIndex < 0) {
            throw new AppError('Cashier paid-credit entry not found', 404);
        }

        const applications = Array.isArray(selectedEntry.applications)
            ? selectedEntry.applications
            : [];
        const entryAmount = toNumber(selectedEntry.amount);
        const alreadyApplied = applications
            .reduce((sum: number, app: any) => sum + toNumber(app.amount), 0);
        const remainingEntryAmount = Math.max(0, entryAmount - alreadyApplied);
        if (paymentAmount > remainingEntryAmount + 0.001) {
            throw new AppError(`Payment amount exceeds remaining cashier paid-credit entry balance (${remainingEntryAmount})`, 400);
        }

        const { data: bill, error: billError } = await supabase
            .from('staff_credit_bills')
            .select('*')
            .eq('id', staff_credit_bill_id)
            .single();
        if (billError || !bill) throw new AppError('Staff credit bill not found', 404);
        if (selectedEntry.staff_id && bill.staff_id && String(selectedEntry.staff_id) !== String(bill.staff_id)) {
            throw new AppError('Paid-credit entry staff does not match selected credit bill staff', 400);
        }
        if (!openCreditStatuses.includes(String(bill.status))) {
            throw new AppError('Selected credit bill is not open for payment application', 400);
        }
        if (String(bill.status) === 'pending') {
            throw new AppError('Approve the credit bill before applying paid-credit entries', 400);
        }

        const currentPaid = toNumber(bill.paid_amount);
        const billAmount = toNumber(bill.amount);
        const currentBalance = bill.balance !== null && bill.balance !== undefined
            ? toNumber(bill.balance)
            : Math.max(0, billAmount - currentPaid);
        if (paymentAmount > currentBalance + 0.001) {
            throw new AppError(`Payment amount exceeds selected credit bill balance (${currentBalance})`, 400);
        }

        const newPaid = Math.min(billAmount, currentPaid + paymentAmount);
        const newBalance = Math.max(0, currentBalance - paymentAmount);
        const newStatus = newBalance <= 0 ? 'paid_cash' : bill.status;

        const { data: updatedBill, error: updateError } = await supabase
            .from('staff_credit_bills')
            .update({
                paid_amount: newPaid,
                balance: newBalance,
                status: newStatus,
                paid_in_shift_id: newStatus === 'paid_cash'
                    ? selectedShift.id
                    : bill.paid_in_shift_id || null
            })
            .eq('id', bill.id)
            .select()
            .single();
        if (updateError) throw updateError;

        const application = {
            staff_credit_bill_id: bill.id,
            amount: paymentAmount,
            applied_at: new Date().toISOString(),
            applied_by: (req as any).user?.id || null,
            notes: notes || null
        };
        const nextApplications = [...applications, application];
        const nextApplied = nextApplications
            .reduce((sum: number, app: any) => sum + toNumber(app.amount), 0);
        const nextRemaining = Math.max(0, entryAmount - nextApplied);
        const nextEntries = (Array.isArray(selectedShift.paid_bills_details)
            ? selectedShift.paid_bills_details
            : []).map((entry: any, index: number) => {
                if (index !== selectedIndex) return entry;
                return {
                    ...entry,
                    applications: nextApplications,
                    applied_amount: nextApplied,
                    remaining_amount: nextRemaining,
                    review_status: nextRemaining <= 0 ? 'fully_applied' : 'partially_applied',
                    reviewed_at: new Date().toISOString(),
                    reviewed_by: (req as any).user?.id || null
                };
            });

        const { error: shiftUpdateError } = await supabase
            .from(selectedTable)
            .update({ paid_bills_details: nextEntries })
            .eq('id', selectedShift.id);
        if (shiftUpdateError) throw shiftUpdateError;

        try {
            await supabase.from('staff_credit_bill_payments').insert({
                credit_bill_id: bill.id,
                amount: paymentAmount,
                payment_method: selectedEntry.payment_method || 'cash',
                payment_date: new Date().toISOString().split('T')[0],
                reference: selectedEntry.reference || null,
                notes: `Applied cashier paid-credit entry ${selectedEntry.id || entryId}${notes ? `: ${notes}` : ''}`,
                recorded_by: (req as any).user?.id || null,
                shift_id: selectedShift.id
            });
        } catch (paymentHistoryError) {
            logger.warn('Unable to write staff credit payment history for cashier paid-credit application', paymentHistoryError);
        }

        await syncLinkedCashierCreditBill(bill.source_cashier_credit_bill_id, {
            paid_amount: newPaid,
            balance_amount: newBalance,
            status: newBalance <= 0 ? 'paid' : undefined
        });

        res.status(200).json({
            success: true,
            message: newBalance <= 0
                ? 'Credit bill fully cleared from cashier paid-credit entry'
                : 'Partial credit payment applied',
            data: {
                bill: updatedBill,
                entry: {
                    ...selectedEntry,
                    applications: nextApplications,
                    applied_amount: nextApplied,
                    remaining_amount: nextRemaining,
                    review_status: nextRemaining <= 0 ? 'fully_applied' : 'partially_applied'
                }
            }
        });
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
            .select('*')
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

        const userIds = [...new Set((data || []).map((row: any) => row.recorded_by).filter(Boolean))];
        const { data: users } = userIds.length > 0
            ? await supabase.from('users').select('id, first_name, last_name').in('id', userIds)
            : { data: [] };
        const userMap = new Map((users || []).map((user: any) => [user.id, user]));
        const rows = (data || []).map((row: any) => ({
            ...row,
            recorded_by_user: userMap.get(row.recorded_by) || null
        }));

        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

// @desc    Manually trigger pending bills migration
// @route   POST /api/payroll/credit-bills/migrate-pending
// @access  Private (Branch Accountant, Manager)
export const triggerPendingBillsMigration = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = req.body?.branch_id
            ? Number(req.body.branch_id)
            : (req as any).user?.branch_id
                ? Number((req as any).user.branch_id)
                : undefined;

        await migratePendingBills(branchId);

        res.status(200).json({
            success: true,
            message: 'Pending bills migration completed successfully'
        });
    } catch (error) {
        next(error);
    }
};
