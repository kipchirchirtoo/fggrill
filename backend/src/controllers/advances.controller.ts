import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const createAdvance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, amount, reason, request_date } = req.body;

        if (!staff_id || !amount || !reason) {
            throw new AppError('Missing required fields', 400);
        }

        const { data, error } = await supabase
            .from('staff_advances')
            .insert({
                staff_id,
                amount,
                reason,
                request_date: request_date || new Date().toISOString().split('T')[0],
                status: 'pending'
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

export const getAdvances = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status } = req.query;

        let query = supabase
            .from('staff_advances')
            .select(`
                *,
                staff:staff_profiles(
                    id, 
                    role,
                    user:users!user_id(id, first_name, last_name)
                )
            `)
            .order('created_at', { ascending: false });

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) throw error;

        // Transform to flatten nested user data for frontend compatibility
        const transformed = data.map(advance => ({
            ...advance,
            staff: advance.staff ? {
                id: advance.staff.id,
                role: advance.staff.role,
                first_name: advance.staff.user?.first_name || '',
                last_name: advance.staff.user?.last_name || ''
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

export const approveAdvance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;

        const { data, error } = await supabase
            .from('staff_advances')
            .update({
                status: 'approved',
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
