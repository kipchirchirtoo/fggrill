import { logger } from '../utils/logger';
import schedulerService from './scheduler.service';
import db from '../db';
import { runGRNStockBackfill } from '../controllers/storekeeping/grn.controller';
import { automationService } from './automation.service';

/**
 * Service to handle application startup tasks
 */
class StartupService {
  private keepAliveInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize all services that need to be started when the server starts
   */
  async initialize(): Promise<void> {
    logger.info('Initializing startup services...');

    // Patch broken DB triggers/columns from migration 0003
    await this.applyDbPatches();

    // Backfill inventory_balances from posted GRNs (handles first-run where location didn't exist yet)
    try {
      const backfillResult = await runGRNStockBackfill();
      logger.info(`GRN stock backfill on startup: ${JSON.stringify(backfillResult)}`);
    } catch (err: any) {
      logger.warn('GRN stock backfill skipped (non-critical):', err.message);
    }

    try {
      void automationService;
      logger.info('Reception automation service initialized');
    } catch (error) {
      logger.error('Error initializing automation service:', error);
    }

    try {
      // Start the scheduler for automated tasks
      const jobs = schedulerService.startAll();
      logger.info('Scheduler service started successfully');
      logger.info(`Active scheduled jobs: ${Object.keys(jobs).join(', ')}`);
    } catch (error) {
      logger.error('Error starting scheduler service:', error);
    }

    // Start keep-alive ping to prevent Render cold starts
    this.startKeepAlivePing();
    
    logger.info('All startup services initialized');
  }

  /**
   * Keep Render instance warm by pinging health endpoint every 10 minutes
   * Prevents cold start CORS issues
   */
  private startKeepAlivePing(): void {
    // Only run in production
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Keep-alive ping disabled in development');
      return;
    }

    const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
    const API_URL = process.env.API_URL || 'https://api.hirall.com';

    this.keepAliveInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
          logger.debug('Keep-alive ping successful');
        }
      } catch (error) {
        // Silently fail - this is just a keep-alive mechanism
        logger.debug('Keep-alive ping failed (expected during cold start)');
      }
    }, PING_INTERVAL);

    logger.info(`Keep-alive ping started (interval: ${PING_INTERVAL / 1000}s)`);
  }

  /**
   * Stop keep-alive ping (for graceful shutdown)
   */
  private async applyDbPatches(): Promise<void> {
    try {
      // Fix _sync_grn_cols: goods_receipts has no 'approved_by' column.
      // The original migration 0003 function referenced NEW.approved_by which caused
      // every GRN insert/update to fail with "record new has no field approved_by".
      await db.query(`
        CREATE OR REPLACE FUNCTION public._sync_grn_cols()
        RETURNS TRIGGER LANGUAGE plpgsql AS $func$
        BEGIN
          NEW.grn_date       := COALESCE(NEW.grn_date, NEW.received_at);
          NEW.received_by_id := NEW.received_by;
          IF NEW.status IN ('partially_accepted','posted') THEN
            NEW.grn_approved := TRUE;
          END IF;
          RETURN NEW;
        END;
        $func$;
      `);
      logger.info('DB patch applied: _sync_grn_cols trigger fixed');
    } catch (err: any) {
      logger.warn('DB patch skipped (non-critical):', err.message);
    }
  }

  stopKeepAlivePing(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      logger.info('Keep-alive ping stopped');
    }
  }
}

export default new StartupService();
