import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
    getBranchConfig,
    updateBranchConfig,
    getAllBranchConfigs
} from '../controllers/branchFoodControlConfig.controller';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Branch-specific config (managers and accountants)
router.get('/:branchId', authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.AUDITOR
]), getBranchConfig);

router.put('/:branchId', authorize([
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER
]), updateBranchConfig);

// All configs (admin only)
router.get('/', authorize([
    UserRole.SUPER_ADMIN,
    UserRole.AUDITOR
]), getAllBranchConfigs);

export default router;
