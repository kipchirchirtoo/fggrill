import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// @desc    Get all conference halls for a branch
// @route   GET /api/conference/halls
// @access  Private
export const getHalls = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;

        let query = supabase.from('conference_halls').select('*');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data: halls, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: halls
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new conference hall
// @route   POST /api/conference/halls
// @access  Private (Admin/Manager)
export const createHall = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { name, branch_id, capacity, base_price_per_day, base_price_per_hour, description, amenities } = req.body;

        const { data: hall, error } = await supabase
            .from('conference_halls')
            .insert([{
                name,
                branch_id,
                capacity,
                base_price_per_day,
                base_price_per_hour,
                description,
                amenities,
                status: 'available'
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: hall
        });

        logger.info(`Conference hall created: ${name} in branch ${branch_id}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Get all conference bookings
// @route   GET /api/conference/bookings
// @access  Private
export const getConferenceBookings = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;
        const { status, startDate, endDate } = req.query;

        let query = supabase
            .from('conference_hall_bookings')
            .select('*, hall:conference_halls(*)');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }
        if (status) {
            query = query.eq('booking_status', status);
        }
        if (startDate) {
            query = query.gte('start_date', startDate);
        }
        if (endDate) {
            query = query.lte('end_date', endDate);
        }

        const { data: bookings, error } = await query.order('start_date', { ascending: false });

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: bookings
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a conference hall booking
// @route   POST /api/conference/bookings
// @access  Private
export const createConferenceBooking = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            conference_hall_id,
            customer_name,
            customer_phone,
            customer_email,
            start_date,
            end_date,
            total_amount,
            notes
        } = req.body;

        const branch_id = req.body.branch_id || req.user?.branch_id;
        const created_by = req.user?.id;

        if (!conference_hall_id || !start_date || !end_date || !customer_name) {
            throw new AppError('Missing required booking fields', 400);
        }

        // Check for existing bookings in that time range
        const { data: existing, error: checkError } = await supabase
            .from('conference_hall_bookings')
            .select('*')
            .eq('conference_hall_id', conference_hall_id)
            .eq('booking_status', 'confirmed')
            .or(`start_date.lte.${end_date},end_date.gte.${start_date}`);

        if (checkError) throw checkError;

        // More precise overlap check: (StartA < EndB) and (EndA > StartB)
        const hasOverlap = existing && existing.some(b => {
            const bStart = new Date(b.start_date);
            const bEnd = new Date(b.end_date);
            const reqStart = new Date(start_date);
            const reqEnd = new Date(end_date);
            return reqStart < bEnd && reqEnd > bStart;
        });

        if (hasOverlap) {
            throw new AppError('The hall is already booked for the selected time range', 400);
        }

        const { data: booking, error } = await supabase
            .from('conference_hall_bookings')
            .insert([{
                conference_hall_id,
                branch_id,
                customer_name,
                customer_phone,
                customer_email,
                start_date,
                end_date,
                total_amount,
                amount_paid: 0,
                payment_status: 'pending',
                booking_status: 'confirmed',
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

        logger.info(`Conference booking created for ${customer_name} at hall ${conference_hall_id}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Update conference booking status
// @route   PATCH /api/conference/bookings/:id/status
// @access  Private
export const updateConferenceBookingStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
            throw new AppError('Invalid booking status', 400);
        }

        const { data: booking, error } = await supabase
            .from('conference_hall_bookings')
            .update({
                booking_status: status,
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

        logger.info(`Conference booking ${id} status updated to ${status}`);
    } catch (error) {
        next(error);
    }
};
