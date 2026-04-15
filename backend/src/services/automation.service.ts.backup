import cron from 'node-cron';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';
import axios from 'axios';

class AutomationService {
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    this.initializeAutomations();
  }

  private initializeAutomations() {
    // Check-in reminders (daily at 8 AM)
    cron.schedule('0 8 * * *', () => {
      this.sendCheckInReminders();
    });

    // Check-out reminders (daily at 9 AM)
    cron.schedule('0 9 * * *', () => {
      this.sendCheckOutReminders();
    });

    // Generate daily reports (daily at 11 PM)
    cron.schedule('0 23 * * *', () => {
      this.generateDailyReports();
    });

    // Check low inventory (daily at 10 AM)
    cron.schedule('0 10 * * *', () => {
      this.checkLowInventory();
    });

    // Process pending payments (every hour)
    cron.schedule('0 * * * *', () => {
      this.processPendingPayments();
    });

    // Generate payroll (1st of every month at 9 AM)
    cron.schedule('0 9 1 * *', () => {
      this.generateMonthlyPayroll();
    });

    // Auto-checkout overdue bookings (every 2 hours)
    cron.schedule('0 */2 * * *', () => {
      this.autoCheckoutOverdue();
    });

    // Send birthday wishes to staff (daily at 8 AM)
    cron.schedule('0 8 * * *', () => {
      this.sendBirthdayWishes();
    });

    // Generate weekly revenue report (Monday at 9 AM)
    cron.schedule('0 9 * * 1', () => {
      this.generateWeeklyRevenueReport();
    });

    // Backup database (daily at 2 AM)
    cron.schedule('0 2 * * *', () => {
      this.backupDatabase();
    });

    logger.info('Automation service initialized with scheduled tasks');
  }

  // Send check-in reminders
  private async sendCheckInReminders() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          guest:guest_profiles!guest_id(first_name, last_name, email, phone_number),
          room:rooms!room_id(room_number, type)
        `)
        .eq('check_in_date', today)
        .eq('status', 'confirmed');

      if (error) throw error;

      for (const booking of bookings || []) {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_USER,
          to: booking.guest.email,
          subject: 'Check-in Reminder - Kyogong',
          html: `
            <h2>Check-in Reminder</h2>
            <p>Dear ${booking.guest.first_name} ${booking.guest.last_name},</p>
            <p>This is a reminder that your check-in is today!</p>
            <p><strong>Booking Details:</strong></p>
            <ul>
              <li>Room: ${booking.room.type} - ${booking.room.room_number}</li>
              <li>Check-in: ${booking.check_in_date}</li>
              <li>Check-out: ${booking.check_out_date}</li>
            </ul>
            <p>We look forward to welcoming you!</p>
          `
        });
      }

      logger.info(`Sent ${bookings?.length || 0} check-in reminders`);
    } catch (error) {
      logger.error('Error sending check-in reminders:', error);
    }
  }

  // Send check-out reminders
  private async sendCheckOutReminders() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          guest:guest_profiles!guest_id(first_name, last_name, email),
          room:rooms!room_id(room_number)
        `)
        .eq('check_out_date', today)
        .eq('status', 'checked_in');

      if (error) throw error;

      for (const booking of bookings || []) {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_USER,
          to: booking.guest.email,
          subject: 'Check-out Reminder - Kyogong',
          html: `
            <h2>Check-out Reminder</h2>
            <p>Dear ${booking.guest.first_name} ${booking.guest.last_name},</p>
            <p>Your check-out is today. Please ensure you check out by 11:00 AM.</p>
            <p>Thank you for staying with us!</p>
          `
        });
      }

      logger.info(`Sent ${bookings?.length || 0} check-out reminders`);
    } catch (error) {
      logger.error('Error sending check-out reminders:', error);
    }
  }

  // Generate daily reports
  private async generateDailyReports() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Call Python service to generate reports
      const reportTypes = ['occupancy_rate', 'revenue_analysis', 'inventory_status'];

      for (const reportType of reportTypes) {
        try {
          await axios.post(`${process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com'}/api/reports/generate/pdf`, {
            reportType,
            filters: {
              startDate: today,
              endDate: today
            }
          });
        } catch (err) {
          logger.error(`Error generating ${reportType} report:`, err);
        }
      }

      logger.info('Daily reports generated');
    } catch (error) {
      logger.error('Error generating daily reports:', error);
    }
  }

  // Check low inventory
  private async checkLowInventory() {
    try {
      const { data: lowStockItems, error } = await supabase
        .from('branch_stock')
        .select(`
          *,
          item:inventory_items!item_sku(item_name, item_code),
          branch:branches!branch_id(name, code)
        `)
        .lt('current_quantity', supabase.rpc('min_stock_level'));

      if (error) throw error;

      if (lowStockItems && lowStockItems.length > 0) {
        // Send alert to store managers
        const { data: managers, error: managerError } = await supabase
          .from('users')
          .select('email, first_name, last_name')
          .in('role', ['central_storekeeper', 'branch_storekeeper', 'super_admin']);

        if (!managerError && managers) {
          const itemsList = lowStockItems
            .map(item => `${item.item.item_name} (${item.item.item_code}) - Current: ${item.current_quantity}`)
            .join('\n');

          for (const manager of managers) {
            await this.emailTransporter.sendMail({
              from: process.env.SMTP_USER,
              to: manager.email,
              subject: 'Low Stock Alert - Kyogong',
              html: `
                <h2>Low Stock Alert</h2>
                <p>Dear ${manager.first_name},</p>
                <p>The following items are running low on stock:</p>
                <pre>${itemsList}</pre>
                <p>Please reorder these items as soon as possible.</p>
              `
            });
          }
        }

        logger.info(`Sent low inventory alerts for ${lowStockItems.length} items`);
      }
    } catch (error) {
      logger.error('Error checking low inventory:', error);
    }
  }

  // Process pending payments
  private async processPendingPayments() {
    try {
      const { data: pendingPayments, error } = await supabase
        .from('payments')
        .select('*')
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // 30 minutes old

      if (error) throw error;

      for (const payment of pendingPayments || []) {
        // Mark as expired if too old (24 hours)
        if (new Date(payment.created_at).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
          await supabase
            .from('payments')
            .update({ status: 'expired' })
            .eq('id', payment.id);
        }
      }

      logger.info(`Processed ${pendingPayments?.length || 0} pending payments`);
    } catch (error) {
      logger.error('Error processing pending payments:', error);
    }
  }

  // Generate monthly payroll
  private async generateMonthlyPayroll() {
    try {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const { data: employees, error } = await supabase
        .from('staff_profiles')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      for (const employee of employees || []) {
        // Calculate payroll (simplified)
        // Calculate payroll (simplified)
        const payrollData = {
          staff_id: employee.id,
          month: previousMonth.getMonth() + 1,
          year: previousMonth.getFullYear(),
          base_salary: employee.salary || 0,
          allowances: employee.allowances || 0,
          gross_pay: (employee.salary || 0) + (employee.allowances || 0),
          status: 'pending',
          approval_status: 'draft',
          created_at: new Date().toISOString()
        };

        await supabase.from('staff_payroll').upsert(payrollData, { onConflict: 'staff_id, month, year' });
      }

      logger.info(`Generated payroll for ${employees?.length || 0} employees`);
    } catch (error) {
      logger.error('Error generating monthly payroll:', error);
    }
  }

  // Auto-checkout overdue bookings
  private async autoCheckoutOverdue() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: overdueBookings, error } = await supabase
        .from('bookings')
        .select('*')
        .lt('check_out_date', today)
        .eq('status', 'checked_in');

      if (error) throw error;

      for (const booking of overdueBookings || []) {
        await supabase
          .from('bookings')
          .update({
            status: 'checked_out',
            actual_check_out: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', booking.id);

        // Update room status
        await supabase
          .from('rooms')
          .update({ status: 'dirty' })
          .eq('id', booking.room_id);
      }

      logger.info(`Auto-checked out ${overdueBookings?.length || 0} overdue bookings`);
    } catch (error) {
      logger.error('Error auto-checking out overdue bookings:', error);
    }
  }

  // Send birthday wishes
  private async sendBirthdayWishes() {
    try {
      const today = new Date();
      const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const { data: birthdayStaff, error } = await supabase
        .from('staff_profiles')
        .select(`
          *,
          user:users!user_id(first_name, last_name, email)
        `)
        .like('date_of_birth', `%-${monthDay}`);

      if (error) throw error;

      for (const staff of birthdayStaff || []) {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_USER,
          to: staff.user.email,
          subject: 'Happy Birthday from Kyogong!',
          html: `
            <h2>Happy Birthday, ${staff.user.first_name}! 🎉</h2>
            <p>The entire team at Kyogong wishes you a wonderful birthday!</p>
            <p>May your day be filled with joy and happiness.</p>
            <p>Best wishes,<br>The Kyogong Team</p>
          `
        });
      }

      logger.info(`Sent birthday wishes to ${birthdayStaff?.length || 0} staff members`);
    } catch (error) {
      logger.error('Error sending birthday wishes:', error);
    }
  }

  // Generate weekly revenue report
  private async generateWeeklyRevenueReport() {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Call Python service to generate report
      await axios.post(`${process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com'}/api/reports/generate/pdf`, {
        reportType: 'revenue_analysis',
        filters: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        }
      });

      logger.info('Weekly revenue report generated');
    } catch (error) {
      logger.error('Error generating weekly revenue report:', error);
    }
  }

  // Backup database
  private async backupDatabase() {
    try {
      // In production, implement actual database backup
      logger.info('Database backup completed (placeholder)');
    } catch (error) {
      logger.error('Error backing up database:', error);
    }
  }

  // Public method to trigger manual automation
  public async triggerManualAutomation(automationType: string) {
    switch (automationType) {
      case 'check_in_reminders':
        await this.sendCheckInReminders();
        break;
      case 'check_out_reminders':
        await this.sendCheckOutReminders();
        break;
      case 'daily_reports':
        await this.generateDailyReports();
        break;
      case 'low_inventory':
        await this.checkLowInventory();
        break;
      case 'pending_payments':
        await this.processPendingPayments();
        break;
      default:
        throw new Error('Unknown automation type');
    }
  }
}

export const automationService = new AutomationService();
