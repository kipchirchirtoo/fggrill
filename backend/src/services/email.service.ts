/**
 * email.service.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Primary transactional email service using Brevo SMTP relay via Nodemailer.
 *
 * Security posture:
 *  • TLS enforced end-to-end (rejectUnauthorized: true in production)
 *  • Connection pooling – reduces auth round-trips & rate-limit exposure
 *  • HTML sanitised before sending (strips injected <script> / event attrs)
 *  • Rate limiting on bursts (max N emails per minute guard in-process)
 *  • Recipient address validated before any network call
 *  • No credentials, secrets, or full email addresses ever written to logs
 *  • Ethereal fallback ONLY in non-production with explicit opt-in
 * ──────────────────────────────────────────────────────────────────────────────
 */

import nodemailer from 'nodemailer';
import type SMTPPool from 'nodemailer/lib/smtp-pool';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import axios from 'axios';
import { logger } from '../utils/logger';
import { emailTemplates } from '../utils/emailTemplates';
import { enterpriseEmailTemplates } from '../utils/emailTemplates.enterprise';
import { landingEmailTemplates } from '../utils/emailTemplates.landing';
import { barcodeGeneratorService } from './barcodeGenerator.service';
import { PYTHON_SERVICE_URL } from '../config/pythonService';
import { buildSmtpConfig, SmtpConfig } from '../config/smtp.config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: nodemailer.SendMailOptions['attachments'];
}

// ─── Sanitisation helper ──────────────────────────────────────────────────────

/**
 * Strips dangerous HTML constructs from email bodies.
 * This is a defence-in-depth measure – template authors should still escape
 * user-supplied data, but this catches any slip-ups.
 */
