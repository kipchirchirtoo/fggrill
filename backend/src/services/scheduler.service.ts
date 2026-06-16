import cron from 'node-cron';
import { logger } from '../utils/logger';
import alertsService from './alerts.service';
import reportsService from './reports.service';
import { runDailyFinancialEngine } from './daily-financial-engine.service';

class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Start all scheduled jobs
   * IMPORTANT: This method should only be called ONCE during server startup
   * to prevent duplicate job registration
   */
  startAll() {
    // Prevent duplicate initialization
    if (this.jobs.size > 0) {
      logger.warn('Scheduler already initialized, skipping duplicate startAll()');
      return Object.fromEntries(this.jobs);
    }

    // Daily tasks
    this.scheduleDaily();

    // Weekly tasks
    this.scheduleWeekly();

    // Hourly tasks
    this.scheduleHourly();

    // Every 5 minute tasks
    this.schedule5Minutes();

    // Every 15 minute tasks
    this.schedule15Minutes();

    logger.info('All scheduled jobs started');

    return Object.fromEntries(this.jobs);
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    for (const [jobName, job] of this.jobs.entries()) {
      job.stop();
      logger.info(`Stopped scheduled job: ${jobName}`);
    }
    this.jobs.clear();
    logger.info('All scheduled jobs stopped');
  }

  /**
   * Get list of active jobs
   */
  getActiveJobs() {
    return Array.from(this.jobs.keys());
  }

  /**
   * Schedule daily tasks - runs at 1 AM everyday
   */
  private scheduleDaily() {
    // Run Daily Financial Engine at 00:05 AM — generates system baseline snapshots for all branches
    const dailyFinancialEngine = cron.schedule('5 0 * * *', async () => {
      try {
        logger.info('[Scheduler] Running Daily Financial Engine (midnight snapshots)');
        await runDailyFinancialEngine();
        logger.info('[Scheduler] Daily Financial Engine completed');
      } catch (error) {
        logger.error('[Scheduler] Daily Financial Engine failed:', error);
      }
    });
    this.jobs.set('daily-financial-engine', dailyFinancialEngine);

    // Run daily performance reports at 1:00 AM
    const dailyReports = cron.schedule('0 1 * * *', async () => {
      try {
        logger.info('Running daily report generation');
        await reportsService.generateScheduledReports('daily');
        logger.info('Daily report generation completed');
      } catch (error) {
        logger.error('Error in daily report generation:', error);
      }
    });
    this.jobs.set('daily-reports', dailyReports);

    // Run budget variance check at 2:00 AM
    const budgetCheck = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Running budget variance check');
        const alertCount = await alertsService.checkBudgetVariances();
        logger.info(`Budget variance check completed, ${alertCount} alerts generated`);
      } catch (error) {
        logger.error('Error in budget variance check:', error);
      }
    });
    this.jobs.set('budget-variance-check', budgetCheck);

    // Run performance metrics check at 3:00 AM
    const performanceCheck = cron.schedule('0 3 * * *', async () => {
      try {
        logger.info('Running performance metrics check');
        const alertCount = await alertsService.checkPerformanceMetrics();
        logger.info(`Performance metrics check completed, ${alertCount} alerts generated`);
      } catch (error) {
        logger.error('Error in performance metrics check:', error);
      }
    });
    this.jobs.set('performance-metrics-check', performanceCheck);
  }

  /**
   * Schedule weekly tasks - runs on Monday at 2 AM
   */
  private scheduleWeekly() {
    // Run weekly reports at 2:00 AM on Monday
    const weeklyReports = cron.schedule('0 2 * * 1', async () => {
      try {
        logger.info('Running weekly report generation');
        await reportsService.generateScheduledReports('weekly');
        logger.info('Weekly report generation completed');
      } catch (error) {
        logger.error('Error in weekly report generation:', error);
      }
    });
    this.jobs.set('weekly-reports', weeklyReports);

    // Run compliance check at 3:00 AM on Monday
    const complianceCheck = cron.schedule('0 3 * * 1', async () => {
      try {
        logger.info('Running compliance expiry check');
        const alertCount = await alertsService.checkComplianceExpiry();
        logger.info(`Compliance expiry check completed, ${alertCount} alerts generated`);
      } catch (error) {
        logger.error('Error in compliance expiry check:', error);
      }
    });
    this.jobs.set('compliance-check', complianceCheck);
  }

  /**
   * Schedule hourly tasks
   */
  private scheduleHourly() {
    // Check low stock every hour
    const lowStockCheck = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Running low stock check');
        const alertCount = await alertsService.checkLowStock();
        logger.info(`Low stock check completed, ${alertCount} alerts generated`);
      } catch (error) {
        logger.error('Error in low stock check:', error);
      }
    });
    this.jobs.set('low-stock-check', lowStockCheck);

    // Migrate pending bills to credit bills every hour
    const { migratePendingBills } = require('../jobs/migrate-pending-bills.job');
    const pendingBillsMigration = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Running pending bills migration');
        await migratePendingBills();
        logger.info('Pending bills migration completed');
      } catch (error) {
        logger.error('Error in pending bills migration:', error);
      }
    });
    this.jobs.set('pending-bills-migration', pendingBillsMigration);
  }

  /**
   * Schedule tasks that run every 5 minutes
   */
  private schedule5Minutes() {
    // Currently no tasks needed every 5 minutes
  }

  /**
   * Schedule tasks that run every 15 minutes
   */
  private schedule15Minutes() {
    // Update conference hall statuses based on active bookings
    const conferenceHallStatusUpdate = cron.schedule('*/15 * * * *', async () => {
      try {
        logger.info('Running conference hall status update');
        await this.updateConferenceHallStatuses();
        logger.info('Conference hall status update completed');
      } catch (error) {
        logger.error('Error in conference hall status update:', error);
      }
    });
    this.jobs.set('conference-hall-status-update', conferenceHallStatusUpdate);
  }

  /**
   * Update conference hall statuses based on current bookings
   */
  private async updateConferenceHallStatuses() {
    const { supabase } = require('../config/supabase');
    const now = new Date();
    
    try {
      // Get all halls
      const { data: halls, error: hallsError } = await supabase
        .from('conference_halls')
        .select('id, status, name');
      
      if (hallsError) {
        logger.error('Error fetching conference halls:', hallsError);
        return;
      }
      
      let updatedCount = 0;
      
      for (const hall of halls || []) {
        // Check if hall has any active bookings (ongoing right now)
        const { data: activeBookings, error: bookingsError } = await supabase
          .from('conference_hall_bookings')
          .select('id, start_date, end_date, customer_name')
          .eq('conference_hall_id', hall.id)
          .eq('booking_status', 'confirmed')
          .lte('start_date', now.toISOString())
          .gte('end_date', now.toISOString());
        
        if (bookingsError) {
          logger.error(`Error checking bookings for hall ${hall.id}:`, bookingsError);
          continue;
        }
        
        // Determine new status based on active bookings
        const hasActiveBooking = activeBookings && activeBookings.length > 0;
        const newStatus = hasActiveBooking ? 'occupied' : 'available';
        
        // Only update if status changed and not in maintenance/unavailable (manual overrides)
        if (hall.status !== 'maintenance' && hall.status !== 'unavailable' && hall.status !== newStatus) {
          const { error: updateError } = await supabase
            .from('conference_halls')
            .update({ status: newStatus })
            .eq('id', hall.id);
          
          if (updateError) {
            logger.error(`Error updating hall ${hall.id} status:`, updateError);
          } else {
            logger.info(`Hall "${hall.name}" status updated: ${hall.status} → ${newStatus}`);
            updatedCount++;
          }
        }
      }
      
      if (updatedCount > 0) {
        logger.info(`Conference hall status update: ${updatedCount} halls updated`);
      }
      
    } catch (error) {
      logger.error('Error in conference hall status update:', error);
      throw error;
    }
  }

  /**
   * Add a custom scheduled job
   */
  addJob(name: string, cronExpression: string, task: () => Promise<void>) {
    // Stop existing job with the same name if exists
    if (this.jobs.has(name)) {
      this.jobs.get(name)?.stop();
      this.jobs.delete(name);
    }

    // Create and start new job
    const job = cron.schedule(cronExpression, async () => {
      try {
        logger.info(`Running custom job: ${name}`);
        await task();
        logger.info(`Custom job completed: ${name}`);
      } catch (error) {
        logger.error(`Error in custom job ${name}:`, error);
      }
    });

    this.jobs.set(name, job);
    logger.info(`Added custom scheduled job: ${name} with cron: ${cronExpression}`);
    return true;
  }
}

export default new SchedulerService();
