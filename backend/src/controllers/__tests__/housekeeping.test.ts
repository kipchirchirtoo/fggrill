import request from 'supertest';
import { app } from '../../server';
import { Room, RoomStatus } from '../../models/Room';
import { HousekeepingTask, TaskStatus, TaskType } from '../../models/HousekeepingTask';
import { getTestUserWithToken } from '../../test/helpers';
import { mockSocketService } from '../../test/mocks/services';
import { UserRole } from '../../models/User';

jest.mock('../../services/socket.service', () => ({
  socketService: mockSocketService
}));

describe('Housekeeping Controller', () => {
  let room: any;

  beforeEach(async () => {
    // Create a test room
    room = await Room.create({
      roomNumber: '101',
      type: 'standard',
      floor: 1,
      status: RoomStatus.CLEANING,
      basePrice: 5000,
      currentPrice: 5000,
      maxOccupancy: 2,
      beds: { single: 2, double: 0, queen: 0, king: 0 },
      area: 25,
      isActive: true
    });
  });

  describe('GET /api/housekeeping/tasks', () => {
    it('should get all tasks', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const response = await request(app)
        .get('/api/housekeeping/tasks')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter tasks by status', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      // Create some tasks
      await HousekeepingTask.create([
        {
          taskNumber: 'HSK001',
          roomId: room.id,
          roomNumber: room.roomNumber,
          taskType: TaskType.CHECK_OUT_CLEAN,
          status: TaskStatus.PENDING,
          estimatedDuration: 30
        },
        {
          taskNumber: 'HSK002',
          roomId: room.id,
          roomNumber: room.roomNumber,
          taskType: TaskType.DAILY_CLEAN,
          status: TaskStatus.COMPLETED,
          estimatedDuration: 20
        }
      ]);

      const response = await request(app)
        .get('/api/housekeeping/tasks')
        .query({ status: TaskStatus.PENDING })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(TaskStatus.PENDING);
    });
  });

  describe('POST /api/housekeeping/tasks', () => {
    it('should create a new task', async () => {
      const { token, user } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const taskData = {
        roomNumber: room.roomNumber,
        taskType: TaskType.CHECK_OUT_CLEAN,
        priority: 'high',
        estimatedDuration: 30,
        checklist: [
          { item: 'Make bed', completed: false },
          { item: 'Clean bathroom', completed: false }
        ]
      };

      const response = await request(app)
        .post('/api/housekeeping/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.taskNumber).toBeDefined();
      expect(response.body.data.roomNumber).toBe(room.roomNumber);
      expect(response.body.data.status).toBe(TaskStatus.PENDING);

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'housekeeping',
        'housekeeping:taskCreated',
        expect.any(Object)
      );
    });

    it('should not create task for non-existent room', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const response = await request(app)
        .post('/api/housekeeping/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          roomNumber: '999',
          taskType: TaskType.CHECK_OUT_CLEAN,
          priority: 'high',
          estimatedDuration: 30
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Room not found');
    });
  });

  describe('PUT /api/housekeeping/tasks/:id', () => {
    let task: any;

    beforeEach(async () => {
      task = await HousekeepingTask.create({
        taskNumber: 'HSK001',
        roomId: room.id,
        roomNumber: room.roomNumber,
        taskType: TaskType.CHECK_OUT_CLEAN,
        status: TaskStatus.PENDING,
        estimatedDuration: 30,
        checklist: [
          { item: 'Make bed', completed: false },
          { item: 'Clean bathroom', completed: false }
        ]
      });
    });

    it('should update task status', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const response = await request(app)
        .put(`/api/housekeeping/tasks/${task.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: TaskStatus.COMPLETED,
          checklist: [
            { item: 'Make bed', completed: true },
            { item: 'Clean bathroom', completed: true }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(TaskStatus.COMPLETED);

      // Verify room status was updated
      const updatedRoom = await Room.findById(room.id);
      expect(updatedRoom?.status).toBe(RoomStatus.AVAILABLE);

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'housekeeping',
        'housekeeping:taskUpdated',
        expect.any(Object)
      );
    });

    it('should update task checklist', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const response = await request(app)
        .put(`/api/housekeeping/tasks/${task.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          checklist: [
            { item: 'Make bed', completed: true },
            { item: 'Clean bathroom', completed: false }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.checklist[0].completed).toBe(true);
      expect(response.body.data.checklist[1].completed).toBe(false);
    });
  });

  describe('DELETE /api/housekeeping/tasks/:id', () => {
    it('should delete task (admin only)', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      const task = await HousekeepingTask.create({
        taskNumber: 'HSK001',
        roomId: room.id,
        roomNumber: room.roomNumber,
        taskType: TaskType.CHECK_OUT_CLEAN,
        status: TaskStatus.PENDING,
        estimatedDuration: 30
      });

      const response = await request(app)
        .delete(`/api/housekeeping/tasks/${task.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify task was deleted
      const deletedTask = await HousekeepingTask.findById(task.id);
      expect(deletedTask).toBeNull();

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'housekeeping',
        'housekeeping:taskDeleted',
        task.id
      );
    });

    it('should not allow non-admin to delete task', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const task = await HousekeepingTask.create({
        taskNumber: 'HSK001',
        roomId: room.id,
        roomNumber: room.roomNumber,
        taskType: TaskType.CHECK_OUT_CLEAN,
        status: TaskStatus.PENDING,
        estimatedDuration: 30
      });

      const response = await request(app)
        .delete(`/api/housekeeping/tasks/${task.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/housekeeping/rooms/:roomNumber/status', () => {
    it('should get room cleaning status', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      // Create a task for the room
      await HousekeepingTask.create({
        taskNumber: 'HSK001',
        roomId: room.id,
        roomNumber: room.roomNumber,
        taskType: TaskType.CHECK_OUT_CLEAN,
        status: TaskStatus.IN_PROGRESS,
        estimatedDuration: 30
      });

      const response = await request(app)
        .get(`/api/housekeeping/rooms/${room.roomNumber}/status`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.roomStatus).toBe(RoomStatus.CLEANING);
      expect(response.body.data.currentTask).toBeDefined();
      expect(response.body.data.currentTask.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should return 404 for non-existent room', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const response = await request(app)
        .get('/api/housekeeping/rooms/999/status')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Room not found');
    });
  });

  describe('GET /api/housekeeping/staff/workload', () => {
    it('should get staff workload', async () => {
      const { token, user } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      // Create tasks assigned to user
      await HousekeepingTask.create([
        {
          taskNumber: 'HSK001',
          roomId: room.id,
          roomNumber: room.roomNumber,
          taskType: TaskType.CHECK_OUT_CLEAN,
          status: TaskStatus.ASSIGNED,
          assignedTo: user.id,
          estimatedDuration: 30
        },
        {
          taskNumber: 'HSK002',
          roomId: room.id,
          roomNumber: room.roomNumber,
          taskType: TaskType.DAILY_CLEAN,
          status: TaskStatus.IN_PROGRESS,
          assignedTo: user.id,
          estimatedDuration: 20
        }
      ]);

      const response = await request(app)
        .get('/api/housekeeping/staff/workload')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].totalTasks).toBe(2);
      expect(response.body.data[0].staffName).toBeDefined();
    });
  });
});
