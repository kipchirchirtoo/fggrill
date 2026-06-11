import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import * as ctrl from '../controllers/branch-payments.controller';

const router = Router();
router.use(protect);

// Who can see payments (auditor + leadership are read-only viewers here).
const VIEW_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.FINANCE_MANAGER,
  UserRole.AUDITOR,
];
// Maker (initiates the payment).
const INITIATE_ROLES = [UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN];
// Checker (approve/reject).
const APPROVE_ROLES = [
  UserRole.BRANCH_MANAGER,
  UserRole.GENERAL_MANAGER,
  UserRole.FINANCE_MANAGER,
  UserRole.DIRECTOR,
  UserRole.SUPER_ADMIN,
];
// Treasury release.
const RELEASE_ROLES = [
  UserRole.FINANCE_MANAGER,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.SUPER_ADMIN,
];

router.get('/', authorize(VIEW_ROLES), ctrl.listPayments);
router.get('/:id', authorize(VIEW_ROLES), ctrl.getPayment);
router.post('/', authorize(INITIATE_ROLES), ctrl.createPayment);
router.put('/:id/approve', authorize(APPROVE_ROLES), ctrl.approvePayment);
router.put('/:id/reject', authorize(APPROVE_ROLES), ctrl.rejectPayment);
router.put('/:id/release', authorize(RELEASE_ROLES), ctrl.releasePayment);

export default router;
