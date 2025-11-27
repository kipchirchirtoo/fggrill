import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';

class SocketService {
  private io: Server;
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]
  private roomSockets: Map<string, string[]> = new Map(); // roomId -> socketIds[]

  constructor(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Handle user authentication
      socket.on('authenticate', (userId: string) => {
        this.addUserSocket(userId, socket.id);
        socket.join(`user:${userId}`);
        logger.info(`User ${userId} authenticated on socket ${socket.id}`);
      });

      // Handle room join
      socket.on('join:room', (roomId: string) => {
        this.addRoomSocket(roomId, socket.id);
        socket.join(`room:${roomId}`);
        logger.info(`Socket ${socket.id} joined room ${roomId}`);
      });

      // Handle room leave
      socket.on('leave:room', (roomId: string) => {
        this.removeRoomSocket(roomId, socket.id);
        socket.leave(`room:${roomId}`);
        logger.info(`Socket ${socket.id} left room ${roomId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.removeSocket(socket.id);
        logger.info(`Client disconnected: ${socket.id}`);
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  // User socket management
  private addUserSocket(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId) || [];
    if (!sockets.includes(socketId)) {
      sockets.push(socketId);
      this.userSockets.set(userId, sockets);
    }
  }

  private removeUserSocket(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId) || [];
    const updatedSockets = sockets.filter(id => id !== socketId);
    if (updatedSockets.length > 0) {
      this.userSockets.set(userId, updatedSockets);
    } else {
      this.userSockets.delete(userId);
    }
  }

  // Room socket management
  private addRoomSocket(roomId: string, socketId: string): void {
    const sockets = this.roomSockets.get(roomId) || [];
    if (!sockets.includes(socketId)) {
      sockets.push(socketId);
      this.roomSockets.set(roomId, sockets);
    }
  }

  private removeRoomSocket(roomId: string, socketId: string): void {
    const sockets = this.roomSockets.get(roomId) || [];
    const updatedSockets = sockets.filter(id => id !== socketId);
    if (updatedSockets.length > 0) {
      this.roomSockets.set(roomId, updatedSockets);
    } else {
      this.roomSockets.delete(roomId);
    }
  }

  // Remove socket from all tracking
  private removeSocket(socketId: string): void {
    // Remove from user sockets
    this.userSockets.forEach((sockets, userId) => {
      if (sockets.includes(socketId)) {
        this.removeUserSocket(userId, socketId);
      }
    });

    // Remove from room sockets
    this.roomSockets.forEach((sockets, roomId) => {
      if (sockets.includes(socketId)) {
        this.removeRoomSocket(roomId, socketId);
      }
    });
  }

  // Emit to specific user
  emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // Emit to specific room
  emitToRoom(roomId: string, event: string, data: any): void {
    this.io.to(`room:${roomId}`).emit(event, data);
  }

  // Emit to all authenticated users
  emitToAuthenticated(event: string, data: any): void {
    this.userSockets.forEach((_, userId) => {
      this.emitToUser(userId, event, data);
    });
  }

  // Emit to all clients
  emitToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // Get user socket count
  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.length || 0;
  }

  // Get room socket count
  getRoomSocketCount(roomId: string): number {
    return this.roomSockets.get(roomId)?.length || 0;
  }

  // Get total connected socket count
  getTotalSocketCount(): number {
    return this.io.engine.clientsCount;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.getUserSocketCount(userId) > 0;
  }

  // Get online users
  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  // Get active rooms
  getActiveRooms(): string[] {
    return Array.from(this.roomSockets.keys());
  }

  // Disconnect user
  disconnectUser(userId: string): void {
    const sockets = this.userSockets.get(userId) || [];
    sockets.forEach(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    });
  }

  // Disconnect all sockets in a room
  disconnectRoom(roomId: string): void {
    const sockets = this.roomSockets.get(roomId) || [];
    sockets.forEach(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    });
  }
}

export default SocketService;
