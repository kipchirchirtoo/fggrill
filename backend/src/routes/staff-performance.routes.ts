import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
    getStaffPerformance,
    getStaffKPIs,
    getPerformanceLeaderboard,
    getOverallPerformance
} from '../controllers/staff-performance.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Staff performance list (main endpoint)
router.get(
    '/',
    authorize([
        UserRole.BRANCH_MANAGER,
        UserRole.HR_MANAGER,
        UserRole.AUDITOR,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER
    ]),
    getStaffPerformance
);

// Performance leaderboard
router.get(
    '/leaderboard',
    authorize([
        UserRole.BRANCH_MANAGER,
        UserRole.HR_MANAGER,
        UserRole.AUDITOR,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER
    ]),
    getPerformanceLeaderboard
);

export default router;
