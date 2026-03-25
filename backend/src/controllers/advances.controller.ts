import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const createAdvance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, amount, reason, advance_date, month_to_deduct, year_to_deduct } = req.body;

        if (!staff_id || !amount || !reason || !month_to_deduct || !year_to_deduct) {
            throw new AppError('Missing required fields: staff_id, amount, reason, month_to_deduct, year_to_deduct', 400);
        }

        const { data, error } = await supabase
            .from('staff_advances')
            .insert({
                staff_id,
                amount,
                reason,
                advance_date: advance_date || new Date().toISOString().split('T')[0],
                month_to_deduct: Number(month_to_deduct),
                year_to_deduct: Number(year_to_deduct),
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getAdvances = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status } = req.query;

        let query = supabase
            .from('staff_advances')
            .select('*')
            .order('created_at', { ascending: false });

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;

        const staffIds = [...new Set((data || []).map((a: any) => a.staff_id).filter(Boolean))];
        const { data: staffProfiles } = staffIds.length > 0
            ? await supabase.from('staff_profiles').select('id, role, first_name, last_name, user_id').in('id', staffIds)
            : { data: [] };
        const userIds = (staffProfiles || []).map((s: any) => s.user_id).filter(Boolean);
        const { data: users } = userIds.length > 0
            ? await supabase.from('users').select('id, first_name, last_name').in('id', userIds)
            : { data: [] };

        const staffMap = new Map((staffProfiles || []).map((s: any) => [s.id, s]));
        const userMap = new Map((users || []).map((u: any) => [u.id, u]));

        const transformed = (data || []).map((advance: any) => {
            const sp = staffMap.get(advance.staff_id);
            const user = sp ? userMap.get(sp.user_id) : null;
            return {
                ...advance,
                staff: sp ? {
                    id: sp.id, role: sp.role,
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
