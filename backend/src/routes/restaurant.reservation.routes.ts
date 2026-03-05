import express from 'express';
import {
  getReservations,
  getReservationById,
  createReservation,
  updateReservation,
  confirmReservation,
  seatReservation,
  cancelReservation,
  markNoShow,
  checkAvailability
} from '../controllers/restaurant.reservation.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Public route for checking availability
router.get('/availability', checkAvailability);

// All other routes require authentication
router.use(protect);

router.get('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT]),
  getReservations
);

router.get('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST, UserRole.BRANCH_ACCOUNTANT]),
  getReservationById
);

router.post('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.RECEPTIONIST]),
  createReservation
);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  updateReservation
);

router.put('/:id/confirm',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  confirmReservation
);

router.put('/:id/seat',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  seatReservation
);

router.put('/:id/cancel',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  cancelReservation
);

router.put('/:id/no-show',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]),
  markNoShow
);

export default router;
