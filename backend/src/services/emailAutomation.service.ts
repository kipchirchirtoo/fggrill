import { logger } from '../utils/logger';
import { PYTHON_SERVICE_URL } from '../config/pythonService';
import { emailService } from './email.service';
import { bookingEmailSequence } from '../utils/bookingEmailTemplates';

interface EmailScheduleRequest {
  bookingId: string;
  guestEmail: string;
  guestName: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  adults: number;
  children?: number;
  totalAmount: number;
  specialRequests?: string;
}

class EmailAutomationService {
  private pythonServiceUrl: string;

  constructor() {
    this.pythonServiceUrl = PYTHON_SERVICE_URL;
  }

  /**
   * Schedule complete email sequence for a booking
   */
  async scheduleBookingEmails(bookingData: EmailScheduleRequest): Promise<boolean> {
    try {
      const payload = {
        id: bookingData.bookingId,
        confirmation_number: bookingData.confirmationNumber,
        guest_email: bookingData.guestEmail,
        guest_name: bookingData.guestName,
        check_in: bookingData.checkInDate,
        check_out: bookingData.checkOutDate,
        room_type: bookingData.roomType,
        adults: bookingData.adults,
        children: bookingData.children || 0,
        total_amount: bookingData.totalAmount,
        special_requests: bookingData.specialRequests
      };

      const response = await fetch(`${this.pythonServiceUrl}/schedule-booking-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Python service error: ${response.statusText}`);
      }

      logger.info(`Email sequence scheduled for booking ${bookingData.confirmationNumber}`);
      return true;

    } catch (error) {
      logger.error('Error scheduling booking emails:', error);

      // Fallback: Send immediate confirmation email
      try {
        await this.sendImmediateConfirmation(bookingData);
        logger.info('Sent fallback confirmation email');
      } catch (fallbackError) {
        logger.error('Fallback email also failed:', fallbackError);
      }

      return false;
    }
  }

  /**
   * Send immediate booking confirmation email
   */
  async sendImmediateConfirmation(bookingData: EmailScheduleRequest): Promise<boolean> {
    try {
      const bookingDetails = {
        id: bookingData.bookingId,
        confirmation_number: bookingData.confirmationNumber,
        guest_name: bookingData.guestName,
        check_in: bookingData.checkInDate,
        check_out: bookingData.checkOutDate,
        room_type: bookingData.roomType,
        adults: bookingData.adults,
        children: bookingData.children || 0,
        total_amount: bookingData.totalAmount,
        special_requests: bookingData.specialRequests,
        room_rate: Math.floor(bookingData.totalAmount / this.calculateNights(bookingData.checkInDate, bookingData.checkOutDate)),
        subtotal: bookingData.totalAmount * 0.862, // Reverse calculate from total
        tax_amount: bookingData.totalAmount * 0.138, // 16% VAT
        service_charge: bookingData.totalAmount * 0.086, // 10% service
        deposit_paid: true,
        payment_method: 'Card Payment'
      };

      await emailService.sendBookingConfirmation(bookingData.guestEmail, bookingDetails);
      logger.info(`Immediate confirmation email sent to ${bookingData.guestEmail}`);
      return true;

    } catch (error) {
      logger.error('Error sending immediate confirmation:', error);
      return false;
    }
  }

  /**
   * Send specific email type immediately
   */
  async sendImmediateEmail(
    emailType: string,
    recipientEmail: string,
    bookingData: any
  ): Promise<boolean> {
    try {
      const payload = {
        to_email: recipientEmail,
        subject: this.getEmailSubject(emailType, bookingData.confirmation_number),
        template_type: emailType,
        booking_data: bookingData
      };

      const response = await fetch(`${this.pythonServiceUrl}/send-immediate-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Python service error: ${response.statusText}`);
      }

      logger.info(`Immediate ${emailType} email sent to ${recipientEmail}`);
      return true;

    } catch (error) {
      logger.error(`Error sending immediate ${emailType} email:`, error);
      return false;
    }
  }

  /**
   * Get email status for a booking
   */
  async getEmailStatus(bookingId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/email-status/${bookingId}`);

      if (!response.ok) {
        throw new Error(`Python service error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.emails || [];

    } catch (error) {
      logger.error('Error getting email status:', error);
      return [];
    }
  }

  /**
   * Send pre-arrival email (7 days before check-in)
   */
  async sendPreArrivalEmail(bookingData: EmailScheduleRequest): Promise<boolean> {
    return this.sendImmediateEmail('pre_arrival', bookingData.guestEmail, {
      confirmation_number: bookingData.confirmationNumber,
      guest_name: bookingData.guestName,
      check_in_formatted: new Date(bookingData.checkInDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      room_type: bookingData.roomType,
      adults: bookingData.adults,
      children: bookingData.children
    });
  }

  /**
   * Send check-in reminder (48 hours before)
   */
  async sendCheckInReminder(bookingData: EmailScheduleRequest): Promise<boolean> {
    return this.sendImmediateEmail('check_in_reminder', bookingData.guestEmail, {
      confirmation_number: bookingData.confirmationNumber,
      guest_name: bookingData.guestName
    });
  }

  /**
   * Send day-of welcome email
   */
  async sendDayOfWelcome(bookingData: EmailScheduleRequest): Promise<boolean> {
    return this.sendImmediateEmail('day_of_welcome', bookingData.guestEmail, {
      guest_name: bookingData.guestName
    });
  }

  /**
   * Send mid-stay check-in email
   */
  async sendMidStayCheckIn(bookingData: EmailScheduleRequest): Promise<boolean> {
    return this.sendImmediateEmail('mid_stay_checkin', bookingData.guestEmail, {
      guest_name: bookingData.guestName
    });
  }

  /**
   * Send pre-departure email
   */
  async sendPreDeparture(bookingData: EmailScheduleRequest): Promise<boolean> {
    return this.sendImmediateEmail('pre_departure', bookingData.guestEmail, {
      guest_name: bookingData.guestName
    });
  }

  /**
   * Send post-stay thank you email
   */
  async sendPostStayThankYou(bookingData: EmailScheduleRequest): Promise<boolean> {
    return this.sendImmediateEmail('post_stay_thankyou', bookingData.guestEmail, {
      guest_name: bookingData.guestName
    });
  }

  /**
   * Send review reminder email
   */
  async sendReviewReminder(bookingData: EmailScheduleRequest): Promise<boolean> {
    return this.sendImmediateEmail('review_reminder', bookingData.guestEmail, {
      guest_name: bookingData.guestName
    });
  }

  /**
   * Test Python service connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/health`);
      return response.ok;
    } catch (error) {
      logger.error('Python service connection failed:', error);
      return false;
    }
  }

  private getEmailSubject(emailType: string, confirmationNumber: string): string {
    const subjects = {
      'pre_arrival': `Your Stay is Almost Here! - Booking ${confirmationNumber}`,
      'check_in_reminder': `Check-in Reminder - Booking ${confirmationNumber}`,
      'day_of_welcome': `Welcome Day is Here! - Booking ${confirmationNumber}`,
      'mid_stay_checkin': 'How is Everything? - FG Grill Hotel',
      'pre_departure': `Check-out Tomorrow - Booking ${confirmationNumber}`,
      'post_stay_thankyou': 'Thank You for Staying with Us!',
      'review_reminder': 'Share Your Experience - FG Grill Hotel'
    };

    return subjects[emailType as keyof typeof subjects] || `FG Grill Hotel - ${confirmationNumber}`;
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    return Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
  }
}

export const emailAutomationService = new EmailAutomationService();
