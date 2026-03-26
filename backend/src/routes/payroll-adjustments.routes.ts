import { Router } from 'express';
import { authorize, protect } from '../middleware/auth';
import { UserRole } from '../models/User';
import * as adjustmentsController from '../controllers/payroll-adjustments.controller';

const router = Router();

// Protect all routes in this file
router.use(protect);

// Only HR Manager, Super Admin, and Auditor can view adjustments
router.get('/', authorize([UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]), adjustmentsController.getAdjustments);

// Only HR Manager, Super Admin, and Auditor can create/void adjustments
router.post('/', authorize([UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]), adjustmentsController.createAdjustment);
router.patch('/:id/void', authorize([UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]), adjustmentsController.voidAdjustment);
router.post('/:id/void', authorize([UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]), adjustmentsController.voidAdjustment);

export default router;
