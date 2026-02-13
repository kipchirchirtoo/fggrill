import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const createLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, total_amount, monthly_installment, reason, start_date } = req.body;

        if (!staff_id || !total_amount || !monthly_installment || !reason || !start_date) {
            throw new AppError('Missing required fields', 400);
        }

        const { data, error } = await supabase
            .from('staff_loans')
            .insert({
                staff_id,
                total_amount,
                monthly_installment,
                remaining_balance: total_amount, // Initial balance is total
                reason,
                start_date,
                status: 'pending' // Changed from 'active' to 'pending'
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

export const getLoans = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status } = req.query;

        let query = supabase
            .from('staff_loans')
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
            .order('created_at', { ascending: false });

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) throw error;

        // Transform to flatten nested user data for frontend compatibility
        const transformed = data.map(loan => ({
            ...loan,
            staff: loan.staff ? {
                id: loan.staff.id,
                role: loan.staff.role,
                first_name: loan.staff.first_name || loan.staff.user?.first_name || '',
                last_name: loan.staff.last_name || loan.staff.user?.last_name || ''
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

export const approveLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const adminId = (req as any).user?.id;

        if (!id) {
            throw new AppError('Loan ID is required', 400);
        }

        const { data, error } = await supabase
            .from('staff_loans')
            .update({
                status: 'active',
                approved_by: adminId
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
