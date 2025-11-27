import { Server } from 'socket.io';
import { logger } from '../utils/logger';

export const setupSocketIO = (io: Server): void => {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Room status updates
    socket.on('join:room', (roomId: string) => {
      socket.join(`room:${roomId}`);
      logger.debug(`Client ${socket.id} joined room:${roomId}`);
    });

    socket.on('leave:room', (roomId: string) => {
      socket.leave(`room:${roomId}`);
      logger.debug(`Client ${socket.id} left room:${roomId}`);
    });

    // Real-time booking updates
    socket.on('booking:update', (data: { bookingId: string; status: string }) => {
      io.emit('booking:updated', data);
      logger.debug(`Booking update: ${JSON.stringify(data)}`);
    });

    // Housekeeping task updates
    socket.on('housekeeping:update', (data: { taskId: string; status: string }) => {
      io.emit('housekeeping:updated', data);
      logger.debug(`Housekeeping update: ${JSON.stringify(data)}`);
    });

    // Maintenance task updates
    socket.on('maintenance:update', (data: { taskId: string; status: string }) => {
      io.emit('maintenance:updated', data);
      logger.debug(`Maintenance update: ${JSON.stringify(data)}`);
    });

    // Inventory level updates
    socket.on('inventory:update', (data: { itemId: string; quantity: number }) => {
      io.emit('inventory:updated', data);
      logger.debug(`Inventory update: ${JSON.stringify(data)}`);
    });

    // Chat functionality
    socket.on('chat:join', (roomId: string) => {
      socket.join(`chat:${roomId}`);
      logger.debug(`Client ${socket.id} joined chat:${roomId}`);
    });

    socket.on('chat:message', (data: { roomId: string; message: string; sender: string }) => {
      io.to(`chat:${data.roomId}`).emit('chat:message', data);
      logger.debug(`Chat message in ${data.roomId}: ${JSON.stringify(data)}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  // Global error handling for Socket.IO server
  io.engine.on('connection_error', (error) => {
    logger.error('Socket.IO connection error:', error);
  });
};
