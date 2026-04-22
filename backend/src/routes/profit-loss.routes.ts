import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
    getProfitLossStatement,
    getExpenseBreakdown
} from '../controllers/profit-loss.controller';

const router = express.Router();

// All routes require authentication and specific roles
router.use(protect);
router.use(authorize('branch_manager', 'auditor', 'super_admin', 'general_manager'));

// Get profit & loss statement
router.get('/profit-loss', getProfitLossStatement);

// Get expense breakdown
router.get('/expense-breakdown', getExpenseBreakdown);

export default router;
