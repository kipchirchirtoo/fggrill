import express from 'express';
import {
  getBookings,
  getBooking,
  createBooking,
  processPayment,
  cancelBooking,
  checkInBooking
} from '../controllers/booking.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Public routes
router.get('/', getBookings);
router.get('/:id', getBooking);

// Protected routes
router.use(protect);

// Staff routes (Admin, Manager, Receptionist)
router.post('/', 
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  createBooking
);

router.post('/:id/payment',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT]),
  processPayment
);

router.post('/:id/cancel',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  cancelBooking
);

router.post('/:id/check-in',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  checkInBooking
);

export default router;
