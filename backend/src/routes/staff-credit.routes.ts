import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
    getLimits,
    setLimit,
    addBill,
    getBills,
    approveBill
} from '../controllers/staff-credit.controller';

const router = express.Router();

router.use(protect);

router
    .route('/limits')
    .get(authorize([UserRole.AUDITOR, UserRole.HR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]), getLimits)
    .post(authorize([UserRole.AUDITOR, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), setLimit);

router
    .route('/bills')
    .get(authorize([UserRole.AUDITOR, UserRole.HR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.CASHIER]), getBills)
    .post(authorize([UserRole.GENERAL_MANAGER, UserRole.CASHIER, UserRole.SUPER_ADMIN]), addBill);

router
    .route('/bills/:id/approve')
    .put(authorize([UserRole.AUDITOR, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]), approveBill);

export default router;
