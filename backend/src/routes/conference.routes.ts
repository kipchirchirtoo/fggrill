import express from 'express';
import {
    getHalls,
    createHall,
    getConferenceBookings,
    createConferenceBooking,
    updateConferenceBookingStatus
} from '../controllers/conference.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Protected routes
router.use(protect);

// Halls management
router.get('/halls', getHalls);
router.post('/halls', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), createHall);

// Bookings management
router.get('/bookings', getConferenceBookings);
router.post('/bookings', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), createConferenceBooking);
router.patch('/bookings/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), updateConferenceBookingStatus);

export default router;
