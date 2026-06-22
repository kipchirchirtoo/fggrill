import { BrevoClient } from '@getbrevo/brevo';
import { logger } from '../utils/logger';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachment?: {
    content: string; // Base64 encoded
    name: string;
  };
}

class BrevoEmailService {
  private client: BrevoClient | null;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    const apiKey = process.env.BREVO_API_KEY;
    this.fromEmail = 'info@famousgatehotels.com';
    this.fromName = 'FamousGate Hotels';

    if (!apiKey) {
      this.client = null;
      logger.warn('BREVO_API_KEY is not configured. Email delivery is disabled, but the API will continue running.');
      return;
    }

    this.client = new BrevoClient({ apiKey });
    logger.info(`Brevo Email Service initialized. FROM: ${this.fromName} <${this.fromEmail}>`);
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      if (!this.client) {
        logger.warn(`Email not sent to ${options.to}: BREVO_API_KEY is not configured.`);
        return;
      }

      const emailData: any = {
        sender: {
          name: this.fromName,
          email: this.fromEmail
        },
        to: [{
          email: options.to
        }],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text || this.stripHtml(options.html)
      };

      // Add attachment if provided
      if (options.attachment) {
        emailData.attachment = [{
          content: options.attachment.content,
          name: options.attachment.name
        }];
      }

      logger.info(`Sending email via Brevo API to ${options.to}`);
      logger.info(`Subject: ${options.subject}`);
      if (options.attachment) {
        logger.info(`With attachment: ${options.attachment.name}`);
      }

      const result = await this.client.transactionalEmails.sendTransacEmail(emailData);

      logger.info(`✅ Email sent successfully via Brevo API to ${options.to}`);
      logger.info(`Message ID: ${result.messageId}`);
    } catch (error: any) {
      logger.error('❌ Error sending email via Brevo API:', error);
      console.error('RAW BREVO ERROR:', JSON.stringify(error, null, 2));
      logger.error('Error details:', {
        message: error.message,
        body: error.body
      });
      throw new Error(`Email could not be sent: ${error.message}`);
    }
  }

  async sendLandingBookingConfirmation(email: string, details: any): Promise<void> {
    try {
      const { landingEmailTemplates } = await import('../utils/emailTemplates.landing');

      logger.info(`📧 Preparing booking confirmation email for ${email}`);

      const html = landingEmailTemplates.bookingConfirmation({
        guestName: `${details.firstName} ${details.lastName}`,
        confirmationNumber: details.confirmationNumber,
        checkInDate: details.checkInDate,
        checkOutDate: details.checkOutDate,
        roomType: details.roomType,
        guests: details.guests,
        totalAmount: details.totalAmount,
        hotelName: details.branchName || 'Famous Gate Hotel',
        hotelAddress: 'Bomet, Kenya',
        hotelPhone: '+254 706 782 828',
        hotelEmail: 'info@famousgatehotels.com'
      });

      // Fetch the branded PDF invoice from the Python service (same branded,
      // thermal-style generator used for the cashier receipt / checkout bill)
      let pdfAttachment;
      try {
        logger.info(`📄 Fetching branded PDF invoice from Python service...`);
        const nights = Math.max(1, Math.ceil(
          (new Date(details.checkOutDate).getTime() - new Date(details.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
        ));
        const depositAmount = details.depositAmount || 0;
        const pdfResponse = await axios.post(
          `${PYTHON_SERVICE_URL}/api/reports/generate/booking-confirmation-invoice`,
          {
            confirmation_number: details.confirmationNumber,
            guest_name: `${details.firstName} ${details.lastName}`,
            guest_email: email,
            guest_phone: details.phone || '',
            room_number: details.roomNumber || '',
            room_type: details.roomType,
            check_in: details.checkInDate,
            check_out: details.checkOutDate,
            nights,
            guests: details.guests,
            total_amount: details.totalAmount,
            deposit_amount: depositAmount,
            balance_due: details.totalAmount - depositAmount,
            payment_method: details.paymentMethod || '',
            branch_name: details.branchName
          },
          {
            responseType: 'arraybuffer'
          }
        );

        // Convert PDF buffer to base64
        const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');
        pdfAttachment = {
          content: pdfBase64,
          name: `invoice_${details.confirmationNumber}.pdf`
        };
        logger.info(`✅ PDF invoice generated successfully`);
      } catch (pdfError: any) {
        logger.error('⚠️ Failed to generate PDF invoice:', pdfError.message);
        if (pdfError.response) {
          // responseType is 'arraybuffer', so the error body (a JSON error
          // from Flask) arrives as raw bytes - decode it for a readable log
          // instead of dumping a {"0": 123, "1": 34, ...} byte-index object.
          const rawBody = Buffer.isBuffer(pdfError.response.data)
            ? pdfError.response.data.toString('utf-8')
            : pdfError.response.data;
          logger.error('Python service response:', rawBody);
          logger.error('Python service status:', pdfError.response.status);
        }
        logger.warn('Continuing to send email without PDF attachment');
        // Continue without PDF attachment
      }

      await this.sendEmail({
        to: email,
        subject: `Booking Confirmation - ${details.confirmationNumber} - ${details.branchName || 'Famous Gate Hotel'}`,
        html,
        attachment: pdfAttachment
      });

      logger.info(`✅ Booking confirmation email sent successfully to ${email}`);
    } catch (error: any) {
      logger.error('❌ Error sending landing booking confirmation:', error);
      throw error;
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

export const brevoEmailService = new BrevoEmailService();
