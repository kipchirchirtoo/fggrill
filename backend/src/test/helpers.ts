import jwt from 'jsonwebtoken';
import { User, UserRole } from '../models/User';
import { Room, RoomType, RoomStatus } from '../models/Room';
import { InventoryItem, InventoryCategory } from '../models/Inventory';

// Create test user
export const createTestUser = async (
  role: UserRole = UserRole.EMPLOYEE,
  override = {}
) => {
  const user = new User({
    firstName: 'Test',
    lastName: 'User',
    email: `test${Date.now()}@example.com`,
    password: 'password123',
    role,
    employeeId: `EMP${Date.now()}`,
    department: 'Test Department',
    position: 'Test Position',
    phoneNumber: '+254712345678',
    status: 'active',
    joinDate: new Date(),
    ...override
  });

  return user;
};

// Create test room
export const createTestRoom = async (
  type: RoomType = RoomType.STANDARD,
  override = {}
) => {
  const room = new Room({
    roomNumber: `${Math.floor(Math.random() * 999) + 100}`,
    type,
    floor: Math.floor(Math.random() * 5) + 1,
    status: RoomStatus.AVAILABLE,
    basePrice: 5000,
    currentPrice: 5000,
    maxOccupancy: 2,
    bedConfiguration: {
      single: 2,
      double: 0,
      queen: 0,
      king: 0
    },
    squareMeters: 25,
    amenities: ['WiFi', 'TV', 'AC'],
    description: 'Test room',
    accessible: false,
    smoking: false,
    maintenanceHistory: [],
    cleaningSchedule: {},
    occupancyHistory: [],
    ratings: {
      cleanliness: 0,
      comfort: 0,
      location: 0,
      services: 0,
      staff: 0,
      valueForMoney: 0,
      count: 0
    },
    reviews: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...override
  });

  return room;
};

// Create test inventory item
export const createTestInventoryItem = async (
  category: InventoryCategory = InventoryCategory.HOUSEKEEPING,
  override = {}
) => {
  const item = new InventoryItem({
    code: `TEST${Date.now()}`,
    name: 'Test Item',
    category,
    unit: 'piece',
    currentStock: 100,
    minimumStock: 20,
    maximumStock: 200,
    unitCost: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...override
  });

  return item;
};

// Generate auth token
export const generateAuthToken = (userId: string, role: UserRole) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );
};

// Get auth header
export const getAuthHeader = (token: string) => ({
  Authorization: `Bearer ${token}`
});

// Get test user with token
export const getTestUserWithToken = async (role: UserRole = UserRole.EMPLOYEE) => {
  const user = await createTestUser(role);
  const token = generateAuthToken(user.id, role);
  return { user, token };
};
