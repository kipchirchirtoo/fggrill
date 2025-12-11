import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
  sendBookingConfirmation,
  sendCheckInReminder,
  sendInvoice,
  sendCustomEmail,
  sendCustomSMS,
  sendBulkSMS,
  getMessageLog,
  healthCheck,
} from '../controllers/communication.controller';

const router = express.Router();

// Health check (public)
router.get('/health', healthCheck);

// Protected routes - require authentication
router.use(protect);

// Booking-related communications
router.post('/booking-confirmation', sendBookingConfirmation);
router.post('/check-in-reminder', sendCheckInReminder);
router.post('/invoice', sendInvoice);

// Custom communications
router.post('/email', sendCustomEmail);
router.post('/sms', sendCustomSMS);

// Bulk SMS - admin/manager only
router.post('/sms/bulk', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), sendBulkSMS);

// Message log - admin/manager only
router.get('/log', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), getMessageLog);

export default router;
