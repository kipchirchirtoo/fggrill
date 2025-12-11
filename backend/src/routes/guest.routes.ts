import express from 'express';
import {
  getGuests,
  getGuest,
  createGuest,
  updateGuest,
  deleteGuest,
  updateGuestPreferences,
  getGuestHistory,
  getGuestLoyalty,
  updateLoyaltyPoints,
  getVIPGuests
} from '../controllers/guest.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Protected routes
router.use(protect);

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

router.delete('/:id',
  authorize([UserRole.SUPER_ADMIN]),
  deleteGuest
);

// VIP Guests
router.get('/vip/list',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  getVIPGuests
);

// Guest History
router.get('/:id/history',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  getGuestHistory
);

// Guest Loyalty
router.get('/:id/loyalty',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  getGuestLoyalty
);

router.post('/:id/loyalty/points',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  updateLoyaltyPoints
);

export default router;
