import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const createLoan = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, total_amount, installment_amount, reason, start_date } = req.body;

        if (!staff_id || !total_amount || !installment_amount || !reason || !start_date) {
            throw new AppError('Missing required fields', 400);
        }

        const { data, error } = await supabase
            .from('staff_loans')
            .insert({
                staff_id,
                total_amount,
                installment_amount,
                remaining_balance: total_amount, // Initial balance is total
                reason,
                start_date,
                status: 'active'
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
        staff:staff_profiles(id, first_name, last_name, role)
      `)
            .order('created_at', { ascending: false });

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};
