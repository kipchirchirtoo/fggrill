import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// Get all pending and historical adjustments
export const getAdjustments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status, type, month, year } = req.query;

        let query = supabase
            .from('staff_payroll_adjustments')
            .select(`
                *,
                staff:staff_profiles!inner(
                    id, first_name, last_name, role, department, 
                    user:users!user_id(first_name, last_name)
                ),
                created_by_user:users!created_by(first_name, last_name)
            `)
            .order('created_at', { ascending: false });

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status) query = query.eq('status', status);
        if (type) query = query.eq('type', type);
        if (month) query = query.eq('month', month);
        if (year) query = query.eq('year', year);

        const { data, error } = await query;
        if (error) throw error;

        // Flatten staff names
        const transformed = data.map(item => ({
            ...item,
            staff_name: item.staff?.user
                ? `${item.staff.user.first_name || ''} ${item.staff.user.last_name || ''}`.trim()
                : `${item.staff?.first_name || ''} ${item.staff?.last_name || ''}`.trim()
        }));

        res.status(200).json({ success: true, count: transformed.length, data: transformed });
    } catch (error) {
        next(error);
    }
};

// Create a new adjustment
export const createAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, type, category, amount, description, month, year } = req.body;
        const created_by = req.user?.id;

        if (!staff_id || !type || !category || !amount || !month || !year) {
            throw new AppError('Missing required fields for adjustment', 400);
        }

        const { data, error } = await supabase
            .from('staff_payroll_adjustments')
            .insert({
                staff_id, type, category, amount, description, month, year, created_by, status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// Void an adjustment
export const voidAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const { data: existing, error: checkError } = await supabase
            .from('staff_payroll_adjustments')
            .select('status')
            .eq('id', id)
            .single();

        if (checkError) throw checkError;
        if (existing.status === 'applied') {
            throw new AppError('Cannot void an already applied adjustment associated with a payroll run', 400);
        }

        const { data, error } = await supabase
            .from('staff_payroll_adjustments')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
