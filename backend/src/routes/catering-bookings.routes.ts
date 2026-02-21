import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  getCateringBookings,
  getCateringBookingById,
  createCateringBooking,
  updateCateringBooking,
  cancelCateringBooking,
  deleteCateringBooking,
  recordCateringPayment,
  getCateringCalendar,
  getCateringStatistics
} from '../controllers/catering-bookings.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Catering bookings routes
router.get('/', authorize('receptionist', 'branch_manager', 'super_admin'), getCateringBookings);
router.get('/calendar', authorize('receptionist', 'branch_manager', 'super_admin'), getCateringCalendar);
router.get('/statistics', authorize('branch_manager', 'super_admin', 'accountant'), getCateringStatistics);
router.get('/:id', authorize('receptionist', 'branch_manager', 'super_admin'), getCateringBookingById);
router.post('/', authorize('receptionist', 'branch_manager', 'super_admin'), createCateringBooking);
router.put('/:id', authorize('receptionist', 'branch_manager', 'super_admin'), updateCateringBooking);
router.post('/:id/cancel', authorize('receptionist', 'branch_manager', 'super_admin'), cancelCateringBooking);
router.delete('/:id', authorize('super_admin'), deleteCateringBooking);

// Payment routes
router.post('/:id/payment', authorize('receptionist', 'cashier', 'branch_manager', 'super_admin'), recordCateringPayment);

export default router;
