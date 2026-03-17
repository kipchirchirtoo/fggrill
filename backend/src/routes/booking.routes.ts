import express from 'express';
import {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  getAvailableRooms,
  checkAvailability,
  getPricingQuote,
  modifyBooking,
  getBookingByConfirmation
} from '../controllers/booking.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Public routes
router.get('/available', getAvailableRooms);
router.get('/check-availability', checkAvailability);
router.post('/quote', getPricingQuote);
router.get('/confirmation/:confirmationNumber', getBookingByConfirmation);
router.post('/', createBooking);

// Protected routes
router.use(protect);

router.get('/', getBookings);
router.get('/:id', getBooking);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]),
  updateBooking
);

router.put('/:id/check-in',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]),
  checkInBooking
);

router.put('/:id/check-out',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]),
  checkOutBooking
);

router.put('/:id/cancel',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]),
  cancelBooking
);

router.put('/:id/modify',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER]),
  modifyBooking
);

export default router;
