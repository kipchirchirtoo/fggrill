import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
    getRevenueOversight,
    getRevenueTargets,
    getRevenueOverview
} from '../controllers/revenue-oversight.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Revenue overview (for dashboard widgets)
router.get(
    '/revenue-overview',
    authorize([
        UserRole.BRANCH_ACCOUNTANT,
        UserRole.BRANCH_MANAGER,
        UserRole.ACCOUNTANT,
        UserRole.AUDITOR,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER
    ]),
    getRevenueOverview
);

// Revenue oversight routes
router.get(
    '/revenue-oversight',
    authorize([
        UserRole.BRANCH_ACCOUNTANT,
        UserRole.BRANCH_MANAGER,
        UserRole.ACCOUNTANT,
        UserRole.AUDITOR,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER
    ]),
    getRevenueOversight
);

router.get(
    '/targets',
    authorize([
        UserRole.BRANCH_ACCOUNTANT,
        UserRole.BRANCH_MANAGER,
        UserRole.ACCOUNTANT,
        UserRole.AUDITOR,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER
    ]),
    getRevenueTargets
);

export default router;
