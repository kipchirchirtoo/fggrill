/**
 * Shift P&L Routes
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  generatePnL,
  getPnL,
  getPnLs,
  submitPnL,
  reviewPnL,
  approvePnL,
  getBranchSummary,
  getFoodCostTrendData
} from '../controllers/shiftPnL.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// P&L generation and retrieval
router.post('/generate/:shiftId', generatePnL);

// P&L workflow
router.post('/:shiftId/submit', submitPnL);
router.post('/:shiftId/review', reviewPnL);
router.post('/:shiftId/approve', approvePnL);

// Reports and analytics
router.get('/summary', getBranchSummary);
router.get('/summary/branch', getBranchSummary);
router.get('/food-cost-trend', getFoodCostTrendData);
router.get('/', getPnLs);
router.get('/:shiftId', getPnL);

export default router;
