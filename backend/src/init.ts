import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import SocketService from './services/socket.service';
import { connectDB } from './config/database';
import { logger } from './utils/logger';

export const initializeApp = async () => {
  try {
    // Connect to Supabase
    await connectDB();
    logger.info('Database connection established');

    // Create Express app
    const app = express();
    const httpServer = createServer(app);

    // Initialize Socket.IO
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST']
      }
    });

    // Initialize Socket Service
    const socketService = new SocketService(io);

    // Export Socket.IO instance
    app.set('io', io);
    app.set('socketService', socketService);

    return { app, httpServer, io, socketService };
  } catch (error) {
    logger.error('Error initializing app:', error);
    process.exit(1);
  }
};
