import express from 'express';
import {
  getAuditLogs,
  createAuditLog,
  getAuditStats
} from '../controllers/audit.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// =====================================================
// AUDIT LOGS ROUTES
// =====================================================

router.route('/logs')
  .get(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), getAuditLogs)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]), createAuditLog);

router.get('/stats',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  getAuditStats
);

export default router;
