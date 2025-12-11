import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
  getChannels,
  getSyncStatus,
  configureChannel,
  toggleChannel,
  pushAvailability,
  pushRates,
  pullBookings,
  syncAllChannels,
  importBooking,
} from '../controllers/channelManager.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin/Manager only routes
const managerRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER];

// Get all channels and sync status
router.get('/', getChannels);
router.get('/status', getSyncStatus);

// Channel configuration - admin only
router.put('/:channelId/configure', authorize(managerRoles), configureChannel);
router.patch('/:channelId/toggle', authorize(managerRoles), toggleChannel);

// Sync operations
router.post('/:channelId/push-availability', authorize(managerRoles), pushAvailability);
router.post('/:channelId/push-rates', authorize(managerRoles), pushRates);
router.post('/:channelId/pull-bookings', authorize(managerRoles), pullBookings);

// Sync all channels
router.post('/sync-all', authorize(managerRoles), syncAllChannels);

// Import booking from channel
router.post('/import-booking', authorize(managerRoles), importBooking);

export default router;
