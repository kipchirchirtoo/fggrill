import express from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
    getWaiterSales,
    getWaiterPerformance
} from '../controllers/waiter-sales.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Waiter sales routes — mounted at /api/waiter-sales in routes/index.ts,
// so paths here are relative to that mount point.
router.get(
    '/',
    authorize([
        UserRole.BRANCH_MANAGER,
        UserRole.RESTAURANT_MANAGER,
        UserRole.AUDITOR,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER
    ]),
    getWaiterSales
);

router.get(
    '/waiter/:id/performance',
    authorize([
        UserRole.BRANCH_MANAGER,
        UserRole.RESTAURANT_MANAGER,
        UserRole.AUDITOR,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER
    ]),
    getWaiterPerformance
);

export default router;
