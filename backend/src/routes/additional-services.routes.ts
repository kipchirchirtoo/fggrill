import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
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
    authorize(['super_admin', 'branch_manager', 'receptionist', 'cashier']),
    getServices
  )
  .post(
    authorize(['super_admin', 'branch_manager']),
    createService
  );

router.route('/services/:id')
  .get(
    authorize(['super_admin', 'branch_manager', 'receptionist', 'cashier']),
    getServiceById
  )
  .patch(
    authorize(['super_admin', 'branch_manager']),
    updateService
  )
  .delete(
    authorize(['super_admin']),
    deleteService
  );

// Service Bookings
router.route('/bookings')
  .get(
    authorize(['super_admin', 'branch_manager', 'receptionist', 'cashier']),
    getServiceBookings
  )
  .post(
    authorize(['super_admin', 'branch_manager', 'receptionist', 'cashier']),
    createServiceBooking
  );

router.route('/bookings/:id')
  .get(
    authorize(['super_admin', 'branch_manager', 'receptionist', 'cashier']),
    getServiceBookingById
  )
  .patch(
    authorize(['super_admin', 'branch_manager', 'receptionist', 'cashier']),
    updateServiceBooking
  );

router.route('/bookings/:id/confirm')
  .patch(
    authorize(['super_admin', 'branch_manager', 'receptionist']),
    confirmServiceBooking
  );

router.route('/bookings/:id/complete')
  .patch(
    authorize(['super_admin', 'branch_manager', 'receptionist', 'cashier']),
    completeServiceBooking
  );

router.route('/bookings/:id/cancel')
  .patch(
    authorize(['super_admin', 'branch_manager', 'receptionist']),
    cancelServiceBooking
  );

router.route('/bookings/:id/payment')
  .post(
    authorize(['super_admin', 'branch_manager', 'receptionist', 'cashier']),
    recordServicePayment
  );

// Service Stats
router.route('/stats')
  .get(
    authorize(['super_admin', 'branch_manager', 'receptionist', 'cashier']),
    getServiceStats
  );

export default router;
