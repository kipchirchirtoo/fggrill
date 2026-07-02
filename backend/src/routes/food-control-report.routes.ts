import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import {
  exportFoodControlReport,
  getFoodControlReport,
} from '../controllers/food-control-report.controller';

const router = Router();

// IMPORTANT: middleware is attached per-route (not router.use) because this
// router is mounted at /branches alongside branch-health.routes — router.use
// middleware would otherwise run for every /branches/* request that merely
// passes through on its way to the other router.
const REPORT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.FINANCE_MANAGER,
  UserRole.AUDITOR,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.CENTRAL_STOREKEEPER,
];

router.get(
  '/:branchId/food-control-report',
  protect,
  authorize(REPORT_ROLES),
  getFoodControlReport
);
router.get(
  '/:branchId/food-control-report/export',
  protect,
  authorize(REPORT_ROLES),
  exportFoodControlReport
);

export default router;
