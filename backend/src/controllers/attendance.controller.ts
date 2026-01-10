import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// @desc    Get attendance records
// @route   GET /api/attendance
// @access  Private
export const getAttendance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;
        const { userId, startDate, endDate } = req.query;

        let query = supabase
            .from('staff_attendance')
            .select('*, user:users(id, full_name, role)');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }
        if (userId) {
            query = query.eq('user_id', userId);
        }
        if (startDate) {
            query = query.gte('clock_in', startDate);
        }
        if (endDate) {
            query = query.lte('clock_in', endDate);
        }

        const { data: attendance, error } = await query.order('clock_in', { ascending: false });

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: attendance
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Manual Clock-in
// @route   POST /api/attendance/clock-in
// @access  Private
export const clockIn = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;
        const branchId = req.user?.branch_id;

        if (!userId || !branchId) {
            throw new AppError('User session invalid', 401);
        }

        // Check if already clocked in today (not clocked out yet)
        const { data: existing, error: checkError } = await supabase
            .from('staff_attendance')
            .select('*')
            .eq('user_id', userId)
            .is('clock_out', null)
            .maybeSingle();

        if (checkError) throw checkError;
        if (existing) {
            throw new AppError('Already clocked in', 400);
        }

        const { data: attendance, error } = await supabase
            .from('staff_attendance')
            .insert([{
                user_id: userId,
                branch_id: branchId,
                clock_in: new Date().toISOString(),
                status: 'present'
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: attendance
        });

        logger.info(`Staff ${userId} clocked in at ${attendance.clock_in}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Clock-out
// @route   POST /api/attendance/clock-out
// @access  Private
export const clockOut = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?.id;

        const { data: existing, error: checkError } = await supabase
            .from('staff_attendance')
            .select('*')
            .eq('user_id', userId)
            .is('clock_out', null)
            .order('clock_in', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!existing) {
            throw new AppError('No active clock-in found', 404);
        }

        const { data: attendance, error } = await supabase
            .from('staff_attendance')
            .update({
                clock_out: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: attendance
        });

        logger.info(`Staff ${userId} clocked out at ${attendance.clock_out}`);
    } catch (error) {
        next(error);
    }
};
