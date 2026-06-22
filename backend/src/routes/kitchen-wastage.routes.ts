import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
    listWastageAlerts,
    acknowledgeWastageAlert,
    getWastageReport,
    getWastageThresholdsConfig,
    updateWastageThresholdsConfig
} from '../controllers/kitchen/kitchen-wastage.controller';

const router = express.Router();
router.use(protect);

const KITCHEN_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_STOREKEEPER,
    UserRole.STOREKEEPER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.HEAD_CHEF,
    UserRole.SOUS_CHEF,
    UserRole.LINE_COOK,
    UserRole.KITCHEN,
    UserRole.KITCHEN_OPERATIONS,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR
];
const MANAGER_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.HEAD_CHEF,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.AUDITOR
];
const THRESHOLD_WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT];

// Must come before '/thresholds/:branchId' route registration order doesn't
// matter here since the segment counts differ, but kept grouped for clarity.
router.get('/alerts', authorize(KITCHEN_ROLES), listWastageAlerts);
router.patch('/alerts/:id/acknowledge', authorize(KITCHEN_ROLES), acknowledgeWastageAlert);
router.get('/report', authorize(MANAGER_ROLES), getWastageReport);
router.get('/thresholds/:branchId', authorize(MANAGER_ROLES), getWastageThresholdsConfig);
router.put('/thresholds/:branchId', authorize(THRESHOLD_WRITE_ROLES), updateWastageThresholdsConfig);

export default router;
