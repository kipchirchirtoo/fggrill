import { BrevoClient } from '@getbrevo/brevo';
import { logger } from '../utils/logger';
import axios from 'axios';

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
  private client: BrevoClient;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    // Get API key from environment with hardcoded fallback for production persistence
    const apiKey = process.env.BREVO_API_KEY ||
      process.env.SMTP_PASS ||
      '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';

    // Initialize Brevo client
    this.client = new BrevoClient({ apiKey });
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'info@famousgateshotels.com';
    this.fromName = process.env.SMTP_FROM_NAME || 'FamousGate Hotels';

    logger.info('Brevo Email Service initialized with API');
    logger.info(`FROM: ${this.fromName} <${this.fromEmail}>`);
    logger.info(`API Key Source: ${process.env.BREVO_API_KEY ? 'Environment' : 'Fallback'}`);
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
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

      // Fetch PDF invoice from Python service
      let pdfAttachment;
      try {
        logger.info(`📄 Fetching PDF invoice from Python service...`);
        const pdfResponse = await axios.post(
          'http://localhost:5001/api/reports/generate/branded-pdf',
          {
            confirmationNumber: details.confirmationNumber,
            guestName: `${details.firstName} ${details.lastName}`,
            email: email,
            phone: details.phone || 'N/A',
            checkInDate: details.checkInDate,
            checkOutDate: details.checkOutDate,
            roomType: details.roomType,
            guests: details.guests,
            totalAmount: details.totalAmount
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
