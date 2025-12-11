import { logger } from '../utils/logger';
import schedulerService from './scheduler.service';

/**
 * Service to handle application startup tasks
 */
class StartupService {
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
    
    logger.info('All startup services initialized');
  }
}

export default new StartupService();
