import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { applyBranchFilter } from '../utils/branchIsolation';
import notificationService from '../services/notification.service';

export const createLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, total_amount, installment_amount, reason, loan_date, start_deduction_month, start_deduction_year } = req.body;

        if (!staff_id || !total_amount || !installment_amount || !reason || !start_deduction_month || !start_deduction_year) {
            throw new AppError('Missing required fields: staff_id, total_amount, installment_amount, reason, start_deduction_month, start_deduction_year', 400);
        }

        const { data, error } = await supabase
            .from('staff_loans')
            .insert({
                staff_id,
                total_amount,
                installment_amount,
                remaining_balance: total_amount,
                reason,
                loan_date: loan_date || new Date().toISOString().split('T')[0],
                start_deduction_month: Number(start_deduction_month),
                start_deduction_year: Number(start_deduction_year),
                status: 'pending_approval',
                branch_id: (req as any).user?.branch_id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getLoans = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status, from_date, to_date } = req.query;

        let query = supabase
            .from('staff_loans')
            .select('*')
            .order('created_at', { ascending: false });
        // Optional — omitted by callers (e.g. the branch dashboard's
        // outstanding totals) that need every row regardless of age.
        if (from_date) query = query.gte('created_at', `${new Date(String(from_date)).toISOString().slice(0, 10)}T00:00:00.000Z`);
        if (to_date) query = query.lte('created_at', `${new Date(String(to_date)).toISOString().slice(0, 10)}T23:59:59.999Z`);

        query = applyBranchFilter(query, req);

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;

        const staffIds = [...new Set((data || []).map((l: any) => l.staff_id).filter(Boolean))];
        const { data: staffProfiles } = staffIds.length > 0
            ? await supabase.from('staff_profiles').select('id, role, position, department, employee_number, national_id, first_name, last_name, user_id').in('id', staffIds)
            : { data: [] };
        const userIds = (staffProfiles || []).map((s: any) => s.user_id).filter(Boolean);
        const { data: users } = userIds.length > 0
            ? await supabase.from('users').select('id, first_name, last_name, employee_id').in('id', userIds)
            : { data: [] };

        const staffMap = new Map((staffProfiles || []).map((s: any) => [s.id, s]));
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        const transformed = (data || []).map((loan: any) => {
            const sp = staffMap.get(loan.staff_id);
            const user = sp ? userMap.get(sp.user_id) : null;
            return {
                ...loan,
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
        });

        res.status(200).json({ success: true, data: transformed });
    } catch (error) {
        next(error);
    }
};

export const recordLoanPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { amount, payment_method, reference, notes } = req.body;
        const paymentAmount = Number(amount || 0);

        if (!id) {
            throw new AppError('Loan ID is required', 400);
        }
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            throw new AppError('Payment amount must be greater than zero', 400);
        }

        const { data: loan, error: fetchError } = await supabase
            .from('staff_loans')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!loan) throw new AppError('Loan not found', 404);

        const userBranchId = (req as any).user?.branch_id;
        const userRole = String((req as any).user?.role || '');
        const globalRoles = ['super_admin', 'general_manager', 'director', 'auditor', 'hr_manager'];
        if (!globalRoles.includes(userRole) && userBranchId && Number(loan.branch_id) !== Number(userBranchId)) {
            throw new AppError('Access denied for this branch loan', 403);
        }

        const currentBalance = Math.max(
            0,
            Number(loan.remaining_balance ?? loan.total_amount ?? 0)
        );
        if (paymentAmount > currentBalance + 0.001) {
            throw new AppError(`Payment amount exceeds remaining balance (${currentBalance})`, 400);
        }

        const newBalance = Math.max(0, currentBalance - paymentAmount);
        const normalizedMethod = String(payment_method || 'cash').toLowerCase();
        const historyEntry = {
            amount: paymentAmount,
            payment_method: normalizedMethod,
            reference: reference || null,
            notes: notes || null,
            recorded_by: (req as any).user?.id || null,
            recorded_at: new Date().toISOString()
        };
        const existingHistory = Array.isArray(loan.payment_history) ? loan.payment_history : [];

        const updatePayload: any = {
            remaining_balance: newBalance,
            status: newBalance <= 0 ? 'paid' : (loan.status === 'pending_approval' ? 'active' : loan.status || 'active')
        };

        // payment_history is optional on older deployments; retry without it if
        // the column is not present.
        let updated;
        const { data, error } = await supabase
            .from('staff_loans')
            .update({ ...updatePayload, payment_history: [...existingHistory, historyEntry] })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            const { data: retryData, error: retryError } = await supabase
                .from('staff_loans')
                .update(updatePayload)
                .eq('id', id)
                .select()
                .single();
            if (retryError) throw retryError;
            updated = retryData;
        } else {
            updated = data;
        }

        const paymentPayload = {
            loan_id: id,
            amount: paymentAmount,
            payment_method: normalizedMethod,
            reference: reference || null,
            notes: notes || null,
            recorded_by: (req as any).user?.id || null,
            branch_id: loan.branch_id || userBranchId || null
        };
        const { data: payment, error: paymentError } = await supabase
            .from('staff_loan_payments')
            .insert(paymentPayload)
            .select()
            .single();

        if (paymentError) {
            // Older deployments may have the legacy loan payment table before
            // evidence columns were added. Still keep a ledger row instead of
            // losing the payment record entirely.
            const { error: legacyPaymentError } = await supabase
                .from('staff_loan_payments')
                .insert({
                    loan_id: id,
                    amount: paymentAmount
                });
            if (legacyPaymentError) throw paymentError;
        }

        res.status(200).json({
            success: true,
            message: newBalance <= 0 ? 'Loan fully paid' : 'Loan payment recorded',
            data: {
                loan: updated,
                payment: payment || null
            }
        });
    } catch (error) {
        next(error);
    }
};

export const approveLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        if (!id) {
            throw new AppError('Loan ID is required', 400);
        }

        // Determine if this is an auditor approval
        const isAuditor = userRole === 'auditor';

        const updateData: any = {
            status: isAuditor ? 'auditor_confirmed' : 'active',
        };

        if (isAuditor) {
            updateData.auditor_id = userId;
            updateData.auditor_confirmed_at = new Date().toISOString();
        } else {
            updateData.approved_by = userId;
        }

        const { data, error } = await supabase
            .from('staff_loans')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Send notification to branch accountant when auditor approves
        if (isAuditor && data) {
            try {
                const { data: staffData } = await supabase
                    .from('staff_profiles')
                    .select('first_name, last_name')
                    .eq('id', data.staff_id)
                    .single();

                const staffName = staffData ? `${staffData.first_name} ${staffData.last_name}` : 'Staff member';
                
                await notificationService.notifyRole(
                    'branch_accountant',
                    'Loan Approved by Auditor',
                    `A staff loan of KES ${data.total_amount.toLocaleString()} for ${staffName} has been approved by the auditor and requires your final approval.`,
                    {
                        type: 'info',
                        category: 'payroll',
                        branchId: data.branch_id,
                        metadata: {
                            loan_id: data.id,
                            staff_id: data.staff_id,
                            amount: data.total_amount
                        }
                    }
                );
            } catch (notifError) {
                // Don't fail the approval if notification fails
                console.error('Failed to send notification:', notifError);
            }
        }

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};


export const rejectLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new AppError('Loan ID is required', 400);
        }

        const { data, error } = await supabase
            .from('staff_loans')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};
