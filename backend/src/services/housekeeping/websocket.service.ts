import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { supabase } from '../../config/supabase';

interface RoomStatusUpdate {
  roomId: string;
  roomNumber: string;
  oldStatus: string;
  newStatus: string;
  updatedBy?: string;
  timestamp: Date;
}

interface TaskUpdate {
  taskId: string;
  taskNumber: string;
  type: 'created' | 'assigned' | 'started' | 'completed' | 'cancelled';
  roomNumber?: string;
  assignedTo?: string;
  timestamp: Date;
}

interface StaffUpdate {
  staffId: string;
  staffName: string;
  type: 'location' | 'availability' | 'task_started' | 'task_completed';
  data: any;
  timestamp: Date;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  recipientId?: string;
  data?: any;
  timestamp: Date;
}

class HousekeepingWebSocketService {
  private io: SocketServer | null = null;
  private connectedClients: Map<string, Socket> = new Map();
  private roomSubscriptions: Map<string, Set<string>> = new Map(); // roomId -> Set of socketIds
  private staffSubscriptions: Map<string, string> = new Map(); // staffId -> socketId

  initialize(httpServer: HttpServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/ws/housekeeping'
    });

    this.io.on('connection', (socket: Socket) => {
      // console.log(`[HK-WS] Client connected: ${socket.id}`);
      this.handleConnection(socket);
    });

    // Subscribe to Supabase real-time changes
    this.setupSupabaseRealtimeListeners();

    // console.log('[HK-WS] WebSocket service initialized');
  }

  private handleConnection(socket: Socket) {
    const userId = socket.handshake.auth.userId;
    const userRole = socket.handshake.auth.userRole;
    
    this.connectedClients.set(socket.id, socket);

    // Join role-based rooms
    if (userRole === 'housekeeping') {
      socket.join('housekeeping-staff');
    }
    if (['super_admin', 'manager'].includes(userRole)) {
      socket.join('housekeeping-supervisors');
    }

    // Handle client events
    socket.on('subscribe:room', (roomId: string) => {
      this.subscribeToRoom(socket.id, roomId);
    });

    socket.on('unsubscribe:room', (roomId: string) => {
      this.unsubscribeFromRoom(socket.id, roomId);
    });

    socket.on('subscribe:floor', (floorNumber: number) => {
      socket.join(`floor-${floorNumber}`);
    });

    socket.on('staff:location', (data: { staffId: string; floor: number; room?: string }) => {
      this.handleStaffLocationUpdate(data);
    });

    socket.on('staff:availability', (data: { staffId: string; isAvailable: boolean }) => {
      this.broadcastStaffUpdate({
        staffId: data.staffId,
        staffName: '',
        type: 'availability',
        data: { isAvailable: data.isAvailable },
        timestamp: new Date()
      });
    });

    socket.on('disconnect', () => {
      // console.log(`[HK-WS] Client disconnected: ${socket.id}`);
      this.handleDisconnection(socket);
    });

    // Send initial state
    this.sendInitialState(socket);
  }

  private handleDisconnection(socket: Socket) {
    this.connectedClients.delete(socket.id);
    
    // Clean up room subscriptions
    this.roomSubscriptions.forEach((socketIds, roomId) => {
      socketIds.delete(socket.id);
    });

    // Clean up staff subscriptions
    this.staffSubscriptions.forEach((socketId, staffId) => {
      if (socketId === socket.id) {
        this.staffSubscriptions.delete(staffId);
      }
    });
  }

  private subscribeToRoom(socketId: string, roomId: string) {
    if (!this.roomSubscriptions.has(roomId)) {
      this.roomSubscriptions.set(roomId, new Set());
    }
    this.roomSubscriptions.get(roomId)!.add(socketId);
  }

  private unsubscribeFromRoom(socketId: string, roomId: string) {
    this.roomSubscriptions.get(roomId)?.delete(socketId);
  }

  private async sendInitialState(socket: Socket) {
    try {
      // Get current room status summary
      const { data: roomStats } = await supabase
        .from('rooms')
        .select('hk_status')
        .not('hk_status', 'is', null);

      const statusCounts: Record<string, number> = {};
      roomStats?.forEach(r => {
        statusCounts[r.hk_status] = (statusCounts[r.hk_status] || 0) + 1;
      });

      // Get pending/active tasks count
      const { count: pendingTasks } = await supabase
        .from('hk_tasks')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'assigned', 'in_progress']);

      socket.emit('initial:state', {
        roomStatusCounts: statusCounts,
        pendingTasksCount: pendingTasks || 0,
        connectedAt: new Date()
      });
    } catch (error) {
      console.error('[HK-WS] Error sending initial state:', error);
    }
  }

  private setupSupabaseRealtimeListeners() {
    // Listen to room status changes
    supabase
      .channel('rooms-changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'rooms' },
        (payload) => {
          if (payload.old.hk_status !== payload.new.hk_status) {
            this.broadcastRoomStatusUpdate({
              roomId: payload.new.id,
              roomNumber: payload.new.room_number,
              oldStatus: payload.old.hk_status,
              newStatus: payload.new.hk_status,
              timestamp: new Date()
            });
          }
        }
      )
      .subscribe();

    // Listen to task changes
    supabase
      .channel('tasks-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'hk_tasks' },
        (payload) => {
          const newTask = payload.new as any;
          const oldTask = payload.old as any;
          
          let type: TaskUpdate['type'] = 'created';
          if (payload.eventType === 'UPDATE') {
            if (newTask?.status === 'assigned' && oldTask?.status === 'pending') {
              type = 'assigned';
            } else if (newTask?.status === 'in_progress') {
              type = 'started';
            } else if (newTask?.status === 'completed') {
              type = 'completed';
            } else if (newTask?.status === 'cancelled') {
              type = 'cancelled';
            }
          }
          this.broadcastTaskUpdate({
            taskId: newTask.id,
            taskNumber: newTask.task_number,
            type,
            roomNumber: newTask.room_number,
            assignedTo: newTask.assigned_to,
            timestamp: new Date()
          });
        }
      )
      .subscribe();
  }

  // Public methods for broadcasting

  broadcastRoomStatusUpdate(update: RoomStatusUpdate) {
    if (!this.io) return;

    // Broadcast to all housekeeping staff
    this.io.to('housekeeping-staff').emit('room:status', update);
    this.io.to('housekeeping-supervisors').emit('room:status', update);

    // Broadcast to specific room subscribers
    const subscribers = this.roomSubscriptions.get(update.roomId);
    if (subscribers) {
      subscribers.forEach(socketId => {
        this.connectedClients.get(socketId)?.emit('room:status', update);
      });
    }

    // Broadcast to floor
    const floorMatch = update.roomNumber.match(/^(\d)/);
    if (floorMatch) {
      this.io.to(`floor-${floorMatch[1]}`).emit('room:status', update);
    }
  }

  broadcastTaskUpdate(update: TaskUpdate) {
    if (!this.io) return;

    this.io.to('housekeeping-staff').emit('task:update', update);
    this.io.to('housekeeping-supervisors').emit('task:update', update);

    // Notify assigned staff directly
    if (update.assignedTo && update.type === 'assigned') {
      const staffSocketId = this.staffSubscriptions.get(update.assignedTo);
      if (staffSocketId) {
        this.connectedClients.get(staffSocketId)?.emit('task:assigned', update);
      }
    }
  }

  broadcastStaffUpdate(update: StaffUpdate) {
    if (!this.io) return;

    this.io.to('housekeeping-supervisors').emit('staff:update', update);
  }

  sendNotification(notification: Notification) {
    if (!this.io) return;

    if (notification.recipientId) {
      // Direct notification to specific user
      const staffSocketId = this.staffSubscriptions.get(notification.recipientId);
      if (staffSocketId) {
        this.connectedClients.get(staffSocketId)?.emit('notification', notification);
      }
    } else if (notification.priority === 'urgent' || notification.priority === 'high') {
      // Broadcast urgent notifications to all supervisors
      this.io.to('housekeeping-supervisors').emit('notification', notification);
    }
  }

  broadcastUrgentAlert(alert: { type: string; message: string; data?: any }) {
    if (!this.io) return;

    this.io.to('housekeeping-supervisors').emit('urgent:alert', {
      ...alert,
      timestamp: new Date()
    });
  }

  private handleStaffLocationUpdate(data: { staffId: string; floor: number; room?: string }) {
    // Update location in database
    supabase
      .from('hk_staff_locations')
      .insert({
        staff_id: data.staffId,
        floor_number: data.floor,
        room_number: data.room,
        source: 'manual'
      })
      .then(() => {
        // Broadcast to supervisors
        this.broadcastStaffUpdate({
          staffId: data.staffId,
          staffName: '',
          type: 'location',
          data: { floor: data.floor, room: data.room },
          timestamp: new Date()
        });
      });
  }

  // Utility methods
  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  getClientsOnFloor(floorNumber: number): number {
    if (!this.io) return 0;
    return this.io.sockets.adapter.rooms.get(`floor-${floorNumber}`)?.size || 0;
  }
}

export const housekeepingWS = new HousekeepingWebSocketService();
export default housekeepingWS;
