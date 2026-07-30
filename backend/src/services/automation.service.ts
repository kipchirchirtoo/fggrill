import cron from 'node-cron';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';
import db from '../db';

const NAIROBI_TIMEZONE = 'Africa/Nairobi';
const DEFAULT_CHECKOUT_HOUR = 11;
const DEFAULT_CHECKOUT_MINUTE = 0;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getNairobiDateParts(value: Date | string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NAIROBI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(map.get('year'));
  const month = Number(map.get('month'));
  const day = Number(map.get('day'));
  const hour = Number(map.get('hour'));
  const minute = Number(map.get('minute'));

  if ([year, month, day, hour, minute].some((item) => !Number.isFinite(item))) {
    return null;
  }

  return { year, month, day, hour, minute };
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function nairobiDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parts = getNairobiDateParts(value);
  if (!parts) return null;
  return formatDateKey(parts.year, parts.month, parts.day);
}

function nairobiNowContext(now = new Date()) {
  const parts = getNairobiDateParts(now);
  if (!parts) {
    throw new Error('Unable to resolve Nairobi time context');
  }
  return {
    date: formatDateKey(parts.year, parts.month, parts.day),
    minutes: parts.hour * 60 + parts.minute,
  };
}

function compareDateKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

function diffDays(startDate: string, endDate: string): number {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000));
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function dateKeyToMidnightUtc(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

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

    // Extend overdue in-house stays after checkout cutoff (every 2 hours)
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
          await axios.post(`${PYTHON_SERVICE_URL}/api/reports/generate/pdf`, {
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

        const { error } = await supabase.from('staff_payroll').upsert(payrollData, { onConflict: 'staff_id, month, year' });
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
      }

      logger.info(`Generated payroll for ${employees?.length || 0} employees`);
    } catch (error) {
      logger.error('Error generating monthly payroll:', error);
    }
  }

  // Auto-extend overdue in-house stays instead of force-checking them out.
  private async autoCheckoutOverdue() {
    try {
      const now = new Date();
      const nairobiNow = nairobiNowContext(now);
      const cutoffMinutes = DEFAULT_CHECKOUT_HOUR * 60 + DEFAULT_CHECKOUT_MINUTE;
      const client = await db.getClient();

      try {
        const result = await client.query(
          `
            SELECT
              r.id,
              r.branch_id,
              r.guest_id,
              r.room_id,
              r.confirmation_number,
              r.status,
              r.check_in_date,
              r.check_out_date,
              r.original_check_out_date,
              r.auto_extended_nights,
              r.last_auto_extension_at,
              r.room_rate,
              r.subtotal,
              r.tax_amount,
              r.service_charge,
              r.discount_amount,
              r.total_amount,
              r.amount_paid,
              r.deposit_amount,
              rm.room_number,
              rm.expected_checkout
            FROM reservations r
            LEFT JOIN rooms rm ON rm.id = r.room_id
            WHERE LOWER(TRIM(COALESCE(r.status, ''))) = 'checked_in'
              AND r.check_out_date IS NOT NULL
            ORDER BY r.check_out_date ASC, r.updated_at ASC NULLS LAST
          `
        );

        let extendedReservations = 0;
        let postedExtraNights = 0;

        for (const reservation of result.rows) {
          const effectiveCheckoutDate = nairobiDateString(reservation.check_out_date);
          const checkInDate = nairobiDateString(reservation.check_in_date);
          if (!effectiveCheckoutDate || !checkInDate) {
            continue;
          }

          const daysBehind = Math.max(0, diffDays(effectiveCheckoutDate, nairobiNow.date));
          const todayReachedCutoff =
            compareDateKeys(nairobiNow.date, effectiveCheckoutDate) >= 0 &&
            nairobiNow.minutes >= cutoffMinutes;
          const extensionNights = daysBehind + (todayReachedCutoff ? 1 : 0);

          if (extensionNights <= 0) {
            continue;
          }

          const bookedNights = Math.max(1, diffDays(checkInDate, reservation.original_check_out_date || effectiveCheckoutDate));
          const currentTotalAmount = Number(reservation.total_amount || 0);
          const currentSubtotal = Number(reservation.subtotal || 0);
          const currentTaxAmount = Number(reservation.tax_amount || 0);
          const currentServiceCharge = Number(reservation.service_charge || 0);
          const currentDiscountAmount = Number(reservation.discount_amount || 0);
          const fallbackNightlyRate = Number(reservation.room_rate || 0);

          // Locked nightly rate snapshot: use room_rate if set, else calculate initial rate from bookedNights
          const nightlyTotal =
            fallbackNightlyRate > 0
              ? roundMoney(fallbackNightlyRate)
              : currentTotalAmount > 0
              ? roundMoney(currentTotalAmount / bookedNights)
              : 0;

          if (!(nightlyTotal > 0)) {
            logger.warn('Skipping overdue stay auto-extension because nightly rate could not be derived', {
              reservationId: reservation.id,
              confirmationNumber: reservation.confirmation_number,
            });
            continue;
          }

          const nightlySubtotal =
            currentSubtotal > 0
              ? roundMoney(currentSubtotal / bookedNights)
              : roundMoney(nightlyTotal / 1.26);
          const nightlyTax =
            currentTaxAmount > 0
              ? roundMoney(currentTaxAmount / bookedNights)
              : roundMoney(nightlySubtotal * 0.16);
          const nightlyService =
            currentServiceCharge > 0
              ? roundMoney(currentServiceCharge / bookedNights)
              : roundMoney(nightlySubtotal * 0.10);
          const nightlyDiscount =
            currentDiscountAmount > 0
              ? roundMoney(currentDiscountAmount / bookedNights)
              : 0;

          const extraRoomCharge = roundMoney(nightlyTotal * extensionNights);
          const extraSubtotal = roundMoney(nightlySubtotal * extensionNights);
          const extraTaxAmount = roundMoney(nightlyTax * extensionNights);
          const extraServiceCharge = roundMoney(nightlyService * extensionNights);
          const extraDiscountAmount = roundMoney(nightlyDiscount * extensionNights);
          const nextCheckoutDate = addDays(effectiveCheckoutDate, extensionNights);
          const reservationBasePaid = Math.max(
            Number(reservation.amount_paid || 0),
            Number(reservation.deposit_amount || 0)
          );

          const idempotencyRef = `AUTO-OVERSTAY-${reservation.confirmation_number || reservation.id}-${effectiveCheckoutDate}`;

          // Database-level idempotency check: skip if charge for this overstay date key already exists
          const duplicateCheck = await client.query(
            `SELECT id FROM folio_transactions WHERE reference = $1 AND status = 'posted' LIMIT 1`,
            [idempotencyRef]
          );
          if (duplicateCheck.rows.length > 0) {
            logger.info('Skipping duplicate overstay charge insertion', {
              reservationId: reservation.id,
              reference: idempotencyRef,
            });
            continue;
          }

          await client.query('BEGIN');
          try {
            const folioRes = await client.query(
              `
                SELECT
                  id,
                  status,
                  room_charges,
                  food_charges,
                  beverage_charges,
                  other_charges,
                  total_charges,
                  total_payments,
                  balance,
                  balance_due
                FROM folios
                WHERE reservation_id = $1
                ORDER BY created_at DESC
                LIMIT 1
                FOR UPDATE
              `,
              [reservation.id]
            );

            let folio = folioRes.rows[0];
            if (!folio) {
              const createdFolio = await client.query(
                `
                  INSERT INTO folios (
                    branch_id,
                    reservation_id,
                    guest_id,
                    folio_number,
                    status,
                    room_charges,
                    food_charges,
                    beverage_charges,
                    other_charges,
                    total_charges,
                    total_payments,
                    balance,
                    balance_due,
                    settled,
                    created_at,
                    updated_at
                  )
                  VALUES (
                    $1, $2, $3, $4, 'open',
                    $5, 0, 0, 0, $5, 0, $5, $5, false, NOW(), NOW()
                  )
                  RETURNING
                    id,
                    status,
                    room_charges,
                    food_charges,
                    beverage_charges,
                    other_charges,
                    total_charges,
                    total_payments,
                    balance,
                    balance_due
                `,
                [
                  reservation.branch_id,
                  reservation.id,
                  reservation.guest_id,
                  reservation.confirmation_number || `FOL-${Date.now()}`,
                  currentTotalAmount,
                ]
              );
              folio = createdFolio.rows[0];
            }

            const currentRoomCharges = Math.max(
              Number(folio.room_charges || 0),
              currentTotalAmount
            );
            const nextRoomCharges = roundMoney(currentRoomCharges + extraRoomCharge);
            const foodCharges = Number(folio.food_charges || 0);
            const beverageCharges = Number(folio.beverage_charges || 0);
            const otherCharges = Number(folio.other_charges || 0);
            const trackedPayments = Math.max(
              Number(folio.total_payments || 0),
              reservationBasePaid
            );
            const nextTotalCharges = roundMoney(
              nextRoomCharges + foodCharges + beverageCharges + otherCharges
            );
            // Preserve negative balance for guest credit / overpayment
            const nextBalance = roundMoney(nextTotalCharges - trackedPayments);
            const nextReservationTotal = roundMoney(currentTotalAmount + extraRoomCharge);
            const nextReservationSubtotal = roundMoney(
              currentSubtotal + extraSubtotal
            );
            const nextReservationTax = roundMoney(
              currentTaxAmount + extraTaxAmount
            );
            const nextReservationService = roundMoney(
              currentServiceCharge + extraServiceCharge
            );
            const nextReservationDiscount = roundMoney(
              currentDiscountAmount + extraDiscountAmount
            );
            // Constraint-compliant payment status values for reservations/bookings
            const nextPaymentStatus =
              nextBalance <= 0
                ? 'paid'
                : trackedPayments > 0
                ? 'partial'
                : 'pending';

            await client.query(
              `
                UPDATE reservations
                SET
                  check_out_date = $2,
                  original_check_out_date = COALESCE(original_check_out_date, $3),
                  auto_extended_nights = COALESCE(auto_extended_nights, 0) + $4,
                  last_auto_extension_at = NOW(),
                  subtotal = $5,
                  tax_amount = $6,
                  service_charge = $7,
                  discount_amount = $8,
                  total_amount = $9,
                  payment_status = $10,
                  updated_at = NOW()
                WHERE id = $1
              `,
              [
                reservation.id,
                nextCheckoutDate,
                effectiveCheckoutDate,
                extensionNights,
                nextReservationSubtotal,
                nextReservationTax,
                nextReservationService,
                nextReservationDiscount,
                nextReservationTotal,
                nextPaymentStatus,
              ]
            );

            // Synchronize parent booking if linked
            if ((reservation as any).booking_id) {
              await client.query(
                `
                  UPDATE bookings
                  SET
                    check_out_date = $2,
                    total_amount = $3,
                    payment_status = $4,
                    updated_at = NOW()
                  WHERE id = $1
                `,
                [(reservation as any).booking_id, nextCheckoutDate, nextReservationTotal, nextPaymentStatus]
              );
            }

            await client.query(
              `
                UPDATE folios
                SET
                  status = 'open',
                  settled = false,
                  room_charges = $2,
                  total_charges = $3,
                  total_payments = $4,
                  balance = $5,
                  balance_due = $5,
                  updated_at = NOW()
                WHERE id = $1
              `,
              [folio.id, nextRoomCharges, nextTotalCharges, trackedPayments, nextBalance]
            );

            await client.query(
              `
                INSERT INTO folio_transactions (
                  folio_id,
                  branch_id,
                  transaction_type,
                  category,
                  description,
                  amount,
                  tax_amount,
                  total_amount,
                  reference,
                  posted_by,
                  posted_at,
                  status,
                  created_at
                )
                VALUES (
                  $1, $2, 'charge', 'Room Charge', $3, $4, $5, $4, $6, NULL, NOW(), 'posted', NOW()
                )
              `,
              [
                folio.id,
                reservation.branch_id,
                extensionNights === 1
                  ? `Automatic overdue room-night extension for ${reservation.room_number || reservation.confirmation_number || reservation.id}`
                  : `Automatic overdue extension (${extensionNights} room nights) for ${reservation.room_number || reservation.confirmation_number || reservation.id}`,
                extraRoomCharge,
                extraTaxAmount,
                idempotencyRef,
              ]
            );

            if (reservation.room_id) {
              await client.query(
                `
                  UPDATE rooms
                  SET
                    status = 'occupied',
                    current_guest = COALESCE($2, current_guest),
                    expected_checkout = $3,
                    updated_at = NOW()
                  WHERE id = $1
                `,
                [
                  reservation.room_id,
                  reservation.guest_id,
                  dateKeyToMidnightUtc(nextCheckoutDate),
                ]
              );
            }


            await client.query('COMMIT');
            extendedReservations += 1;
            postedExtraNights += extensionNights;

            logger.info('Auto-extended overdue in-house stay', {
              reservationId: reservation.id,
              confirmationNumber: reservation.confirmation_number,
              previousCheckoutDate: effectiveCheckoutDate,
              nextCheckoutDate,
              extensionNights,
              extraRoomCharge,
            });
          } catch (reservationError) {
            await client.query('ROLLBACK');
            logger.error('Failed to auto-extend overdue stay; transaction rolled back', {
              reservationId: reservation.id,
              confirmationNumber: reservation.confirmation_number,
              error: reservationError,
            });
          }
        }

        logger.info(
          `Auto-extended ${extendedReservations} overdue in-house reservation(s) and posted ${postedExtraNights} extra room night(s)`
        );
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error auto-extending overdue in-house stays:', error);
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
      await axios.post(`${PYTHON_SERVICE_URL}/api/reports/generate/pdf`, {
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
