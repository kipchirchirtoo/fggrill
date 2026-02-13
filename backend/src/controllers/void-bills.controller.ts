import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { migratePendingBills } from '../jobs/migrate-pending-bills.job';

// @desc    Get all void bills for auditor review
// @route   GET /api/auditor/void-bills
// @access  Private (Auditor, Branch Accountant)
export const getVoidBills = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { reviewed, waiter_id, from_date, to_date } = req.query;

        let query = supabase
            .from('void_bills_audit')
            .select(`
                *,
                waiter:staff_profiles!waiter_id(
                    id,
                    first_name,
                    last_name,
                    user:users!user_id(id, first_name, last_name)
                ),
                voided_by_user:users!voided_by(id, first_name, last_name)
            `)
            .order('created_at', { ascending: false });

        if (reviewed !== undefined) {
            query = query.eq('reviewed_by_auditor', reviewed === 'true');
        }
        if (waiter_id) {
            query = query.eq('waiter_id', waiter_id);
        }
        if (from_date) {
            query = query.gte('voided_at', from_date);
        }
        if (to_date) {
            query = query.lte('voided_at', to_date);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: data?.length || 0,
            data: data || []
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark void bill as reviewed by auditor
// @route   PUT /api/auditor/void-bills/:id/review
// @access  Private (Auditor)
export const reviewVoidBill = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { auditor_notes } = req.body;
        const userId = req.user?.id;

        const { data, error } = await supabase
            .from('void_bills_audit')
            .update({
                reviewed_by_auditor: true,
                reviewed_at: new Date().toISOString(),
                auditor_notes
            })
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
