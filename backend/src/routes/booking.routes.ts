import express from 'express';
import {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  getAvailableRooms
} from '../controllers/booking.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Public routes
router.get('/available', getAvailableRooms);
router.post('/', createBooking);

// Protected routes
router.use(protect);

router.get('/', getBookings);
router.get('/:id', getBooking);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  updateBooking
);

router.put('/:id/check-in',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  checkInBooking
);

router.put('/:id/check-out',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  checkOutBooking
);

router.put('/:id/cancel',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  cancelBooking
);

export default router;