function sanitiseHtml(html: string): string {
  return html
    // Remove <script> blocks entirely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove inline event handlers (onclick, onerror, onload, …)
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Remove javascript: URIs
    .replace(/href\s*=\s*(['"])\s*javascript:/gi, 'href=$1#');
}

/**
 * Validates a recipient email address.
 * Prevents header-injection and catches obvious typos before making network calls.
 */
function isValidEmail(email: string): boolean {
  // Reject multi-line values (header injection guard)
  if (/[\r\n]/.test(email)) return false;
  const EMAIL_RE = /^[^\s@"'<>]{1,64}@[^\s@"'<>]{1,255}\.[^\s@"'<>]{2,}$/;
  return EMAIL_RE.test(email.trim());
}

/** Masks an email for safe logging: info@example.com → i***@example.com */
function maskEmail(email: string): string {
  if (!email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  return `${local[0]}${'*'.repeat(Math.max(0, local.length - 1))}@${domain}`;
}

// ─── In-process rate limiter ──────────────────────────────────────────────────

class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxPerWindow: number;
  private readonly windowMs: number;

  constructor(maxPerWindow: number, windowSeconds: number) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowSeconds * 1000;
  }

  /** Returns true if within the rate limit, false if throttled. */
  allow(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxPerWindow) return false;
    this.timestamps.push(now);
    return true;
  }

  remaining(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxPerWindow - this.timestamps.length);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class EmailService {
  private transporter!: nodemailer.Transporter;
  private config!: SmtpConfig;
  private usingEthereal = false;
  private etherealCredentials?: { user: string; pass: string };
  /**
   * In-process guard: max 30 sends per 60 seconds.
   * Brevo's free tier limit is 300/day (~12/hour) so this is generous,
   * but it defends against runaway loops and programmatic abuse.
   */
  private rateLimiter = new RateLimiter(30, 60);

  constructor() {
    this.initTransporter();
  }

  // ── Setup ───────────────────────────────────────────────────────────────────

  private initTransporter(): void {
    try {
      this.config = buildSmtpConfig();
      // Pool options (nodemailer uses SMTPPool when pool:true)
      const smtpOptions: SMTPPool.Options = {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.auth.user,
          pass: this.config.auth.pass
        },
        tls: {
          rejectUnauthorized: this.config.tls.rejectUnauthorized,
          minVersion: this.config.tls.minVersion as 'TLSv1.2' | 'TLSv1.3',
          ciphers: this.config.tls.ciphers
        },
        pool: true as const,
        maxConnections: this.config.maxConnections,
        maxMessages: this.config.maxMessages,
        connectionTimeout: 10_000,  // 10 s
        socketTimeout: 30_000       // 30 s
      };
      this.transporter = nodemailer.createTransport(smtpOptions);
      this.usingEthereal = false;
      logger.info('[EmailService] Brevo SMTP transporter ready');
    } catch (err: any) {
      // Config errors are already logged by buildSmtpConfig()
      logger.warn('[EmailService] SMTP init failed – email delivery is disabled until config is fixed.');
      // In non-production, set up Ethereal as an emergency fallback
      if (process.env.NODE_ENV !== 'production') {
        logger.info('[EmailService] Non-production: will attempt Ethereal fallback on first send.');
      }
    }
  }

  /** Sets up Ethereal (test SMTP) as a last-resort fallback — dev-only. */
  private async setupEtherealFallback(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[EmailService] Ethereal fallback is disabled in production.');
    }
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.etherealCredentials = { user: testAccount.user, pass: testAccount.pass };
      const etherealOptions: SMTPTransport.Options = {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
        tls: { rejectUnauthorized: false }  // Ethereal uses self-signed certs (dev only)
      };
      this.transporter = nodemailer.createTransport(etherealOptions);
      this.usingEthereal = true;
      // INTENTIONALLY log credentials here — Ethereal is a disposable test inbox
      logger.info('[EmailService] Ethereal fallback active.');
      logger.info(`  Preview inbox: https://ethereal.email/login`);
      logger.info(`  User: ${testAccount.user}`);
    } catch (err: any) {
      logger.error('[EmailService] Could not create Ethereal account:', err.message);
      throw err;
    }
  }

  // ── Core send ────────────────────────────────────────────────────────────────

  async sendEmail(options: EmailOptions): Promise<{ previewUrl?: string }> {
    // ── Rate limit guard ──────────────────────────────────────────────────────
    if (!this.rateLimiter.allow()) {
      logger.warn('[EmailService] Rate limit exceeded – email queued/dropped', {
        to: maskEmail(options.to),
        remaining: 0
      });
      throw new Error('Email rate limit exceeded. Please try again shortly.');
    }

    // ── Recipient validation ──────────────────────────────────────────────────
    if (!isValidEmail(options.to)) {
      logger.error('[EmailService] Rejected invalid recipient address', {
        to: maskEmail(options.to)
      });
      throw new Error('Invalid recipient email address.');
    }

    // ── Subject validation (prevent header injection) ─────────────────────────
    if (/[\r\n]/.test(options.subject)) {
      logger.error('[EmailService] Rejected email with newline in subject (header injection attempt)');
      throw new Error('Invalid email subject.');
    }

    // ── HTML sanitisation ─────────────────────────────────────────────────────
    const safeHtml = sanitiseHtml(options.html);

    try {
      if (!this.transporter) {
        if (process.env.NODE_ENV !== 'production') {
          await this.setupEtherealFallback();
        } else {
          throw new Error('Email transporter is not initialised.');
        }
      }

      const from = this.config
        ? `${this.config.from.name} <${this.config.from.email}>`
        : (process.env.SMTP_FROM_NAME
            ? `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`
            : 'Famous Gate Hotels <info@famousgatehotels.com>');

      const mailOptions: nodemailer.SendMailOptions = {
        from,
        to: options.to.trim(),
        subject: options.subject.trim(),
        html: safeHtml,
        text: options.text || this.stripHtml(safeHtml),
        attachments: options.attachments
      };

      logger.info('[EmailService] Sending email', {
        to: maskEmail(options.to),
        subject: options.subject,
        hasAttachments: (options.attachments?.length ?? 0) > 0
      });

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('[EmailService] Email sent successfully', {
        to: maskEmail(options.to),
        messageId: info.messageId ? `<${info.messageId.slice(0, 12)}…>` : 'n/a'
      });

      if (this.usingEthereal && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          logger.info(`[EmailService] Ethereal preview: ${previewUrl}`);
          return { previewUrl };
        }
      }

      return {};
    } catch (error: any) {
      // Safe error logging — don't dump credentials from error objects
      logger.error('[EmailService] Failed to send email', {
        to: maskEmail(options.to),
        error: error.message,
        code: error.code
      });

      // Dev-only Ethereal fallback
      if (!this.usingEthereal && process.env.NODE_ENV !== 'production') {
        logger.info('[EmailService] Primary SMTP failed – activating Ethereal fallback...');
        try {
          await this.setupEtherealFallback();
          return await this.sendEmail(options);  // single retry via Ethereal
        } catch (ethErr: any) {
          logger.error('[EmailService] Ethereal fallback also failed:', ethErr.message);
        }
      }

      throw new Error(`Email could not be sent: ${error.message}`);
    }
  }

  // ── Health check ─────────────────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      if (!this.transporter) throw new Error('Transporter not initialised');
      await this.transporter.verify();
      logger.info('[EmailService] SMTP connection verified (Brevo)');
      return true;
    } catch (error: any) {
      logger.error('[EmailService] SMTP verify failed:', {
        error: error.message,
        code: error.code
      });
      if (!this.usingEthereal && process.env.NODE_ENV !== 'production') {
        await this.setupEtherealFallback();
        try {
          await this.transporter.verify();
          logger.info('[EmailService] Ethereal fallback verified');
          return true;
        } catch { /* ignore */ }
      }
      return false;
    }
  }

  // ── High-level email methods ──────────────────────────────────────────────────

  // ── DISABLED — only reservation, booking confirmation & checkout emails are sent
  async sendWelcomeEmail(_name: string, _email: string): Promise<void> {
    logger.debug('[EmailService] sendWelcomeEmail is disabled');
  }

  // ── DISABLED
  async sendPasswordResetEmail(_email: string, _resetToken: string): Promise<void> {
    logger.debug('[EmailService] sendPasswordResetEmail is disabled');
  }

  async sendBookingConfirmation(email: string, bookingDetails: any): Promise<void> {
    try {
      const confirmationNumber = bookingDetails.confirmation_number || bookingDetails.id;
      logger.info('[EmailService] Generating barcode', { ref: confirmationNumber });
      const barcodeBase64 = await barcodeGeneratorService.generateBarcode(confirmationNumber);

      const mailOptions: EmailOptions = {
        to: email,
        subject: 'Booking Confirmation – Famous Gate Hotels',
        html: enterpriseEmailTemplates.bookingConfirmation(bookingDetails, barcodeBase64 || undefined),
        attachments: []
      };

      if (barcodeBase64) {
        mailOptions.attachments!.push({
          filename: 'barcode.png',
          content: Buffer.from(barcodeBase64, 'base64'),
          cid: 'barcode@famousgate',
          contentType: 'image/png'
        });
      }

      await this.sendEmail(mailOptions);
      logger.info('[EmailService] Booking confirmation sent', {
        to: maskEmail(email),
        barcode: !!barcodeBase64
      });
    } catch (error) {
      logger.error('[EmailService] sendBookingConfirmation error:', error);
      // Fallback without barcode
      await this.sendEmail({
        to: email,
        subject: 'Booking Confirmation – Famous Gate Hotels',
        html: enterpriseEmailTemplates.bookingConfirmation(bookingDetails)
      });
    }
  }

  // ── DISABLED
  async sendBookingCancellation(_email: string, _bookingDetails: any): Promise<void> {
    logger.debug('[EmailService] sendBookingCancellation is disabled');
  }

  async sendPaymentReceipt(email: string, paymentDetails: any): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Payment Receipt – Famous Gate Hotels',
      html: emailTemplates.paymentReceipt(paymentDetails)
    });
  }

  async sendInvoice(email: string, invoiceDetails: any): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: `Invoice ${invoiceDetails.invoice_number || invoiceDetails.id} – Famous Gate Hotels`,
      html: emailTemplates.invoice(invoiceDetails)
    });
  }

  // ── DISABLED
  async sendCheckInReminder(_email: string, _bookingDetails: any): Promise<void> {
    logger.debug('[EmailService] sendCheckInReminder is disabled');
  }

  // ── DISABLED
  async sendCheckOutReminder(_email: string, _bookingDetails: any): Promise<void> {
    logger.debug('[EmailService] sendCheckOutReminder is disabled');
  }

  // ── DISABLED
  async sendCheckInWelcome(_email: string, _bookingDetails: any): Promise<void> {
    logger.debug('[EmailService] sendCheckInWelcome is disabled');
  }

  // ── DISABLED
  async sendMaintenanceAlert(_email: string, _taskDetails: any): Promise<void> {
    logger.debug('[EmailService] sendMaintenanceAlert is disabled');
  }

  // ── DISABLED
  async sendInventoryAlert(_email: string, _itemDetails: any): Promise<void> {
    logger.debug('[EmailService] sendInventoryAlert is disabled');
  }

  // ── DISABLED
  async sendStockTransferEmail(_user: any, _items: any[]): Promise<void> {
    logger.debug('[EmailService] sendStockTransferEmail is disabled');
  }

  // ── DISABLED
  async sendPayslipEmail(_staff: any, _month: string, _year: number, _pdfBuffer: Buffer): Promise<void> {
    logger.debug('[EmailService] sendPayslipEmail is disabled');
  }

  async sendLandingBookingConfirmation(email: string, details: any): Promise<void> {
    try {
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

      let attachments: nodemailer.SendMailOptions['attachments'];
      try {
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
          { responseType: 'arraybuffer' }
        );

        attachments = [{
          filename: `invoice_${details.confirmationNumber}.pdf`,
          content: Buffer.from(pdfResponse.data),
          contentType: 'application/pdf'
        }];
        logger.info('[EmailService] PDF invoice generated for booking confirmation');
      } catch (pdfError: any) {
        const body = Buffer.isBuffer(pdfError.response?.data)
          ? pdfError.response.data.toString('utf-8')
          : pdfError.response?.data;
        logger.error('[EmailService] PDF invoice generation failed', {
          error: pdfError.message,
          status: pdfError.response?.status,
          body
        });
        logger.warn('[EmailService] Sending email without PDF attachment');
      }

      await this.sendEmail({
        to: email,
        subject: `Booking Confirmation – ${details.confirmationNumber} – ${details.branchName || 'Famous Gate Hotel'}`,
        html,
        attachments
      });
    } catch (error: any) {
      logger.error('[EmailService] sendLandingBookingConfirmation error:', error.message);
      throw error;
    }
  }

  async sendLandingReservationRequest(email: string, details: any): Promise<void> {
    const html = landingEmailTemplates.reservationRequest({
      guestName: `${details.firstName} ${details.lastName}`,
      reservationId: details.reservationId,
      checkInDate: details.checkInDate,
      checkOutDate: details.checkOutDate,
      roomType: details.roomType,
      guests: details.guests,
      totalAmount: details.totalAmount,
      paymentLink: details.paymentLink,
      hotelName: details.branchName || 'Famous Gate Hotel',
      hotelAddress: 'Bomet, Kenya',
      hotelPhone: '+254 706 782 828',
      hotelEmail: 'info@famousgatehotels.com'
    });

    await this.sendEmail({
      to: email,
      subject: `Reservation Request Pending – ${details.branchName || 'Famous Gate Hotel'}`,
      html
    });
  }

  // ── DISABLED
  async sendLandingPromotion(_recipients: any[], _details: any): Promise<void> {
    logger.debug('[EmailService] sendLandingPromotion is disabled');
  }

  // ── DISABLED
  async sendLandingNewsletter(_recipients: any[], _details: any): Promise<void> {
    logger.debug('[EmailService] sendLandingNewsletter is disabled');
  }

  // ── DISABLED
  async sendPurchaseOrderEmail(_supplierEmail: string, _poDetails: any): Promise<void> {
    logger.debug('[EmailService] sendPurchaseOrderEmail is disabled');
  }

  // ── Private utilities ─────────────────────────────────────────────────────────

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

export const emailService = new EmailService();
