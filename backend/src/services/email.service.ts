import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

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
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        attachments: options.attachments
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${options.to}`);
    } catch (error: any) {
      logger.error('Error sending email:', error);
      throw new Error('Email could not be sent');
    }
  }

  async sendWelcomeEmail(name: string, email: string): Promise<void> {
    const html = `
      <h1>Welcome to Famous Gate Hotel!</h1>
      <p>Dear ${name},</p>
      <p>Thank you for registering with us. We're excited to have you on board!</p>
      <p>You can now access our system to:</p>
      <ul>
        <li>View your schedule and tasks</li>
        <li>Access important documents</li>
        <li>Communicate with your team</li>
        <li>And much more!</li>
      </ul>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p>Best regards,<br>Famous Gate Hotel Team</p>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Welcome to Famous Gate Hotel',
      html
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const html = `
      <h1>Password Reset Request</h1>
      <p>You are receiving this email because you (or someone else) has requested to reset your password.</p>
      <p>Please click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link will expire in 10 minutes.</p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html
    });
  }

  async sendBookingConfirmation(
    email: string,
    bookingDetails: any
  ): Promise<void> {
    const html = `
      <h1>Booking Confirmation</h1>
      <p>Dear ${bookingDetails.guest.firstName},</p>
      <p>Your booking has been confirmed. Here are the details:</p>
      <table>
        <tr>
          <td><strong>Booking Reference:</strong></td>
          <td>${bookingDetails.bookingNumber}</td>
        </tr>
        <tr>
          <td><strong>Check-in:</strong></td>
          <td>${new Date(bookingDetails.checkIn).toLocaleDateString()}</td>
        </tr>
        <tr>
          <td><strong>Check-out:</strong></td>
          <td>${new Date(bookingDetails.checkOut).toLocaleDateString()}</td>
        </tr>
        <tr>
          <td><strong>Room Type:</strong></td>
          <td>${bookingDetails.roomType}</td>
        </tr>
        <tr>
          <td><strong>Total Amount:</strong></td>
          <td>KES ${bookingDetails.totalAmount.toLocaleString()}</td>
        </tr>
      </table>
      <p>We look forward to welcoming you!</p>
      <p>Best regards,<br>Famous Gate Hotel Team</p>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Booking Confirmation - Famous Gate Hotel',
      html
    });
  }

  async sendMaintenanceAlert(
    email: string,
    taskDetails: any
  ): Promise<void> {
    const html = `
      <h1>Maintenance Alert</h1>
      <p>A new maintenance task has been assigned:</p>
      <table>
        <tr>
          <td><strong>Task Number:</strong></td>
          <td>${taskDetails.taskNumber}</td>
        </tr>
        <tr>
          <td><strong>Location:</strong></td>
          <td>${taskDetails.location}</td>
        </tr>
        <tr>
          <td><strong>Priority:</strong></td>
          <td>${taskDetails.priority}</td>
        </tr>
        <tr>
          <td><strong>Description:</strong></td>
          <td>${taskDetails.description}</td>
        </tr>
      </table>
      <p>Please check the maintenance portal for more details.</p>
    `;

    await this.sendEmail({
      to: email,
      subject: 'New Maintenance Task Assigned',
      html
    });
  }

  async sendInventoryAlert(
    email: string,
    itemDetails: any
  ): Promise<void> {
    const html = `
      <h1>Low Stock Alert</h1>
      <p>The following item is running low on stock:</p>
      <table>
        <tr>
          <td><strong>Item Code:</strong></td>
          <td>${itemDetails.itemCode}</td>
        </tr>
        <tr>
          <td><strong>Name:</strong></td>
          <td>${itemDetails.name}</td>
        </tr>
        <tr>
          <td><strong>Current Stock:</strong></td>
          <td>${itemDetails.currentStock}</td>
        </tr>
        <tr>
          <td><strong>Minimum Stock:</strong></td>
          <td>${itemDetails.minimumStock}</td>
        </tr>
      </table>
      <p>Please reorder this item soon.</p>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Low Stock Alert',
      html
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

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}

export const emailService = new EmailService();
