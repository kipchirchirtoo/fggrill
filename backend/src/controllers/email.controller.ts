import { Request, Response, NextFunction } from 'express';
import { emailService } from '../services/email.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// @desc    Send test email
// @route   POST /api/email/test
// @access  Private (Admin only)
export const sendTestEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      throw new AppError('Please provide to, subject, and message', 400);
    }

    await emailService.sendEmail({
      to,
      subject: `[TEST] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Test Email from FG Grill Hotel</h2>
          <p>${message}</p>
          <hr>
          <p><small>This is a test email sent from the FG Grill Hotel management system.</small></p>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully'
    });

    logger.info(`Test email sent to ${to} by user ${req.user?.email}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Send welcome email to new staff
// @route   POST /api/email/welcome
// @access  Private
export const sendWelcomeEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      throw new AppError('Please provide name and email', 400);
    }

    await emailService.sendWelcomeEmail(name, email);

    res.status(200).json({
      success: true,
      message: 'Welcome email sent successfully'
    });

    logger.info(`Welcome email sent to ${email} for ${name}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Send booking confirmation email
// @route   POST /api/email/booking-confirmation
// @access  Private
export const sendBookingConfirmationEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, bookingDetails } = req.body;

    if (!email || !bookingDetails) {
      throw new AppError('Please provide email and booking details', 400);
    }

    await emailService.sendBookingConfirmation(email, bookingDetails);

    res.status(200).json({
      success: true,
      message: 'Booking confirmation email sent successfully'
    });

    logger.info(`Booking confirmation email sent to ${email} for booking ${bookingDetails.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Send maintenance alert email
// @route   POST /api/email/maintenance-alert
// @access  Private
export const sendMaintenanceAlertEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, taskDetails } = req.body;

    if (!email || !taskDetails) {
      throw new AppError('Please provide email and task details', 400);
    }

    await emailService.sendMaintenanceAlert(email, taskDetails);

    res.status(200).json({
      success: true,
      message: 'Maintenance alert email sent successfully'
    });

    logger.info(`Maintenance alert email sent to ${email} for task ${taskDetails.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Send inventory alert email
// @route   POST /api/email/inventory-alert
// @access  Private
export const sendInventoryAlertEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, itemDetails } = req.body;

    if (!email || !itemDetails) {
      throw new AppError('Please provide email and item details', 400);
    }

    await emailService.sendInventoryAlert(email, itemDetails);

    res.status(200).json({
      success: true,
      message: 'Inventory alert email sent successfully'
    });

    logger.info(`Inventory alert email sent to ${email} for item ${itemDetails.item_code}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Send password reset email
// @route   POST /api/email/password-reset
// @access  Public
export const sendPasswordResetEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, resetToken } = req.body;

    if (!email || !resetToken) {
      throw new AppError('Please provide email and reset token', 400);
    }

    await emailService.sendPasswordResetEmail(email, resetToken);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully'
    });

    logger.info(`Password reset email sent to ${email}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get email service status
// @route   GET /api/email/status
// @access  Private (Admin only)
export const getEmailServiceStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Test SMTP connection
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
