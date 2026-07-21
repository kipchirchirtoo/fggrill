import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import * as ctrl from '../controllers/menu-pricing.controller';

const router = Router();
router.use(protect);

// Reads (pricing matrix + profitability) are available to leadership / finance
// roles so the branch accountant analysis and director module can consume them.
const READ_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.FINANCE_MANAGER,
  UserRole.AUDITOR,
];

// SuperAdmin and branch accountants can edit cost / selling prices.
const WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.BRANCH_ACCOUNTANT];

router.get('/branch/:branchId', authorize(READ_ROLES), ctrl.getBranchMenuPricing);
router.get('/branch/:branchId/profitability', authorize(READ_ROLES), ctrl.getBranchMenuProfitability);

router.put('/branch/:branchId/item', authorize(WRITE_ROLES), ctrl.upsertBranchItemPricing);
router.put('/branch/:branchId/bulk', authorize(WRITE_ROLES), ctrl.bulkUpsertBranchPricing);
router.delete('/branch/:branchId/item/:itemType/:itemId', authorize(WRITE_ROLES), ctrl.deleteBranchItemPricing);

export default router;
