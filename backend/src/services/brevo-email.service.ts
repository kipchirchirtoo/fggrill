/**
 * brevo-email.service.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Brevo Transactional Email API client (REST, not SMTP).
 *
 * This service uses the Brevo API SDK for sending transactional emails and
 * PDF-attached booking confirmations. It complements email.service.ts (SMTP)
 * and is the preferred method for landing-page booking confirmations since the
 * Brevo API gives delivery receipts and open-tracking out of the box.
 *
 * Security posture:
 *  • API key read exclusively from process.env.BREVO_API_KEY
 *  • fromEmail read from process.env.SMTP_FROM_EMAIL (validated at config level)
 *  • Recipient address validated before any API call
 *  • HTML sanitised before sending
 *  • No credentials or full addresses in logs (masked)
 *  • Raw Brevo error body NEVER dumped to console / logs in production
 *  • PDF content validated as base64 before attaching
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { BrevoClient } from '@getbrevo/brevo';
import axios from 'axios';
import { logger } from '../utils/logger';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachment?: {
    /** Base64-encoded file content */
    content: string;
    name: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Validates a recipient email address and guards against header injection. */
function isValidEmail(email: string): boolean {
  if (/[\r\n]/.test(email)) return false;
  return /^[^\s@"'<>]{1,64}@[^\s@"'<>]{1,255}\.[^\s@"'<>]{2,}$/.test(email.trim());
}

/** Masks email for safe logging: info@example.com → i***@example.com */
function maskEmail(email: string): string {
  if (!email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  return `${local[0]}${'*'.repeat(Math.max(0, local.length - 1))}@${domain}`;
}

/** Strips dangerous HTML constructs from email body (defence-in-depth). */
function sanitiseHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/href\s*=\s*(['"])\s*javascript:/gi, 'href=$1#');
}

/** Strips HTML tags to produce a plain-text fallback. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Validates that a string is valid base64 content.
 * Returns false for obviously malformed content to prevent API errors.
 */
function isValidBase64(str: string): boolean {
  try {
    return /^[A-Za-z0-9+/]+=*$/.test(str) && str.length > 0;
  } catch {
    return false;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class BrevoEmailService {
  private client: BrevoClient | null = null;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly isProd: boolean;

  constructor() {
    this.isProd = process.env.NODE_ENV === 'production';
    this.fromEmail = (process.env.SMTP_FROM_EMAIL || 'info@famousgatehotels.com').trim();
    this.fromName  = (process.env.SMTP_FROM_NAME  || 'Famous Gate Hotels').trim();

    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      logger.warn('[BrevoEmailService] BREVO_API_KEY not set – Brevo API delivery disabled.');
      return;
    }

    this.client = new BrevoClient({ apiKey });
    logger.info('[BrevoEmailService] Brevo API client ready', {
      fromName: this.fromName,
      fromEmail: maskEmail(this.fromEmail)
    });
  }

  // ── Core send ──────────────────────────────────────────────────────────────

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.client) {
      logger.warn('[BrevoEmailService] Email not sent – BREVO_API_KEY not configured', {
        to: maskEmail(options.to)
      });
      return;
    }

    // ── Input validation ─────────────────────────────────────────────────────
    if (!isValidEmail(options.to)) {
      logger.error('[BrevoEmailService] Rejected invalid recipient', { to: maskEmail(options.to) });
      throw new Error('Invalid recipient email address.');
    }
    if (/[\r\n]/.test(options.subject)) {
      logger.error('[BrevoEmailService] Rejected email with newline in subject');
      throw new Error('Invalid email subject.');
    }

    const safeHtml = sanitiseHtml(options.html);

    try {
      const emailData: any = {
        sender: { name: this.fromName, email: this.fromEmail },
        to: [{ email: options.to.trim() }],
        subject: options.subject.trim(),
        htmlContent: safeHtml,
        textContent: options.text || stripHtml(safeHtml)
      };

      // ── Attachment ─────────────────────────────────────────────────────────
      if (options.attachment) {
        if (!isValidBase64(options.attachment.content)) {
          logger.warn('[BrevoEmailService] Attachment skipped – invalid base64 content');
        } else {
          emailData.attachment = [{
            content: options.attachment.content,
            name: options.attachment.name
          }];
        }
      }

      logger.info('[BrevoEmailService] Sending email via Brevo API', {
        to: maskEmail(options.to),
        subject: options.subject,
        hasAttachment: !!options.attachment
      });

      const result = await this.client.transactionalEmails.sendTransacEmail(emailData);

      logger.info('[BrevoEmailService] Email sent successfully', {
        to: maskEmail(options.to),
        // Truncate messageId to avoid leaking internal Brevo routing info
        messageId: result.messageId ? `<${String(result.messageId).slice(0, 12)}…>` : 'n/a'
      });
    } catch (error: any) {
      // ── Safe error logging – never log the full error body in production ──
      const safeError: Record<string, any> = {
        message: error.message,
        code: error.code,
        status: error.status
      };

      if (!this.isProd && error.body) {
        // In development only, include body for easier debugging
        try {
          safeError.body = typeof error.body === 'string'
            ? JSON.parse(error.body)
            : error.body;
        } catch { /* ignore JSON parse errors */ }
      }

      logger.error('[BrevoEmailService] Failed to send email', safeError);
      throw new Error(`Email could not be sent: ${error.message}`);
    }
  }

  // ── Booking confirmation ────────────────────────────────────────────────────

  async sendLandingBookingConfirmation(email: string, details: any): Promise<void> {
    try {
      const { landingEmailTemplates } = await import('../utils/emailTemplates.landing');

      logger.info('[BrevoEmailService] Preparing booking confirmation', {
        to: maskEmail(email),
        ref: details.confirmationNumber
      });

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

      // ── PDF invoice ────────────────────────────────────────────────────────
      let pdfAttachment: { content: string; name: string } | undefined;
      try {
        const nights = Math.max(1, Math.ceil(
          (new Date(details.checkOutDate).getTime() - new Date(details.checkInDate).getTime())
          / (1000 * 60 * 60 * 24)
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
          { responseType: 'arraybuffer', timeout: 15_000 }
        );

        const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');
        pdfAttachment = {
          content: pdfBase64,
          name: `invoice_${details.confirmationNumber}.pdf`
        };
        logger.info('[BrevoEmailService] PDF invoice generated');
      } catch (pdfError: any) {
        const rawBody = Buffer.isBuffer(pdfError.response?.data)
          ? pdfError.response.data.toString('utf-8')
          : pdfError.response?.data;

        logger.error('[BrevoEmailService] PDF generation failed', {
          error: pdfError.message,
          status: pdfError.response?.status,
          // Only log body in dev
          body: this.isProd ? '[redacted]' : rawBody
        });
        logger.warn('[BrevoEmailService] Sending email without PDF attachment');
      }

      await this.sendEmail({
        to: email,
        subject: `Booking Confirmation – ${details.confirmationNumber} – ${details.branchName || 'Famous Gate Hotel'}`,
        html,
        attachment: pdfAttachment
      });

      logger.info('[BrevoEmailService] Booking confirmation sent', {
        to: maskEmail(email),
        ref: details.confirmationNumber,
        hasPdf: !!pdfAttachment
      });
    } catch (error: any) {
      logger.error('[BrevoEmailService] sendLandingBookingConfirmation error:', error.message);
      throw error;
    }
  }
}

export const brevoEmailService = new BrevoEmailService();
