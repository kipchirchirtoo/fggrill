import express from 'express';
import {
  sendTestEmail,
  sendWelcomeEmail,
  sendBookingConfirmationEmail,
  sendMaintenanceAlertEmail,
  sendInventoryAlertEmail,
  sendPasswordResetEmail,
  getEmailServiceStatus
} from '../controllers/email.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Public routes
router.post('/password-reset', sendPasswordResetEmail);

// Protected routes
router.use(protect);

// Admin only routes
router.get('/status', 
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), 
  getEmailServiceStatus
);

router.post('/test', 
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), 
  sendTestEmail
);

// Staff management routes
router.post('/welcome',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]),
  sendWelcomeEmail
);

// Booking related routes
router.post('/booking-confirmation',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST]),
  sendBookingConfirmationEmail
);

// Maintenance routes
router.post('/maintenance-alert',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.MAINTENANCE]),
  sendMaintenanceAlertEmail
);

// Inventory routes
router.post('/inventory-alert',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]),
  sendInventoryAlertEmail
);

export default router;
