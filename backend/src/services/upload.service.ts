import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { logger } from '../utils/logger';

// Define storage engine
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: Function) => {
    const uploadDir = path.join(process.env.UPLOAD_DIR || 'uploads');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Create subdirectories based on file type
    let subDir = '';
    if (file.mimetype.startsWith('image/')) {
      subDir = 'images';
    } else if (file.mimetype.startsWith('video/')) {
      subDir = 'videos';
    } else {
      subDir = 'documents';
    }

    const finalDir = path.join(uploadDir, subDir);
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    cb(null, finalDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: Function) => {
  // Allowed file types
  const allowedTypes = {
    'image/jpeg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    'video/mp4': true,
    'video/mpeg': true,
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true
  };

  if (allowedTypes[file.mimetype as keyof typeof allowedTypes]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880') // 5MB default
  }
});

class UploadService {
  // Single file upload
  uploadSingle(fieldName: string) {
    return upload.single(fieldName);
  }

  // Multiple files upload
  uploadMultiple(fieldName: string, maxCount: number) {
    return upload.array(fieldName, maxCount);
  }

  // Multiple fields upload
  uploadFields(fields: { name: string; maxCount: number }[]) {
    return upload.fields(fields);
  }

  // Delete file
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info(`File deleted: ${filePath}`);
      }
    } catch (error: any) {
      logger.error('Error deleting file:', error);
      throw new Error('File could not be deleted');
    }
  }

  // Get file info
  async getFileInfo(filePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
    type: string;
  }> {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        type: path.extname(filePath)
      };
    } catch (error: any) {
      logger.error('Error getting file info:', error);
      throw new Error('File info could not be retrieved');
    }
  }

  // Move file
  async moveFile(oldPath: string, newPath: string): Promise<void> {
    try {
      await fs.promises.rename(oldPath, newPath);
      logger.info(`File moved from ${oldPath} to ${newPath}`);
    } catch (error: any) {
      logger.error('Error moving file:', error);
      throw new Error('File could not be moved');
    }
  }

  // Copy file
  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      await fs.promises.copyFile(sourcePath, destinationPath);
      logger.info(`File copied from ${sourcePath} to ${destinationPath}`);
    } catch (error: any) {
      logger.error('Error copying file:', error);
      throw new Error('File could not be copied');
    }
  }

  // Create directory
  async createDirectory(dirPath: string): Promise<void> {
    try {
      if (!fs.existsSync(dirPath)) {
        await fs.promises.mkdir(dirPath, { recursive: true });
        logger.info(`Directory created: ${dirPath}`);
      }
    } catch (error: any) {
      logger.error('Error creating directory:', error);
      throw new Error('Directory could not be created');
    }
  }

  // List directory contents
  async listDirectory(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(dirPath);
      return files;
    } catch (error: any) {
      logger.error('Error listing directory:', error);
      throw new Error('Directory contents could not be listed');
    }
  }

  // Check if file exists
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Get file size
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch (error: any) {
      logger.error('Error getting file size:', error);
      throw new Error('File size could not be retrieved');
    }
  }

  // Read file content (for text files)
  async readFileContent(filePath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return content;
    } catch (error: any) {
      logger.error('Error reading file:', error);
      throw new Error('File could not be read');
    }
  }

  // Write file content (for text files)
  async writeFileContent(filePath: string, content: string): Promise<void> {
    try {
      await fs.promises.writeFile(filePath, content, 'utf8');
      logger.info(`Content written to file: ${filePath}`);
    } catch (error: any) {
      logger.error('Error writing file:', error);
      throw new Error('File could not be written');
    }
  }
}

export const uploadService = new UploadService();
