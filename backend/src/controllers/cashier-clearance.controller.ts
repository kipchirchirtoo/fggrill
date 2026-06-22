import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import notificationService from '../services/notification.service';

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const loadShiftForReconciliation = async (
    shiftId: string,
    req: Request,
    res: Response
): Promise<Record<string, any> | null> => {
    const { data: shift, error } = await supabase
        .from('cashier_shifts')
        .select('*')
        .eq('id', shiftId)
        .maybeSingle();
    if (error) throw error;
    if (!shift) {
        res.status(404).json({ success: false, message: 'Shift not found' });
        return null;
    }
    return shift;
};

/**
 * @desc    Get cashier clearances for a branch
 * @route   GET /api/cashier/clearances
 * @access  Private (Branch Manager, Auditor, Super Admin)
 */
export const getCashierClearances = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, date, status, cashier_id } = req.query;
        const targetDate = (date as string) || new Date().toISOString().split('T')[0];

        console.log('🔍 [Cashier Clearance] Fetching clearances:', { branch_id, date: targetDate, status, cashier_id });

        // Fetch all cashier shifts for the date
        let shiftsQuery = supabase
            .from('cashier_shifts')
            .select('*')
            .gte('start_time', `${targetDate}T00:00:00`)
            .lte('start_time', `${targetDate}T23:59:59`)
            .order('start_time', { ascending: false });

        if (branch_id && branch_id !== '0') {
            shiftsQuery = shiftsQuery.eq('branch_id', branch_id);
        }

        if (status) {
            shiftsQuery = shiftsQuery.eq('status', status);
        }

        if (cashier_id) {
            shiftsQuery = shiftsQuery.eq('cashier_id', cashier_id);
        }

        const { data: shifts, error: shiftsError } = await shiftsQuery;

        if (shiftsError) {
            console.error('❌ [Cashier Clearance] Error fetching shifts:', shiftsError);
            throw shiftsError;
        }

        console.log(`✅ [Cashier Clearance] Found ${shifts?.length || 0} shifts`);

        // Fetch user details separately
        const uniqueCashierIds = [...new Set((shifts || []).map(s => s.cashier_id).filter(Boolean))];
        const uniqueApproverIds = [...new Set((shifts || []).map(s => s.approved_by).filter(Boolean))];
        const allUserIds = [...new Set([...uniqueCashierIds, ...uniqueApproverIds])];

        let usersMap = new Map();
        if (allUserIds.length > 0) {
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, first_name, last_name, email')
                .in('id', allUserIds);

            if (!usersError && users) {
                usersMap = new Map(users.map(u => [u.id, u]));
            }
        }

        // Calculate variances and enrich data
        const clearances = (shifts || []).map(shift => {
            const expectedCash = Number(shift.expected_cash || 0);
            const actualCash = Number(shift.actual_cash || 0);
            const variance = actualCash - expectedCash;
            const variancePercentage = expectedCash > 0 ? (variance / expectedCash) * 100 : 0;

            const cashier = usersMap.get(shift.cashier_id);
            const approver = usersMap.get(shift.approved_by);

            return {
                ...shift,
                expected_cash: expectedCash,
                actual_cash: actualCash,
                variance,
                variance_percentage: variancePercentage,
                has_discrepancy: Math.abs(variance) > 10, // Flag if variance > 10
                cashier_name: cashier ? `${cashier.first_name} ${cashier.last_name}` : 'Unknown',
                approved_by_name: approver ? `${approver.first_name} ${approver.last_name}` : null,
                cashier,
                approved_by_user: approver
            };
        });

        // Calculate summary stats
        const summary = {
            total_shifts: clearances.length,
            pending: clearances.filter(c => c.status === 'open' || c.status === 'pending').length,
            approved: clearances.filter(c => c.status === 'closed' || c.status === 'approved').length,
            with_discrepancies: clearances.filter(c => c.has_discrepancy).length,
            total_expected: clearances.reduce((sum, c) => sum + c.expected_cash, 0),
            total_actual: clearances.reduce((sum, c) => sum + c.actual_cash, 0),
            total_variance: clearances.reduce((sum, c) => sum + c.variance, 0)
        };

        res.status(200).json({
            success: true,
            data: {
                clearances,
                summary,
                date: targetDate
            }
        });
    } catch (error) {
        console.error('❌ [Cashier Clearance] Error:', error);
        logger.error('Error fetching cashier clearances:', error);
        next(error);
    }
};

/**
 * @desc    Get shift summary for a specific cashier
 * @route   GET /api/cashier/:id/shift-summary
 * @access  Private
 */
