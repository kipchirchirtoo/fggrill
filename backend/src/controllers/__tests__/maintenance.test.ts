import request from 'supertest';
import { app } from '../../server';
import { Room, RoomStatus } from '../../models/Room';
import { MaintenanceTask, MaintenanceStatus, MaintenanceType } from '../../models/MaintenanceTask';
import { InventoryItem } from '../../models/Inventory';
import { getTestUserWithToken } from '../../test/helpers';
import { mockSocketService, mockEmailService } from '../../test/mocks/services';
import { UserRole } from '../../models/User';

jest.mock('../../services/socket.service', () => ({
  socketService: mockSocketService
}));

jest.mock('../../services/email.service', () => ({
  emailService: mockEmailService
}));

describe('Maintenance Controller', () => {
  let room: any;
  const taskData = {
    location: 'Room 101',
    type: MaintenanceType.CORRECTIVE,
    priority: 'high',
    description: 'AC not working',
    estimatedDuration: 60
  };

  beforeEach(async () => {
    // Create a test room
    room = await Room.create({
      roomNumber: '101',
      type: 'standard',
      floor: 1,
      status: RoomStatus.MAINTENANCE,
      basePrice: 5000,
      currentPrice: 5000,
      maxOccupancy: 2,
      beds: { single: 2, double: 0, queen: 0, king: 0 },
      area: 25,
      isActive: true
    });
  });

  describe('GET /api/maintenance/tasks', () => {
    beforeEach(async () => {
      await MaintenanceTask.create([
        {
          ...taskData,
          taskNumber: 'MNT001',
          status: MaintenanceStatus.PENDING
        },
        {
          ...taskData,
          taskNumber: 'MNT002',
          type: MaintenanceType.PREVENTIVE,
          status: MaintenanceStatus.COMPLETED
        }
      ]);
    });

    it('should get all tasks', async () => {
      const { token } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const response = await request(app)
        .get('/api/maintenance/tasks')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter tasks by type', async () => {
      const { token } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const response = await request(app)
        .get('/api/maintenance/tasks')
        .query({ type: MaintenanceType.PREVENTIVE })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe(MaintenanceType.PREVENTIVE);
    });

    it('should filter tasks by status', async () => {
      const { token } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const response = await request(app)
        .get('/api/maintenance/tasks')
        .query({ status: MaintenanceStatus.PENDING })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(MaintenanceStatus.PENDING);
    });
  });

  describe('POST /api/maintenance/tasks', () => {
    it('should create a new task', async () => {
      const { token, user } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const response = await request(app)
        .post('/api/maintenance/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.taskNumber).toBeDefined();
      expect(response.body.data.status).toBe(MaintenanceStatus.PENDING);
      expect(response.body.data.reportedBy.toString()).toBe(user.id);

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'maintenance',
        'maintenance:taskCreated',
        expect.any(Object)
      );
    });

    it('should update room status for room maintenance', async () => {
      const { token } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const response = await request(app)
        .post('/api/maintenance/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...taskData,
          location: `Room ${room.roomNumber}`
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify room status was updated
      const updatedRoom = await Room.findById(room.id);
      expect(updatedRoom?.status).toBe(RoomStatus.MAINTENANCE);
    });
  });

  describe('PUT /api/maintenance/tasks/:id', () => {
    let task: any;
    let parts: any;

    beforeEach(async () => {
      // Create test parts in inventory
      parts = await InventoryItem.create([
        {
          itemCode: 'PART001',
          name: 'AC Filter',
          category: 'maintenance',
          unit: 'piece',
          currentStock: 10,
          minimumStock: 2,
          reorderPoint: 3,
          maximumStock: 20,
          unitCost: 1000,
          isActive: true
        }
      ]);

      task = await MaintenanceTask.create({
        ...taskData,
        taskNumber: 'MNT001',
        status: MaintenanceStatus.PENDING
      });
    });

    it('should update task status and handle parts', async () => {
      const { token } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const response = await request(app)
        .put(`/api/maintenance/tasks/${task.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: MaintenanceStatus.COMPLETED,
          parts: [{
            itemId: parts[0].itemCode,
            name: parts[0].name,
            quantity: 1,
            cost: parts[0].unitCost
          }]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(MaintenanceStatus.COMPLETED);
      expect(response.body.data.parts).toHaveLength(1);

      // Verify inventory was updated
      const updatedPart = await InventoryItem.findById(parts[0].id);
      expect(updatedPart?.currentStock).toBe(9); // 10 - 1

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'maintenance',
        'maintenance:taskUpdated',
        expect.any(Object)
      );
    });

    it('should handle room status when completing task', async () => {
      const { token } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const roomTask = await MaintenanceTask.create({
        ...taskData,
        taskNumber: 'MNT002',
        location: `Room ${room.roomNumber}`,
        status: MaintenanceStatus.IN_PROGRESS
      });

      const response = await request(app)
        .put(`/api/maintenance/tasks/${roomTask.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: MaintenanceStatus.COMPLETED
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify room status was updated
      const updatedRoom = await Room.findById(room.id);
      expect(updatedRoom?.status).toBe(RoomStatus.AVAILABLE);
    });
  });

  describe('DELETE /api/maintenance/tasks/:id', () => {
    it('should delete task (admin only)', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      const task = await MaintenanceTask.create({
        ...taskData,
        taskNumber: 'MNT001',
        status: MaintenanceStatus.PENDING
      });

      const response = await request(app)
        .delete(`/api/maintenance/tasks/${task.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify task was deleted
      const deletedTask = await MaintenanceTask.findById(task.id);
      expect(deletedTask).toBeNull();

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'maintenance',
        'maintenance:taskDeleted',
        task.id
      );
    });

    it('should not allow non-admin to delete task', async () => {
      const { token } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const task = await MaintenanceTask.create({
        ...taskData,
        taskNumber: 'MNT001',
        status: MaintenanceStatus.PENDING
      });

      const response = await request(app)
        .delete(`/api/maintenance/tasks/${task.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/maintenance/schedule', () => {
    beforeEach(async () => {
      // Create some preventive maintenance tasks
      await MaintenanceTask.create([
        {
          ...taskData,
          taskNumber: 'MNT001',
          type: MaintenanceType.PREVENTIVE,
          status: MaintenanceStatus.PENDING,
          startedAt: new Date('2024-12-01')
        },
        {
          ...taskData,
          taskNumber: 'MNT002',
          type: MaintenanceType.PREVENTIVE,
          status: MaintenanceStatus.PENDING,
          startedAt: new Date('2024-12-15')
        }
      ]);
    });

    it('should get maintenance schedule', async () => {
      const { token } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const response = await request(app)
        .get('/api/maintenance/schedule')
        .query({
          startDate: '2024-12-01',
          endDate: '2024-12-31'
        })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/maintenance/stats', () => {
    beforeEach(async () => {
      await MaintenanceTask.create([
        {
          ...taskData,
          taskNumber: 'MNT001',
          status: MaintenanceStatus.COMPLETED,
          type: MaintenanceType.CORRECTIVE,
          startedAt: new Date('2024-01-01T10:00:00'),
          completedAt: new Date('2024-01-01T11:00:00'),
          totalCost: 5000
        },
        {
          ...taskData,
          taskNumber: 'MNT002',
          status: MaintenanceStatus.COMPLETED,
          type: MaintenanceType.PREVENTIVE,
          startedAt: new Date('2024-01-02T14:00:00'),
          completedAt: new Date('2024-01-02T15:30:00'),
          totalCost: 3000
        }
      ]);
    });

    it('should get maintenance statistics', async () => {
      const { token } = await getTestUserWithToken(UserRole.MAINTENANCE);

      const response = await request(app)
        .get('/api/maintenance/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('byStatus');
      expect(response.body.data).toHaveProperty('byType');
      expect(response.body.data).toHaveProperty('byPriority');
      expect(response.body.data).toHaveProperty('avgCompletionTime');
      expect(response.body.data).toHaveProperty('totalCost');

      // Verify statistics
      expect(response.body.data.byStatus).toHaveLength(1); // Only COMPLETED status
      expect(response.body.data.byType).toHaveLength(2); // CORRECTIVE and PREVENTIVE
      expect(response.body.data.totalCost[0].total).toBe(8000); // 5000 + 3000
    });
  });
});
