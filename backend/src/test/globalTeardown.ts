import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

export default async (): Promise<void> => {
  try {
    // Clean up test uploads
    const uploadDir = path.join(__dirname, '../../uploads');
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }

    // Clean up test logs
    const logDir = path.join(__dirname, '../../logs');
    if (fs.existsSync(logDir)) {
      fs.rmSync(logDir, { recursive: true, force: true });
    }

    logger.info('Test cleanup completed');
  } catch (error) {
    logger.error('Error during test cleanup:', error);
    throw error;
  }
};
