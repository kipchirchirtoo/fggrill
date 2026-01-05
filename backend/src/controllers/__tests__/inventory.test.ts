import request from 'supertest';
import { app } from '../../server';
import { InventoryItem, InventoryCategory } from '../../models/Inventory';
import { getTestUserWithToken } from '../../test/helpers';
import { mockSocketService, mockEmailService } from '../../test/mocks/services';
import { UserRole } from '../../models/User';

jest.mock('../../services/socket.service', () => ({
  socketService: mockSocketService
}));

jest.mock('../../services/email.service', () => ({
  emailService: mockEmailService
}));

describe('Inventory Controller', () => {
  const itemData = {
    code: 'HSK001',
    name: 'Bath Towel',
    category: InventoryCategory.HOUSEKEEPING,
    unit: 'piece',
    currentStock: 100,
    minimumStock: 20,
    maximumStock: 200,
    unitCost: 500,
  };

  describe('GET /api/inventory/items', () => {
    beforeEach(async () => {
      await new InventoryItem(itemData).save();
      await new InventoryItem({
        ...itemData,
        code: 'HSK002',
        name: 'Hand Towel',
        currentStock: 50
      }).save();
    });

    it('should get all items', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const response = await request(app)
        .get('/api/inventory/items')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter items by category', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const response = await request(app)
        .get('/api/inventory/items')
        .query({ category: InventoryCategory.HOUSEKEEPING })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.every((item: any) =>
        item.category === InventoryCategory.HOUSEKEEPING
      )).toBe(true);
    });

    it('should search items by name', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const response = await request(app)
        .get('/api/inventory/items')
        .query({ search: 'Hand' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Hand Towel');
    });
  });

  describe('POST /api/inventory/items', () => {
    it('should create a new item', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      const response = await request(app)
        .post('/api/inventory/items')
        .set('Authorization', `Bearer ${token}`)
        .send(itemData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.code).toBe(itemData.code);
      expect(response.body.data.name).toBe(itemData.name);

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'inventory',
        'inventory:itemCreated',
        expect.any(Object)
      );
    });

    it('should not create item with duplicate code', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      // Create first item
      await new InventoryItem(itemData).save();

      // Try to create duplicate
      const response = await request(app)
        .post('/api/inventory/items')
        .set('Authorization', `Bearer ${token}`)
        .send(itemData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Item code already exists');
    });
  });

  describe('PUT /api/inventory/items/:id', () => {
    let item: any;

    beforeEach(async () => {
      item = await new InventoryItem(itemData).save();
    });

    it('should update item details', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      const updateData = {
        name: 'Premium Bath Towel',
        unitCost: 600
      };

      const response = await request(app)
        .put(`/api/inventory/items/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.unitCost).toBe(updateData.unitCost);

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'inventory',
        'inventory:itemUpdated',
        expect.any(Object)
      );
    });

    it('should trigger low stock alert', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      const response = await request(app)
        .put(`/api/inventory/items/${item.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentStock: 15 // Below minimum stock
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.currentStock).toBe(15);

      // Verify alerts were sent
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'inventory',
        'inventory:lowStock',
        expect.any(Object)
      );
      expect(mockEmailService.sendInventoryAlert).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/inventory/items/:id', () => {
    it('should delete item (admin only)', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      const item = await new InventoryItem(itemData).save();

      const response = await request(app)
        .delete(`/api/inventory/items/${item.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify item was deleted
      const deletedItem = await InventoryItem.findById(item.id);
      expect(deletedItem).toBeNull();

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'inventory',
        'inventory:itemDeleted',
        item.id
      );
    });

    it('should not allow non-admin to delete item', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const item = await new InventoryItem(itemData).save();

      const response = await request(app)
        .delete(`/api/inventory/items/${item.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/inventory/items/:id/movement', () => {
    let item: any;

    beforeEach(async () => {
      item = await new InventoryItem(itemData).save();
    });

    it('should add stock movement', async () => {
      const { token, user } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const movement = {
        type: 'in',
        quantity: 50,
        reference: 'PO123',
        notes: 'Stock replenishment'
      };

      const response = await request(app)
        .post(`/api/inventory/items/${item.id}/movement`)
        .set('Authorization', `Bearer ${token}`)
        .send(movement);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.currentStock).toBe(150); // 100 + 50

      // Verify movement was recorded
      expect(response.body.data.stockMovements).toHaveLength(1);
      expect(response.body.data.stockMovements[0].type).toBe('in');
      expect(response.body.data.stockMovements[0].quantity).toBe(50);
      expect(response.body.data.stockMovements[0].performedBy.toString()).toBe(user.id);

      // Verify socket event was emitted
      expect(mockSocketService.emitToRoom).toHaveBeenCalledWith(
        'inventory',
        'inventory:stockMovement',
        expect.any(Object)
      );
    });

    it('should prevent stock going negative', async () => {
      const { token } = await getTestUserWithToken(UserRole.HOUSEKEEPING);

      const movement = {
        type: 'out',
        quantity: 150,
        reference: 'REQ123',
        notes: 'Room supplies'
      };

      const response = await request(app)
        .post(`/api/inventory/items/${item.id}/movement`)
        .set('Authorization', `Bearer ${token}`)
        .send(movement);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient stock');
    });
  });

  describe('GET /api/inventory/low-stock', () => {
    beforeEach(async () => {
      // Create some items
      await new InventoryItem({
        code: 'INV001',
        name: 'Item 1',
        category: InventoryCategory.HOUSEKEEPING,
        unit: 'box',
        currentStock: 50,
        minimumStock: 10,
        maximumStock: 100,
        unitCost: 500
      }).save();

      await new InventoryItem({
        code: 'INV002',
        name: 'Item 2',
        category: InventoryCategory.MAINTENANCE,
        unit: 'piece',
        currentStock: 10,
        minimumStock: 5,
        maximumStock: 30,
        unitCost: 1000
      }).save();

      await new InventoryItem({
        ...itemData,
        code: 'HSK002',
        name: 'Hand Towel',
        currentStock: 15, // Below minimum stock
      }).save();
      await new InventoryItem({
        ...itemData,
        code: 'HSK003',
        name: 'Bath Mat',
        currentStock: 0,
      }).save();
    });

    it('should get low stock items', async () => {
      const { token } = await getTestUserWithToken(UserRole.SUPER_ADMIN);

      const response = await request(app)
        .get('/api/inventory/low-stock')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Low stock and out of stock items
    });
  });
});
