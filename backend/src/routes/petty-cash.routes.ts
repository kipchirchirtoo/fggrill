import express from 'express';
import {
    getPettyCashTransactions,
    requestPettyCash,
    updatePettyCashStatus
} from '../controllers/petty-cash.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

router.get('/', getPettyCashTransactions);
router.post('/', requestPettyCash);
router.patch('/:id/status', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]), updatePettyCashStatus);

export default router;
