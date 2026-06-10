import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import * as ctrl from '../controllers/branch-search.controller';

const router = Router();
router.use(protect);

// Branch-strict universal search is for branch leadership / finance roles.
// Branch isolation is enforced inside the controller (non-global roles are
// pinned to their own branch_id).
const ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.FINANCE_MANAGER,
  UserRole.AUDITOR,
];
router.use(authorize(ROLES));

router.get('/', ctrl.search);
router.get('/types', ctrl.listTypes);
router.get('/:type/:id', ctrl.getDetail);
router.post('/:type', ctrl.createDetail);
router.put('/:type/:id', ctrl.updateDetail);
router.delete('/:type/:id', ctrl.deleteDetail);

export default router;