export const getCashierShiftSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { from_date, to_date } = req.query;

        const startDate = (from_date as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = (to_date as string) || new Date().toISOString().split('T')[0];

        console.log('🔍 [Cashier Summary] Fetching summary for cashier:', id, { startDate, endDate });

        const { data: shifts, error } = await supabase
            .from('cashier_shifts')
            .select('*')
            .eq('cashier_id', id)
            .gte('start_time', `${startDate}T00:00:00`)
            .lte('start_time', `${endDate}T23:59:59`)
            .order('start_time', { ascending: false });

        if (error) throw error;

        const summary = {
            total_shifts: shifts?.length || 0,
            total_sales: shifts?.reduce((sum, s) => sum + Number(s.total_sales || 0), 0) || 0,
            total_expected_cash: shifts?.reduce((sum, s) => sum + Number(s.expected_cash || 0), 0) || 0,
            total_actual_cash: shifts?.reduce((sum, s) => sum + Number(s.actual_cash || 0), 0) || 0,
            total_variance: shifts?.reduce((sum, s) => sum + (Number(s.actual_cash || 0) - Number(s.expected_cash || 0)), 0) || 0,
            shifts_with_discrepancies: shifts?.filter(s => Math.abs(Number(s.actual_cash || 0) - Number(s.expected_cash || 0)) > 10).length || 0,
            average_variance: 0
        };

        summary.average_variance = summary.total_shifts > 0 ? summary.total_variance / summary.total_shifts : 0;

        res.status(200).json({
            success: true,
            data: {
                summary,
                shifts: shifts || []
            }
        });
    } catch (error) {
        logger.error('Error fetching cashier shift summary:', error);
        next(error);
    }
};

/**
 * @desc    Approve cashier clearance
 * @route   POST /api/cashier/clearances/:id/approve
 * @access  Private (Branch Manager, Auditor, Super Admin)
 */
export const approveCashierClearance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const userId = req.user?.id;

        console.log('🔍 [Cashier Clearance] Approving clearance:', id, 'by user:', userId);

        // Update shift status
        const { data: shift, error: updateError } = await supabase
            .from('cashier_shifts')
            .update({
                status: 'closed',
                approved_by: userId,
                approved_at: new Date().toISOString(),
                approval_notes: notes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*')
            .single();

        if (updateError) {
            console.error('❌ [Cashier Clearance] Error approving:', updateError);
            throw updateError;
        }

        // Fetch cashier details separately
        let cashier = null;
        if (shift?.cashier_id) {
            const { data: cashierData } = await supabase
                .from('users')
                .select('id, first_name, last_name')
                .eq('id', shift.cashier_id)
                .single();
            cashier = cashierData;
        }

        console.log('✅ [Cashier Clearance] Approved successfully');

        // Notify cashier
        if (cashier) {
            notificationService.notifyUser(
                cashier.id,
                'Shift Clearance Approved',
                `Your shift clearance has been approved by management.`,
                {
                    type: 'success',
                    category: 'finance',
                    priority: 'medium',
                    actionUrl: `/dashboard/cashier/shifts/${id}`,
                    metadata: { shift_id: id, status: 'approved' }
                }
            ).catch(e => logger.error('Failed to notify cashier of clearance approval', e));
        }

        res.status(200).json({
            success: true,
            message: 'Clearance approved successfully',
            data: { ...shift, cashier }
        });
    } catch (error) {
        console.error('❌ [Cashier Clearance] Error:', error);
        logger.error('Error approving cashier clearance:', error);
        next(error);
    }
};

/**
 * @desc    Flag cashier clearance for discrepancy
 * @route   POST /api/cashier/clearances/:id/flag
 * @access  Private (Branch Manager, Auditor, Super Admin)
 */
export const flagCashierClearance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason, notes } = req.body;
        const userId = req.user?.id;

        console.log('🔍 [Cashier Clearance] Flagging clearance:', id, 'by user:', userId);

        // Update shift with flag
        const { data: shift, error: updateError } = await supabase
            .from('cashier_shifts')
            .update({
                status: 'flagged',
                flagged_by: userId,
                flagged_at: new Date().toISOString(),
                flag_reason: reason,
                flag_notes: notes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*')
            .single();

        if (updateError) {
            console.error('❌ [Cashier Clearance] Error flagging:', updateError);
            throw updateError;
        }

        // Fetch cashier details separately
        let cashier = null;
        if (shift?.cashier_id) {
            const { data: cashierData } = await supabase
                .from('users')
                .select('id, first_name, last_name')
                .eq('id', shift.cashier_id)
                .single();
            cashier = cashierData;
        }

        console.log('✅ [Cashier Clearance] Flagged successfully');

        // Notify cashier and auditor
        if (cashier) {
            notificationService.notifyUser(
                cashier.id,
                'Shift Clearance Flagged',
                `Your shift clearance has been flagged for review. Reason: ${reason}`,
                {
                    type: 'warning',
                    category: 'finance',
                    priority: 'high',
                    actionUrl: `/dashboard/cashier/shifts/${id}`,
                    metadata: { shift_id: id, status: 'flagged', reason }
                }
            ).catch(e => logger.error('Failed to notify cashier of clearance flag', e));
        }

        // Notify auditor
        notificationService.notifyRole(
            'auditor',
            'Cashier Clearance Flagged',
            `A cashier shift has been flagged for discrepancy. Cashier: ${cashier ? `${cashier.first_name} ${cashier.last_name}` : 'Unknown'}`,
            {
                type: 'warning',
                category: 'finance',
                priority: 'high',
                actionUrl: `/dashboard/auditor/cashier-clearances/${id}`,
                metadata: { shift_id: id, reason }
            }
        ).catch(e => logger.error('Failed to notify auditor of clearance flag', e));

        res.status(200).json({
            success: true,
            message: 'Clearance flagged successfully',
            data: { ...shift, cashier }
        });
    } catch (error) {
        console.error('❌ [Cashier Clearance] Error:', error);
        logger.error('Error flagging cashier clearance:', error);
        next(error);
    }
};

