import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { migratePendingBills } from '../jobs/migrate-pending-bills.job';

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

        let updateData: any = { status: resolvedStatus };

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
