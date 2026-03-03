import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import * as performanceController from '../controllers/performance.controller';

const router = Router();

// Apply authentication to all routes in this file
router.use(protect);

router.get(
    '/staff-metrics',
    authorize([UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
    performanceController.getStaffPerformance
);

export default router;
