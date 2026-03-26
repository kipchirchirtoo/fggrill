import { Router } from 'express';
import * as PolicyController from '../controllers/policy.controller';
import { protect, authorize, UserRole } from '../middleware/auth';

const router = Router();

router.use(protect);
router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT, UserRole.HR_MANAGER, UserRole.AUDITOR]));

router
  .route('/')
  .get(PolicyController.getPolicies)
  .post(PolicyController.createPolicy);

router
  .route('/:id')
  .put(PolicyController.updatePolicy)
  .delete(PolicyController.deletePolicy);

export default router;
