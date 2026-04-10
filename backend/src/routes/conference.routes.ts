import express from 'express';
import {
    getHalls,
    createHall,
    updateHall,
    getConferenceBookings,
    createConferenceBooking,
    updateConferenceBookingStatus,
    getBookingInvoice,
    addConferencePayment,
    checkHallAvailability,
    autoUpdateHallStatuses
} from '../controllers/conference.controller';

import {
    recordDailyAttendance,
    getDailyAttendance,
    generateInvoiceWithAttendance,
    deleteDailyAttendance
} from '../controllers/conference-attendance.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Protected routes
router.use(protect);

// Halls management
router.get('/halls', getHalls);
router.get('/halls/:id/availability', checkHallAvailability);
router.post('/halls', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), createHall);
router.patch('/halls/:id', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), updateHall);
router.post('/halls/auto-update-status', autoUpdateHallStatuses);

// Bookings management
router.get('/bookings', getConferenceBookings);
router.get('/bookings/by-invoice/:invoice_number', getConferenceBookings); // Lookup by invoice number
router.post('/bookings', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), createConferenceBooking);
router.patch('/bookings/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]), updateConferenceBookingStatus);
router.get('/bookings/:id/invoice', getBookingInvoice);
router.post('/bookings/:id/payments', addConferencePayment);

// Daily attendance routes
router.post('/bookings/:id/attendance', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), recordDailyAttendance);
router.get('/bookings/:id/attendance', getDailyAttendance);
router.get('/bookings/:id/invoice-with-attendance', authorize([UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT]), generateInvoiceWithAttendance);
router.delete('/bookings/:id/attendance/:date', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), deleteDailyAttendance);

export default router;
