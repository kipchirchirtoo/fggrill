import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import db from '../db';
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

const openCreditStatuses = ['pending', 'approved', 'active', 'open', 'accountant_confirmed', 'auditor_confirmed'];

// The `credit_bills` table (the "cashier" side of a linked bill) is a lean
// table — it does NOT carry every field `staff_credit_bills` does (no
// balance/description/bill_date/department/paid_amount/approval_status
// columns). Callers here build payloads shaped for `staff_credit_bills` and
// forward them wholesale; without this allow-list, any of those
// staff-only fields reaching `credit_bills.update()` throws Postgres 42703
// ("column does not exist") and silently no-ops (see catch below) — this
// was firing continuously in production for `department` specifically via
// editCreditBill(). Only forward columns that actually exist on
// `credit_bills`.
const CREDIT_BILLS_COLUMNS = new Set([
    'amount', 'total_amount', 'reason', 'status',
    'amount_paid', 'balance_due', 'paid_amount', 'balance',
    'accountant_confirmed_at', 'accountant_id',
    'auditor_confirmed_at', 'auditor_id'
]);

// credit_bills.status has a CHECK constraint allowing only
// pending/confirmed/paid/cancelled. staff_credit_bills uses a wider set
// (e.g. 'voided') — map those onto the closest valid credit_bills value
// instead of letting the update fail with a 23514 constraint violation.
const CREDIT_BILLS_STATUS_MAP: Record<string, string> = {
    voided: 'cancelled',
    rejected: 'cancelled',
    accountant_confirmed: 'confirmed',
    auditor_confirmed: 'confirmed'
};

async function syncLinkedCashierCreditBill(
    sourceCashierCreditBillId: string | null | undefined,
    payload: Record<string, any>
) {
    if (!sourceCashierCreditBillId) return;
    const mappedPayload: Record<string, any> = { ...payload };
    if (payload.paid_amount !== undefined && payload.amount_paid === undefined) {
        mappedPayload.amount_paid = payload.paid_amount;
    }
    if (payload.balance_amount !== undefined && payload.balance_due === undefined) {
        mappedPayload.balance_due = payload.balance_amount;
    }
    if (payload.balance !== undefined && payload.balance_due === undefined) {
        mappedPayload.balance_due = payload.balance;
    }
    const cleaned = Object.fromEntries(
        Object.entries(mappedPayload).filter(
            ([key, value]) => value !== undefined && CREDIT_BILLS_COLUMNS.has(key)
        )
    );
    if (typeof cleaned.status === 'string' && CREDIT_BILLS_STATUS_MAP[cleaned.status]) {
        cleaned.status = CREDIT_BILLS_STATUS_MAP[cleaned.status];
    }
    if (!Object.keys(cleaned).length) return;
    try {
        const { error } = await supabase
            .from('credit_bills')
            .update(cleaned)
            .eq('id', sourceCashierCreditBillId);
        if (error) {
            logger.warn('Unable to sync linked cashier credit bill', {
                sourceCashierCreditBillId,
                error
            });
        }
    } catch (error) {
        logger.warn('Unable to sync linked cashier credit bill', {
            sourceCashierCreditBillId,
            error
        });
    }
}

