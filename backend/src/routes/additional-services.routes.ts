import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getServiceBookings,
  getServiceBookingById,
  createServiceBooking,
  updateServiceBooking,
  confirmServiceBooking,
  completeServiceBooking,
  cancelServiceBooking,
  recordServicePayment,
  getServiceStats
} from '../controllers/additional-services.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Additional Services Management
router.route('/services')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER]),
    getServices
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]),
    createService
  );

router.route('/services/:id')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER]),
    getServiceById
  )
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]),
    updateService
  )
  .delete(
    authorize([UserRole.SUPER_ADMIN]),
    deleteService
  );

// Service Bookings
router.route('/bookings')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER]),
    getServiceBookings
  )
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER]),
    createServiceBooking
  );

router.route('/bookings/:id')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER]),
    getServiceBookingById
  )
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER]),
    updateServiceBooking
  );

router.route('/bookings/:id/confirm')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]),
    confirmServiceBooking
  );

router.route('/bookings/:id/complete')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER]),
    completeServiceBooking
  );

router.route('/bookings/:id/cancel')
  .patch(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]),
    cancelServiceBooking
  );

router.route('/bookings/:id/payment')
  .post(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER]),
    recordServicePayment
  );

// Service Stats
router.route('/stats')
  .get(
    authorize([UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.CASHIER]),
    getServiceStats
  );

export default router;
