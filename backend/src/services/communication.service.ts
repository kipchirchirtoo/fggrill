import axios from 'axios';
import { logger } from '../utils/logger';

const COMMUNICATION_SERVICE_URL = process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:8002';

interface EmailRequest {
  to: string;
  subject: string;
  body?: string;
  template?: string;
  context?: Record<string, any>;
}

interface SMSRequest {
  phoneNumber: string;
  message: string;
  senderId?: string;
}

interface BookingConfirmationRequest {
  guestEmail: string;
  guestName: string;
  guestPhone?: string;
  bookingId: string;
  confirmationNumber: string;
  roomType: string;
  roomNumber?: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  currency?: string;
  specialRequests?: string;
  sendSms?: boolean;
}

interface CheckInReminderRequest {
  guestEmail: string;
  guestName: string;
  guestPhone?: string;
  bookingId: string;
  confirmationNumber: string;
  checkInDate: string;
  checkInTime?: string;
  roomType: string;
  sendSms?: boolean;
}

interface InvoiceRequest {
  guestEmail: string;
  guestName: string;
  bookingId: string;
  folioId: string;
  invoiceNumber: string;
  items: Array<{ description: string; quantity: number; amount: number }>;
  subtotal: number;
  tax: number;
  total: number;
  currency?: string;
  paymentStatus?: string;
}

interface CommunicationResponse {
  success: boolean;
  messageId?: string;
  channel: string;
  recipient: string;
  status: string;
  error?: string;
}

class CommunicationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = COMMUNICATION_SERVICE_URL;
  }

  /**
   * Send a single email
   */
  async sendEmail(request: EmailRequest): Promise<CommunicationResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/communications/email`, {
        to: request.to,
        subject: request.subject,
        body: request.body,
        template: request.template,
        context: request.context || {},
      });
      return response.data;
    } catch (error: any) {
      logger.error('Communication service email error:', error.message);
      return {
        success: false,
        channel: 'email',
        recipient: request.to,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Send a single SMS
   */
  async sendSMS(request: SMSRequest): Promise<CommunicationResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/communications/sms`, {
        phone_number: request.phoneNumber,
        message: request.message,
        sender_id: request.senderId,
      });
      return response.data;
    } catch (error: any) {
      logger.error('Communication service SMS error:', error.message);
      return {
        success: false,
        channel: 'sms',
        recipient: request.phoneNumber,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Send booking confirmation to guest
   */
  async sendBookingConfirmation(request: BookingConfirmationRequest): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/communications/email/booking-confirmation`,
        {
          guest_email: request.guestEmail,
          guest_name: request.guestName,
          guest_phone: request.guestPhone,
          booking_id: request.bookingId,
          confirmation_number: request.confirmationNumber,
          room_type: request.roomType,
          room_number: request.roomNumber,
          check_in_date: request.checkInDate,
          check_out_date: request.checkOutDate,
          total_amount: request.totalAmount,
          currency: request.currency || 'KES',
          special_requests: request.specialRequests,
          send_sms: request.sendSms || false,
        }
      );
      logger.info(`Booking confirmation sent to ${request.guestEmail}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send booking confirmation:', error.message);
      throw error;
    }
  }

  /**
   * Send check-in reminder to guest
   */
  async sendCheckInReminder(request: CheckInReminderRequest): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/communications/email/check-in-reminder`,
        {
          guest_email: request.guestEmail,
          guest_name: request.guestName,
          guest_phone: request.guestPhone,
          booking_id: request.bookingId,
          confirmation_number: request.confirmationNumber,
          check_in_date: request.checkInDate,
          check_in_time: request.checkInTime || '14:00',
          room_type: request.roomType,
          send_sms: request.sendSms || false,
        }
      );
      logger.info(`Check-in reminder sent to ${request.guestEmail}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send check-in reminder:', error.message);
      throw error;
    }
  }

  /**
   * Send invoice to guest
   */
  async sendInvoice(request: InvoiceRequest): Promise<CommunicationResponse> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/communications/email/invoice`, {
        guest_email: request.guestEmail,
        guest_name: request.guestName,
        booking_id: request.bookingId,
        folio_id: request.folioId,
        invoice_number: request.invoiceNumber,
        items: request.items,
        subtotal: request.subtotal,
        tax: request.tax,
        total: request.total,
        currency: request.currency || 'KES',
        payment_status: request.paymentStatus || 'pending',
      });
      logger.info(`Invoice sent to ${request.guestEmail}`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send invoice:', error.message);
      throw error;
    }
  }

  /**
   * Send bulk SMS
   */
  async sendBulkSMS(
    recipients: string[],
    message: string,
    senderId?: string
  ): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/communications/sms/bulk`, {
        recipients,
        message,
        sender_id: senderId,
      });
      logger.info(`Bulk SMS sent to ${recipients.length} recipients`);
      return response.data;
    } catch (error: any) {
      logger.error('Failed to send bulk SMS:', error.message);
      throw error;
    }
  }

  /**
   * Get message log
   */
  async getMessageLog(limit: number = 50): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/communications/log`, {
        params: { limit },
      });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get message log:', error.message);
      throw error;
    }
  }

  /**
   * Check if communication service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return response.data?.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}

export const communicationService = new CommunicationService();
