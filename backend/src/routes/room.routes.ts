import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
  getRooms,
  getRoom,
  getRoomBookings,
  createRoom,
  updateRoom,
  deleteRoom,
  updateRoomStatus,
  getRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType
} from '../controllers/room.controller';

const router = express.Router();

// Public routes
router.get('/types', getRoomTypes);

// Protected routes
router.use(protect);

// Room Type CRUD
router.post('/types', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), createRoomType);
router.put('/types/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), updateRoomType);
router.delete('/types/:id', authorize([UserRole.SUPER_ADMIN]), deleteRoomType);

router.get('/', getRooms);
router.get('/:id/bookings', getRoomBookings);
router.get('/:id', getRoom);

// Admin and Manager routes
router.post('/', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), createRoom);
router.put('/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), updateRoom);
router.delete('/:id', authorize([UserRole.SUPER_ADMIN]), deleteRoom);

// Admin, Manager, and Housekeeping routes
router.patch(
  '/:id/status',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HOUSEKEEPING, UserRole.RECEPTIONIST]),
  updateRoomStatus
);

export default router;