export const getCreditBills = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status, from_date, to_date } = req.query;

        // Optional date-range scoping. Callers that need an accurate
        // all-time total (e.g. the branch dashboard's "Total Outstanding
        // Credit" figure, which must include bills older than any UI
        // window) never pass from_date/to_date, so they keep getting every
        // row exactly as before. The Staff Accounts screen, whose From/To
        // filter used to only filter client-side *after* fetching every
        // credit bill the branch has ever had (1000+ rows on every load —
        // the actual cause of it hanging/crashing), now passes its date
        // range through so the server does the filtering instead.
        const fromStr = from_date ? new Date(String(from_date)).toISOString().slice(0, 10) : null;
        const toStr = to_date ? new Date(String(to_date)).toISOString().slice(0, 10) : null;

        // ===== QUERY STAFF_CREDIT_BILLS (payroll system credits) =====
        let staffQuery = supabase
            .from('staff_credit_bills')
            .select('*')
            .order('bill_date', { ascending: false });
        if (fromStr) staffQuery = staffQuery.gte('bill_date', fromStr);
        if (toStr) staffQuery = staffQuery.lte('bill_date', toStr);

        staffQuery = applyBranchFilter(staffQuery, req);

        if (staff_id) staffQuery = staffQuery.eq('staff_id', staff_id);
        if (status && status !== 'all') {
            if (status === 'outstanding') {
                // Every unpaid status, not just pending/confirmed. Omitting
                // 'approved' and 'open' silently dropped the bulk of a staff
                // member's outstanding credit — making the accountant's "Record
                // Paid Bill" total (e.g. KES 800) diverge from the POS "My Credit
                // Bills" figure (e.g. KES 6400) for the same staff. Reuse the
                // canonical openCreditStatuses so this can't drift again.
                staffQuery = staffQuery.in('status', openCreditStatuses);
            } else {
                staffQuery = staffQuery.eq('status', status);
            }
        }

        // ===== QUERY CREDIT_BILLS (cashier station credits) =====
        // Wrapped in try-catch so a schema mismatch (missing bill_date/staff_id)
        // doesn't crash the whole endpoint — we still return staff_credit_bills.
        // Scoped on created_at (not credit_date) — createCreditBill never sets
        // credit_date, so filtering on it would silently drop every
        // cashier-created bill.
        let cashierCreditBills: any[] = [];
        try {
            let cashierQuery = supabase
                .from('credit_bills')
                .select('*')
                .order('created_at', { ascending: false });
            if (fromStr) cashierQuery = cashierQuery.gte('created_at', `${fromStr}T00:00:00.000Z`);
            if (toStr) cashierQuery = cashierQuery.lte('created_at', `${toStr}T23:59:59.999Z`);

            cashierQuery = applyBranchFilter(cashierQuery, req);

            if (staff_id) {
                cashierQuery = cashierQuery.eq('staff_id', staff_id);
            }
            if (status && status !== 'all') {
                if (status === 'outstanding') {
                    // Unpaid in both tables
                    cashierQuery = cashierQuery.in('status', ['open', 'pending']);
                } else if (status === 'pending') {
                    // staff_credit_bills calls it 'pending', credit_bills calls it 'open'
                    cashierQuery = cashierQuery.in('status', ['open', 'pending']);
                } else if (status === 'paid_cash' || status === 'deducted') {
                    // Paid / settled in credit_bills
                    cashierQuery = cashierQuery.eq('status', 'paid');
                } else if (status === 'cancelled') {
                    cashierQuery = cashierQuery.in('status', ['written_off', 'voided']);
                } else {
                    cashierQuery = cashierQuery.eq('status', status);
                }
            }

            const { data, error } = await cashierQuery;
            if (!error) cashierCreditBills = data || [];
            else logger.warn('credit_bills query failed (non-critical):', error.message);
        } catch (cashierErr: any) {
            logger.warn('credit_bills query exception (non-critical):', cashierErr.message);
        }

        const { data: staffCreditBills, error: staffError } = await staffQuery;
        if (staffError) throw staffError;

        // ===== NORMALIZE BOTH SOURCES TO COMMON SHAPE =====
        const normalizedStaffBills = (staffCreditBills || []).map((bill: any) => ({
            ...bill,
            // Ensure consistent field names
            amount: bill.amount,
            paid_amount: bill.paid_amount || bill.amount_paid || 0,
            balance: bill.balance !== null && bill.balance !== undefined
                ? bill.balance
                : (bill.amount - (bill.paid_amount || bill.amount_paid || 0)),
            source_table: 'staff_credit_bills'
        }));

        const normalizedCashierBills = (cashierCreditBills || []).map((bill: any) => ({
            ...bill,
            // Map cashier fields to staff_credit_bills field names for consistency
            amount: bill.total_amount || bill.amount || 0,
            paid_amount: bill.amount_paid || bill.paid_amount || 0,
                balance: bill.balance_due !== null && bill.balance_due !== undefined
                ? bill.balance_due
                : (bill.balance || (bill.total_amount || bill.amount || 0) - (bill.amount_paid || 0)),
            description: bill.description || `Credit bill for ${bill.customer_name || 'customer'}`,
            source_table: 'credit_bills'
        }));

        // ===== MERGE AND SORT BY BILL_DATE (DE-DUPLICATING LINKED ROWS) =====
        const existingSourceCashierIds = new Set(
            (staffCreditBills || [])
                .map((b: any) => b.source_cashier_credit_bill_id || b.bill_number)
                .filter(Boolean)
        );
        const unlinkedCashierBills = (normalizedCashierBills || []).filter(
            (b: any) => !existingSourceCashierIds.has(b.id) && !existingSourceCashierIds.has(b.bill_number)
        );
        const allBills = [...normalizedStaffBills, ...unlinkedCashierBills]
            .sort((a, b) => {
                const dateA = new Date(a.bill_date || a.created_at).getTime();
                const dateB = new Date(b.bill_date || b.created_at).getTime();
                return dateB - dateA; // descending
            });

        // ===== ENRICH WITH STAFF PROFILE DATA =====
        const staffIds = [...new Set(allBills.map((b: any) => b.staff_id).filter(Boolean))];
        const { data: staffProfiles } = staffIds.length > 0
            ? await supabase.from('staff_profiles').select('id, role, position, department, employee_number, national_id, first_name, last_name, user_id').in('id', staffIds)
            : { data: [] };
        const userIds = (staffProfiles || []).map((s: any) => s.user_id).filter(Boolean);
        const { data: users } = userIds.length > 0
            ? await supabase.from('users').select('id, first_name, last_name, employee_id').in('id', userIds)
            : { data: [] };

        const staffMap = new Map((staffProfiles || []).map((s: any) => [s.id, s]));
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        const transformed = allBills.map((bill: any) => {
            const sp = staffMap.get(bill.staff_id);
            const user = sp ? userMap.get(sp.user_id) : null;

            // Use existing staff_name if present (from credit_bills), otherwise build from profile
            let staffName = bill.staff_name || bill.customer_name || '';
            if (sp || user) {
                staffName = `${user?.first_name || sp?.first_name || ''} ${user?.last_name || sp?.last_name || ''}`.trim();
            }

            return {
                ...bill,
                staff_name: staffName,
                employee_id: user?.employee_id || sp?.employee_number || sp?.national_id || bill.employee_id || null,
                department: sp?.department || bill.department || null,
                staff: sp ? {
                    id: sp.id,
                    role: sp.role || sp.position,
                    department: sp.department,
                    employee_id: user?.employee_id || sp.employee_number || sp.national_id,
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
            billUpdate.amount_paid = newPaidAmount;
            billUpdate.balance = Math.max(0, newBalance);
            billUpdate.is_paid = isFullyPaid;
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
                amount_paid: newPaidAmount,
                balance_amount: Math.max(0, newBalance),
                balance_due: Math.max(0, newBalance),
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
        // Optional — like getCreditBills, only scope by date when the caller
        // asks for it (the dashboard's outstanding total needs every
        // still-unapplied entry regardless of shift age). Without this every
        // load scanned paid_bills_details across every shift the branch has
        // ever run, unbounded.
        const fromStr = req.query.from_date ? new Date(String(req.query.from_date)).toISOString() : null;
        const toStr = req.query.to_date
            ? new Date(`${String(req.query.to_date)}T23:59:59.999Z`).toISOString()
            : null;

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
        if (fromStr) logQuery = logQuery.gte('shift_start', fromStr);
        if (toStr) logQuery = logQuery.lte('shift_start', toStr);
        logQuery = applyBranchFilter(logQuery, req);
        const { data: logShifts, error: logError } = await logQuery;
        if (logError) throw logError;

        let legacyQuery = supabase
            .from('cashier_shifts')
            .select('id, shift_number, branch_id, cashier_id, cashier_name, shift_start, shift_end, status, paid_bills_details')
            .order('shift_start', { ascending: false });
        if (fromStr) legacyQuery = legacyQuery.gte('shift_start', fromStr);
        if (toStr) legacyQuery = legacyQuery.lte('shift_start', toStr);
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
        let updatedBill: any = null;
        const isAutoAllocate = !staff_credit_bill_id ||
            staff_credit_bill_id === 'auto' ||
            staff_credit_bill_id === 'unlinked' ||
            staff_credit_bill_id === 'salary_credit';

        if (!isAutoAllocate) {
            let bill: any = null;
            let isStaffTable = true;
            const { data: sBill } = await supabase
                .from('staff_credit_bills')
                .select('*')
                .eq('id', staff_credit_bill_id)
                .maybeSingle();

            if (sBill) {
                bill = sBill;
                isStaffTable = true;
            } else {
                const { data: cBill } = await supabase
                    .from('credit_bills')
                    .select('*')
                    .eq('id', staff_credit_bill_id)
                    .maybeSingle();
                if (cBill) {
                    bill = cBill;
                    isStaffTable = false;
                }
            }

            if (!bill) throw new AppError('Staff credit bill not found', 404);
            if (selectedEntry.staff_id && bill.staff_id && String(selectedEntry.staff_id) !== String(bill.staff_id)) {
                throw new AppError('Paid-credit entry staff does not match selected credit bill staff', 400);
            }
            if (!openCreditStatuses.includes(String(bill.status))) {
                throw new AppError('Selected credit bill is not open for payment application', 400);
            }

            const currentPaid = toNumber(isStaffTable ? bill.paid_amount || bill.amount_paid : bill.amount_paid || bill.paid_amount);
            const billAmount = toNumber(isStaffTable ? bill.amount : bill.total_amount || bill.amount);
            const currentBalance = bill.balance !== null && bill.balance !== undefined
                ? toNumber(bill.balance)
                : (bill.balance_due !== null && bill.balance_due !== undefined
                    ? toNumber(bill.balance_due)
                    : Math.max(0, billAmount - currentPaid));

            const appliedToThisBill = Math.min(currentBalance, paymentAmount);
            const newPaid = Math.min(billAmount, currentPaid + appliedToThisBill);
            const newBalance = Math.max(0, currentBalance - appliedToThisBill);
            const newStatus = newBalance <= 0.001 ? 'paid' : (bill.status === 'pending' ? 'approved' : bill.status);

            if (isStaffTable) {
                const { data: uBill, error: updateError } = await supabase
                    .from('staff_credit_bills')
                    .update({
                        paid_amount: newPaid,
                        amount_paid: newPaid,
                        balance: newBalance,
                        is_paid: newBalance <= 0.001,
                        status: newStatus,
                        paid_in_shift_id: newBalance <= 0.001
                            ? selectedShift.id
                            : bill.paid_in_shift_id || null
                    })
                    .eq('id', bill.id)
                    .select()
                    .single();
                if (updateError) throw updateError;
                updatedBill = uBill;

                await syncLinkedCashierCreditBill(bill.source_cashier_credit_bill_id, {
                    amount_paid: newPaid,
                    paid_amount: newPaid,
                    balance_due: newBalance,
                    balance: newBalance,
                    status: newBalance <= 0.001 ? 'paid' : undefined
                });
            } else {
                const { data: uBill, error: updateError } = await supabase
                    .from('credit_bills')
                    .update({
                        amount_paid: newPaid,
                        balance_due: newBalance,
                        status: newStatus
                    })
                    .eq('id', bill.id)
                    .select()
                    .single();
                if (updateError) throw updateError;
                updatedBill = uBill;
            }

            try {
                await supabase.from('staff_credit_bill_payments').insert({
                    bill_id: bill.id,
                    credit_bill_id: bill.id,
                    amount: appliedToThisBill,
                    method: selectedEntry.payment_method || 'cash',
                    payment_method: selectedEntry.payment_method || 'cash',
                    paid_on: new Date().toISOString().split('T')[0],
                    payment_date: new Date().toISOString().split('T')[0],
                    reference: selectedEntry.reference || null,
                    notes: `Applied cashier paid-credit entry ${selectedEntry.id || entryId}${notes ? `: ${notes}` : ''}`,
                    recorded_by: (req as any).user?.id || null,
                    shift_id: selectedShift.id
                });
            } catch (paymentHistoryError) {
                logger.warn('Unable to write staff credit payment history for cashier paid-credit application', paymentHistoryError);
            }
        } else {
            const staffId = selectedEntry.staff_id;
            if (staffId) {
                await allocateStaffCreditPayment(
                    String(staffId),
                    selectedShift.branch_id || null,
                    paymentAmount,
                    selectedEntry.payment_method || 'cash',
                    (req as any).user?.id || null,
                    notes || `Cashier paid bill credit`,
                    selectedShift.id
                );
            }
        }

        const application = {
            staff_credit_bill_id: !isAutoAllocate ? staff_credit_bill_id : null,
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

        res.status(200).json({
            success: true,
            message: !isAutoAllocate && updatedBill?.balance <= 0
                ? 'Credit bill fully cleared from cashier paid-credit entry'
                : 'Payment entry approved and recorded',
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

// @desc    Branch-wide history of every recorded paid-bill payment (the money
//          applied against staff credit bills), newest first. Powers the
//          "Paid History" tab so there is one place to see all paid bills.
// @route   GET /api/payroll/credit-bills/payments
export const getBranchCreditBillPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const branchId = (req as any).user?.branch_id ?? req.query.branch_id ?? null;
        if (!branchId) throw new AppError('branch_id required', 400);
        const { from_date, to_date, staff_id } = req.query;

        const params: any[] = [branchId];
        let where = 'b.branch_id = $1';
        if (from_date) { params.push(String(from_date)); where += ` AND p.created_at::date >= $${params.length}`; }
        if (to_date) { params.push(String(to_date)); where += ` AND p.created_at::date <= $${params.length}`; }
        if (staff_id) { params.push(String(staff_id)); where += ` AND b.staff_id = $${params.length}`; }

        const { rows } = await db.query(
            `SELECT p.id, p.amount,
                    COALESCE(p.payment_method, p.method) AS payment_method,
                    p.reference, p.notes, p.created_at, p.recorded_by,
                    b.staff_id, b.bill_number, b.description,
                    NULLIF(TRIM(CONCAT(sp.first_name, ' ', sp.last_name)), '') AS staff_name,
                    NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS recorded_by_name
               FROM staff_credit_bill_payments p
               JOIN staff_credit_bills b ON b.id = COALESCE(p.credit_bill_id, p.bill_id)
               LEFT JOIN staff_profiles sp ON sp.id = b.staff_id
               LEFT JOIN users u ON u.id = p.recorded_by
              WHERE ${where}
              ORDER BY p.created_at DESC
              LIMIT 1000`,
            params
        );
        res.status(200).json({ success: true, data: rows });
    } catch (error: any) {
        // Table not present yet → empty list rather than a broken screen.
        if (error?.code === '42P01') { res.status(200).json({ success: true, data: [] }); return; }
        next(error);
    }
};

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

// @desc    Get detailed line items and POS order contents for a credit bill
// @route   GET /api/payroll/credit-bills/:id/contents
// @access  Private (Branch Accountant, Manager, Auditor)
export const getCreditBillContents = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // 1. Fetch bill from staff_credit_bills or credit_bills
        let { data: staffBill } = await supabase
            .from('staff_credit_bills')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        let cashierBill: any = null;
        if (!staffBill) {
            const { data } = await supabase
                .from('credit_bills')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            cashierBill = data;
        }

        const targetBill = staffBill || cashierBill;
        if (!targetBill) {
            throw new AppError('Credit bill not found', 404);
        }

        const crdMatch = (targetBill.description || '').match(/CRD-[\w-]+/)?.[0];
        const staffNameMatch = (targetBill.description || '').replace(/^Cashier Credit Bill - CRD-[\w-]+ -\s*/i, '').trim();

        // Also fetch linked cashier credit_bill if source_cashier_credit_bill_id or CRD code is present
        if (!cashierBill) {
            if (targetBill.source_cashier_credit_bill_id) {
                const { data: linkedCb } = await supabase
                    .from('credit_bills')
                    .select('*')
                    .eq('id', targetBill.source_cashier_credit_bill_id)
                    .maybeSingle();
                if (linkedCb) cashierBill = linkedCb;
            }
            if (!cashierBill && crdMatch) {
                const { data: linkedCb } = await supabase
                    .from('credit_bills')
                    .select('*')
                    .or(`credit_number.eq.${crdMatch},bill_number.eq.${crdMatch}`)
                    .maybeSingle();
                if (linkedCb) cashierBill = linkedCb;
            }
        }

        let rawItems: any[] = [];
        let orderHeader: any = null;

        // 2. Check JSON items stored directly on targetBill or cashierBill
        const directJsonItems = targetBill.items || targetBill.items_snapshot || targetBill.metadata?.items || targetBill.order_items || cashierBill?.items || cashierBill?.items_snapshot || cashierBill?.order_items;
        if (Array.isArray(directJsonItems) && directJsonItems.length > 0) {
            rawItems = directJsonItems;
        } else if (typeof directJsonItems === 'string') {
            try { rawItems = JSON.parse(directJsonItems); } catch (_) {}
        }

        const billAmt = Number(targetBill.amount || targetBill.total_amount || cashierBill?.total_amount || cashierBill?.amount || 0);
        const candidatePosIds = [
            targetBill.source_document_id,
            targetBill.source_pos_order_id,
            targetBill.pos_bill_id,
            cashierBill?.source_document_id,
            cashierBill?.source_pos_order_id,
            cashierBill?.pos_order_id,
            cashierBill?.order_id
        ].filter(Boolean);

        const billDocNo = targetBill.source_document_number || targetBill.bill_number || cashierBill?.source_document_number || cashierBill?.bill_number;

        // 3. Query pos_shift_orders
        if (!rawItems || !rawItems.length) {
            try {
                let shiftOrder: any = null;

                // 3a. Query by staff_credit_bill_id directly
                if (targetBill.id) {
                    const { data: matchedByStaffBill } = await supabase
                        .from('pos_shift_orders')
                        .select('*')
                        .eq('staff_credit_bill_id', targetBill.id)
                        .maybeSingle();
                    if (matchedByStaffBill) shiftOrder = matchedByStaffBill;
                }

                // 3b. Match by candidate POS order IDs
                if (!shiftOrder && candidatePosIds.length > 0) {
                    const { data: matchedById } = await supabase
                        .from('pos_shift_orders')
                        .select('*')
                        .in('id', candidatePosIds)
                        .maybeSingle();
                    if (matchedById) shiftOrder = matchedById;
                }

                // 3c. Match by document / CRD order number
                if (!shiftOrder && (billDocNo || crdMatch)) {
                    const searchCodes = [billDocNo, crdMatch].filter(Boolean);
                    const { data: matchedByDoc } = await supabase
                        .from('pos_shift_orders')
                        .select('*')
                        .in('order_number', searchCodes)
                        .maybeSingle();
                    if (matchedByDoc) shiftOrder = matchedByDoc;

                    if (!shiftOrder) {
                        const { data: matchedByShortCode } = await supabase
                            .from('pos_shift_orders')
                            .select('*')
                            .in('short_code', searchCodes)
                            .maybeSingle();
                        if (matchedByShortCode) shiftOrder = matchedByShortCode;
                    }
                }

                // 3d. Match by staff waiter ID or name + amount
                if (!shiftOrder && (staffNameMatch || targetBill.staff_id) && billAmt > 0) {
                    let orderQuery = supabase.from('pos_shift_orders').select('*');
                    if (targetBill.staff_id) {
                        orderQuery = orderQuery.eq('waiter_id', targetBill.staff_id);
                    } else if (staffNameMatch) {
                        orderQuery = orderQuery.or(`waiter_name.ilike.%${staffNameMatch}%,customer_name.ilike.%${staffNameMatch}%`);
                    }
                    const { data: candidates } = await orderQuery.order('created_at', { ascending: false }).limit(30);

                    if (candidates && candidates.length > 0) {
                        const bTime = new Date(targetBill.created_at || targetBill.bill_date || Date.now()).getTime();
                        shiftOrder = candidates.find(c => {
                            const cAmt = Number(c.total_amount || 0);
                            const cTime = new Date(c.created_at || 0).getTime();
                            return Math.abs(cAmt - billAmt) <= 2 && Math.abs(cTime - bTime) <= 72 * 3600 * 1000;
                        }) || null;
                    }
                }

                if (shiftOrder) {
                    orderHeader = shiftOrder;
                    if (Array.isArray(shiftOrder.items) && shiftOrder.items.length > 0) {
                        rawItems = shiftOrder.items;
                    } else if (typeof shiftOrder.items === 'string') {
                        try { rawItems = JSON.parse(shiftOrder.items); } catch (_) {}
                    }
                }
            } catch (err: any) {
                logger.warn('pos_shift_orders query exception:', err?.message || err);
            }
        }

        // 4. Query cashier_shift_transactions if still empty
        if (!rawItems || !rawItems.length) {
            try {
                const { data: txn } = await supabase
                    .from('cashier_shift_transactions')
                    .select('*')
                    .eq('credit_bill_id', targetBill.id)
                    .maybeSingle();

                if (txn && txn.items) {
                    if (Array.isArray(txn.items) && txn.items.length > 0) {
                        rawItems = txn.items;
                    } else if (typeof txn.items === 'string') {
                        try { rawItems = JSON.parse(txn.items); } catch (_) {}
                    }
                }
            } catch (_) {}
        }

        // 4.5. Query cashier_shifts table for credit_bills_details
        if (!rawItems || !rawItems.length) {
            const shiftIdToSearch = targetBill.shift_id || targetBill.source_pos_shift_id || cashierBill?.shift_id || cashierBill?.source_pos_shift_id;
            if (shiftIdToSearch) {
                try {
                    const { data: shiftRow } = await supabase
                        .from('cashier_shifts')
                        .select('credit_bills_details, sales_breakdown')
                        .eq('id', shiftIdToSearch)
                        .maybeSingle();

                    if (shiftRow) {
                        const details = Array.isArray(shiftRow.credit_bills_details)
                            ? shiftRow.credit_bills_details
                            : (shiftRow.sales_breakdown?.credit_bills_details || []);

                        const matchedEntry = (details || []).find((b: any) => {
                            const bAmt = Number(b.amount || b.total_amount || 0);
                            const bRef = String(b.reference || b.credit_number || b.id || '');
                            const bStaff = String(b.staff_id || b.staff_name || b.name || '');
                            return (crdMatch && bRef.includes(crdMatch)) ||
                                (targetBill.staff_id && bStaff === String(targetBill.staff_id)) ||
                                (Math.abs(bAmt - billAmt) <= 1);
                        });

                        if (matchedEntry && matchedEntry.items) {
                            if (Array.isArray(matchedEntry.items) && matchedEntry.items.length > 0) {
                                rawItems = matchedEntry.items;
                            } else if (typeof matchedEntry.items === 'string') {
                                try { rawItems = JSON.parse(matchedEntry.items); } catch (_) {}
                            }
                        }
                    }
                } catch (_) {}
            }
        }

        // 5. Query restaurant_orders if still empty
        if (!rawItems || !rawItems.length) {
            try {
                let restOrder: any = null;
                if (crdMatch || billDocNo) {
                    const searchCodes = [crdMatch, billDocNo].filter(Boolean);
                    const { data: ro } = await supabase
                        .from('restaurant_orders')
                        .select('*, items:restaurant_order_items(*)')
                        .in('order_number', searchCodes)
                        .maybeSingle();
                    if (ro) restOrder = ro;
                }

                if (restOrder) {
                    orderHeader = restOrder;
                    if (Array.isArray(restOrder.items) && restOrder.items.length > 0) {
                        rawItems = restOrder.items;
                    }
                }
            } catch (_) {}
        }

        // 6. Query pos_master_bills if still empty
        if (!rawItems || !rawItems.length) {
            try {
                const targetMasterId = candidatePosIds[0] || targetBill.id;
                const { data: masterBill } = await supabase
                    .from('pos_master_bills')
                    .select('*, pos_bill_items(*)')
                    .eq('id', targetMasterId)
                    .maybeSingle();

                if (masterBill) {
                    orderHeader = masterBill;
                    rawItems = masterBill.pos_bill_items || [];
                }
            } catch (_) {}
        }

        // 6.5. Query kitchen shift variance items if this is a kitchen variance bill
        const isKitchenBill = String(targetBill.bill_number || '').startsWith('CRD-KV') ||
            String(targetBill.description || '').toLowerCase().includes('kitchen') ||
            targetBill.metadata?.bill_type === 'kitchen_variance' ||
            targetBill.metadata?.bill_type === 'production_shortfall';

        if ((!rawItems || !rawItems.length) && (targetBill.shift_id || isKitchenBill)) {
            try {
                if (targetBill.shift_id) {
                    const { getKitchenShiftVarianceItems } = await import('./kitchen-shift.controller');
                    const kvItems = await getKitchenShiftVarianceItems(targetBill.shift_id);
                    if (kvItems && kvItems.length > 0) {
                        rawItems = kvItems;
                    }
                }
            } catch (err: any) {
                logger.warn('Kitchen shift variance items fetch fallback failed:', err?.message || err);
            }
        }

        if (!orderHeader && (isKitchenBill || targetBill.shift_id)) {
            let shiftNumber = targetBill.metadata?.shift_number || '';
            let shiftDate = targetBill.metadata?.shift_date || targetBill.bill_date || '';
            if (targetBill.shift_id && !shiftNumber) {
                try {
                    const { data: ks } = await supabase
                        .from('kitchen_shifts')
                        .select('shift_number, shift_date, department')
                        .eq('id', targetBill.shift_id)
                        .maybeSingle();
                    if (ks) {
                        shiftNumber = ks.shift_number || '';
                        shiftDate = ks.shift_date || shiftDate;
                    }
                } catch (_) {}
            }
            orderHeader = {
                order_number: targetBill.bill_number || `CRD-KV-${(targetBill.id || '').slice(0, 8)}`,
                source: 'kitchen_variance',
                source_type: 'Kitchen Variance Credit Bill',
                shift_number: shiftNumber,
                shift_date: shiftDate,
                total_amount: targetBill.amount,
                department: 'Kitchen',
                notes: targetBill.description
            };
        }

        // 7. Fetch staff profile if linked
        let staffProfile: any = null;
        if (targetBill.staff_id) {
            const { data: sp } = await supabase
                .from('staff_profiles')
                .select('*, users(first_name, last_name, employee_id)')
                .eq('id', targetBill.staff_id)
                .maybeSingle();
            staffProfile = sp;
        }

        // 8. Format line items consistently
        const firstNumber = (row: any, keys: string[]) => {
            for (const key of keys) {
                const value = Number(row?.[key]);
                if (Number.isFinite(value) && value > 0) return value;
            }
            return 0;
        };

        const formattedItems = (rawItems || []).map((item: any, idx: number) => {
            const qty = firstNumber(item, ['quantity', 'qty', 'count', 'variance_qty']) || 1;
            const price = firstNumber(item, [
                'unit_price',
                'cost_price',
                'selling_price',
                'menu_price',
                'retail_price',
                'price_each',
                'price',
                'rate',
                'amount'
            ]);
            const total = firstNumber(item, [
                'total_price',
                'variance_cost',
                'variance_value',
                'line_total',
                'total_amount',
                'extended_price',
                'active_total',
                'subtotal',
                'total',
                'amount'
            ]) || (qty * price);
            let rawItemName = item.name || item.item_name || item.description || item.title || 'Food & Beverage Item';
            if (rawItemName.startsWith('Cashier Credit Bill - CRD-')) {
                rawItemName = item.name || item.item_name || 'Food & Beverage Item';
                if (rawItemName.startsWith('Cashier Credit Bill - CRD-')) {
                    rawItemName = 'Food & Beverage Item';
                }
            }
            return {
                id: item.id || `${targetBill.id}_${idx}`,
                name: rawItemName,
                item_sku: item.item_sku || item.sku || '',
                unit: item.unit || '',
                category: item.category || (isKitchenBill ? 'Kitchen Variance' : (item.department || item.item_group || 'Food & Beverage')),
                quantity: qty,
                variance_qty: item.variance_qty != null ? item.variance_qty : (isKitchenBill ? -qty : null),
                unit_price: price,
                cost_price: price,
                total_price: total > 0 ? total : (qty * price),
                variance_cost: total > 0 ? total : (qty * price),
                notes: item.notes || item.special_instructions || (isKitchenBill ? `Shortage: ${qty} ${item.unit || ''}` : ''),
                is_voided: item.is_voided || item.status === 'voided' || false
            };
        });

        res.status(200).json({
            success: true,
            data: {
                bill: targetBill,
                order_header: orderHeader,
                items: formattedItems,
                staff_profile: staffProfile,
                is_kitchen_variance: isKitchenBill
            },
            items: formattedItems,
            order_header: orderHeader,
            bill: targetBill
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Transfer credit bill to another staff member or customer account
// @route   POST /api/payroll/credit-bills/:id/transfer
// @access  Private (Branch Accountant, Manager)
export const transferCreditBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { new_staff_id, new_customer_name, transfer_reason } = req.body;

        if (!transfer_reason || !transfer_reason.trim()) {
            throw new AppError('Transfer reason is mandatory', 400);
        }

        let newStaffName = new_customer_name;
        let newStaffObj: any = null;

        if (new_staff_id) {
            const { data: sp } = await supabase
                .from('staff_profiles')
                .select('*, users(first_name, last_name)')
                .eq('id', new_staff_id)
                .single();
            if (sp) {
                newStaffObj = sp;
                newStaffName = sp.users
                    ? `${sp.users.first_name || ''} ${sp.users.last_name || ''}`.trim()
                    : `${sp.first_name || ''} ${sp.last_name || ''}`.trim();
            }
        }

        const updateData: any = {
            updated_at: new Date().toISOString()
        };
        if (new_staff_id) updateData.staff_id = new_staff_id;
        if (newStaffName) updateData.staff_name = newStaffName;

        // Update staff_credit_bills
        const { data: updatedStaffBill, error: staffErr } = await supabase
            .from('staff_credit_bills')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        // Update credit_bills if present
        await supabase
            .from('credit_bills')
            .update(updateData)
            .eq('id', id);

        const actorId = (req as any).user?.id || null;

        // Log transfer in payments/audit history
        try {
            await supabase.from('staff_credit_bill_payments').insert({
                credit_bill_id: id,
                amount: 0,
                payment_method: 'transfer',
                payment_date: new Date().toISOString().split('T')[0],
                notes: `Transferred to ${newStaffName || new_staff_id}. Reason: ${transfer_reason.trim()}`,
                recorded_by: actorId
            });
        } catch (_) {}

        res.status(200).json({
            success: true,
            message: `Credit bill transferred to ${newStaffName || 'new target'} successfully`,
            data: updatedStaffBill || updateData
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reject and void credit bill with mandatory reason and optional paid bill entry
// @route   PATCH /api/payroll/credit-bills/:id/reject
// @access  Private (Branch Accountant, Manager)
export const rejectCreditBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { rejection_reason, is_paid, paid_amount, payment_method } = req.body;

        if (!rejection_reason || !rejection_reason.trim()) {
            throw new AppError('Rejection reason is required', 400);
        }

        const actorId = (req as any).user?.id || null;
        const voidedAt = new Date().toISOString();

        // Fetch bill
        const { data: bill, error: fetchErr } = await supabase
            .from('staff_credit_bills')
            .select('*')
            .eq('id', id)
            .single();

        const updatePayload = {
            status: 'cancelled',
            rejection_reason: rejection_reason.trim(),
            rejected_at: voidedAt,
            rejected_by: actorId,
            balance: 0
        };

        const { data: updatedBill, error: updateErr } = await supabase
            .from('staff_credit_bills')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        await syncLinkedCashierCreditBill(bill?.source_cashier_credit_bill_id || id, {
            status: 'voided',
            approval_status: 'rejected'
        });

        // Record Paid Bill entry if payment was received upon rejection
        let paidEntry: any = null;
        if (is_paid || (paid_amount && Number(paid_amount) > 0)) {
            const payAmt = Number(paid_amount) || Number(bill?.amount || 0);
            try {
                const { data: pData } = await supabase.from('staff_credit_bill_payments').insert({
                    credit_bill_id: id,
                    amount: payAmt,
                    payment_method: payment_method || 'cash',
                    payment_date: new Date().toISOString().split('T')[0],
                    notes: `Paid entry recorded upon credit bill rejection/void: ${rejection_reason.trim()}`,
                    recorded_by: actorId
                }).select().single();
                paidEntry = pData;
            } catch (pErr) {
                logger.warn('Failed recording paid bill entry on rejection:', pErr);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Credit bill voided and rejected successfully',
            data: {
                bill: updatedBill,
                paid_entry: paidEntry
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Edit credit bill details (amount, description, bill date)
// @route   PUT /api/payroll/credit-bills/:id
// @access  Private (Branch Accountant, Manager)
export const editCreditBill = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { amount, description, bill_date, department } = req.body;

        const updateData: any = {};
        if (amount !== undefined) {
            const parsedAmt = Number(amount);
            if (isNaN(parsedAmt) || parsedAmt <= 0) throw new AppError('Amount must be positive', 400);
            updateData.amount = parsedAmt;
            updateData.balance = parsedAmt;
        }
        if (description !== undefined) updateData.description = description.trim();
        if (bill_date !== undefined) updateData.bill_date = bill_date;
        if (department !== undefined) updateData.department = department.trim();

        const { data: updatedBill, error } = await supabase
            .from('staff_credit_bills')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await syncLinkedCashierCreditBill(updatedBill.source_cashier_credit_bill_id, updateData);

        res.status(200).json({
            success: true,
            message: 'Credit bill updated successfully',
            data: updatedBill
        });
    } catch (error) {
        next(error);
    }
};

export const allocateStaffCreditPayment = async (
    staffId: string,
    branchId: number | string | null,
    amount: number,
    paymentMethod: string = 'cash',
    recordedBy: string | null = null,
    notes: string | null = null,
    shiftId: string | null = null,
    reference: string | null = null
) => {
    let remainingToApply = amount;
    const appliedBills: any[] = [];

    // Collect all linked staff IDs (user ID, staff profile ID)
    const staffIdsSet = new Set<string>([String(staffId)]);
    try {
        const { data: profile } = await supabase
            .from('staff_profiles')
            .select('id, user_id')
            .or(`id.eq.${staffId},user_id.eq.${staffId}`)
            .maybeSingle();
        if (profile?.id) staffIdsSet.add(profile.id);
        if (profile?.user_id) staffIdsSet.add(profile.user_id);
    } catch (_) {}
    const staffIdList = Array.from(staffIdsSet);

    let query = supabase
        .from('staff_credit_bills')
        .select('*')
        .in('staff_id', staffIdList)
        .in('status', ['pending', 'approved', 'active', 'open', 'accountant_confirmed', 'auditor_confirmed', 'partial', 'partially_applied'])
        .order('created_at', { ascending: true });

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data: openBills } = await query;

    for (const bill of openBills || []) {
        if (remainingToApply <= 0.001) break;

        const billAmount = toNumber(bill.amount);
        const currentPaid = toNumber(bill.paid_amount);
        const currentBalance = bill.balance !== null && bill.balance !== undefined
            ? toNumber(bill.balance)
            : Math.max(0, billAmount - currentPaid);

        if (currentBalance <= 0) continue;

        const applyAmt = Math.min(currentBalance, remainingToApply);
        const newPaid = Math.min(billAmount, currentPaid + applyAmt);
        const newBalance = Math.max(0, currentBalance - applyAmt);
        const newStatus = newBalance <= 0.001 ? 'paid' : (bill.status === 'pending' ? 'approved' : bill.status);

        // Money-critical write via the raw pg pool. The supabase/PostgREST client was
        // intermittently returning success WITHOUT persisting this update, leaving the
        // balance unreduced while the payment row was still written (silent data loss).
        // rowCount from a real SQL UPDATE is authoritative.
        const upd = await db.query(
            `UPDATE staff_credit_bills
                SET paid_amount = $1, amount_paid = $1, balance = $2, status = $3,
                    is_paid = $4, paid_in_shift_id = $5, updated_at = NOW()
              WHERE id = $6
            RETURNING *`,
            [newPaid, newBalance, newStatus, newBalance <= 0.001, newBalance <= 0.001 ? shiftId : (bill.paid_in_shift_id || null), bill.id]
        );
        if (upd.rowCount !== 1) {
            throw new AppError(
                `Could not reduce credit bill ${bill.id}. No payment was recorded — please try again.`,
                500
            );
        }
        const uBill = upd.rows[0];

        try {
            await supabase.from('staff_credit_bill_payments').insert({
                bill_id: bill.id,
                credit_bill_id: bill.id,
                amount: applyAmt,
                method: paymentMethod,
                payment_method: paymentMethod,
                paid_on: new Date().toISOString().split('T')[0],
                payment_date: new Date().toISOString().split('T')[0],
                reference: reference || null,
                notes: notes || (reference ? `Direct paid-bill settlement (${reference})` : `Direct paid-bill credit settlement`),
                recorded_by: recordedBy,
                shift_id: shiftId
            });
        } catch (_) {}

        await syncLinkedCashierCreditBill(bill.source_cashier_credit_bill_id, {
            paid_amount: newPaid,
            amount_paid: newPaid,
            balance_amount: newBalance,
            balance_due: newBalance,
            status: newBalance <= 0.001 ? 'paid' : undefined
        });

        appliedBills.push(uBill || bill);
        remainingToApply -= applyAmt;
    }

    // If there is still remaining payment and open bills exist in credit_bills
    if (remainingToApply > 0.001) {
        let cQuery = supabase
            .from('credit_bills')
            .select('*')
            .in('staff_id', staffIdList)
            .in('status', ['open', 'pending', 'approved', 'partial'])
            .order('created_at', { ascending: true });

        if (branchId) {
            cQuery = cQuery.eq('branch_id', branchId);
        }

        const { data: openCBills } = await cQuery;

        for (const cb of openCBills || []) {
            if (remainingToApply <= 0.001) break;
            const amt = toNumber(cb.total_amount || cb.amount);
            const currentPaid = toNumber(cb.amount_paid || cb.paid_amount);
            const currentBal = cb.balance_due !== null && cb.balance_due !== undefined
                ? toNumber(cb.balance_due)
                : Math.max(0, amt - currentPaid);

            if (currentBal <= 0) continue;

            const applyAmt = Math.min(currentBal, remainingToApply);
            const newPaid = Math.min(amt, currentPaid + applyAmt);
            const newBal = Math.max(0, currentBal - applyAmt);
            const newStatus = newBal <= 0.001 ? 'paid' : cb.status;

            await db.query(
                `UPDATE credit_bills
                    SET amount_paid = $1, balance_due = $2, status = $3, updated_at = NOW()
                  WHERE id = $4`,
                [newPaid, newBal, newStatus, cb.id]
            );

            try {
                await supabase.from('staff_credit_bill_payments').insert({
                    bill_id: cb.id,
                    credit_bill_id: cb.id,
                    amount: applyAmt,
                    method: paymentMethod,
                    payment_method: paymentMethod,
                    paid_on: new Date().toISOString().split('T')[0],
                    payment_date: new Date().toISOString().split('T')[0],
                    reference: reference || null,
                    notes: notes || (reference ? `Direct paid-bill settlement (${reference})` : `Direct paid-bill credit settlement`),
                    recorded_by: recordedBy,
                    shift_id: shiftId
                });
            } catch (_) {}

            appliedBills.push({ ...cb, amount_paid: newPaid, balance_due: newBal, status: newStatus });
            remainingToApply -= applyAmt;
        }
    }

    return {
        appliedBills,
        remainingUnapplied: Math.max(0, remainingToApply)
    };
};

export const recordPaidBillByStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, amount, payment_method, reference, reference_code, notes, credit_bill_id, staff_credit_bill_id } = req.body;
        const paymentAmount = toNumber(amount);
        const refCode = String(reference || reference_code || '').trim();

        if (!staff_id) throw new AppError('Staff member is required', 400);
        if (!paymentAmount || paymentAmount <= 0) throw new AppError('Payment amount must be greater than zero', 400);

        const method = String(payment_method || 'cash').toLowerCase();
        if (['mpesa', 'card'].includes(method) && !refCode) {
            throw new AppError(`Reference code is required for ${method === 'mpesa' ? 'M-Pesa' : 'Card'} payments`, 400);
        }

        const branchId = (req as any).user?.branch_id || req.query.branch_id || null;
        const recordedBy = (req as any).user?.id || null;

        const targetBillId = staff_credit_bill_id || credit_bill_id;

        // If target bill was specified and is not 'auto' / 'unlinked', apply directly to it
        if (targetBillId && targetBillId !== 'auto' && targetBillId !== 'unlinked' && targetBillId !== 'salary_credit') {
            let bill: any = null;
            let isStaffTable = true;
            const { data: sBill } = await supabase.from('staff_credit_bills').select('*').eq('id', targetBillId).maybeSingle();
            if (sBill) {
                bill = sBill;
                isStaffTable = true;
            } else {
                const { data: cBill } = await supabase.from('credit_bills').select('*').eq('id', targetBillId).maybeSingle();
                if (cBill) {
                    bill = cBill;
                    isStaffTable = false;
                }
            }

            if (bill) {
                const currentPaid = toNumber(isStaffTable ? bill.paid_amount || bill.amount_paid : bill.amount_paid || bill.paid_amount);
                const billAmount = toNumber(isStaffTable ? bill.amount : bill.total_amount || bill.amount);
                const currentBalance = bill.balance !== null && bill.balance !== undefined
                    ? toNumber(bill.balance)
                    : (bill.balance_due !== null && bill.balance_due !== undefined ? toNumber(bill.balance_due) : Math.max(0, billAmount - currentPaid));

                const applyAmt = Math.min(currentBalance, paymentAmount);
                const newPaid = Math.min(billAmount, currentPaid + applyAmt);
                const newBalance = Math.max(0, currentBalance - applyAmt);
                const newStatus = newBalance <= 0.001 ? 'paid' : (bill.status === 'pending' ? 'approved' : bill.status);

                let uBill: any = null;
                if (isStaffTable) {
                    // The bill reduction MUST persist before we record the payment.
                    // Done via the raw pg pool because the supabase/PostgREST client was
                    // intermittently returning success WITHOUT persisting the update — the
                    // payment row got written but the balance never went down (silent loss).
                    // rowCount from a real SQL UPDATE is authoritative.
                    const upd = await db.query(
                        `UPDATE staff_credit_bills
                            SET paid_amount = $1, amount_paid = $1, balance = $2,
                                is_paid = $3, status = $4, updated_at = NOW()
                          WHERE id = $5
                        RETURNING *`,
                        [newPaid, newBalance, newBalance <= 0.001, newStatus, bill.id]
                    );
                    if (upd.rowCount !== 1) {
                        throw new AppError(
                            'Could not apply the payment to the credit bill. No payment was recorded — please try again.',
                            500
                        );
                    }
                    uBill = upd.rows[0];

                    await syncLinkedCashierCreditBill(bill.source_cashier_credit_bill_id, {
                        amount_paid: newPaid,
                        paid_amount: newPaid,
                        balance_due: newBalance,
                        balance: newBalance,
                        status: newBalance <= 0.001 ? 'paid' : undefined
                    });
                } else {
                    const upd = await db.query(
                        `UPDATE credit_bills
                            SET amount_paid = $1, balance_due = $2, status = $3, updated_at = NOW()
                          WHERE id = $4
                        RETURNING *`,
                        [newPaid, newBalance, newStatus, bill.id]
                    );
                    if (upd.rowCount !== 1) {
                        throw new AppError(
                            'Could not apply the payment to the credit bill. No payment was recorded — please try again.',
                            500
                        );
                    }
                    uBill = upd.rows[0];
                }

                try {
                    await supabase.from('staff_credit_bill_payments').insert({
                        bill_id: bill.id,
                        credit_bill_id: bill.id,
                        amount: applyAmt,
                        method: method,
                        payment_method: method,
                        paid_on: new Date().toISOString().split('T')[0],
                        payment_date: new Date().toISOString().split('T')[0],
                        reference: refCode || null,
                        notes: notes || (refCode ? `Direct paid bill payment (${refCode})` : 'Direct paid bill payment'),
                        recorded_by: recordedBy
                    });
                } catch (err) {
                    logger.warn('Error inserting payment history:', err);
                }

                const remainder = Math.max(0, paymentAmount - applyAmt);
                let furtherResult = null;
                if (remainder > 0.001) {
                    furtherResult = await allocateStaffCreditPayment(
                        String(staff_id),
                        branchId,
                        remainder,
                        method,
                        recordedBy,
                        notes,
                        null,
                        refCode || null
                    );
                }

                return res.status(200).json({
                    success: true,
                    message: `Recorded payment of KES ${paymentAmount.toLocaleString()} to staff credit bill`,
                    data: {
                        appliedBills: [uBill || bill, ...(furtherResult?.appliedBills || [])],
                        remainingUnapplied: furtherResult?.remainingUnapplied || 0
                    }
                });
            }
        }

        const result = await allocateStaffCreditPayment(
            String(staff_id),
            branchId,
            paymentAmount,
            method,
            recordedBy,
            notes || (refCode ? `Direct paid bill payment (${refCode})` : 'Direct paid bill payment'),
            null,
            refCode || null
        );

        res.status(200).json({
            success: true,
            message: `Recorded payment of KES ${paymentAmount.toLocaleString()} to staff credit account`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};
