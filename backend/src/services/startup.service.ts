import { logger } from '../utils/logger';
import schedulerService from './scheduler.service';
import db from '../db';
import { runGRNStockBackfill } from '../controllers/storekeeping/grn.controller';

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

    // Keep the central store pinned to Kyogong before any stock reconciliation runs.
    await this.enforceKyogongCentralBranch();

    // Backfill inventory_balances from posted GRNs (handles first-run where location didn't exist yet)
    try {
      const backfillResult = await runGRNStockBackfill();
      logger.info(`GRN stock backfill on startup: ${JSON.stringify(backfillResult)}`);
    } catch (err: any) {
      logger.warn('GRN stock backfill skipped (non-critical):', err.message);
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

  private async enforceKyogongCentralBranch(): Promise<void> {
    try {
      await db.query(`
        DO $$
        DECLARE
          v_central_branch_id integer;
        BEGIN
          SELECT id
          INTO v_central_branch_id
          FROM public.branches
          WHERE id = 1
            AND (upper(code) = 'KYO' OR upper(name) = 'KYOGONG')
          LIMIT 1;

          IF v_central_branch_id IS NULL THEN
            SELECT id
            INTO v_central_branch_id
            FROM public.branches
            WHERE upper(code) = 'KYO' OR upper(name) = 'KYOGONG'
            ORDER BY id
            LIMIT 1;
          END IF;

          IF v_central_branch_id IS NULL THEN
            RAISE EXCEPTION 'Kyogong branch not found; cannot configure central warehouse';
          END IF;

          UPDATE public.branches
          SET
            is_central_warehouse = (id = v_central_branch_id),
            is_main_branch = CASE WHEN id = v_central_branch_id THEN true ELSE is_main_branch END,
            updated_at = now()
          WHERE is_central_warehouse IS DISTINCT FROM (id = v_central_branch_id)
             OR (id = v_central_branch_id AND is_main_branch IS DISTINCT FROM true);

          UPDATE public.users
          SET
            branch_id = v_central_branch_id,
            updated_at = now()
          WHERE role = 'central_storekeeper'
            AND branch_id IS DISTINCT FROM v_central_branch_id;

          INSERT INTO public.inventory_locations (
            branch_id,
            location_code,
            name,
            location_type,
            is_active,
            metadata
          )
          VALUES (
            v_central_branch_id,
            'CENTRAL-STORE-' || v_central_branch_id,
            'Central Store',
            'central_store',
            true,
            '{}'::jsonb
          )
          ON CONFLICT (branch_id, location_code)
          DO UPDATE SET
            name = excluded.name,
            location_type = excluded.location_type,
            is_active = true,
            updated_at = now();
        END $$;
      `);
      logger.info('Central warehouse guard applied: Kyogong is central branch');
    } catch (err: any) {
      logger.warn('Central warehouse guard skipped (non-critical):', err.message);
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
