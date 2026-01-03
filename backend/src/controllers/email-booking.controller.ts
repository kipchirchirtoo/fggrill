import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { emailService } from '../services/email.service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Send booking confirmation email for a specific booking
 */
export const sendBookingEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params;

    // Fetch booking with guest and room details
    const { data: booking, error: bookingError } = await supabase
      .from('reservations')
      .select(`
        *,
        guest:guests(*),
        room:rooms(room_number, room_type:room_types(name))
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new AppError('Booking not found', 404);
    }

    const guest = Array.isArray(booking.guest) ? booking.guest[0] : booking.guest;
    const room = Array.isArray(booking.room) ? booking.room[0] : booking.room;

    if (!guest || !guest.email) {
      throw new AppError('Guest email not found', 400);
    }

    const bookingDetails = {
      id: booking.id,
      confirmation_number: booking.confirmation_number,
      guest_name: `${guest.first_name} ${guest.last_name}`,
      check_in: booking.check_in_date,
      check_out: booking.check_out_date,
      room_number: room?.room_number || 'TBA',
      room_type: room?.room_type?.name || 'Standard',
      adults: booking.adults,
      children: booking.children || 0,
      total_amount: booking.total_amount,
      special_requests: booking.special_requests,
      room_rate: booking.room_rate,
      subtotal: booking.subtotal,
      tax_amount: booking.tax_amount,
      service_charge: booking.service_charge,
      deposit_paid: booking.deposit_paid,
      payment_method: booking.payment_method,
      meal_plan: booking.meal_plan
    };

    await emailService.sendBookingConfirmation(guest.email, bookingDetails);
    
    logger.info(`Booking confirmation email sent to ${guest.email} for booking ${bookingId}`);

    res.status(200).json({
      success: true,
      message: `Email sent successfully to ${guest.email}`,
      data: {
        bookingId,
        email: guest.email,
        confirmationNumber: booking.confirmation_number
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send booking confirmation emails for all confirmed bookings
 */
export const sendAllConfirmedBookingEmails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branchId, status = 'confirmed' } = req.query;

    let query = supabase
      .from('reservations')
      .select(`
        *,
        guest:guests(*),
        room:rooms(room_number, room_type:room_types(name))
      `)
      .in('status', ['confirmed', 'checked_in']);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: bookings, error } = await query;

    if (error) {
      throw new AppError('Failed to fetch bookings', 500);
    }

    const results = {
      total: bookings?.length || 0,
      sent: 0,
      failed: 0,
      errors: [] as any[]
    };

    if (bookings && bookings.length > 0) {
      for (const booking of bookings) {
        try {
          const guest = Array.isArray(booking.guest) ? booking.guest[0] : booking.guest;
          const room = Array.isArray(booking.room) ? booking.room[0] : booking.room;

          if (!guest || !guest.email) {
            results.failed++;
            results.errors.push({
              bookingId: booking.id,
              error: 'No guest email'
            });
            continue;
          }

          const bookingDetails = {
            id: booking.id,
            confirmation_number: booking.confirmation_number,
            guest_name: `${guest.first_name} ${guest.last_name}`,
            check_in: booking.check_in_date,
            check_out: booking.check_out_date,
            room_number: room?.room_number || 'TBA',
            room_type: room?.room_type?.name || 'Standard',
            adults: booking.adults,
            children: booking.children || 0,
            total_amount: booking.total_amount,
            special_requests: booking.special_requests,
            room_rate: booking.room_rate,
            subtotal: booking.subtotal,
            tax_amount: booking.tax_amount,
            service_charge: booking.service_charge,
            deposit_paid: booking.deposit_paid,
            payment_method: booking.payment_method,
            meal_plan: booking.meal_plan
          };

          await emailService.sendBookingConfirmation(guest.email, bookingDetails);
          results.sent++;
          
          logger.info(`Email sent to ${guest.email} for booking ${booking.confirmation_number}`);
        } catch (emailError: any) {
          results.failed++;
          results.errors.push({
            bookingId: booking.id,
            confirmationNumber: booking.confirmation_number,
            error: emailError.message
          });
          logger.error(`Failed to send email for booking ${booking.id}:`, emailError);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Sent ${results.sent} emails, ${results.failed} failed`,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Test email service connection
 */
export const testEmailService = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isConnected = await emailService.testConnection();

    res.status(200).json({
      success: true,
      data: {
        smtp_host: process.env.SMTP_HOST,
        smtp_port: process.env.SMTP_PORT,
        smtp_user: process.env.SMTP_USER,
        from_email: process.env.SMTP_FROM_EMAIL,
        from_name: process.env.SMTP_FROM_NAME,
        connection_status: isConnected ? 'Connected' : 'Disconnected',
        last_checked: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};
