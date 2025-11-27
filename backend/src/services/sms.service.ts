import twilio from 'twilio';
import { logger } from '../utils/logger';

class SMSService {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendSMS(to: string, message: string): Promise<void> {
    try {
      await this.client.messages.create({
        to,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: message
      });

      logger.info(`SMS sent to ${to}`);
    } catch (error: any) {
      logger.error('Error sending SMS:', error);
      throw new Error('SMS could not be sent');
    }
  }

  async sendBookingConfirmation(phone: string, bookingDetails: any): Promise<void> {
    const message = `
Famous Gate Hotel - Booking Confirmation
Booking: ${bookingDetails.bookingNumber}
Check-in: ${new Date(bookingDetails.checkIn).toLocaleDateString()}
Check-out: ${new Date(bookingDetails.checkOut).toLocaleDateString()}
Room: ${bookingDetails.roomType}
Amount: KES ${bookingDetails.totalAmount.toLocaleString()}

Thank you for choosing Famous Gate Hotel!
    `.trim();

    await this.sendSMS(phone, message);
  }

  async sendCheckInReminder(phone: string, bookingDetails: any): Promise<void> {
    const message = `
Famous Gate Hotel - Check-in Reminder
Dear ${bookingDetails.guest.firstName},
This is a reminder that your check-in is tomorrow.
Booking: ${bookingDetails.bookingNumber}
Check-in time: From 2:00 PM

We look forward to welcoming you!
    `.trim();

    await this.sendSMS(phone, message);
  }

  async sendMaintenanceAlert(phone: string, taskDetails: any): Promise<void> {
    const message = `
Famous Gate Hotel - Maintenance Alert
Task: ${taskDetails.taskNumber}
Location: ${taskDetails.location}
Priority: ${taskDetails.priority}
Description: ${taskDetails.description}

Please check maintenance portal for details.
    `.trim();

    await this.sendSMS(phone, message);
  }

  async sendLowStockAlert(phone: string, itemDetails: any): Promise<void> {
    const message = `
Famous Gate Hotel - Low Stock Alert
Item: ${itemDetails.name}
Code: ${itemDetails.itemCode}
Current Stock: ${itemDetails.currentStock}
Min Stock: ${itemDetails.minimumStock}

Please reorder soon.
    `.trim();

    await this.sendSMS(phone, message);
  }

  async sendHousekeepingAlert(phone: string, taskDetails: any): Promise<void> {
    const message = `
Famous Gate Hotel - Housekeeping Alert
Room ${taskDetails.roomNumber} needs attention
Type: ${taskDetails.taskType}
Priority: ${taskDetails.priority}

Please check housekeeping portal for details.
    `.trim();

    await this.sendSMS(phone, message);
  }

  async sendEmergencyAlert(phone: string, details: any): Promise<void> {
    const message = `
URGENT: Famous Gate Hotel Emergency Alert
Location: ${details.location}
Type: ${details.type}
Details: ${details.description}

Immediate attention required!
    `.trim();

    await this.sendSMS(phone, message);
  }
}

export const smsService = new SMSService();
