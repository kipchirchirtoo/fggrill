import express from 'express';
import {
  getGuests,
  getGuest,
  createGuest,
  updateGuest,
  deleteGuest,
  updateGuestPreferences
} from '../controllers/guest.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Protected routes
router.use(protect);

// Staff routes (Admin, Manager, Receptionist)
router.get('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  getGuests
);

router.get('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  getGuest
);

router.post('/',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  createGuest
);

router.put('/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  updateGuest
);

router.put('/:id/preferences',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  updateGuestPreferences
);

// Admin only routes
router.delete('/:id',
  authorize([UserRole.SUPER_ADMIN]),
  deleteGuest
);

export default router;