/**
 * @desc    Shift reconciliation detail — actual collections (system vs.
 *          counted, by payment method) and reconciliation expenses
 *          (shift_actual_collections / shift_reconciliation_expenses,
 *          migration 20260622_famousgate_major_redesign.sql section 6).
 * @route   GET /api/cashier/clearances/:id/reconciliation
 * @access  Private (Branch Manager, Branch Accountant, Auditor, Super Admin)
 */
export const getShiftReconciliation = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const shift = await loadShiftForReconciliation(req.params.id, req, res);
        if (!shift) return;

        const [{ data: collections, error: collErr }, { data: expenses, error: expErr }] = await Promise.all([
            supabase
                .from('shift_actual_collections')
                .select('*')
                .eq('shift_id', shift.id)
                .order('created_at', { ascending: true }),
            supabase
                .from('shift_reconciliation_expenses')
                .select('*')
                .eq('shift_id', shift.id)
                .order('created_at', { ascending: true }),
        ]);
        if (collErr) throw collErr;
        if (expErr) throw expErr;

        const totalSystem = (collections || []).reduce((s, c) => s + num(c.system_amount), 0);
        const totalActual = (collections || []).reduce((s, c) => s + num(c.actual_amount), 0);
        const totalExpenses = (expenses || []).reduce((s, e) => s + num(e.amount), 0);

        res.status(200).json({
            success: true,
            data: {
                shift,
                actual_collections: collections || [],
                reconciliation_expenses: expenses || [],
                summary: {
                    total_system: totalSystem,
                    total_actual: totalActual,
                    total_variance: totalActual - totalSystem,
                    total_expenses: totalExpenses,
                },
            },
        });
    } catch (error) {
        logger.error('Error fetching shift reconciliation:', error);
        next(error);
    }
};

/**
 * @desc    Record the accountant-verified actual cash/mpesa/card/credit
 *          collection for a shift, against the system-recorded amount.
 * @route   POST /api/cashier/clearances/:id/actual-collections
 *          body: { payment_method: 'mpesa'|'cash'|'card'|'credit', system_amount, actual_amount }
 * @access  Private (Branch Accountant, Branch Manager, Auditor, Super Admin)
 */
export const addShiftActualCollection = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const shift = await loadShiftForReconciliation(req.params.id, req, res);
        if (!shift) return;

        const { payment_method, system_amount, actual_amount } = req.body || {};
        const allowedMethods = ['mpesa', 'cash', 'card', 'credit'];
        if (!allowedMethods.includes(String(payment_method))) {
            res.status(400).json({ success: false, message: `payment_method must be one of ${allowedMethods.join(', ')}` });
            return;
        }

        const { data, error } = await supabase
            .from('shift_actual_collections')
            .insert({
                shift_id: shift.id,
                branch_id: Number(shift.branch_id),
                payment_method,
                system_amount: num(system_amount),
                actual_amount: num(actual_amount),
                verified_by: req.user?.id || null,
            })
            .select()
            .single();
        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        logger.error('Error recording shift actual collection:', error);
        next(error);
    }
};

/**
 * @desc    Record a reconciliation expense (petty cash, transaction cost,
 *          other) discovered while reconciling a shift.
 * @route   POST /api/cashier/clearances/:id/reconciliation-expenses
 *          body: { category: 'petty_cash'|'transaction_cost'|'other', amount, description }
 * @access  Private (Branch Accountant, Branch Manager, Auditor, Super Admin)
 */
export const addShiftReconciliationExpense = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const shift = await loadShiftForReconciliation(req.params.id, req, res);
        if (!shift) return;

        const { category, amount, description } = req.body || {};
        const allowedCategories = ['petty_cash', 'transaction_cost', 'other'];
        if (!allowedCategories.includes(String(category))) {
            res.status(400).json({ success: false, message: `category must be one of ${allowedCategories.join(', ')}` });
            return;
        }
        const amt = num(amount);
        if (amt <= 0) {
            res.status(400).json({ success: false, message: 'amount must be greater than zero' });
            return;
        }

        const { data, error } = await supabase
            .from('shift_reconciliation_expenses')
            .insert({
                shift_id: shift.id,
                branch_id: Number(shift.branch_id),
                category,
                amount: amt,
                description: description || null,
                recorded_by: req.user?.id || null,
            })
            .select()
            .single();
        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        logger.error('Error recording shift reconciliation expense:', error);
        next(error);
    }
};
