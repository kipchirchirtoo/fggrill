import { Router } from 'express';
import {
    getVoidBills,
    reviewVoidBill
} from '../controllers/void-bills.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(protect);

// ==========================================
// VOID BILLS AUDIT
// ==========================================
router.get('/void-bills', authorize([UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT]), getVoidBills);
router.put('/void-bills/:id/review', authorize([UserRole.SUPER_ADMIN, UserRole.AUDITOR]), reviewVoidBill);

export default router;
