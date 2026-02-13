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

        const { data, error } = await supabase
            .from('staff_credit_bills')
            .insert({
                staff_id,
                amount,
                balance: amount,
                description,
                date: date || new Date().toISOString().split('T')[0],
                is_paid: false
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

export const getCreditBills = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status } = req.query;

        let query = supabase
            .from('staff_credit_bills')
            .select(`
                *,
                staff:staff_profiles(
                    id, 
                    role,
                    first_name,
                    last_name,
                    user:users!user_id(id, first_name, last_name)
                )
            `)
            .order('date', { ascending: false });

        if (staff_id) query = query.eq('staff_id', staff_id);

        // Map 'pending'/'paid' status query to is_paid boolean
        if (status === 'pending') query = query.eq('is_paid', false);
        if (status === 'paid' || status === 'deducted') query = query.eq('is_paid', true);

        const { data, error } = await query;

        if (error) throw error;

        // Transform to flatten nested user data for frontend compatibility
        const transformed = data.map(bill => ({
            ...bill,
            staff: bill.staff ? {
                id: bill.staff.id,
                role: bill.staff.role,
                first_name: bill.staff.first_name || bill.staff.user?.first_name || '',
                last_name: bill.staff.last_name || bill.staff.user?.last_name || ''
            } : null
        }));

        res.status(200).json({
            success: true,
            data: transformed
        });
    } catch (error) {
        next(error);
    }
};

export const updateCreditBillStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // Expecting 'paid' or boolean

        let is_paid = false;
        if (status === 'paid' || status === 'deducted' || status === true) {
            is_paid = true;
        }

        const { data, error } = await supabase
            .from('staff_credit_bills')
            .update({
                is_paid,
                balance: is_paid ? 0 : undefined // Reset balance to 0 if marking as paid
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
