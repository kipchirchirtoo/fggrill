import nodemailer from 'nodemailer';
import axios from 'axios';
import { logger } from '../utils/logger';
import { emailTemplates } from '../utils/emailTemplates';
import { enterpriseEmailTemplates } from '../utils/emailTemplates.enterprise';
import { landingEmailTemplates } from '../utils/emailTemplates.landing';
import { barcodeGeneratorService } from './barcodeGenerator.service';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: any[];
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const isGmail = process.env.EMAIL_SERVICE === 'gmail';

    if (isGmail) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || process.env.SMTP_USER,
          pass: process.env.EMAIL_PASS || process.env.SMTP_PASS
        }
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
        }
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      // Ensure FROM email is properly set and verified in Brevo
      const fromEmail = process.env.SMTP_FROM_EMAIL || 'info@famousgateshotels.com';
      const fromName = process.env.SMTP_FROM_NAME || 'FamousGate Hotels';

      const mailOptions = {
        from: `${fromName} <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        attachments: options.attachments
      };

      logger.info(`Sending email from ${fromName} <${fromEmail}> to ${options.to}`);
      await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${options.to}`);
    } catch (error: any) {
      logger.error('Error sending email:', error);
      logger.error('Email error details:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
      throw new Error(`Email could not be sent: ${error.message}`);
    }
  }

  async sendWelcomeEmail(name: string, email: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to FG Grill Hotel',
      html: emailTemplates.welcome(name)
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request - FG Grill Hotel',
      html: emailTemplates.passwordReset(resetUrl)
    });
  }

  async sendBookingConfirmation(
    email: string,
    bookingDetails: any
  ): Promise<void> {
    try {
      // Generate barcode for booking
      const confirmationNumber = bookingDetails.confirmation_number || bookingDetails.id;
      logger.info(`Generating barcode for booking ${confirmationNumber}`);

      const barcodeBase64 = await barcodeGeneratorService.generateBarcode(confirmationNumber);

      if (barcodeBase64) {
        logger.info(`Barcode generated successfully for ${confirmationNumber}`);
      } else {
        logger.warn(`Barcode generation failed for ${confirmationNumber}, sending email without barcode`);
      }

      // Prepare email options with CID attachment for barcode
      const mailOptions: any = {
        to: email,
        subject: 'Booking Confirmation - Kyogong',
        html: enterpriseEmailTemplates.bookingConfirmation(bookingDetails, barcodeBase64 || undefined),
        attachments: []
      };

      // Add barcode as CID attachment if available
      if (barcodeBase64) {
        mailOptions.attachments.push({
          filename: 'barcode.png',
          content: Buffer.from(barcodeBase64, 'base64'),
          cid: 'barcode@kyogong',
          contentType: 'image/png'
        });
      }

      // Send email with attachment
      await this.sendEmail(mailOptions);

      logger.info(`Booking confirmation email sent to ${email} with${barcodeBase64 ? '' : 'out'} barcode`);
    } catch (error) {
      logger.error('Error in sendBookingConfirmation:', error);
      // Fallback to sending without barcode if there's an error
      await this.sendEmail({
        to: email,
        subject: 'Booking Confirmation - Kyogong',
        html: enterpriseEmailTemplates.bookingConfirmation(bookingDetails)
      });
    }
  }

  async sendMaintenanceAlert(
    email: string,
    taskDetails: any
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'New Maintenance Task Assigned - FG Grill Hotel',
      html: emailTemplates.maintenanceAlert(taskDetails)
    });
  }

  async sendInventoryAlert(
    email: string,
    itemDetails: any
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Low Stock Alert - FG Grill Hotel',
      html: emailTemplates.inventoryAlert(itemDetails)
    });
  }

  async sendStockTransferEmail(
    user: any,
    items: any[]
  ): Promise<void> {
    const formattedTime = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });

    let itemsHtml = '<ul>';
    let itemsText = '';

    items.forEach(item => {
      const sku = item.item?.sku || item.item_sku || 'N/A';
      const desc = item.item?.description || 'N/A';
      const price = item.item?.retail_price || 0;
      const qty = item.quantity;

      itemsHtml += `
            <li>
                <strong>SKU:</strong> ${sku}<br>
                <strong>Description:</strong> ${desc}<br>
                <strong>Units transferred:</strong> ${qty}<br>
                <strong>Unit price:</strong> ${price}
            </li><br>
        `;

      itemsText += `
            - SKU: ${sku}
            - Description: ${desc}
            - Units transferred: ${qty}
            - Unit price: ${price}
        `;
    });
    itemsHtml += '</ul>';

    const html = `
        <h1>Stock Transfer Request</h1>
        <p>The following order has been placed by ${user.full_name || user.username || 'User'} [${user.email}] on ${formattedTime}.</p>
        <h2>Stock Order Details</h2>
        ${itemsHtml}
        <br><hr><br>
    `;

    // In a real app, we would fetch the "stock administrators" list. 
    // For now, we'll send to the system admin email or the user themselves for confirmation + admin.
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    // We might want to send to a list of recipients.

    await this.sendEmail({
      to: adminEmail, // and maybe cc user.email
      subject: '[STOCK MANAGEMENT] A transfer request been placed.',
      html,
      text: `Stock Transfer Request\n\nThe following order has been placed by ${user.email} on ${formattedTime}.\n\n${itemsText}`
    });
  }

  async sendPayslipEmail(staff: any, month: string, year: number, pdfBuffer: Buffer): Promise<void> {
    await this.sendEmail({
      to: staff.user.email,
      subject: `Payslip for ${month} ${year} - Kyogong`,
      html: enterpriseEmailTemplates.payslipNotification(`${staff.user.first_name} ${staff.user.last_name}`, month, year),
      attachments: [
        {
          filename: `Payslip_${staff.user.last_name}_${month}_${year}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
  }

  async sendLandingBookingConfirmation(email: string, details: any): Promise<void> {
    try {
      const { landingEmailTemplates } = await import('../utils/emailTemplates.landing');

      // PDF generation is not available yet - send email without PDF attachment
      logger.info(`Sending booking confirmation email to ${email} (PDF attachment not available)`);

      const html = landingEmailTemplates.bookingConfirmation({
        guestName: `${details.firstName} ${details.lastName}`,
        confirmationNumber: details.confirmationNumber,
        checkInDate: details.checkInDate,
        checkOutDate: details.checkOutDate,
        roomType: details.roomType,
        guests: details.guests,
        totalAmount: details.totalAmount,
        hotelName: details.branchName || 'Famous Gate Hotel',
        hotelAddress: 'P.O. Box 123, Bomet, Kenya',
        hotelPhone: '+254 700 000 000',
        hotelEmail: 'info@famousgatehotels.com'
      });

      await this.sendEmail({
        to: email,
        subject: `Booking Confirmation - ${details.branchName || 'Famous Gate Hotel'}`,
        html
      });

      logger.info(`Booking confirmation email sent successfully to ${email}`);
    } catch (error: any) {
      logger.error('Error sending landing booking confirmation:', error);
      throw error;
    }
  }

  async sendLandingReservationRequest(email: string, details: any): Promise<void> {
    const { landingEmailTemplates } = await import('../utils/emailTemplates.landing');
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
      hotelAddress: 'P.O. Box 123, Bomet, Kenya',
      hotelPhone: '+254 700 000 000',
      hotelEmail: 'info@famousgatehotels.com'
    });

    await this.sendEmail({
      to: email,
      subject: `Reservation Request Pending - ${details.branchName || 'Famous Gate Hotel'}`,
      html
    });
  }

  async sendLandingPromotion(recipients: any[], details: any): Promise<void> {
    const { landingEmailTemplates } = await import('../utils/emailTemplates.landing');
    for (const recipient of recipients) {
      try {
        const html = landingEmailTemplates.promotion({
          guestName: recipient.name || 'Valued Guest',
          promoTitle: details.promoTitle,
          promoHeadline: details.promoHeadline || 'Limited Time Offer',
          promoDescription: details.promoDescription,
          promoCode: details.promoCode,
          discountPercentage: details.discountPercentage,
          validUntil: details.validUntil,
          bookingLink: details.bookingLink,
          hotelName: 'Famous Gate Hotel',
          hotelAddress: 'P.O. Box 123, Bomet, Kenya'
        });

        await this.sendEmail({
          to: recipient.email,
          subject: details.promoTitle,
          html
        });
      } catch (e: any) {
        logger.error(`Failed to send promo to ${recipient.email}: ${e.message}`);
      }
    }
  }

  async sendLandingNewsletter(recipients: any[], details: any): Promise<void> {
    const { landingEmailTemplates } = await import('../utils/emailTemplates.landing');
    for (const recipient of recipients) {
      try {
        const html = landingEmailTemplates.newsletter({
          guestName: recipient.name || 'Subscriber',
          issueDate: details.issueDate,
          newsletterTitle: details.newsletterTitle,
          featuredArticle: details.featuredArticle,
          secondaryArticles: details.secondaryArticles || [],
          bookingLink: details.bookingLink,
          hotelName: 'Famous Gate Hotel',
          hotelAddress: 'P.O. Box 123, Bomet, Kenya',
          hotelPhone: '+254 700 000 000'
        });

        await this.sendEmail({
          to: recipient.email,
          subject: details.newsletterTitle,
          html
        });
      } catch (e: any) {
        logger.error(`Failed to send newsletter to ${recipient.email}: ${e.message}`);
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error: any) {
      logger.error('SMTP connection failed:', error);
      return false;
    }
  }

  async sendPurchaseOrderEmail(supplierEmail: string, poDetails: any): Promise<void> {
    const supplierName = poDetails.supplier?.name || 'Supplier';
    await this.sendEmail({
      to: supplierEmail,
      subject: `PURCHASE ORDER: ${poDetails.po_number} - Famous Gate Hotels`,
      html: enterpriseEmailTemplates.purchaseOrder(supplierName, poDetails)
    });
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

export const emailService = new EmailService();
