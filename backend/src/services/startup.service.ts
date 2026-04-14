import { logger } from '../utils/logger';
import schedulerService from './scheduler.service';

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
  stopKeepAlivePing(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      logger.info('Keep-alive ping stopped');
    }
  }
}

export default new StartupService();
