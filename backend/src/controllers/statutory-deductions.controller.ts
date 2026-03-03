import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

export const getMonthlyDeductions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { branchId, month, year, staffId } = req.query;

        let query = supabase
            .from('staff_monthly_statutory_deductions')
            .select(`
                *,
                staff:staff_profiles(
                    id,
                    role,
                    first_name,
                    last_name,
                    user:users!user_id(id, first_name, last_name)
                )
            `);

        if (branchId) query = query.eq('branch_id', branchId);
        if (month) query = query.eq('month', month);
        if (year) query = query.eq('year', year);
        if (staffId) query = query.eq('staff_id', staffId);

        const { data, error } = await query;

        if (error) throw error;

        // Transform for frontend
        const transformed = data.map(record => ({
            ...record,
            staff_name: record.staff ? `${record.staff.first_name || record.staff.user?.first_name || ''} ${record.staff.last_name || record.staff.user?.last_name || ''}`.trim() : 'Unknown'
        }));

        res.status(200).json({
            success: true,
            data: transformed
        });
    } catch (error) {
        next(error);
    }
};

export const createOrUpdateDeductions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, branch_id, month, year, nssf_amount, shif_amount, housing_fund_amount } = req.body;

        if (!staff_id || !month || !year) {
            throw new AppError('Missing required fields: staff_id, month, year', 400);
        }

        // Check if a record already exists for this staff and period
        const { data: existing } = await supabase
            .from('staff_monthly_statutory_deductions')
            .select('*')
            .eq('staff_id', staff_id)
            .eq('month', month)
            .eq('year', year)
            .eq('status', 'pending')
            .maybeSingle();

        let result;
        if (existing) {
            // Update
            const { data, error } = await supabase
                .from('staff_monthly_statutory_deductions')
                .update({
                    nssf_amount,
                    shif_amount,
                    housing_fund_amount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            result = data;
        } else {
            // Insert
            const { data, error } = await supabase
                .from('staff_monthly_statutory_deductions')
                .insert({
                    staff_id,
                    branch_id,
                    month,
                    year,
                    nssf_amount,
                    shif_amount,
                    housing_fund_amount,
                    status: 'pending'
                })
                .select()
                .single();
            if (error) throw error;
            result = data;
        }

        res.status(201).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};
