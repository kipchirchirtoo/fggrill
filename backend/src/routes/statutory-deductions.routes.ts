import { Router } from 'express';
import { authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import * as statutoryController from '../controllers/statutory-deductions.controller';

const router = Router();

// Branch Accountants, Managers, and Super Admins can manage these
router.get('/', authorize([
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_OPERATIONS_MANAGER,
    UserRole.HR_MANAGER,
    UserRole.SUPER_ADMIN
]), statutoryController.getMonthlyDeductions);

router.post('/', authorize([
    UserRole.BRANCH_ACCOUNTANT,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_OPERATIONS_MANAGER,
    UserRole.SUPER_ADMIN
]), statutoryController.createOrUpdateDeductions);

export default router;
