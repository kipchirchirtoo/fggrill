import express from 'express';
import {
    getCateringBookings,
    createCateringBooking,
    updateCateringStatus
} from '../controllers/catering.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Protected routes
router.use(protect);

router.get('/bookings', getCateringBookings);
router.post('/bookings', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.RESTAURANT]), createCateringBooking);
router.patch('/bookings/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.RESTAURANT]), updateCateringStatus);

export default router;
