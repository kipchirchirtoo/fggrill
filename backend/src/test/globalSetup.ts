import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

export default async (): Promise<void> => {
  // Load test environment variables
  config({ path: '.env.test' });

  // Create necessary directories
  const dirs = [
    'logs',
    'uploads',
    'uploads/images',
    'uploads/documents',
    'uploads/videos'
  ];

  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '../../', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
};
