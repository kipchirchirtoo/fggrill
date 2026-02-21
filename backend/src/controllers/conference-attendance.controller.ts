import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * @desc    Record daily attendance for a conference booking
 * @route   POST /api/conference/bookings/:id/attendance
 * @access  Private (Receptionist/Manager)
 */
export const recordDailyAttendance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id: booking_id } = req.params;
        const {
            attendance_date,
            num_participants,
            meal_plan_details,
            notes
        } = req.body;

        if (!attendance_date || !num_participants) {
            throw new AppError('Attendance date and number of participants are required', 400);
        }

        const recorded_by = req.user?.id;

        // Check if attendance already exists for this date
        const { data: existing } = await supabase
            .from('conference_daily_attendance')
            .select('*')
            .eq('booking_id', booking_id)
            .eq('attendance_date', attendance_date)
            .single();

        let result;
        if (existing) {
            // Update existing attendance
            const { data, error } = await supabase
                .from('conference_daily_attendance')
                .update({
                    num_participants,
                    meal_plan_details,
                    notes,
                    updated_at: new Date().toISOString()
                })
                .eq('booking_id', booking_id)
                .eq('attendance_date', attendance_date)
                .select()
                .single();

            if (error) throw error;
            result = data;
        } else {
            // Insert new attendance
            const { data, error } = await supabase
                .from('conference_daily_attendance')
                .insert({
                    booking_id,
                    attendance_date,
                    num_participants,
                    meal_plan_details,
                    notes,
                    recorded_by
                })
                .select()
                .single();

            if (error) throw error;
            result = data;
        }

        res.status(200).json({
            success: true,
            message: existing ? 'Attendance updated' : 'Attendance recorded',
            data: result
        });

        logger.info(`Daily attendance recorded for booking ${booking_id} on ${attendance_date}`);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get daily attendance records for a booking
 * @route   GET /api/conference/bookings/:id/attendance
 * @access  Private
 */
export const getDailyAttendance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id: booking_id } = req.params;

        const { data: attendance, error } = await supabase
            .from('conference_daily_attendance')
            .select('*')
            .eq('booking_id', booking_id)
            .order('attendance_date', { ascending: true });

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: attendance || []
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Generate invoice with daily attendance breakdown
 * @route   GET /api/conference/bookings/:id/invoice-with-attendance
 * @access  Private (Accountant)
 */
export const generateInvoiceWithAttendance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id: booking_id } = req.params;

        // Get booking details
        const { data: booking, error: bookingError } = await supabase
            .from('conference_hall_bookings')
            .select('*, hall:conference_halls(*), branch:branches(*)')
            .eq('id', booking_id)
            .single();

        if (bookingError) throw bookingError;
        if (!booking) throw new AppError('Booking not found', 404);

        // Get daily attendance
        const { data: attendance, error: attendanceError } = await supabase
            .from('conference_daily_attendance')
            .select('*')
            .eq('booking_id', booking_id)
            .order('attendance_date', { ascending: true });

        if (attendanceError) throw attendanceError;

        // Calculate totals using the database function
        const { data: calculation, error: calcError } = await supabase
            .rpc('calculate_conference_invoice_with_attendance', {
                p_booking_id: booking_id
            });

        if (calcError) {
            logger.error(`Error calculating invoice: ${calcError.message}`);
        }

        // Build invoice data
        const invoiceData = {
            booking,
            daily_attendance: attendance || [],
            calculation: calculation && calculation.length > 0 ? calculation[0] : null,
            generated_at: new Date().toISOString(),
            generated_by: req.user?.id
        };

        res.status(200).json({
            success: true,
            data: invoiceData
        });

        logger.info(`Invoice with attendance generated for booking ${booking_id}`);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete daily attendance record
 * @route   DELETE /api/conference/bookings/:id/attendance/:date
 * @access  Private (Manager)
 */
export const deleteDailyAttendance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id: booking_id, date: attendance_date } = req.params;

        const { error } = await supabase
            .from('conference_daily_attendance')
            .delete()
            .eq('booking_id', booking_id)
            .eq('attendance_date', attendance_date);

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Attendance record deleted'
        });

        logger.info(`Attendance deleted for booking ${booking_id} on ${attendance_date}`);
    } catch (error) {
        next(error);
    }
};
