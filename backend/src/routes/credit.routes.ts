import { Router } from 'express';
import { confirmCreditBill, getPendingConfirmations } from '../controllers/credit.controller';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.use(protect);

// Confirmations
router.put('/:type/:id/confirm', authorize('accountant', 'auditor', 'super_admin'), confirmCreditBill);

// Pending Lists
router.get('/pending/:role', authorize('accountant', 'auditor', 'super_admin'), getPendingConfirmations);

export default router;
