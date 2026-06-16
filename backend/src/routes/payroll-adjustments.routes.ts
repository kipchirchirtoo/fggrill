import { Router } from 'express';
import { authorize, protect } from '../middleware/auth';
import { UserRole } from '../models/User';
import * as adjustmentsController from '../controllers/payroll-adjustments.controller';

const router = Router();
const adjustmentRoles = [
    UserRole.HR_MANAGER,
    UserRole.SUPER_ADMIN,
    UserRole.AUDITOR,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_ACCOUNTANT,
];

// Protect all routes in this file
router.use(protect);

// Only HR Manager, Super Admin, and Auditor can view adjustments
router.get('/', authorize(adjustmentRoles), adjustmentsController.getAdjustments);

// Only HR Manager, Super Admin, and Auditor can create/void adjustments
router.post('/', authorize(adjustmentRoles), adjustmentsController.createAdjustment);
router.patch('/:id/approve', authorize(adjustmentRoles), adjustmentsController.approveAdjustment);
router.patch('/:id/reject', authorize(adjustmentRoles), adjustmentsController.rejectAdjustment);
router.patch('/:id/void', authorize(adjustmentRoles), adjustmentsController.voidAdjustment);
router.post('/:id/void', authorize(adjustmentRoles), adjustmentsController.voidAdjustment);

export default router;
