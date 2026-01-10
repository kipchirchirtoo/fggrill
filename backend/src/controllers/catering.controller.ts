import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// @desc    Get all catering bookings
// @route   GET /api/catering/bookings
// @access  Private
export const getCateringBookings = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;
        const { status, startDate, endDate } = req.query;

        let query = supabase.from('outside_catering_bookings').select('*');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (startDate) {
            query = query.gte('event_date', startDate);
        }
        if (endDate) {
            query = query.lte('event_date', endDate);
        }

        const { data: bookings, error } = await query.order('event_date', { ascending: false });

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: bookings
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a catering booking
// @route   POST /api/catering/bookings
// @access  Private
export const createCateringBooking = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            customer_name,
            customer_phone,
            event_date,
            event_location,
            guest_count,
            menu_details,
            total_amount,
            notes
        } = req.body;

        const branch_id = req.body.branch_id || req.user?.branch_id;
        const created_by = req.user?.id;

        if (!customer_name || !event_date || !event_location || !total_amount) {
            throw new AppError('Missing required catering booking fields', 400);
        }

        const { data: booking, error } = await supabase
            .from('outside_catering_bookings')
            .insert([{
                branch_id,
                customer_name,
                customer_phone,
                event_date,
                event_location,
                guest_count,
                menu_details,
                total_amount,
                amount_paid: 0,
                payment_status: 'pending',
                status: 'confirmed',
                notes,
                created_by
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: booking
        });

        logger.info(`Outside catering booking created for ${customer_name} on ${event_date}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Update catering booking status
// @route   PATCH /api/catering/bookings/:id/status
// @access  Private
export const updateCateringStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
            throw new AppError('Invalid catering status', 400);
        }

        const { data: booking, error } = await supabase
            .from('outside_catering_bookings')
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: booking
        });

        logger.info(`Catering booking ${id} status updated to ${status}`);
    } catch (error) {
        next(error);
    }
};
