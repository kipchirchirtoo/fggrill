import { Request, Response, NextFunction } from 'express';
import { communicationService } from '../services/communication.service';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * Send booking confirmation to guest
 */
export const sendBookingConfirmation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId, sendSms = false } = req.body;

    if (!bookingId) {
      throw new AppError('Booking ID is required', 400);
    }

    // Fetch booking details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        guest:guests(first_name, last_name, email, phone),
        room:rooms(room_number),
        room_type:room_types(name)
      `)
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new AppError('Booking not found', 404);
    }

    if (!booking.guest?.email) {
      throw new AppError('Guest email not available', 400);
    }

    const result = await communicationService.sendBookingConfirmation({
      guestEmail: booking.guest.email,
      guestName: `${booking.guest.first_name} ${booking.guest.last_name}`,
      guestPhone: booking.guest.phone,
      bookingId: booking.id,
      confirmationNumber: booking.confirmation_number,
      roomType: booking.room_type?.name || 'Standard Room',
      roomNumber: booking.room?.room_number,
      checkInDate: new Date(booking.check_in_date).toLocaleDateString(),
      checkOutDate: new Date(booking.check_out_date).toLocaleDateString(),
      totalAmount: booking.total_amount || 0,
      specialRequests: booking.special_requests,
      sendSms,
    });

    res.json({
      success: true,
      message: 'Booking confirmation sent',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send check-in reminder to guest
 */
export const sendCheckInReminder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId, sendSms = false } = req.body;

    if (!bookingId) {
      throw new AppError('Booking ID is required', 400);
    }

    // Fetch booking details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        guest:guests(first_name, last_name, email, phone),
        room_type:room_types(name)
      `)
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      throw new AppError('Booking not found', 404);
    }

    if (!booking.guest?.email) {
      throw new AppError('Guest email not available', 400);
    }

    const result = await communicationService.sendCheckInReminder({
      guestEmail: booking.guest.email,
      guestName: `${booking.guest.first_name} ${booking.guest.last_name}`,
      guestPhone: booking.guest.phone,
      bookingId: booking.id,
      confirmationNumber: booking.confirmation_number,
      checkInDate: new Date(booking.check_in_date).toLocaleDateString(),
      roomType: booking.room_type?.name || 'Standard Room',
      sendSms,
    });

    res.json({
      success: true,
      message: 'Check-in reminder sent',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send invoice to guest
 */
export const sendInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { folioId } = req.body;

    if (!folioId) {
      throw new AppError('Folio ID is required', 400);
    }

    // Fetch folio with transactions
    const { data: folio, error: folioError } = await supabase
      .from('folios')
      .select(`
        *,
        booking:bookings(
          id,
          confirmation_number,
          guest:guests(first_name, last_name, email)
        )
      `)
      .eq('id', folioId)
      .single();

    if (folioError || !folio) {
      throw new AppError('Folio not found', 404);
    }

    // Fetch transactions
    const { data: transactions } = await supabase
      .from('folio_transactions')
      .select('*')
      .eq('folio_id', folioId)
      .eq('type', 'charge');

    const guest = folio.booking?.guest;
    if (!guest?.email) {
      throw new AppError('Guest email not available', 400);
    }

    // Calculate totals
    const items = (transactions || []).map((t: any) => ({
      description: t.description,
      quantity: 1,
      amount: t.amount,
    }));

    const subtotal = items.reduce((sum: number, item: any) => sum + item.amount, 0);
    const tax = subtotal * 0.16; // 16% VAT
    const total = subtotal + tax;

    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;

    const result = await communicationService.sendInvoice({
      guestEmail: guest.email,
      guestName: `${guest.first_name} ${guest.last_name}`,
      bookingId: folio.booking?.id,
      folioId: folio.id,
      invoiceNumber,
      items,
      subtotal,
      tax,
      total,
      paymentStatus: folio.balance <= 0 ? 'paid' : 'pending',
    });

    res.json({
      success: true,
      message: 'Invoice sent',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send custom email
 */
export const sendCustomEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      throw new AppError('Email recipient, subject, and body are required', 400);
    }

    const result = await communicationService.sendEmail({
      to,
      subject,
      body,
    });

    res.json({
      success: result.success,
      message: result.success ? 'Email sent' : 'Failed to send email',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send custom SMS
 */
export const sendCustomSMS = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      throw new AppError('Phone number and message are required', 400);
    }

    const result = await communicationService.sendSMS({
      phoneNumber,
      message,
    });

    res.json({
      success: result.success,
      message: result.success ? 'SMS sent' : 'Failed to send SMS',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send bulk SMS
 */
export const sendBulkSMS = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipients, message } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new AppError('Recipients list is required', 400);
    }

    if (!message) {
      throw new AppError('Message is required', 400);
    }

    const result = await communicationService.sendBulkSMS(recipients, message);

    res.json({
      success: true,
      message: `SMS sent to ${result.sent} of ${result.total} recipients`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get message log
 */
export const getMessageLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await communicationService.getMessageLog(limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check communication service health
 */
export const healthCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isHealthy = await communicationService.healthCheck();

    res.json({
      success: true,
      data: {
        service: 'communication-hub',
        status: isHealthy ? 'healthy' : 'unhealthy',
      },
    });
  } catch (error) {
    next(error);
  }
};
